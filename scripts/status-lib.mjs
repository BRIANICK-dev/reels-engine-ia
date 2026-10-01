// Production Controller — Reels Engine IA.
//
// Estado persistente de produção de UM projeto, gravado em
// projects/<slug>/project-status.json. É a fonte de verdade operacional:
// em qual etapa o projeto está, o que foi concluído, o que o usuário aprovou,
// o que está bloqueado e qual é a próxima ação.
//
// Node puro, sem dependências. As funções de transição são puras (recebem e
// devolvem o objeto de estado) para poderem ser testadas sem disco; a leitura
// e a gravação ficam em loadStatus/saveStatus.
//
// Documentação: docs/09-FLUXO-DE-PRODUCAO.md
import fs from 'node:fs';
import path from 'node:path';
import {loadCatalog, validReason} from './linguagens-lib.mjs';

export const STATUS_FILE = 'project-status.json';
export const SCHEMA = 'reels-engine.project-status/1';

/** Estados oficiais, na ordem do fluxo. */
export const STAGES = [
  '00_BRIEFING',
  '01_CONCEPT',
  '02_SCRIPT',
  '03_STORYBOARD',
  '04_ASSETS',
  '05_IMPLEMENTATION',
  '06_VALIDATION',
  '07_STUDIO',
  '08_DRY_RUN',
  '09_RENDER',
  '10_FINAL',
];

export const STAGE_LABELS = {
  '00_BRIEFING': 'briefing',
  '01_CONCEPT': 'conceito',
  '02_SCRIPT': 'roteiro',
  '03_STORYBOARD': 'storyboard',
  '04_ASSETS': 'assets',
  '05_IMPLEMENTATION': 'implementação',
  '06_VALIDATION': 'validação técnica',
  '07_STUDIO': 'revisão no Studio',
  '08_DRY_RUN': 'dry-run',
  '09_RENDER': 'render',
  '10_FINAL': 'final',
};

/**
 * Gates humanos. Cada gate:
 *  - exitOf:  etapa que NÃO pode ser concluída sem o gate resolvido;
 *  - from:    etapa mais cedo em que a aprovação pode ser registrada;
 *  - waivable: pode ser dispensado com justificativa (decisão já tomada pelo
 *              usuário no briefing / MODO PRODUÇÃO). Studio e Render nunca.
 */
export const GATES = {
  GATE_1: {name: 'Conceito', exitOf: '01_CONCEPT', from: '01_CONCEPT', waivable: true},
  GATE_2: {name: 'Roteiro + Storyboard', exitOf: '03_STORYBOARD', from: '02_SCRIPT', waivable: true},
  GATE_3: {name: 'Studio', exitOf: '07_STUDIO', from: '07_STUDIO', waivable: false},
  GATE_4: {name: 'Render', exitOf: '08_DRY_RUN', from: '07_STUDIO', waivable: false},
};

/** Estados de um gate. "legacy" = etapa anterior à adoção do controller (init tardio). */
export const GATE_STATUSES = ['pending', 'approved', 'waived', 'legacy'];
const GATE_OK = new Set(['approved', 'waived', 'legacy']);

/** Próxima ação padrão de cada etapa (usada quando nenhuma foi definida). */
export const DEFAULT_NEXT = {
  '00_BRIEFING': {owner: 'claude', text: 'Interpretar o briefing (8 perguntas do Briefing Rápido), registrar em briefing.md e durationSeconds no project.json; perguntar só o que for essencial e estiver faltando.'},
  '01_CONCEPT': {owner: 'claude', text: 'Propor o conceito com uma linguagem visual do catálogo (npm run linguagens). Havendo mais de uma direção válida, apresentar 2–3 caminhos com linguagens diferentes e aguardar o GATE 1; registrar a escolhida em project.json → "linguagem".'},
  '02_SCRIPT': {owner: 'claude', text: 'Escrever o roteiro. Ele NÃO é aprovado sozinho: vai ao GATE 2 junto com o storyboard.'},
  '03_STORYBOARD': {owner: 'claude', text: 'Detalhar storyboard.md cena a cena (soma = durationSeconds) e apresentar roteiro + storyboard (plano visual) juntos para o GATE 2 — Roteiro + Storyboard.'},
  '04_ASSETS': {owner: 'claude', text: 'Rodar npm run assets -- <slug> (ficha técnica), examinar o conteúdo, registrar em manifesto-de-assets.md e pedir ao usuário apenas os que faltarem.'},
  '05_IMPLEMENTATION': {owner: 'claude', text: 'Implementar timeline.ts, cenas e componentes conforme o storyboard aprovado.'},
  '06_VALIDATION': {owner: 'claude', text: 'Rodar npm run preflight -- <slug> e o checklist técnico; corrigir sozinho os problemas técnicos. O avancar roda o preflight de novo.'},
  '07_STUDIO': {owner: 'usuario', text: 'Assistir no Studio (npm run studio -- <slug>) e aprovar (GATE 3) ou pedir ajustes.'},
  '08_DRY_RUN': {owner: 'usuario', text: 'Rodar npm run render -- <slug> --dry-run (inclui o preflight), conferir o destino e autorizar o render final (GATE 4).'},
  '09_RENDER': {owner: 'usuario', text: 'Rodar npm run render -- <slug> (a validação técnica do MP4 é registrada automaticamente) e assistir o MP4 fora do Studio.'},
  '10_FINAL': {owner: 'claude', text: 'Projeto concluído. Para revisar: reabrir a etapa necessária (gera a próxima versão).'},
};

