// Agente de Render — núcleo.
//
// O agente roda no computador do usuário, em segundo plano, e executa SOMENTE
// pedidos explícitos deixados em `.reels-engine/pedidos/` (arquivos JSON).
// Operações possíveis (lista fechada — nada vindo de texto vira comando):
//
//   render    → roda o render OFICIAL (scripts/render.mjs <slug> --version vNN)
//   verificar → não executa nada: responde com o diagnóstico do agente
//
// Regras (docs/12-AUTOMACAO.md, seção "Agente de Render"):
//  1. Sem pedido válido, nada acontece. Projetos existirem não dispara nada.
//  2. render exige: slug + versão no pedido, GATE_4 "approved",
//     projectVersion == versão, etapa 08_DRY_RUN ou 09_RENDER, MP4 da versão
//     ainda inexistente, projeto fora da lista protegida.
//  3. Cada pedido é consumido UMA vez: sai de pedidos/ ANTES de executar e o id
//     vai para o histórico; id repetido é recusado.
//  4. Nunca altera/sobrescreve/exclui assets, código, renders ou projetos.
//     O único arquivo novo em projects/ é o MP4 do render oficial.
//  5. Erro = registrado e encerrado. Sem nova tentativa automática.
//  6. Todo pedido gera um recibo: projeto, versão, horário, resultado,
//     caminho e tamanho do MP4, SHA-256.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {SLUG_RE} from './lib.mjs';
import {LOCAL_CONFIG, loadLocalConfig} from './local-config.mjs';
import {loadStatus, renderBase} from './status-lib.mjs';

export const AGENT_VERSION = '1.0.0';
export const REQUEST_SCHEMA = 'reels-engine.render-request/1';
export const RECEIPT_SCHEMA = 'reels-engine.render-receipt/1';

/** Pasta do agente (local, fora do Git), relativa à raiz. */
export const AGENT_DIR = '.reels-engine';

/** Projetos que o agente NUNCA toca, mesmo com pedido (sempre protegidos). */
export const BASE_PROTECTED_SLUGS = ['_MOLDE'];

/** Configuração da camada local (opcional; fora do Git). */
export {LOCAL_CONFIG};

/**
 * Lista completa de projetos protegidos: os do motor + os que o usuário
 * declarar em local/config.json → {"agente": {"projetosProtegidos": ["slug", ...]}}.
 * Arquivo ausente = só os do motor. Arquivo inválido (JSON quebrado, campo
 * desconhecido ou campo que tente alterar uma trava do núcleo) = erro:
 * o agente nunca "desprotege" em silêncio.
 */
export const protectedSlugs = (root) => {
  const {config} = loadLocalConfig(root);
  const extra = config.agente?.projetosProtegidos ?? [];
  return [...new Set([...BASE_PROTECTED_SLUGS, ...extra])];
};

/** Etapas em que um render/montagem final pode acontecer. */
export const RENDER_STAGES = ['08_DRY_RUN', '09_RENDER'];

export const OPERATIONS = ['render', 'verificar'];

/** Limite de tempo de um render (depois disso: falha registrada, sem repetir). */
export const RENDER_TIMEOUT_MS = 90 * 60 * 1000;

const ID_RE = /^[a-z0-9][a-z0-9._-]{2,100}$/;
const VERSION_RE = /^v\d{2,3}$/;

const ALLOWED_KEYS = {
  render: ['$schema', 'id', 'operacao', 'slug', 'versao', 'criadoEm', 'criadoPor', 'nota'],
  verificar: ['$schema', 'id', 'operacao', 'criadoEm', 'criadoPor', 'nota'],
};

// ── Pastas do agente ─────────────────────────────────────────────

export const agentPaths = (root) => {
  const base = path.join(root, AGENT_DIR);
  return {
    root,
    base,
    pedidos: path.join(base, 'pedidos'),
    emExecucao: path.join(base, 'em-execucao'),
    concluidos: path.join(base, 'concluidos'),
    falhas: path.join(base, 'falhas'),
    logs: path.join(base, 'logs'),
    tmp: path.join(base, 'tmp'),
    historico: path.join(base, 'historico.jsonl'),
    log: path.join(base, 'agente.log'),
    status: path.join(base, 'agente-status.json'),
    lock: path.join(base, 'agente.lock'),
    projects: path.join(root, 'projects'),
  };
};

export const ensureDirs = (P) => {
  for (const d of [P.pedidos, P.emExecucao, P.concluidos, P.falhas, P.logs, P.tmp]) {
    fs.mkdirSync(d, {recursive: true});
  }
};

const now = () => new Date().toISOString();

export const logLine = (P, msg) => {
  const line = `${now()}  ${msg}`;
  try {
    fs.appendFileSync(P.log, `${line}\n`);
  } catch {
    /* log é best-effort */
  }
  return line;
};

