// Production Controller — consulta e atualiza projects/<slug>/project-status.json.
//
// Uso (sempre na raiz):
//   npm run status                                         → lista todos os projetos e suas etapas
//   npm run status -- <slug>                               → relatório "STATUS DO PROJETO"
//   npm run status -- <slug> avancar [--nota "..."]        → conclui a etapa atual e avança
//        (06_VALIDATION/08_DRY_RUN rodam o preflight; 09_RENDER roda a validação pós-render)
//   npm run status -- <slug> aprovar GATE_1 --nota "..."   → registra aprovação do usuário
//   npm run status -- <slug> dispensar GATE_1 --motivo "..." (só GATE_1 e GATE_2)
//   npm run status -- <slug> bloquear "texto" [--responsavel usuario|claude|ambiente]
//   npm run status -- <slug> desbloquear B1|todos [--nota "..."]
//   npm run status -- <slug> proxima "texto" [--responsavel usuario|claude]
//   npm run status -- <slug> nota "texto"
//   npm run status -- <slug> reabrir 05_IMPLEMENTATION --motivo "..."
//   npm run status -- <slug> validar                       → confere a estrutura do arquivo
//   npm run status -- <slug> init [--etapa 05_IMPLEMENTATION]  → só para projetos sem arquivo de estado
//   Qualquer comando aceita --json para imprimir o estado bruto.
//
// Documentação: docs/09-FLUXO-DE-PRODUCAO.md
import fs from 'node:fs';
import path from 'node:path';
import {MOLDE_DIR, PROJECTS_DIR, ROOT, assertLocalConfig, fail, loadProject, parseArgs, rel} from './lib.mjs';
import {loadCatalog, productionHistory, repetition} from './linguagens-lib.mjs';
import {formatInspect, inspectSummary, runInspect} from './inspect-lib.mjs';
import {formatPreflight, preflightSummary, projectFingerprint, runPreflight} from './preflight-lib.mjs';
import {
  PREFLIGHT_STAGES,
  STATUS_FILE,
  StatusError,
  isAssetsEmpty,
  isBriefingEmpty,
  addNote,
  advance,
  approve,
  block,
  createStatus,
  existingRenderVersions,
  formatReport,
  loadStatus,
  recordInspect,
  recordPreflight,
  reopen,
  saveStatus,
  setNext,
  stageIndex,
  unblock,
  validateStatus,
  versionLabel,
  waitingFor,
  waive,
} from './status-lib.mjs';

const {positional, flags} = parseArgs(process.argv.slice(2));
const [slug, command, arg] = positional;
const str = (v) => (typeof v === 'string' ? v.trim() : undefined);

/**
 * Contexto que só o disco sabe: briefing vazio, assets vazios, catálogo de
 * linguagens e repetição de linguagem em relação às últimas produções.
 */
const diskContext = (dir, config) => {
  const ctx = {
    config,
    briefingEmpty: isBriefingEmpty(dir, config, MOLDE_DIR),
    assetsEmpty: isAssetsEmpty(path.join(dir, 'assets')),
  };
  try {
    ctx.linguagens = loadCatalog(ROOT).ids;
  } catch (e) {
    ctx.catalogError = e.message;
  }
  ctx.repetition = repetition({slug: path.basename(dir), cliente: config.cliente, linguagem: config.linguagem}, productionHistory(PROJECTS_DIR));
  return ctx;
};

const run = (fn) => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof StatusError) fail(e.message);
    throw e;
  }
};

// ── Sem slug: visão geral de todos os projetos ─────────────────
if (!slug) {
  assertLocalConfig();
  const dirs = fs
    .readdirSync(PROJECTS_DIR, {withFileTypes: true})
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
  console.log('\nPROJETOS\n');
  for (const name of dirs) {
    const dir = path.join(PROJECTS_DIR, name);
    let line;
    try {
      const s = loadStatus(dir);
      const cfg = s ? JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')) : null;
      line = s
        ? `${s.stage.padEnd(18)} ${s.projectVersion}  aguardando: ${waitingFor(s, diskContext(dir, cfg))[0]}`
        : 'sem controle de estado (sem project-status.json)';
    } catch (e) {
      line = `⚠ ${e.message.split('\n')[0]}`;
    }
    console.log(`  ${name.padEnd(32)} ${line}`);
  }
  console.log('');
  process.exit(0);
}

const project = loadProject(slug);
const ctx = {...diskContext(project.dir, project.config), rendersDir: project.renders, fingerprint: projectFingerprint(project.dir)};
const file = rel(path.join(project.dir, STATUS_FILE));