export class StatusError extends Error {}
const err = (msg) => {
  throw new StatusError(msg);
};

const now = () => new Date().toISOString();
export const stageIndex = (stage) => STAGES.indexOf(stage);
export const isStage = (s) => stageIndex(s) !== -1;
export const versionLabel = (n) => `v${String(n).padStart(2, '0')}`;
const versionNumber = (label) => Number(String(label).replace(/^v/i, ''));

/** Gates cuja etapa de saída é `stage`. */
export const gatesAtExit = (stage) => Object.keys(GATES).filter((g) => GATES[g].exitOf === stage);

/** Normaliza "gate1", "1", "GATE_1" → "GATE_1". */
export const normalizeGate = (input) => {
  const m = String(input ?? '').toUpperCase().match(/^(?:GATE[_-]?)?([1-4])$/);
  if (!m) err(`Gate inválido: "${input}". Use GATE_1, GATE_2, GATE_3 ou GATE_4.`);
  return `GATE_${m[1]}`;
};

/** Aceita "05_IMPLEMENTATION", "05" ou "implementation". */
export const normalizeStage = (input) => {
  const s = String(input ?? '').toUpperCase();
  const found = STAGES.find((st) => st === s || st.slice(0, 2) === s.padStart(2, '0') || st.slice(3) === s);
  if (!found) err(`Etapa inválida: "${input}". Etapas: ${STAGES.join(', ')}.`);
  return found;
};

// ─────────────────────────────────────────────────────────────
// Renders — leitura apenas (o render continua sendo do render.mjs)
// ─────────────────────────────────────────────────────────────

/** "Loja Exemplo" → "loja-exemplo" (mesma regra do scripts/lib.mjs). */
const slugify = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const renderBase = (config) => `${slugify(config.cliente)}_${slugify(config.projeto)}`;

/** Versões finais existentes em renders/ (ex.: [1, 2]). Ignora rascunhos. */
export const existingRenderVersions = (rendersDir, config) => {
  if (!rendersDir || !fs.existsSync(rendersDir) || !config?.cliente || !config?.projeto) return [];
  const re = new RegExp(`^${renderBase(config)}_v(\\d+)\\.mp4$`);
  return fs
    .readdirSync(rendersDir)
    .map((f) => f.match(re))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
};

// ─────────────────────────────────────────────────────────────
// Criação e validação
// ─────────────────────────────────────────────────────────────

const emptyGates = () => Object.fromEntries(Object.keys(GATES).map((g) => [g, {status: 'pending'}]));

/**
 * Estado inicial. `stage` > 00 só para projetos que começaram sem controle
 * de estado (init tardio): as etapas anteriores entram como concluídas e os
 * gates anteriores como "legacy" (não se inventa aprovação).
 */
export const createStatus = ({slug, stage = '00_BRIEFING', version = 'v01', note} = {}) => {
  if (!slug) err('slug obrigatório.');
  stage = normalizeStage(stage);
  const idx = stageIndex(stage);
  const at = now();
  const gates = emptyGates();
  for (const g of Object.keys(GATES)) {
    if (stageIndex(GATES[g].exitOf) < idx) gates[g] = {status: 'legacy', at, note: 'Etapa anterior à adoção do Production Controller.'};
  }
  return {
    $schema: SCHEMA,
    slug,
    stage,
    projectVersion: version,
    completed: expectedCompleted(stage),
    gates,
    blockers: [],
    nextAction: null,
    lastRender: null,
    createdAt: at,
    updatedAt: at,
    history: [{at, event: 'init', stage, detail: note ?? (idx ? `Controller iniciado na etapa ${stage}.` : 'Projeto criado.')}],
  };
};

