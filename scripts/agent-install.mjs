// Instalador do Agente de Render (Windows) — executar UMA única vez.
//
//   node scripts/agent-install.mjs            → instala e inicia o agente agora
//   node scripts/agent-install.mjs --status   → mostra se está instalado e ativo
//   node scripts/agent-install.mjs --remover  → remove o início automático e encerra o agente
//
// O que faz:
//  1. Confere Node e dependências (roda `npm ci` só se node_modules não existir).
//  2. Cria UM arquivo na pasta Inicializar do usuário
//     (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ReelsEngineIA-AgenteRender-<hash>.vbs,
//     com um hash curto da pasta do repositório — duas instalações não colidem)
//     que liga o agente oculto, sem janela, a cada login. Sem administrador.
//  3. Inicia o agente imediatamente e espera o primeiro sinal de vida.
// Não altera nenhum projeto, asset, código ou render.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {ROOT} from './lib.mjs';
import {agentPaths, AGENT_VERSION, vbsContent, vbsName} from './agent-lib.mjs';

const P = agentPaths(ROOT);
const args = new Set(process.argv.slice(2));
const VBS_NAME = vbsName(ROOT);

const startupDir = () =>
  process.env.APPDATA ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup') : null;

const heartbeatAfter = (t0) => {
  try {
    const s = JSON.parse(fs.readFileSync(P.status, 'utf8'));
    return Date.parse(s.ultimoSinal) >= t0 ? s : null;
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (process.platform !== 'win32') {
  fail('O Agente de Render é só para Windows. No macOS e no Linux, renderize pelo terminal: npm run render -- <slug> (veja o Manual de Implantação).');
}
const dir = startupDir();
if (!dir || !fs.existsSync(dir)) fail('Pasta Inicializar do Windows não encontrada (%APPDATA% ausente).');
const vbs = path.join(dir, VBS_NAME);

if (args.has('--status')) {
  console.log(`\nAgente de Render — início automático: ${fs.existsSync(vbs) ? 'INSTALADO' : 'não instalado'}`);
  const s = heartbeatAfter(Date.now() - 90_000);
  console.log(`Agente ativo agora: ${s ? `sim (pid ${s.pid}, último sinal ${s.ultimoSinal})` : 'não (sem sinal nos últimos 90 s)'}\n`);
  process.exit(0);
}

if (args.has('--remover')) {
  if (fs.existsSync(vbs)) fs.unlinkSync(vbs); // arquivo criado por este instalador
  try {
    const {pid} = JSON.parse(fs.readFileSync(P.lock, 'utf8'));
    if (pid) process.kill(pid);
  } catch {
    /* agente não estava rodando */
  }
  console.log('\n✔ Início automático removido e agente encerrado. Projetos e renders não foram tocados.\n');
  process.exit(0);
}

// ── Instalação ─────────────────────────────────────────────────
console.log(`\nINSTALAÇÃO — Agente de Render v${AGENT_VERSION}\n  raiz: ${ROOT}\n  node: ${process.execPath} (${process.version})\n`);

if (!fs.existsSync(path.join(ROOT, 'node_modules', '@remotion', 'cli'))) {
  console.log('▶ Dependências não instaladas: rodando "npm ci" (só desta vez)...\n');
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {cwd: ROOT, stdio: 'inherit', shell: true});
  if (r.status !== 0) fail('"npm ci" falhou. Verifique a conexão e tente de novo.');
}

fs.writeFileSync(vbs, vbsContent(process.execPath, ROOT));
console.log(`✔ Início automático criado:\n  ${vbs}\n`);

const t0 = Date.now();
spawn('wscript.exe', [vbs], {detached: true, stdio: 'ignore', windowsHide: true}).unref();
process.stdout.write('▶ Iniciando o agente');
let beat = null;
for (let i = 0; i < 30 && !beat; i++) {
  await sleep(500);
  process.stdout.write('.');
  beat = heartbeatAfter(t0 - 1000);
}
console.log('');
if (!beat) {
  fail(`O agente não respondeu em 15 s. Veja ${path.relative(ROOT, P.log)}. O início automático continua instalado.`);
}
console.log(`\n✔ Agente de Render ATIVO (pid ${beat.pid}).`);
console.log('  Ele liga sozinho a cada login no Windows e trabalha em segundo plano.');
console.log('  A partir de agora, renders finais aprovados no chat aparecem direto em projects/<slug>/renders/.\n');
