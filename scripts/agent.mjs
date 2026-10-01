// Agente de Render — processo em segundo plano.
//
// Roda no computador do usuário, iniciado automaticamente com o Windows
// (instalado UMA vez por scripts/agent-install.mjs). Não depende do Claude
// estar aberto. Vigia SOMENTE .reels-engine/pedidos/ e executa pedidos explícitos e
// válidos (regras em scripts/agent-lib.mjs e docs/12-AUTOMACAO.md).
//
// Uso:
//   node scripts/agent.mjs                → modo contínuo (o que a inicialização do Windows chama)
//   node scripts/agent.mjs --uma-vez      → processa o que houver em pedidos/ e sai
//   node scripts/agent.mjs --diagnostico  → só mostra ambiente e projetos; NÃO processa nada
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';
import {
  acquireLock,
  agentPaths,
  AGENT_VERSION,
  ensureDirs,
  logLine,
  pendingRequests,
  processRequestFile,
  recoverInterrupted,
  releaseLock,
  scanProjects,
  writeHeartbeat,
} from './agent-lib.mjs';

const POLL_MS = 5000;
const HEARTBEAT_MS = 30000;

const args = new Set(process.argv.slice(2));
const P = agentPaths(ROOT);

const safeScan = ({log = true} = {}) => {
  try {
    return scanProjects(P);
  } catch (e) {
    // local/config.json inválido (inclusive campo que tente alterar uma trava do núcleo):
    // nenhum pedido de render será aceito até corrigir.
    if (log) logLine(P, `✖ ${e.message}`);
    console.log(`  ✖ ${e.message}`);
    return [];
  }
};

const printProjects = () => {
  const list = safeScan({log: false}); // diagnóstico: somente leitura
  console.log(`  projetos em projects/: ${list.length}`);
  for (const p of list) {
    const flags = [p.protegido ? 'PROTEGIDO' : null, p.etapa, p.versao, p.gate4 ? `GATE_4=${p.gate4}` : null, p.nota].filter(Boolean);
    console.log(`   · ${p.slug.padEnd(32)} ${flags.join(' · ')}`);
  }
  return list;
};

if (args.has('--diagnostico')) {
  // Somente leitura: não cria pastas, não move pedidos, não executa nada.
  console.log(`\nAGENTE DE RENDER v${AGENT_VERSION} — diagnóstico (somente leitura)\n`);
  console.log(`  raiz:     ${ROOT}`);
  console.log(`  node:     ${process.version} (${process.platform})`);
  console.log(`  projects/ encontrada: ${fs.existsSync(P.projects) ? 'sim' : 'NÃO'}`);
  printProjects();
  const pend = fs.existsSync(P.pedidos) ? fs.readdirSync(P.pedidos).filter((n) => n.endsWith('.json')) : [];
  console.log(`  pedidos pendentes: ${pend.length}${pend.length ? ` (${pend.join(', ')})` : ''}`);
  if (fs.existsSync(P.status)) {
    const s = JSON.parse(fs.readFileSync(P.status, 'utf8'));
    const age = Math.round((Date.now() - Date.parse(s.ultimoSinal)) / 1000);
    console.log(`  último sinal do agente: ${s.ultimoSinal} (há ${age}s, pid ${s.pid})`);
  } else {
    console.log('  último sinal do agente: nenhum (agente ainda não rodou nesta pasta)');
  }
  console.log('');
  process.exit(0);
}

ensureDirs(P);

if (!acquireLock(P)) {
  console.log('Agente de Render já está em execução nesta pasta. Nada a fazer.');
  process.exit(0);
}

const ativoDesde = new Date().toISOString();
const once = args.has('--uma-vez');

logLine(P, `● agente v${AGENT_VERSION} iniciado (pid ${process.pid}, ${once ? 'uma vez' : 'contínuo'}) — raiz ${ROOT}`);
if (!fs.existsSync(P.projects)) logLine(P, '⚠ pasta projects/ não encontrada.');
const projetos = safeScan();
logLine(P, `  ${projetos.length} projeto(s) reconhecido(s): ${projetos.map((p) => p.slug).join(', ') || '—'}`);

const interrupted = recoverInterrupted(P);
if (interrupted.length) logLine(P, `  ${interrupted.length} pedido(s) interrompido(s) registrado(s) como falha (sem nova tentativa).`);

let busy = false;
let lastBeat = 0;

const tick = async () => {
  if (busy) return;
  busy = true;
  try {
    for (const file of pendingRequests(P)) {
      writeHeartbeat(P, {ativoDesde, executando: path.basename(file)});
      await processRequestFile(P, file);
    }
    if (Date.now() - lastBeat >= HEARTBEAT_MS || once) {
      writeHeartbeat(P, {ativoDesde, executando: null});
      lastBeat = Date.now();
    }
  } catch (e) {
    // Erro inesperado do próprio agente: registra e segue vigiando (sem repetir o pedido).
    logLine(P, `✖ erro interno do agente: ${e.stack ?? e.message}`);
  } finally {
    busy = false;
  }
};

const shutdown = (why) => {
  logLine(P, `● agente encerrado (${why}).`);
  releaseLock(P);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (once) {
  await tick();
  shutdown('--uma-vez concluído');
} else {
  await tick();
  setInterval(tick, POLL_MS);
}