/** Etapas que devem constar como concluídas quando o projeto está em `stage`. */
export const expectedCompleted = (stage) =>
  stage === '10_FINAL' ? [...STAGES] : STAGES.slice(0, stageIndex(stage));

/** Lista de problemas estruturais (vazia = válido). */
export const validateStatus = (s) => {
  const p = [];
  if (!s || typeof s !== 'object') return ['Arquivo de estado vazio ou inválido.'];
  if (s.$schema !== SCHEMA) p.push(`$schema deve ser "${SCHEMA}".`);
  if (typeof s.slug !== 'string' || !s.slug) p.push('slug ausente.');
  if (!isStage(s.stage)) p.push(`stage inválido: "${s.stage}".`);
  if (!/^v\d{2,3}$/.test(s.projectVersion ?? '')) p.push(`projectVersion inválida: "${s.projectVersion}" (use v01, v02...).`);
  if (!Array.isArray(s.completed)) p.push('completed deve ser uma lista.');
  else {
    for (const c of s.completed) if (!isStage(c)) p.push(`completed contém etapa inválida: "${c}".`);
    const expected = expectedCompleted(s.stage);
    if (JSON.stringify([...s.completed].sort()) !== JSON.stringify([...expected].sort())) {
      p.push(`completed inconsistente com a etapa atual: esperado ${expected.join(', ') || '(nenhuma)'}.`);
    }
  }
  if (!s.gates || typeof s.gates !== 'object') p.push('gates ausente.');
  else {
    for (const g of Object.keys(GATES)) {
      const st = s.gates[g]?.status;
      if (!GATE_STATUSES.includes(st)) p.push(`${g}.status inválido: "${st}".`);
    }
    // Nenhuma etapa com gate pode estar concluída sem o gate resolvido.
    if (Array.isArray(s.completed)) {
      for (const g of Object.keys(GATES)) {
        if (s.completed.includes(GATES[g].exitOf) && !GATE_OK.has(s.gates[g]?.status)) {
          p.push(`${GATES[g].exitOf} está concluída mas o ${g} (${GATES[g].name}) não foi aprovado.`);
        }
      }
    }
  }
  if (!Array.isArray(s.blockers)) p.push('blockers deve ser uma lista.');
  if (!Array.isArray(s.history)) p.push('history deve ser uma lista.');
  if (Number.isNaN(Date.parse(s.updatedAt))) p.push('updatedAt inválido.');
  return p;
};

// ─────────────────────────────────────────────────────────────
// Transições (puras: devolvem um novo objeto)
// ─────────────────────────────────────────────────────────────

const clone = (s) => JSON.parse(JSON.stringify(s));
const touch = (s, event, detail, extra = {}) => {
  const at = now();
  s.updatedAt = at;
  s.history.push({at, event, stage: s.stage, detail, ...extra});
  return s;
};

export const BRIEFING_EMPTY_MSG = 'o briefing ainda está vazio — responda as 8 perguntas no arquivo ou descreva o vídeo no chat';

const normalizeText = (t) => String(t).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

/**
 * O briefing.md do projeto ainda é igual ao molde (com os campos que o
 * `npm run new` preenche)? Arquivo ausente conta como vazio.
 */
export const isBriefingEmpty = (projectDir, config = {}, moldeDir) => {
  const file = path.join(projectDir, 'briefing.md');
  if (!fs.existsSync(file)) return true;
  const moldeFile = moldeDir && path.join(moldeDir, 'briefing.md');
  if (!moldeFile || !fs.existsSync(moldeFile)) return false;
  const replacements = {
    '{{SLUG}}': config.slug ?? path.basename(projectDir),
    '{{CLIENTE}}': config.cliente ?? '',
    '{{PROJETO}}': config.projeto ?? '',
    '{{ENGINE_VERSION}}': config.engineVersion ?? '',
    '{{CREATED_AT}}': config.createdAt ?? '',
  };
  let molde = fs.readFileSync(moldeFile, 'utf8');
  for (const [k, v] of Object.entries(replacements)) molde = molde.split(k).join(String(v));
  return normalizeText(fs.readFileSync(file, 'utf8')) === normalizeText(molde);
};

