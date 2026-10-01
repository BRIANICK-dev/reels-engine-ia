// Cria um projeto independente em projects/<slug>/ a partir do _MOLDE
// e congela uma cópia do engine em projects/<slug>/src/engine/.
//
// Uso: npm run new -- <slug> --cliente "<Cliente>" --projeto "<Projeto>" [--duracao <segundos>] [--linguagem <id>]
import fs from 'node:fs';
import path from 'node:path';
import {ENGINE_SRC, MOLDE_DIR, PROJECTS_DIR, ROOT, SLUG_RE, assertLocalConfig, fail, parseArgs, rel} from './lib.mjs';
import {createStatus, saveStatus} from './status-lib.mjs';
import {LinguagensError, loadCatalog} from './linguagens-lib.mjs';

assertLocalConfig();

const {positional, flags} = parseArgs(process.argv.slice(2));
const slug = positional[0];
const cliente = typeof flags.cliente === 'string' ? flags.cliente.trim() : '';
const projeto = typeof flags.projeto === 'string' ? flags.projeto.trim() : '';

if (!slug || !cliente || !projeto) {
  fail('Uso: npm run new -- <slug> --cliente "<Cliente>" --projeto "<Projeto>" [--duracao <segundos>]');
}
if (!SLUG_RE.test(slug)) {
  fail(`Slug inválido: "${slug}". Use minúsculas, números e hífens (ex.: loja-exemplo-promo-natal).`);
}

let durationSeconds = null;
if (flags.duracao !== undefined) {
  durationSeconds = Number(flags.duracao);
  if (!(durationSeconds > 0)) fail(`--duracao inválida: "${flags.duracao}".`);
}

// Linguagem visual (opcional aqui; obrigatória na saída de 01_CONCEPT).
let linguagem = null;
if (flags.linguagem !== undefined) {
  linguagem = String(flags.linguagem).trim();
  try {
    const {ids} = loadCatalog(ROOT);
    if (!ids.includes(linguagem)) fail(`--linguagem "${linguagem}" não existe no catálogo. Veja: npm run linguagens`);
  } catch (e) {
    if (e instanceof LinguagensError) fail(e.message);
    throw e;
  }
}

const dest = path.join(PROJECTS_DIR, slug);
if (fs.existsSync(dest)) fail(`projects/${slug}/ já existe. Nada foi alterado.`);
if (!fs.existsSync(MOLDE_DIR)) fail('projects/_MOLDE/ não encontrado.');
if (!fs.existsSync(ENGINE_SRC)) fail('engine/src/ não encontrado.');

// O engine é biblioteca: não pode conter entry point, Root ou composições.
// Arquivos assim (ex.: restos da V1) seriam copiados para o projeto e gerariam
// uma segunda raiz Remotion concorrente dentro de src/engine/.
const LEGACY = ['Root.tsx', 'compositions', 'scenes'].filter((n) => fs.existsSync(path.join(ENGINE_SRC, n)));
if (LEGACY.length) {
  fail(`engine/src/ contém arquivos que não pertencem à biblioteca: ${LEGACY.join(', ')}.\n  Remova-os antes de criar projetos (ver engine/README.md).`);
}

// Versão única do motor: arquivo VERSION na raiz (semver). É gravada como
// engineVersion no project.json e identifica a cópia congelada em src/engine/.
const versionFile = path.join(ROOT, 'VERSION');
if (!fs.existsSync(versionFile)) fail('Arquivo VERSION não encontrado na raiz do repositório.');
const engineVersion = fs.readFileSync(versionFile, 'utf8').trim();
const createdAt = new Date().toISOString().slice(0, 10);

// 1. Molde
fs.cpSync(MOLDE_DIR, dest, {recursive: true});

// 2. Snapshot do engine (sem .gitkeep)
fs.cpSync(ENGINE_SRC, path.join(dest, 'src', 'engine'), {
  recursive: true,
  filter: (src) => path.basename(src) !== '.gitkeep',
});

// 3. project.json
const config = {slug, cliente, projeto, durationSeconds, linguagem, engineVersion, createdAt};
fs.writeFileSync(path.join(dest, 'project.json'), JSON.stringify(config, null, 2) + '\n');

// 3b. Estado de produção (Production Controller — docs/09-FLUXO-DE-PRODUCAO.md)
saveStatus(dest, createStatus({slug}));

// 4. Placeholders nos .md
const replacements = {
  '{{SLUG}}': slug,
  '{{CLIENTE}}': cliente,
  '{{PROJETO}}': projeto,
  '{{ENGINE_VERSION}}': engineVersion,
  '{{CREATED_AT}}': createdAt,
};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(dest, 'src', 'engine')) walk(full);
    } else if (entry.name.endsWith('.md')) {
      let text = fs.readFileSync(full, 'utf8');
      for (const [k, v] of Object.entries(replacements)) text = text.split(k).join(v);
      fs.writeFileSync(full, text);
    }
  }
};
walk(dest);

console.log(`
✔ Projeto criado: ${rel(dest)}/
  cliente: ${cliente}
  projeto: ${projeto}
  duração: ${durationSeconds ?? 'não definida — preencha durationSeconds em project.json'}
  engine:  v${engineVersion} (cópia em src/engine/)
  estado:  00_BRIEFING (project-status.json)

Próximos passos:
  1. Responda as 8 perguntas de ${rel(path.join(dest, 'briefing.md'))} (ou descreva o vídeo no chat)
  2. Coloque os arquivos em ${rel(path.join(dest, 'assets'))}/
  3. npm run status -- ${slug}   (etapa atual e o que falta)
`);
