// Funções compartilhadas pelos scripts de projeto. Node puro, sem dependências,
// compatível com Windows, macOS e Linux.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LocalConfigError, loadLocalConfig} from './local-config.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
export const MOLDE_DIR = path.join(PROJECTS_DIR, '_MOLDE');
export const ENGINE_SRC = path.join(ROOT, 'engine', 'src');

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEHOLDER_RE = /\{\{.+\}\}/;

export const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

/**
 * Valida a camada local (local/config.json) antes de qualquer comando.
 * Campo desconhecido ou que tente alterar uma trava do núcleo = erro claro e o comando para.
 */
export const assertLocalConfig = (root = ROOT) => {
  try {
    return loadLocalConfig(root).config;
  } catch (e) {
    if (e instanceof LocalConfigError) fail(`${e.message}\n  Confira com: npm run local:check`);
    throw e;
  }
};

/** "Loja Exemplo" → "loja-exemplo" */
export const slugify = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Separa argumentos: primeiro posicional = slug; --flag valor / --flag=valor. */
export const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  const passthrough = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s);
    const next = argv[i + 1];
    const value = inline !== undefined ? inline : next && !next.startsWith('--') ? (i++, next) : true;
    flags[key] = value;
    passthrough.push(inline !== undefined || value === true ? a : `--${key}=${value}`);
  }
  return {positional, flags, passthrough};
};

/** Carrega e valida o projeto. `forRender` exige campos completos. */
export const loadProject = (slug, {forRender = false} = {}) => {
  if (!slug) fail('Informe o slug do projeto. Ex.: npm run studio -- loja-exemplo-promo-natal');
  if (slug.startsWith('_')) fail(`${slug} não é um projeto (pastas com "_" são moldes). Crie um com: npm run new -- <slug> ...`);
  assertLocalConfig();
  const dir = path.join(PROJECTS_DIR, slug);
  if (!fs.existsSync(dir)) fail(`Projeto não encontrado: projects/${slug}/`);

  const configPath = path.join(dir, 'project.json');
  if (!fs.existsSync(configPath)) fail(`projects/${slug}/project.json não existe.`);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    fail(`project.json inválido em projects/${slug}/: ${e.message}`);
  }

  const entry = path.join(dir, 'src', 'index.ts');
  if (!fs.existsSync(entry)) fail(`Entry point não encontrado: projects/${slug}/src/index.ts`);

  const assets = path.join(dir, 'assets');
  if (!fs.existsSync(assets)) fs.mkdirSync(assets, {recursive: true});

  if (forRender) {
    for (const key of ['cliente', 'projeto']) {
      if (!config[key] || PLACEHOLDER_RE.test(config[key])) {
        fail(`"${key}" não definido em projects/${slug}/project.json.`);
      }
    }
    if (typeof config.durationSeconds !== 'number' || !(config.durationSeconds > 0)) {
      fail(`"durationSeconds" não definido em projects/${slug}/project.json (use a duração do briefing).`);
    }
  }
  return {slug, dir, config, entry, assets, renders: path.join(dir, 'renders')};
};

/** Caminho do executável JS do Remotion CLI instalado (evita problemas de shell no Windows). */
export const remotionBin = () => {
  const require = createRequire(path.join(ROOT, 'package.json'));
  let pkgPath;
  try {
    pkgPath = require.resolve('@remotion/cli/package.json');
  } catch {
    fail('Remotion não instalado. Rode "npm ci" na raiz do repositório.');
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.remotion;
  return path.join(path.dirname(pkgPath), bin);
};

/** Executa o Remotion CLI a partir da raiz (onde está remotion.config.ts). */
export const runRemotion = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [remotionBin(), ...args], {cwd: ROOT, stdio: 'inherit'});
    child.on('close', (code) => resolve(code ?? 1));
  });

export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