/** A pasta assets/ do projeto não tem nenhum arquivo (além de .gitkeep)? */
export const isAssetsEmpty = (assetsDir) => {
  if (!fs.existsSync(assetsDir)) return true;
  const walk = (d) =>
    fs.readdirSync(d, {withFileTypes: true}).some((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name !== '.gitkeep'));
  return !walk(assetsDir);
};

/** Ids do catálogo de linguagens (núcleo + local). Erro no catálogo vira mensagem. */
const catalogIds = (ctx) => {
  if (ctx.linguagens) return {ids: ctx.linguagens};
  if (ctx.catalogError) return {error: ctx.catalogError};
  try {
    return {ids: loadCatalog().ids};
  } catch (e) {
    return {error: e.message};
  }
};

/** Problemas da linguagem visual na saída de 01_CONCEPT (vazio = ok). */
export const linguagemProblems = (cfg, ctx = {}) => {
  const out = [];
  const id = cfg.linguagem;
  if (typeof id !== 'string' || !id) {
    out.push('Linguagem visual não definida: registre a escolhida em project.json → "linguagem" (catálogo: npm run linguagens).');
    return out;
  }
  const cat = catalogIds(ctx);
  if (cat.error) out.push(`Não foi possível conferir a linguagem: ${cat.error}`);
  else if (!cat.ids.includes(id)) out.push(`Linguagem "${id}" não existe no catálogo (npm run linguagens).`);
  const rep = ctx.repetition?.mesmoCliente ?? [];
  if (rep.length && !validReason(cfg.linguagemMotivo)) {
    out.push(
      `A linguagem "${id}" repete a de ${rep.length === 1 ? 'uma produção recente' : 'produções recentes'} do mesmo cliente (${rep.join(', ')}). ` +
        'Troque a linguagem ou registre o motivo em project.json → "linguagemMotivo" (uma linha, com pelo menos 10 caracteres).',
    );
  }
  return out;
};

/**
 * Pré-condições objetivas para concluir a etapa atual.
 * `ctx` = {config (project.json), rendersDir, preflight?, inspect?}. Devolve lista de impedimentos.
 * 06_VALIDATION e 08_DRY_RUN exigem preflight aprovado; 09_RENDER exige a
 * validação pós-render (inspect) aprovada. No relatório, usa o último
 * resultado registrado; no avancar, o CLI passa um resultado recém-executado.
 */
export const exitChecks = (s, ctx = {}) => {
  const out = [];
  const active = s.blockers.filter((b) => !b.resolvedAt);
  if (active.length) out.push(`Há ${active.length} bloqueio(s) ativo(s): ${active.map((b) => `${b.id} "${b.text}"`).join('; ')}.`);

  for (const g of gatesAtExit(s.stage)) {
    if (!GATE_OK.has(s.gates[g].status)) {
      out.push(`${g} (${GATES[g].name}) pendente: registre a aprovação do usuário${GATES[g].waivable ? ' ou dispense com justificativa' : ''}.`);
    }
  }

  const cfg = ctx.config;
  if (s.stage === '00_BRIEFING' && cfg) {
    for (const key of ['cliente', 'projeto']) {
      if (!cfg[key] || /\{\{.+\}\}/.test(cfg[key])) out.push(`"${key}" não definido em project.json.`);
    }
    if (typeof cfg.durationSeconds !== 'number' || !(cfg.durationSeconds > 0)) {
      out.push('"durationSeconds" não definido em project.json (vem do briefing).');
    }
  }
  if (s.stage === '00_BRIEFING' && ctx.briefingEmpty === true) {
    out.push(`${BRIEFING_EMPTY_MSG} (projects/${s.slug}/briefing.md).`);
  }
  if (s.stage === '01_CONCEPT' && cfg) out.push(...linguagemProblems(cfg, ctx));

  if (PREFLIGHT_STAGES.includes(s.stage)) {
    const pf = ctx.preflight ?? s.preflight;
    if (!pf) out.push('Preflight ainda não executado (npm run preflight -- <slug>; o avancar executa automaticamente).');
    else if (!pf.ok) out.push(`Preflight reprovado (${pf.errors} erro(s)) — corrija e rode de novo.`);
  }

  if (s.stage === '09_RENDER' && cfg) {
    const need = versionNumber(s.projectVersion);
    const found = existingRenderVersions(ctx.rendersDir, cfg).filter((n) => n >= need);
    if (!found.length) out.push(`Nenhum render final ${renderBase(cfg)}_${s.projectVersion}.mp4 (ou posterior) encontrado em renders/.`);
    else {
      const latest = `${renderBase(cfg)}_${versionLabel(Math.max(...found))}.mp4`;
      const insp = ctx.inspect ?? (s.lastRender?.file === latest ? s.lastRender.inspect : null);
      if (!insp) out.push(`Validação pós-render de ${latest} ainda não executada (npm run inspect -- <slug>; o avancar executa automaticamente).`);
      else if (!insp.ok) out.push(`Validação pós-render de ${latest} reprovada (${insp.errors} erro(s)).`);
    }
  }
  return out;
};

