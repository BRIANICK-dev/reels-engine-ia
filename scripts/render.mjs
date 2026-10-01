// Renderiza um projeto em projects/<slug>/renders/cliente_projeto_vNN.mp4
// sem NUNCA sobrescrever uma versão existente.
//
// Uso:
//   npm run render -- <slug>                  → próxima versão livre (v01, v02...)
//   npm run render -- <slug> --version v03    → versão explícita (aborta se já existir)
//   npm run render -- <slug> --dry-run        → só mostra o que seria feito
//   npm run render -- <slug> --draft          → rascunho em renders/_rascunhos/ (não conta como versão)
//
// Qualquer --frames ou --scale transforma o render em rascunho automaticamente.
import fs from 'node:fs';
import path from 'node:path';
import {fail, loadProject, parseArgs, rel, runRemotion, slugify} from './lib.mjs';

const OWN_FLAGS = ['version', 'dry-run', 'draft'];
const FORBIDDEN = ['output', 'overwrite', 'public-dir', 'codec', 'fps', 'width', 'height', 'pixel-format', 'color-space'];

const {positional, flags, passthrough} = parseArgs(process.argv.slice(2));
const project = loadProject(positional[0], {forRender: true});

for (const key of FORBIDDEN) {
  if (key in flags) fail(`--${key} não é permitido aqui: formato, destino e proteção de versões são fixos.`);
}
const remotionArgs = passthrough.filter((a) => !OWN_FLAGS.includes(a.slice(2).split('=')[0]));
const isDraft = Boolean(flags.draft) || 'frames' in flags || 'scale' in flags;
const dryRun = Boolean(flags['dry-run']);

const base = `${slugify(project.config.cliente)}_${slugify(project.config.projeto)}`;
if (!/^[a-z0-9-]+_[a-z0-9-]+$/.test(base)) fail(`Nome base inválido gerado a partir do project.json: "${base}"`);

let outFile;
let versionLabel = null;

if (isDraft) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  outFile = path.join(project.renders, '_rascunhos', `${base}_rascunho_${stamp}.mp4`);
} else {
  fs.mkdirSync(project.renders, {recursive: true});
  const re = new RegExp(`^${base}_v(\\d+)\\.mp4$`);
  const existing = fs
    .readdirSync(project.renders)
    .map((f) => f.match(re))
    .filter(Boolean)
    .map((m) => Number(m[1]));

  let n;
  if (flags.version !== undefined) {
    const m = String(flags.version).match(/^v?(\d{1,3})$/i);
    if (!m || Number(m[1]) < 1) fail(`--version inválida: "${flags.version}". Use v01, v02...`);
    n = Number(m[1]);
  } else {
    n = existing.length ? Math.max(...existing) + 1 : 1;
  }
  versionLabel = `v${String(n).padStart(2, '0')}`;
  outFile = path.join(project.renders, `${base}_${versionLabel}.mp4`);
}

if (fs.existsSync(outFile)) {
  fail(`${rel(outFile)} já existe. Versões existentes nunca são sobrescritas — use a próxima versão.`);
}

console.log(`
▶ Render ${isDraft ? '(RASCUNHO)' : versionLabel}
  projeto:  ${project.slug}
  duração:  ${project.config.durationSeconds}s
  entry:    ${rel(project.entry)}
  assets:   ${rel(project.assets)}/
  saída:    ${rel(outFile)}
  extras:   ${remotionArgs.join(' ') || '—'}
`);

// Só em projetos com project-status.json. Projetos sem estado seguem o render simples.
const hasStatus = fs.existsSync(path.join(project.dir, 'project-status.json'));

if (dryRun) {
  console.log('  --dry-run: nada foi renderizado.\n');
  if (hasStatus && !isDraft) {
    try {
      const {dryRunPreflight} = await import('./render-hooks.mjs');
      process.exit(dryRunPreflight(project) ? 0 : 1);
    } catch (e) {
      fail(`Preflight do dry-run não pôde ser executado: ${e.message}`);
    }
  }
  process.exit(0);
}

fs.mkdirSync(path.dirname(outFile), {recursive: true});
const code = await runRemotion([
  'render',
  project.entry,
  'Main',
  outFile,
  `--public-dir=${project.assets}`,
  ...remotionArgs,
]);
if (code !== 0) fail(`O render falhou (código ${code}). Nenhuma versão foi registrada.`);

if (!isDraft) {
  const log = path.join(project.dir, 'versoes.md');
  if (!fs.existsSync(log)) {
    fs.writeFileSync(log, `# VERSÕES — ${project.slug}\n\n| Data | Arquivo | Duração | Observações |\n|---|---|---|---|\n`);
  }
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  fs.appendFileSync(log, `| ${date} | ${path.basename(outFile)} | ${project.config.durationSeconds}s | |\n`);
}

console.log(`\n✔ Render concluído: ${rel(outFile)}\n`);

// Validação pós-render + registro no estado. Nunca altera o resultado do
// render acima: qualquer falha aqui vira só um aviso.
if (hasStatus && !isDraft) {
  try {
    const {afterFinalRender} = await import('./render-hooks.mjs');
    afterFinalRender(project, {file: path.basename(outFile), version: versionLabel});
  } catch (e) {
    console.warn(`⚠ Render OK, mas a validação/registro automático falhou: ${e.message}\n  Rode: npm run inspect -- ${project.slug}\n`);
  }
}