const writeJson = (file, data) => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file); // arquivo do próprio agente
};

// ── Histórico (anti-duplicidade) ────────────────────────────────

export const readHistory = (P) => {
  if (!fs.existsSync(P.historico)) return [];
  return fs
    .readFileSync(P.historico, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const appendHistory = (P, receipt) => fs.appendFileSync(P.historico, `${JSON.stringify(receipt)}\n`);

// ── Projetos (somente leitura) ──────────────────────────────────

/** Lista os projetos e o que o agente faria com cada um (NUNCA executa nada). */
export const scanProjects = (P) => {
  if (!fs.existsSync(P.projects)) return [];
  const protegidos = protectedSlugs(P.root);
  return fs
    .readdirSync(P.projects, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(P.projects, d.name);
      const info = {slug: d.name, protegido: protegidos.includes(d.name), etapa: null, versao: null, gate4: null};
      if (!fs.existsSync(path.join(dir, 'project.json'))) return {...info, nota: 'sem project.json'};
      try {
        const st = loadStatus(dir);
        if (!st) return {...info, nota: 'sem project-status.json (projeto sem controle de estado)'};
        return {...info, etapa: st.stage, versao: st.projectVersion, gate4: st.gates?.GATE_4?.status ?? null};
      } catch (e) {
        return {...info, nota: `project-status.json inválido: ${e.message}`};
      }
    });
};

// ── Validação do pedido ─────────────────────────────────────────

class Reject extends Error {}
const reject = (msg) => {
  throw new Reject(msg);
};

/** Valida a FORMA do pedido (campos, tipos, lista fechada de operações). */
export const validateRequestShape = (req) => {
  if (!req || typeof req !== 'object' || Array.isArray(req)) reject('pedido não é um objeto JSON.');
  if (req.$schema !== REQUEST_SCHEMA) reject(`"$schema" deve ser "${REQUEST_SCHEMA}".`);
  if (typeof req.id !== 'string' || !ID_RE.test(req.id)) reject('"id" ausente ou inválido (minúsculas, números, ".", "_", "-").');
  if (!OPERATIONS.includes(req.operacao)) reject(`"operacao" deve ser uma de: ${OPERATIONS.join(', ')}.`);
  const extra = Object.keys(req).filter((k) => !ALLOWED_KEYS[req.operacao].includes(k));
  if (extra.length) reject(`campos não permitidos para "${req.operacao}": ${extra.join(', ')}.`);
  if (req.operacao === 'verificar') return;
  if (typeof req.slug !== 'string' || !SLUG_RE.test(req.slug)) reject('"slug" ausente ou inválido.');
  if (typeof req.versao !== 'string' || !VERSION_RE.test(req.versao)) reject('"versao" ausente ou inválida (ex.: "v01").');
};

/** Caminho do MP4 final, calculado pelo SISTEMA (nunca vem do pedido). */
export const expectedOutput = (P, slug, version) => {
  const dir = path.join(P.projects, slug);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
  const base = renderBase(config);
  if (!/^[a-z0-9-]+_[a-z0-9-]+$/.test(base)) reject(`nome base inválido a partir do project.json: "${base}".`);
  return path.join(dir, 'renders', `${base}_${version}.mp4`);
};

/** Valida se o PROJETO pode receber esta operação agora (regra 2). */
export const checkEligibility = (P, req) => {
  const {slug, versao} = req;
  if (protectedSlugs(P.root).includes(slug)) reject(`projeto "${slug}" é protegido: o agente nunca o altera.`);
  const dir = path.join(P.projects, slug);
  if (!fs.existsSync(path.join(dir, 'project.json'))) reject(`projeto "${slug}" não encontrado em projects/.`);
  let st;
  try {
    st = loadStatus(dir);
  } catch (e) {
    reject(`project-status.json inválido: ${e.message}`);
  }
  if (!st) reject('projeto sem project-status.json (sem controle de estado): o agente não o renderiza.');
  const gate4 = st.gates?.GATE_4?.status;
  if (gate4 !== 'approved') reject(`GATE_4 não aprovado (status: "${gate4 ?? 'ausente'}"). Nada foi executado.`);
  if (st.projectVersion !== versao) reject(`versão do pedido (${versao}) diferente da versão de trabalho do projeto (${st.projectVersion}).`);
  if (!RENDER_STAGES.includes(st.stage)) reject(`etapa ${st.stage}: render final só em ${RENDER_STAGES.join(' ou ')}.`);
  const out = expectedOutput(P, slug, versao);
  if (fs.existsSync(out)) reject(`${path.relative(P.root, out)} já existe. Versões nunca são sobrescritas.`);
  return {status: st, output: out};
};

// ── Operações ───────────────────────────────────────────────────

export const sha256File = (file) =>
  new Promise((resolve, reject2) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject2)
      .on('end', () => resolve(h.digest('hex')));
  });