/** Conclui a etapa atual e avança para a próxima. */
export const advance = (status, ctx = {}, {note} = {}) => {
  const s = clone(status);
  if (s.stage === '10_FINAL') err('O projeto já está em 10_FINAL. Para revisar, reabra uma etapa.');
  const problems = exitChecks(s, ctx);
  if (problems.length) err(`Não é possível concluir ${s.stage}:\n  - ${problems.join('\n  - ')}`);
  // Resultados antigos não liberam a transição: o avancar exige verificação recém-executada.
  if (PREFLIGHT_STAGES.includes(s.stage) && !ctx.preflight) err(`Concluir ${s.stage} exige um preflight recém-executado (npm run status -- <slug> avancar o executa).`);
  if (s.stage === '09_RENDER' && ctx.config && !ctx.inspect) err('Concluir 09_RENDER exige a validação pós-render recém-executada (npm run status -- <slug> avancar a executa).');

  const from = s.stage;
  if (ctx.preflight && PREFLIGHT_STAGES.includes(from)) s.preflight = ctx.preflight;
  if (from === '09_RENDER' && ctx.config) {
    const need = versionNumber(s.projectVersion);
    const latest = Math.max(...existingRenderVersions(ctx.rendersDir, ctx.config).filter((n) => n >= need));
    s.projectVersion = versionLabel(latest);
    s.lastRender = {file: `${renderBase(ctx.config)}_${s.projectVersion}.mp4`, registeredAt: now(), inspect: ctx.inspect ?? null};
  }
  if (!s.completed.includes(from)) s.completed.push(from);
  s.stage = STAGES[stageIndex(from) + 1];
  if (s.stage === '10_FINAL' && !s.completed.includes('10_FINAL')) s.completed.push('10_FINAL');
  s.nextAction = null; // volta para a ação padrão da nova etapa
  return touch(s, 'advance', note ?? `${from} → ${s.stage}`, {from});
};

/** Registra a aprovação do usuário para um gate. */
export const approve = (status, gateInput, {note} = {}) => {
  const s = clone(status);
  const g = normalizeGate(gateInput);
  const gate = GATES[g];
  const idx = stageIndex(s.stage);
  if (idx < stageIndex(gate.from)) err(`${g} (${gate.name}) só pode ser aprovado a partir de ${gate.from}. Etapa atual: ${s.stage}.`);
  if (idx > stageIndex(gate.exitOf)) err(`${g} já ficou para trás (${gate.exitOf}). Para revisar essa decisão, reabra a etapa.`);
  if (s.gates[g].status === 'approved') err(`${g} já está aprovado.`);
  if (!note) err('Informe --nota com o que foi aprovado (ex.: "Conceito B — Aventura em família").');
  s.gates[g] = {status: 'approved', at: now(), note};
  return touch(s, 'approve', `${g} (${gate.name}) aprovado: ${note}`, {gate: g});
};

/** Dispensa um gate dispensável, com justificativa obrigatória. */
export const waive = (status, gateInput, {reason} = {}) => {
  const s = clone(status);
  const g = normalizeGate(gateInput);
  const gate = GATES[g];
  if (!gate.waivable) err(`${g} (${gate.name}) não pode ser dispensado: exige aprovação explícita do usuário.`);
  if (!reason) err('Informe --motivo (ex.: "Briefing em MODO PRODUÇÃO define o conceito e autoriza execução").');
  const idx = stageIndex(s.stage);
  if (idx > stageIndex(gate.exitOf)) err(`${g} já ficou para trás.`);
  if (GATE_OK.has(s.gates[g].status)) err(`${g} já está resolvido (${s.gates[g].status}).`);
  s.gates[g] = {status: 'waived', at: now(), note: reason};
  return touch(s, 'waive', `${g} (${gate.name}) dispensado: ${reason}`, {gate: g});
};

