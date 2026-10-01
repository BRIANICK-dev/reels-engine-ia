// Verificação pública — confere o que IRIA para o Git antes de publicar o motor.
// Somente leitura: nunca altera, move ou apaga nada.
//
// Uso (na raiz):
//   npm run verificar-publico            → relatório; sai com código 1 se houver erro
//   npm run verificar-publico -- --json  → saída estruturada
//
// O que verifica:
//   - termos de local/termos-proibidos.txt (nomes, marcas, cidades...) em nome ou
//     conteúdo de arquivo, sem diferenciar maiúsculas nem acentos;
//   - mídia versionada: só a fonte livre do projeto de exemplo é permitida, e com
//     o arquivo de licença na mesma pasta;
//   - arquivos de local/, .reels-engine/ ou .env no conjunto;
//   - arquivos grandes (aviso).
//
// A lista de termos fica em local/, fora do Git: os nomes que ela protege
// nunca vão para o repositório. Documentação: docs/12-AUTOMACAO.md.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const TERMS_FILE = path.join('local', 'termos-proibidos.txt');
export const EXAMPLE_SLUG = 'exemplo-loja-promo';
export const MOLDE_SLUG = '_MOLDE';
export const CLIENT_MOLDE = '_MOLDE-DNA-DE-CLIENTE.md';
export const BIG_FILE_BYTES = 1024 * 1024;
/** Pasta onde o app Claude grava os arquivos enviados ao chat (na pasta conectada). */
export const APP_OUTPUTS_DIR = 'Claude outputs';

const MEDIA = {
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'],
  audio: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'oga', 'flac', 'opus'],
  imagem: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'svg', 'psd', 'ai', 'heic'],
  fonte: ['ttf', 'otf', 'woff', 'woff2'],
};
const MEDIA_KIND = Object.fromEntries(Object.entries(MEDIA).flatMap(([k, exts]) => exts.map((e) => [e, k])));
const LICENSE_RE = /^(ofl|licen[cs]e|licenca|copying)([._-].*)?$/i;

const SKIP_DIRS = new Set(['node_modules', '.git', '.reels-engine', 'local', 'out', 'build', 'dist', '.remotion', '.cache', '.idea', APP_OUTPUTS_DIR]);
const SKIP_FILES = /^(desktop\.ini|thumbs\.db|ehthumbs\.db|\.ds_store|\._.*|npm-debug\.log.*|.*\.(log|tmp|temp|bak|part|swp)|~\$.*)$/i;

const toPosix = (p) => p.split(path.sep).join('/');

export const normalizeText = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Seleção feita pelo próprio script, espelhando as regras de conteúdo do
 * usuário do .gitignore. Usada quando a pasta não é um repositório git.
 */
export const walkPublicFiles = (root) => {
  const out = [];
  const walk = (dirRel) => {
    const abs = path.join(root, dirRel);
    for (const e of fs.readdirSync(abs, {withFileTypes: true})) {
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
      const parts = rel.split('/');
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) && parts.length === 1) continue;
        if (e.name === 'node_modules' || e.name === '.git') continue;
        if (parts[0] === 'projects' && parts.length === 2 && ![MOLDE_SLUG, EXAMPLE_SLUG].includes(e.name)) continue;
        if (parts[0] === 'clients' && parts.length >= 2) continue;
        if (e.name === '.vscode' && parts.length === 1) {
          if (fs.existsSync(path.join(abs, e.name, 'extensions.json'))) out.push('.vscode/extensions.json');
          continue;
        }
        walk(rel);
        continue;
      }
      if (!e.isFile()) continue;
      if (SKIP_FILES.test(e.name) || /^\.env(\..*)?$/i.test(e.name)) continue;
      if (parts[0] === 'clients' && parts.length === 2 && e.name !== CLIENT_MOLDE) continue;
      if (rel === `projects/${EXAMPLE_SLUG}/project-status.json`) continue; // o exemplo vai sem estado
      if (parts[0] === 'projects' && parts.length >= 4) {
        const [, slug, area] = parts;
        if (area === 'assets' && e.name !== '.gitkeep' && slug !== EXAMPLE_SLUG) continue;
        if (area === 'renders' && e.name !== '.gitkeep') continue;
        if (area === 'referencias' && !(parts.length === 4 && e.name.toLowerCase().endsWith('.md'))) continue;
      }
      const ext = path.extname(e.name).slice(1).toLowerCase();
      const isExampleAsset = parts[0] === 'projects' && parts[1] === EXAMPLE_SLUG && parts[2] === 'assets';
      if (MEDIA.video.includes(ext) && !isExampleAsset) continue; // *.mp4, *.mov... ignorados no .gitignore
      out.push(rel);
    }
  };
  walk('');
  return out.sort();
};

/** Arquivos que iriam para o Git: pelo git, se houver repositório; senão, pela seleção própria. */
export const collectFiles = (root, {useGit = true} = {}) => {
  if (useGit && fs.existsSync(path.join(root, '.git'))) {
    const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'});
    if (r.status === 0) {
      return {mode: 'git', files: r.stdout.split('\0').filter(Boolean).filter((f) => fs.existsSync(path.join(root, f))).sort()};
    }
  }
  return {mode: 'pasta', files: walkPublicFiles(root)};
};

/** Lê local/termos-proibidos.txt: um termo por linha; linhas vazias e com # são ignoradas. */
export const readTerms = (root) => {
  const file = path.join(root, TERMS_FILE);
  if (!fs.existsSync(file)) return null;
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
};