/** Runner real: o render OFICIAL, com versão explícita (aborta se o arquivo existir). */
export const realRenderRunner = ({root, slug, versao, logFile, timeoutMs = RENDER_TIMEOUT_MS}) =>
  new Promise((resolve) => {
    const out = fs.openSync(logFile, 'a');
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'render.mjs'), slug, '--version', versao], {
      cwd: root,
      stdio: ['ignore', out, out],
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({code: null, timedOut: true});
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.closeSync(out);
      resolve({code, timedOut: false});
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({code: null, timedOut: false, error: err.message});
    });
  });

const doRender = async (P, req, {output}, runner) => {
  const logFile = path.join(P.logs, `${req.id}.log`);
  const r = await runner({root: P.root, slug: req.slug, versao: req.versao, logFile});
  if (r.timedOut) throw new Error(`render excedeu ${Math.round(RENDER_TIMEOUT_MS / 60000)} min e foi interrompido.`);
  if (r.error) throw new Error(`não foi possível iniciar o render: ${r.error}`);
  if (r.code !== 0) throw new Error(`render.mjs terminou com código ${r.code}. Ver log.`);
  if (!fs.existsSync(output)) throw new Error('render.mjs terminou sem erro, mas o MP4 esperado não existe.');
  const st = loadStatus(path.join(P.projects, req.slug));
  const lr = st?.lastRender;
  return {
    validacaoPosRender: lr && lr.file === path.basename(output) ? (lr.inspect?.ok ? 'aprovada' : 'reprovada') : 'não registrada',
    log: path.relative(P.root, logFile),
  };
};

// ── Processamento de um pedido ──────────────────────────────────

const moveOut = (from, toDir) => {
  const dest = path.join(toDir, path.basename(from));
  const final = fs.existsSync(dest) ? path.join(toDir, `${Date.now()}_${path.basename(from)}`) : dest;
  fs.renameSync(from, final);
  return final;
};

/**
 * Processa UM arquivo de pedido. Passos:
 *  1. tira o arquivo de pedidos/ (consome) → em-execucao/
 *  2. valida forma, duplicidade, elegibilidade
 *  3. executa a operação (ou recusa)
 *  4. grava recibo em concluidos/ ou falhas/ + histórico
 * `runner` é injetável (testes usam um runner falso; nunca renderizam).
 */
export const processRequestFile = async (P, file, {runner = realRenderRunner, scan = () => scanProjects(P)} = {}) => {
  const started = now();
  const claimed = moveOut(file, P.emExecucao); // consumido ANTES de qualquer execução (regra 3)
  let req = null;
  const receipt = {$schema: RECEIPT_SCHEMA, agente: AGENT_VERSION, pedidoArquivo: path.basename(file), inicio: started};
  try {
    try {
      req = JSON.parse(fs.readFileSync(claimed, 'utf8'));
    } catch (e) {
      reject(`JSON inválido: ${e.message}`);
    }
    validateRequestShape(req);
    Object.assign(receipt, {id: req.id, operacao: req.operacao, projeto: req.slug ?? null, versao: req.versao ?? null});
    if (readHistory(P).some((h) => h.id === req.id)) reject(`pedido "${req.id}" já foi processado antes. Nunca é executado duas vezes.`);

    if (req.operacao === 'verificar') {
      Object.assign(receipt, {resultado: 'sucesso', projetos: scan()});
    } else {
      const ctx = checkEligibility(P, req);
      logLine(P, `▶ ${req.operacao} ${req.slug} ${req.versao} (pedido ${req.id})`);
      const extra = await doRender(P, req, ctx, runner);
      const size = fs.statSync(ctx.output).size;
      const hash = await sha256File(ctx.output);
      Object.assign(receipt, {
        resultado: 'sucesso',
        arquivo: ctx.output,
        arquivoRelativo: path.relative(P.root, ctx.output).split(path.sep).join('/'),
        tamanhoBytes: size,
        sha256: hash,
        ...extra,
      });
    }
  } catch (e) {
    Object.assign(receipt, {resultado: e instanceof Reject ? 'recusado' : 'falha', motivo: e.message});
  }
  receipt.fim = now();
  const destDir = receipt.resultado === 'sucesso' ? P.concluidos : P.falhas;
  const reqFinal = moveOut(claimed, destDir);
  receipt.pedidoGuardadoEm = path.relative(P.root, reqFinal).split(path.sep).join('/');
  const receiptFile = path.join(destDir, `${path.basename(reqFinal, '.json')}.recibo.json`);
  writeJson(receiptFile, receipt);
  if (receipt.id) appendHistory(P, receipt);
  logLine(
    P,
    `${receipt.resultado === 'sucesso' ? '✔' : '✖'} ${receipt.operacao ?? '?'} ${receipt.projeto ?? ''} ${receipt.versao ?? ''} → ${receipt.resultado}${
      receipt.motivo ? `: ${receipt.motivo}` : ''
    }${receipt.arquivoRelativo ? ` · ${receipt.arquivoRelativo} · ${receipt.tamanhoBytes} bytes · sha256 ${receipt.sha256}` : ''}`,
  );
  return receipt;
};