export const block = (status, text, {owner = 'usuario'} = {}) => {
  const s = clone(status);
  if (!text) err('Descreva o bloqueio.');
  if (!['usuario', 'claude', 'ambiente'].includes(owner)) err('--responsavel deve ser usuario, claude ou ambiente.');
  const n = s.blockers.reduce((max, b) => Math.max(max, Number(String(b.id).slice(1)) || 0), 0) + 1;
  const b = {id: `B${n}`, text, owner, since: now()};
  s.blockers.push(b);
  return touch(s, 'block', `${b.id}: ${text} (responsável: ${owner})`);
};

export const unblock = (status, id, {note} = {}) => {
  const s = clone(status);
  const active = s.blockers.filter((b) => !b.resolvedAt);
  const targets = String(id).toLowerCase() === 'todos' ? active : active.filter((b) => b.id.toLowerCase() === String(id).toLowerCase());
  if (!targets.length) err(`Nenhum bloqueio ativo com id "${id}".`);
  const at = now();
  for (const b of targets) {
    b.resolvedAt = at;
    if (note) b.resolution = note;
  }
  return touch(s, 'unblock', `${targets.map((b) => b.id).join(', ')} resolvido(s)${note ? `: ${note}` : ''}`);
};

export const setNext = (status, text, {owner = 'claude'} = {}) => {
  const s = clone(status);
  if (!text) err('Descreva a próxima ação.');
  if (!['usuario', 'claude'].includes(owner)) err('--responsavel deve ser usuario ou claude.');
  s.nextAction = {owner, text, at: now()};
  return touch(s, 'next', `(${owner}) ${text}`);
};

/** Etapas cuja conclusão exige preflight aprovado. */
export const PREFLIGHT_STAGES = ['06_VALIDATION', '08_DRY_RUN'];

/** Registra o resultado de um preflight (não muda a etapa). */
export const recordPreflight = (status, summary) => {
  const s = clone(status);
  s.preflight = summary;
  return touch(s, 'preflight', summary.ok ? `Preflight aprovado (${summary.warnings} aviso(s)).` : `Preflight reprovado: ${summary.errors} erro(s), ${summary.warnings} aviso(s).`);
};

/**
 * Registra um render final e sua validação técnica (não muda a etapa nem
 * aprova gates). Chamado automaticamente pelo render.mjs em projetos com estado.
 */
export const recordRender = (status, {file, version, inspect = null, source = 'render'}) => {
  const s = clone(status);
  if (!file || !/^v\d{2,3}$/.test(version ?? '')) err('recordRender: file e version (vNN) obrigatórios.');
  const at = now();
  s.renders = [...(s.renders ?? []).filter((r) => r.file !== file), {file, version, at, source, inspect}];
  s.lastRender = {file, registeredAt: at, inspect};
  const warn = [];
  if (!['09_RENDER', '10_FINAL'].includes(s.stage)) warn.push(`render feito na etapa ${s.stage}, antes de 09_RENDER`);
  if (s.gates.GATE_4.status !== 'approved') warn.push('GATE 4 (Render) não estava aprovado');
  if (version !== s.projectVersion && s.stage !== '10_FINAL') warn.push(`versão ${version} ≠ versão de trabalho ${s.projectVersion}`);
  const insp = inspect ? (inspect.ok ? 'validação técnica aprovada' : `validação técnica REPROVADA (${inspect.errors} erro(s))`) : 'sem validação técnica';
  return touch(s, 'render', `${file} registrado — ${insp}${warn.length ? ` · atenção: ${warn.join('; ')}` : ''}`);
};

/** Registra uma validação pós-render avulsa (npm run inspect). */
export const recordInspect = (status, {file, version, inspect}) => {
  const s = clone(status);
  const at = now();
  const existing = (s.renders ?? []).find((r) => r.file === file);
  s.renders = existing
    ? s.renders.map((r) => (r.file === file ? {...r, inspect} : r))
    : [...(s.renders ?? []), {file, version, at, source: 'inspect', inspect}];
  if (!s.lastRender || s.lastRender.file === file || versionNumber(version) >= versionNumber(s.lastRender.file.match(/_v(\d+)\.mp4$/)?.[1] ?? 0)) {
    s.lastRender = {file, registeredAt: s.lastRender?.file === file ? s.lastRender.registeredAt : at, inspect};
  }
  return touch(s, 'inspect', `${file}: ${inspect.ok ? 'validação técnica aprovada' : `validação técnica REPROVADA (${inspect.errors} erro(s))`}`);
};

