// Archive — cópia verificada de um projeto concluído para uma pasta de backup.
//
// Uso (na raiz):
//   npm run archive -- <slug> --destino "D:\Backups\Videos"            → copia e verifica
//   npm run archive -- <slug> --destino "D:\Backups\Videos" --dry-run  → só mostra o que seria copiado
//
// Garantias:
//   - SÓ COPIA. Nunca move, renomeia ou apaga nada — nem na origem, nem no destino.
//   - Cria <destino>/<slug>_<versão>_<data>/ e recusa se essa pasta já existir.
//   - Recusa destinos dentro do repositório (backup fica fora do Git e do projeto).
//   - Confere cada arquivo copiado por SHA-256 e grava ARCHIVE-MANIFEST.json por último:
//     sem manifesto = cópia incompleta.
//   - Projetos com estado: exige 10_FINAL e registra o arquivamento no project-status.json.
//     Projetos sem estado: cópia somente leitura, nada é gravado no projeto.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT, fail, loadProject, parseArgs, rel} from './lib.mjs';
import {fmtBytes} from './media-lib.mjs';
import {StatusError, existingRenderVersions, loadStatus, recordArchive, saveStatus, versionLabel} from './status-lib.mjs';

export const MANIFEST = 'ARCHIVE-MANIFEST.json';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Todos os arquivos do projeto (inclui .gitkeep e ocultos: a cópia é integral). */
const allFiles = (dir) => {
  const out = [];
  const rec = (d, prefix) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) rec(path.join(d, e.name), r);
      else if (e.isFile()) out.push(r);
    }
  };
  rec(dir, '');
  return out;
};

const isInside = (child, parent) => {
  const r = path.relative(parent, child);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

export const archiveProject = (project, {destino, dryRun = false, status = null, log = console.log} = {}) => {
  if (!destino || destino === true) throw new Error('Informe --destino "<pasta de backup>".');
  const destRoot = path.resolve(String(destino));
  if (isInside(destRoot, ROOT)) throw new Error(`Destino dentro do repositório (${destRoot}). Use uma pasta de backup fora dele (Drive, HD externo...).`);
  if (!fs.existsSync(destRoot) || !fs.statSync(destRoot).isDirectory()) throw new Error(`Pasta de destino não existe: ${destRoot}`);
  if (status && status.stage !== '10_FINAL') throw new Error(`Arquivamento exige 10_FINAL. Etapa atual: ${status.stage}.`);

  const versions = existingRenderVersions(project.renders, project.config);
  const version = status ? status.projectVersion : versions.length ? versionLabel(Math.max(...versions)) : 'sem-render';
  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(destRoot, `${project.slug}_${version}_${stamp}`);
  if (fs.existsSync(target)) throw new Error(`${target} já existe. Nada foi copiado (arquivamentos nunca são sobrescritos).`);

  const files = allFiles(project.dir);
  const total = files.reduce((a, f) => a + fs.statSync(path.join(project.dir, f)).size, 0);
  log(`\n▶ Archive ${dryRun ? '(simulação)' : ''}\n  projeto: ${project.slug} (${version})\n  origem:  ${rel(project.dir)}/\n  destino: ${target}\n  conteúdo: ${files.length} arquivos · ${fmtBytes(total)}\n`);
  if (dryRun) return {dryRun: true, target, files: files.length, bytes: total};

  fs.mkdirSync(target);
  const entries = [];
  for (const f of files) {
    const from = path.join(project.dir, f);
    const to = path.join(target, f);
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    const a = sha256(from);
    const b = sha256(to);
    if (a !== b) throw new Error(`Cópia divergente em ${f}. O arquivamento está INCOMPLETO em ${target} (sem ${MANIFEST}).`);
    entries.push({path: f, size: fs.statSync(from).size, sha256: a});
  }
  const manifest = {
    $note: 'Cópia verificada gerada por npm run archive. Sem este arquivo, a cópia está incompleta.',
    slug: project.slug,
    cliente: project.config.cliente,
    projeto: project.config.projeto,
    version,
    engineVersion: project.config.engineVersion ?? null,
    stage: status?.stage ?? 'sem controle de estado',
    archivedAt: new Date().toISOString(),
    source: project.dir,
    files: entries.length,
    bytes: total,
    entries,
  };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(target, MANIFEST), manifestText, {flag: 'wx'});
  const manifestSha256 = crypto.createHash('sha256').update(manifestText).digest('hex');
  log(`✔ ${entries.length} arquivos copiados e conferidos por SHA-256.\n  Manifesto: ${path.join(target, MANIFEST)}\n`);
  return {dryRun: false, target, files: entries.length, bytes: total, manifestSha256};
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const {positional, flags} = parseArgs(process.argv.slice(2));
  const project = loadProject(positional[0]);
  let status = null;
  try {
    status = loadStatus(project.dir);
  } catch (e) {
    if (e instanceof StatusError) fail(e.message);
    throw e;
  }
  if (!status) console.log('· Projeto sem controle de estado: cópia somente leitura, nada será gravado no projeto.');
  let r;
  try {
    r = archiveProject(project, {destino: flags.destino, dryRun: Boolean(flags['dry-run']), status});
  } catch (e) {
    fail(e.message);
  }
  if (status && !r.dryRun) {
    try {
      saveStatus(project.dir, recordArchive(status, {destination: r.target, files: r.files, bytes: r.bytes, manifestSha256: r.manifestSha256}));
      console.log(`✔ Arquivamento registrado em ${rel(path.join(project.dir, 'project-status.json'))}.\n`);
    } catch (e) {
      console.warn(`⚠ Cópia concluída, mas não foi possível registrar no estado: ${e.message}`);
    }
  }
}
