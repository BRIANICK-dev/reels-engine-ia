// Asset Intelligence (base) — identificação técnica dos arquivos de um projeto.
// Apoia a etapa 04_ASSETS. Somente leitura, exceto com --salvar.
//
// Uso (na raiz):
//   npm run assets -- <slug>              → ficha técnica de cada arquivo em assets/
//   npm run assets -- <slug> --markdown   → linhas prontas para o manifesto-de-assets.md
//   npm run assets -- <slug> --json       → saída estruturada
//   npm run assets -- <slug> --salvar     → grava projects/<slug>/assets-report.json
//                                           (só em projetos com project-status.json)
//
// Documentação: docs/12-AUTOMACAO.md
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fail, loadProject, parseArgs, rel} from './lib.mjs';
import {describeFile, fmtBytes, fmtDuration, walkFiles} from './media-lib.mjs';
import {STATUS_FILE} from './status-lib.mjs';

export const REPORT_FILE = 'assets-report.json';

/** Analisa assets/ e cruza com o manifesto-de-assets.md. */
export const analyzeAssets = (project) => {
  const files = walkFiles(project.assets);
  const items = files.map((f) => describeFile(path.join(project.assets, f), f));
  const manifestPath = path.join(project.dir, 'manifesto-de-assets.md');
  const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : null;
  const unregistered = manifest === null ? files : files.filter((f) => !manifest.includes(f) && !manifest.includes(path.posix.basename(f)));
  const byType = items.reduce((acc, i) => ({...acc, [i.type]: (acc[i.type] ?? 0) + 1}), {});
  return {
    slug: project.slug,
    generatedAt: new Date().toISOString(),
    assetsDir: rel(project.assets),
    total: items.length,
    totalBytes: items.reduce((a, i) => a + i.sizeBytes, 0),
    byType,
    manifestFound: manifest !== null,
    unregistered,
    items,
  };
};

const dims = (i) => (i.width && i.height ? `${i.width}×${i.height}` : '—');
const aspect = (i) => (i.aspect ? (i.aspect.label && i.aspect.label !== i.aspect.ratio ? `${i.aspect.ratio} (≈${i.aspect.label})` : i.aspect.ratio) : '—');

const printTable = (report) => {
  console.log(`\nASSETS — ${report.slug}   (${report.assetsDir}/)\n`);
  if (!report.total) {
    console.log('  Nenhum arquivo em assets/.\n');
    return;
  }
  for (const i of report.items) {
    console.log(`  ${i.name}`);
    const parts = [`${i.type} · .${i.ext}`, fmtBytes(i.sizeBytes)];
    if (i.width) parts.push(`${dims(i)} · ${i.orientation} · ${aspect(i)}`);
    if (i.durationSec !== null) parts.push(fmtDuration(i.durationSec));
    if (i.fps) parts.push(`${i.fps} fps`);
    if (i.codec) parts.push(i.codec);
    if (i.audio && i.type === 'video') parts.push(`áudio ${i.audio.codec}`);
    console.log(`    ${parts.join('  |  ')}`);
    for (const n of i.notes) console.log(`    ⚠ ${n}`);
  }
  const types = Object.entries(report.byType).map(([t, n]) => `${n} ${t}`).join(', ');
  console.log(`\n  Total: ${report.total} arquivo(s) · ${fmtBytes(report.totalBytes)} · ${types}`);
  if (!report.manifestFound) console.log('  ⚠ manifesto-de-assets.md não encontrado.');
  else if (report.unregistered.length) {
    console.log(`  ⚠ Fora do manifesto-de-assets.md (${report.unregistered.length}): ${report.unregistered.join(', ')}`);
  } else console.log('  ✓ Todos os arquivos aparecem no manifesto-de-assets.md.');
  console.log('');
};

/** Linhas no formato da tabela do _MOLDE/manifesto-de-assets.md. Campos de julgamento ficam em branco. */
const printMarkdown = (report) => {
  console.log('| Arquivo | Tipo | Resolução | Orientação | Duração | Conteúdo | Origem | Uso previsto |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const i of report.items) {
    const res = i.width ? `${dims(i)} (${aspect(i)})` : '—';
    const dur = i.durationSec !== null ? fmtDuration(i.durationSec) : '—';
    console.log(`| ${i.name} | ${i.type} (.${i.ext}, ${fmtBytes(i.sizeBytes)}) | ${res} | ${i.orientation ?? '—'} | ${dur} | | | |`);
  }
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const {positional, flags} = parseArgs(process.argv.slice(2));
  const project = loadProject(positional[0]);
  const report = analyzeAssets(project);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else if (flags.markdown) printMarkdown(report);
  else printTable(report);

  if (flags.salvar) {
    if (!fs.existsSync(path.join(project.dir, STATUS_FILE))) {
      fail(`--salvar só grava em projetos com ${STATUS_FILE}. Projetos sem estado não são alterados.`);
    }
    const out = path.join(project.dir, REPORT_FILE);
    fs.writeFileSync(out, JSON.stringify({$note: 'Gerado por npm run assets — não editar à mão.', ...report}, null, 2) + '\n');
    console.log(`✔ Relatório gravado em ${rel(out)}\n`);
  }
}