/** Registra um arquivamento (cópia verificada do projeto). Não muda a etapa. */
export const recordArchive = (status, {destination, files, bytes, manifestSha256}) => {
  const s = clone(status);
  s.archives = [...(s.archives ?? []), {at: now(), destination, files, bytes, manifestSha256, version: s.projectVersion}];
  return touch(s, 'archive', `Projeto arquivado (${files} arquivos) em ${destination}`);
};

export const addNote = (status, text) => {
  if (!text) err('Nota vazia.');
  return touch(clone(status), 'note', text);
};

/**
 * Volta a uma etapa anterior (revisão). Etapas a partir dela deixam de estar
 * concluídas e os gates que dependem delas voltam a "pending". Se o render da
 * versão atual já foi concluído, a revisão abre a próxima versão (v02...).
 */
export const reopen = (status, stageInput, {reason} = {}) => {
  const s = clone(status);
  const target = normalizeStage(stageInput);
  if (!reason) err('Informe --motivo da reabertura.');
  const t = stageIndex(target);
  if (t > stageIndex(s.stage)) err(`${target} ainda não foi alcançada. Etapa atual: ${s.stage}.`);
  if (target === '10_FINAL') err('Não se reabre 10_FINAL.');

  const invalidated = [];
  for (const g of Object.keys(GATES)) {
    if (stageIndex(GATES[g].exitOf) >= t && s.gates[g].status !== 'pending') {
      invalidated.push(`${g} (${s.gates[g].status})`);
      s.gates[g] = {status: 'pending'};
    }
  }
  let bumped = null;
  if (s.completed.includes('09_RENDER')) {
    bumped = versionLabel(versionNumber(s.projectVersion) + 1);
    s.projectVersion = bumped;
  }
  const from = s.stage;
  s.completed = s.completed.filter((c) => stageIndex(c) < t);
  s.stage = target;
  s.nextAction = null;
  const detail = [`${from} → ${target}: ${reason}`];
  if (invalidated.length) detail.push(`aprovações invalidadas: ${invalidated.join(', ')}`);
  if (bumped) detail.push(`nova versão de trabalho: ${bumped}`);
  return touch(s, 'reopen', detail.join(' · '), {from});
};

// ─────────────────────────────────────────────────────────────
// Leitura / gravação
// ─────────────────────────────────────────────────────────────

export const statusPath = (projectDir) => path.join(projectDir, STATUS_FILE);

export const loadStatus = (projectDir) => {
  const file = statusPath(projectDir);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(`${STATUS_FILE} ilegível: ${e.message}`);
  }
  const problems = validateStatus(data);
  if (problems.length) err(`${STATUS_FILE} inválido:\n  - ${problems.join('\n  - ')}`);
  return data;
};