const walkAll = (dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walkAll(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const isBinary = (buf) => buf.subarray(0, Math.min(buf.length, 8000)).includes(0);

/** Executa todas as checagens. Retorna {ok, mode, files, errors, warnings}. */
export const verifyPublic = (root, {files, mode = 'pasta', terms} = {}) => {
  if (!files) ({files, mode} = collectFiles(root));
  if (terms === undefined) terms = readTerms(root);
  const errors = [];
  const warnings = [];

  // Saídas do app (stills, previews, vídeos de validação): fora do Git, mas apague antes de publicar.
  const appOut = path.join(root, APP_OUTPUTS_DIR);
  if (fs.existsSync(appOut)) {
    const n = walkAll(appOut).length;
    warnings.push(`"${APP_OUTPUTS_DIR}/" existe na pasta (${n} arquivo(s) de saída do app: stills, previews, vídeos de validação). Está no .gitignore, mas apague antes de publicar.`);
  }

  if (terms === null) {
    warnings.push(`${toPosix(TERMS_FILE)} não existe: só as checagens estruturais rodaram. Copie o molde de local.exemplo/ e liste os termos que nunca podem ser publicados.`);
    terms = [];
  }
  const shortTerms = terms.filter((t) => normalizeText(t).length < 4);
  if (shortTerms.length) warnings.push(`Termos com menos de 4 letras geram falsos positivos (a busca é por trecho): ${shortTerms.join(', ')}.`);
  const normTerms = [...new Set(terms.map(normalizeText).filter((t) => t.length > 0))];

  for (const rel of files) {
    const posix = toPosix(rel);
    const parts = posix.split('/');
    const base = parts[parts.length - 1];
    const abs = path.join(root, rel);

    // Conteúdo local nunca vai para o Git.
    if (parts[0] === APP_OUTPUTS_DIR) errors.push(`${posix}: saída do app Claude no conjunto publicado (confira o .gitignore: "${APP_OUTPUTS_DIR}/").`);
    if (parts[0] === 'local') errors.push(`${posix}: arquivo da camada local no conjunto publicado (confira o .gitignore: "local/").`);
    if (parts[0] === '.reels-engine') errors.push(`${posix}: arquivo do Agente de Render no conjunto publicado (confira o .gitignore).`);
    if (/^\.env(\..*)?$/i.test(base)) errors.push(`${posix}: arquivo de variáveis de ambiente/segredos no conjunto publicado.`);

    // Mídia: só a fonte livre do exemplo, com a licença ao lado.
    const ext = path.extname(base).slice(1).toLowerCase();
    const kind = MEDIA_KIND[ext];
    if (kind) {
      const inExample = parts[0] === 'projects' && parts[1] === EXAMPLE_SLUG && parts[2] === 'assets';
      if (!inExample) errors.push(`${posix}: mídia (${kind}) no repositório. Só a fonte livre do projeto de exemplo pode ser versionada.`);
      else if (kind !== 'fonte') errors.push(`${posix}: no projeto de exemplo só a fonte livre é versionada (${kind} não é permitido; grafismos vão em código).`);
      else {
        const dir = path.dirname(abs);
        const hasLicense = fs.readdirSync(dir).some((f) => LICENSE_RE.test(f));
        if (!hasLicense) errors.push(`${posix}: fonte sem arquivo de licença na mesma pasta (ex.: OFL.txt).`);
      }
    }

    // Tamanho.
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.size > BIG_FILE_BYTES && base !== 'package-lock.json') {
      warnings.push(`${posix}: ${(stat.size / 1024 / 1024).toFixed(1)} MB — arquivo grande para o repositório.`);
    }

    // Termos proibidos: no caminho e no conteúdo de texto.
    if (!normTerms.length) continue;
    const normPath = normalizeText(posix);
    for (const t of normTerms) if (normPath.includes(t)) errors.push(`${posix}: o caminho contém um termo proibido ("${t}").`);
    if (kind || stat.size > 5 * BIG_FILE_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if (isBinary(buf)) continue;
    const lines = normalizeText(buf.toString('utf8')).split(/\r?\n/);
    for (const t of normTerms) {
      const hits = [];
      lines.forEach((l, i) => l.includes(t) && hits.push(i + 1));
      if (hits.length) errors.push(`${posix}: termo proibido "${t}" na(s) linha(s) ${hits.slice(0, 10).join(', ')}${hits.length > 10 ? '…' : ''}.`);
    }
  }

  return {ok: errors.length === 0, mode, files: files.length, terms: normTerms.length, errors, warnings};
};

export const formatReport = (r) => {
  const out = ['VERIFICAÇÃO PÚBLICA', ''];
  out.push(`  conjunto: ${r.files} arquivo(s) (${r.mode === 'git' ? 'o que o git versionaria' : 'seleção pela pasta, sem git'})`);
  out.push(`  termos:   ${r.terms} termo(s) de ${toPosix(TERMS_FILE)}`);
  out.push('');
  for (const e of r.errors) out.push(`  ✖ ${e}`);
  for (const w of r.warnings) out.push(`  ⚠ ${w}`);
  out.push('');
  out.push(r.ok ? '  ✔ Nada impede a publicação.' : `  ✖ ${r.errors.length} erro(s): corrija antes de publicar.`);
  return out.join('\n');
};

// ── CLI ─────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = verifyPublic(root);
  console.log(process.argv.includes('--json') ? JSON.stringify(r, null, 2) : `\n${formatReport(r)}\n`);
  process.exit(r.ok ? 0 : 1);
}