// ── init: adotar o controle de estado num projeto que não tem ──────
if (command === 'init') {
  run(() => {
    if (loadStatus(project.dir)) fail(`${file} já existe. Nada foi alterado.`);
    const stage = str(flags.etapa) ?? '00_BRIEFING';
    const versions = existingRenderVersions(project.renders, project.config);
    const max = versions.length ? Math.max(...versions) : 0;
    const s0 = createStatus({slug, stage, version: versionLabel(Math.max(1, max))});
    // Em 09_RENDER/10_FINAL a versão é a última renderizada (é ela que será validada/entregue);
    // antes disso, a próxima versão livre.
    if (stageIndex(s0.stage) < stageIndex('09_RENDER') && max) s0.projectVersion = versionLabel(max + 1);
    saveStatus(project.dir, s0);
    console.log(`\n✔ ${file} criado na etapa ${s0.stage}.\n`);
    console.log(formatReport(s0, ctx) + '\n');
  });
  process.exit(0);
}

const status = run(() => loadStatus(project.dir));
if (!status) {
  fail(
    `${file} não existe — projeto sem controle de estado.\n` +
      `  Se este projeto ainda estiver em produção: npm run status -- ${slug} init --etapa <ETAPA>\n` +
      `  Projetos concluídos/de referência podem ficar como estão.`,
  );
}

if (command === 'validar') {
  const problems = validateStatus(status);
  if (problems.length) fail(`${file} inválido:\n  - ${problems.join('\n  - ')}`);
  console.log(`\n✔ ${file} válido (etapa ${status.stage}, ${status.projectVersion}).\n`);
  process.exit(0);
}

/**
 * avancar com verificação automática: ao sair de 06_VALIDATION / 08_DRY_RUN roda
 * o preflight; ao sair de 09_RENDER roda a validação pós-render. O resultado é
 * sempre registrado; se reprovar, a etapa não muda.
 */
const advanceWithChecks = () => {
  let s = status;
  const extra = {};
  const others = ctx.repetition?.outrosClientes ?? [];
  if (s.stage === '01_CONCEPT' && project.config.linguagem && others.length) {
    console.log(`\n⚠ Aviso: a linguagem "${project.config.linguagem}" também foi usada recentemente para outros clientes (${others.join(', ')}). Não bloqueia.`);
  }
  if (PREFLIGHT_STAGES.includes(s.stage)) {
    console.log(`\n▶ Preflight automático (${s.stage})...`);
    const r = runPreflight(project, {typecheck: true, status: s});
    const summary = preflightSummary(r);
    s = recordPreflight(s, summary);
    console.log(`\n${formatPreflight(r)}`);
    if (!r.ok) {
      run(() => saveStatus(project.dir, s));
      fail(`Preflight reprovado — ${s.stage} continua aberta. Resultado registrado em ${file}.`);
    }
    extra.preflight = summary;
  }
  if (s.stage === '09_RENDER') {
    console.log('\n▶ Validação pós-render automática...');
    const r = runInspect(project, {status: s});
    if (r.file) s = recordInspect(s, {file: r.file, version: r.version, inspect: inspectSummary(r)});
    console.log(`\n${formatInspect(r)}`);
    if (!r.ok) {
      run(() => saveStatus(project.dir, s));
      fail(`Validação pós-render reprovada — 09_RENDER continua aberta. Resultado registrado em ${file}.`);
    }
    extra.inspect = inspectSummary(r);
  }
  return advance(s, {...ctx, ...extra}, {note: str(flags.nota)});
};

const actions = {
  avancar: advanceWithChecks,
  aprovar: () => approve(status, arg, {note: str(flags.nota)}),
  dispensar: () => waive(status, arg, {reason: str(flags.motivo)}),
  bloquear: () => block(status, str(arg), {owner: str(flags.responsavel)}),
  desbloquear: () => unblock(status, arg, {note: str(flags.nota)}),
  proxima: () => setNext(status, str(arg), {owner: str(flags.responsavel)}),
  nota: () => addNote(status, str(arg)),
  reabrir: () => reopen(status, arg, {reason: str(flags.motivo)}),
};

if (command && !actions[command]) {
  fail(`Comando desconhecido: "${command}". Comandos: ${['init', 'validar', ...Object.keys(actions)].join(', ')}.`);
}

let current = status;
if (command) {
  current = run(() => actions[command]());
  run(() => saveStatus(project.dir, current));
  const last = current.history.at(-1);
  console.log(`\n✔ ${last.detail}`);
}

if (flags.json) {
  console.log(JSON.stringify(current, null, 2));
} else {
  console.log('\n' + formatReport(current, ctx) + '\n');
}