/** Pedidos pendentes: só *.json diretamente em pedidos/, em ordem de nome. */
export const pendingRequests = (P) =>
  fs.existsSync(P.pedidos)
    ? fs
        .readdirSync(P.pedidos, {withFileTypes: true})
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.json'))
        .map((d) => path.join(P.pedidos, d.name))
        .sort()
    : [];

/**
 * Pedidos que estavam em execução quando o agente parou (PC desligado, crash):
 * viram "interrompido" em falhas/ — NUNCA são repetidos automaticamente (regra 6).
 */
export const recoverInterrupted = (P) => {
  const out = [];
  for (const name of fs.readdirSync(P.emExecucao)) {
    const file = path.join(P.emExecucao, name);
    let id = null;
    try {
      id = JSON.parse(fs.readFileSync(file, 'utf8')).id ?? null;
    } catch {
      /* pedido ilegível */
    }
    const moved = moveOut(file, P.falhas);
    const receipt = {
      $schema: RECEIPT_SCHEMA,
      agente: AGENT_VERSION,
      id,
      resultado: 'interrompido',
      motivo: 'o agente parou durante a execução (computador desligado ou erro). Não será repetido automaticamente.',
      fim: now(),
      pedidoGuardadoEm: path.relative(P.root, moved).split(path.sep).join('/'),
    };
    writeJson(path.join(P.falhas, `${path.basename(moved, '.json')}.recibo.json`), receipt);
    if (id) appendHistory(P, receipt);
    logLine(P, `✖ pedido ${id ?? name} interrompido — registrado, sem nova tentativa.`);
    out.push(receipt);
  }
  // Temporários incompletos (arquivos do próprio agente).
  for (const name of fs.readdirSync(P.tmp)) {
    if (name.endsWith('.partial')) fs.unlinkSync(path.join(P.tmp, name));
  }
  return out;
};

// ── Lançador do Windows (usado pelo instalador) ───────────────

/**
 * Nome do lançador na pasta Inicializar. Leva um hash curto da pasta do
 * repositório: duas instalações na mesma máquina não se sobrescrevem.
 */
export const vbsName = (root) => {
  const key = path.resolve(root).toLowerCase(); // Windows: caminho sem distinção de maiúsculas
  const h = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
  return `ReelsEngineIA-AgenteRender-${h}.vbs`;
};

/** Conteúdo do lançador: roda `node scripts/agent.mjs` oculto (0 = sem janela), sem esperar. */
export const vbsContent = (nodeExe, root) => {
  const q = (s) => s.replace(/"/g, '""');
  const agent = path.join(root, 'scripts', 'agent.mjs');
  return [
    `' Reels Engine IA - Agente de Render v${AGENT_VERSION}`,
    "' Criado por scripts/agent-install.mjs. Para remover: npm run agent:install -- --remover",
    'Set sh = CreateObject("WScript.Shell")',
    `sh.CurrentDirectory = "${q(root)}"`,
    `sh.Run """${q(nodeExe)}"" ""${q(agent)}""", 0, False`,
    '',
  ].join('\r\n');
};

// ── Instância única e heartbeat ─────────────────────────────────

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

/** Garante uma única instância. Retorna false se outra já estiver ativa. */
export const acquireLock = (P) => {
  if (fs.existsSync(P.lock)) {
    try {
      const {pid} = JSON.parse(fs.readFileSync(P.lock, 'utf8'));
      if (pid && pid !== process.pid && pidAlive(pid)) return false;
    } catch {
      /* lock corrompido: assume */
    }
  }
  writeJson(P.lock, {pid: process.pid, desde: now()});
  return true;
};

export const releaseLock = (P) => {
  try {
    const {pid} = JSON.parse(fs.readFileSync(P.lock, 'utf8'));
    if (pid === process.pid) fs.unlinkSync(P.lock); // lock do próprio agente
  } catch {
    /* nada */
  }
};

export const writeHeartbeat = (P, extra = {}) =>
  writeJson(P.status, {
    agente: AGENT_VERSION,
    pid: process.pid,
    ativoDesde: extra.ativoDesde,
    ultimoSinal: now(),
    raiz: P.root,
    node: process.version,
    plataforma: process.platform,
    pedidosPendentes: pendingRequests(P).length,
    ...extra,
  });