/** Gravação atômica (arquivo temporário + rename) — nunca deixa JSON pela metade. */
export const saveStatus = (projectDir, status) => {
  const problems = validateStatus(status);
  if (problems.length) err(`Estado inválido, nada foi gravado:\n  - ${problems.join('\n  - ')}`);
  const file = statusPath(projectDir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(status, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return file;
};

// ─────────────────────────────────────────────────────────────
// Relatório (o bloco "STATUS DO PROJETO")
// ─────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * O que o projeto está esperando agora, em linguagem direta.
 * `ctx` (opcional) traz o que só o disco sabe: briefing vazio, assets vazios, repetição de linguagem.
 */
export const waitingFor = (s, ctx = {}) => {
  const active = s.blockers.filter((b) => !b.resolvedAt);
  if (active.length) return active.map((b) => `bloqueio ${b.id} (${b.owner}): ${b.text}`);
  const out = [];
  const cfg = ctx.config;
  if (s.stage === '00_BRIEFING') {
    if (ctx.briefingEmpty) out.push(`${BRIEFING_EMPTY_MSG} (projects/${s.slug}/briefing.md)`);
    if (cfg && !(typeof cfg.durationSeconds === 'number' && cfg.durationSeconds > 0)) out.push('definir a duração do vídeo (pergunta 4 do briefing)');
    if (ctx.assetsEmpty) out.push(`colocar os arquivos do vídeo (fotos, vídeos, logo, fontes) em projects/${s.slug}/assets/`);
  }
  if (s.stage === '01_CONCEPT' && cfg) {
    for (const p of linguagemProblems(cfg, ctx)) out.push(p);
  }
  const pending = gatesAtExit(s.stage).filter((g) => !GATE_OK.has(s.gates[g].status));
  for (const g of pending) out.push(`${g} (${GATES[g].name}) — aprovação do usuário necessária para concluir esta etapa`);
  if (out.length) return out;
  if (s.stage === '10_FINAL') return ['nada — projeto concluído'];
  return ['nenhuma decisão sua agora — o Claude segue com esta etapa'];
};

export const nextActionOf = (s) => s.nextAction ?? DEFAULT_NEXT[s.stage];

export const formatReport = (s, ctx = {}) => {
  const lines = [];
  const slug = s.slug;
  lines.push(`STATUS DO PROJETO — ${slug}`, '');
  lines.push(`Etapa atual:  ${s.stage} (${STAGE_LABELS[s.stage]})`);
  lines.push(`Versão:       ${s.projectVersion}`);
  lines.push(`Atualizado:   ${fmtDate(s.updatedAt)}`);
  if (s.preflight) {
    const pf = s.preflight;
    const stale = ctx.fingerprint && pf.fingerprint && ctx.fingerprint !== pf.fingerprint ? '  ⚠ desatualizado: o projeto mudou depois' : '';
    lines.push(`Preflight:    ${pf.ok ? '✓ aprovado' : `✖ reprovado (${pf.errors} erro(s))`} em ${fmtDate(pf.at)} · ${pf.warnings} aviso(s)${stale}`);
  } else if (stageIndex(s.stage) >= stageIndex('05_IMPLEMENTATION')) {
    lines.push('Preflight:    — ainda não executado');
  }
  if (s.lastRender) {
    const i = s.lastRender.inspect;
    lines.push(`Último render: ${s.lastRender.file} · ${i ? (i.ok ? '✓ validação técnica aprovada' : `✖ validação técnica reprovada (${i.errors} erro(s))`) : 'sem validação técnica'}`);
  }
  lines.push('');

  lines.push('Concluído:');
  const done = STAGES.filter((st) => s.completed.includes(st) && st !== '10_FINAL');
  if (!done.length) lines.push('  (nada ainda)');
  for (const st of done) lines.push(`  ✓ ${st} (${STAGE_LABELS[st]})`);

  lines.push('', 'Gates humanos:');
  for (const g of Object.keys(GATES)) {
    const v = s.gates[g];
    const mark = {approved: '✓ aprovado', waived: '↷ dispensado', legacy: '· legado', pending: '… pendente'}[v.status];
    lines.push(`  ${g} ${GATES[g].name.padEnd(19)} ${mark}${v.note && v.status !== 'legacy' ? ` — ${v.note}` : ''}`);
  }

  lines.push('', 'Aguardando:');
  for (const w of waitingFor(s, ctx)) lines.push(`  → ${w}`);

  const others = ctx.repetition?.outrosClientes ?? [];
  if (ctx.config?.linguagem && others.length && stageIndex(s.stage) <= stageIndex('01_CONCEPT')) {
    lines.push('', 'Avisos:', `  ⚠ a linguagem "${ctx.config.linguagem}" também foi usada recentemente para outros clientes (${others.join(', ')}). Não bloqueia; considere variar.`);
  }

  lines.push('', 'Bloqueios:');
  const active = s.blockers.filter((b) => !b.resolvedAt);
  if (!active.length) lines.push('  nenhum');
  for (const b of active) lines.push(`  ✖ ${b.id} [${b.owner}] ${b.text} (desde ${fmtDate(b.since)})`);

  const na = nextActionOf(s);
  lines.push('', 'Próxima ação:', `  [${na.owner}] ${na.text.replaceAll('<slug>', slug)}`);

  if (ctx.config) {
    const versions = existingRenderVersions(ctx.rendersDir, ctx.config);
    if (versions.length) {
      const latest = versionLabel(Math.max(...versions));
      lines.push('', `Renders em disco: ${versions.map(versionLabel).join(', ')}`);
      if (s.stage === '10_FINAL' && latest !== s.projectVersion) {
        lines.push(`  ⚠ o render mais recente (${latest}) difere da versão registrada (${s.projectVersion}).`);
      }
    }
    const problems = s.stage !== '10_FINAL' ? exitChecks(s, ctx) : [];
    if (problems.length) {
      lines.push('', `Para concluir ${s.stage}:`);
      for (const p of problems) lines.push(`  - ${p}`);
    }
  }
  return lines.join('\n');
};
