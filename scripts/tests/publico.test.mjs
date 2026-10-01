// Testes da verificação pública (npm run verificar-publico).
// Rodar na raiz: npm test
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectFiles, verifyPublic, walkPublicFiles} from '../verificar-publico.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-publico-'));
after(() => fs.rmSync(TMP, {recursive: true, force: true}));

const put = (root, rel, content = 'x') => {
  const f = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, content);
};

/** Repositório mínimo, sem git: motor + conteúdo do usuário que NÃO deve ser verificado. */
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(TMP, 'root-'));
  put(root, 'README.md', '# Motor\nExemplo: loja-exemplo-promo-natal\n');
  put(root, 'docs/00-NUCLEO.md', '# Núcleo\n');
  put(root, 'scripts/lib.mjs', 'export const a = 1;\n');
  put(root, 'projects/_MOLDE/briefing.md', '# Briefing\n');
  put(root, 'projects/_MOLDE/assets/.gitkeep', '');
  put(root, 'clients/_MOLDE-DNA-DE-CLIENTE.md', '# DNA\n');
  // Conteúdo do usuário: fora do conjunto público.
  put(root, 'projects/video-do-cliente/briefing.md', 'Cliente Secreto Ltda\n');
  put(root, 'projects/_MOLDE/assets/foto.png', 'png');
  put(root, 'projects/_MOLDE/renders/v01.mp4', 'mp4');
  put(root, 'clients/cliente-secreto.md', 'Cliente Secreto Ltda\n');
  put(root, 'local/REGRAS.md', 'Cliente Secreto Ltda\n');
  put(root, '.reels-engine/agente.log', 'log');
  put(root, 'node_modules/pkg/index.js', 'Cliente Secreto');
  put(root, 'desktop.ini', '[x]');
  return root;
};
const setTerms = (root, lines) => put(root, 'local/termos-proibidos.txt', lines.join('\n'));

test('seleção sem git espelha o .gitignore: conteúdo do usuário fica de fora', () => {
  const root = makeRoot();
  const files = walkPublicFiles(root);
  assert.deepEqual(files, ['README.md', 'clients/_MOLDE-DNA-DE-CLIENTE.md', 'docs/00-NUCLEO.md', 'projects/_MOLDE/assets/.gitkeep', 'projects/_MOLDE/briefing.md', 'scripts/lib.mjs']);
});

test('sem lista de termos: só aviso; repositório limpo passa', () => {
  const root = makeRoot();
  const r = verifyPublic(root);
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.ok(r.warnings.some((w) => /termos-proibidos\.txt não existe/.test(w)));
});

test('termo proibido no conteúdo e no nome do arquivo, sem diferenciar maiúsculas e acentos', () => {
  const root = makeRoot();
  setTerms(root, ['# comentário ignorado', '', 'Cliente Secreto', 'agência modelo']);
  put(root, 'docs/05-REMOTION.md', 'linha 1\nFeito para o CLIENTE SECRETO\n');
  put(root, 'docs/agencia-modelo.md', 'ok');
  put(root, 'docs/06.md', 'Assinado: Agencia Modelo\n');
  const r = verifyPublic(root);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith('docs/05-REMOTION.md') && /linha\(s\) 2/.test(e)));
  assert.ok(r.errors.some((e) => e.startsWith('docs/06.md') && /agencia modelo/.test(e)));
  // Nome com hífen não casa com o termo com espaço; conteúdo do usuário não é lido.
  assert.equal(r.errors.some((e) => e.includes('video-do-cliente') || e.includes('cliente-secreto.md')), false);
});

test('termo curto gera aviso de falso positivo', () => {
  const root = makeRoot();
  setTerms(root, ['abc']);
  const r = verifyPublic(root);
  assert.ok(r.warnings.some((w) => /menos de 4 letras/.test(w)));
});

test('mídia: proibida fora do exemplo; no exemplo só a fonte, com licença ao lado', () => {
  const root = makeRoot();
  put(root, 'docs/diagrama.png', 'png');
  put(root, 'projects/exemplo-loja-promo/assets/trilha.mp3', 'mp3');
  put(root, 'projects/exemplo-loja-promo/assets/fonts/Fonte-Livre.ttf', 'ttf');
  let r = verifyPublic(root);
  assert.ok(r.errors.some((e) => e.startsWith('docs/diagrama.png') && /mídia \(imagem\)/.test(e)));
  assert.ok(r.errors.some((e) => e.includes('trilha.mp3') && /só a fonte livre/.test(e)));
  assert.ok(r.errors.some((e) => e.includes('Fonte-Livre.ttf') && /sem arquivo de licença/.test(e)));

  fs.rmSync(path.join(root, 'docs', 'diagrama.png'));
  fs.rmSync(path.join(root, 'projects', 'exemplo-loja-promo', 'assets', 'trilha.mp3'));
  put(root, 'projects/exemplo-loja-promo/assets/fonts/OFL.txt', 'SIL Open Font License');
  r = verifyPublic(root);
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('arquivo grande gera aviso (package-lock.json é exceção)', () => {
  const root = makeRoot();
  put(root, 'docs/grande.md', 'a'.repeat(1024 * 1024 + 10));
  put(root, 'package-lock.json', '{' + ' '.repeat(1024 * 1024 + 10) + '}');
  const r = verifyPublic(root);
  assert.ok(r.warnings.some((w) => w.startsWith('docs/grande.md')));
  assert.equal(r.warnings.some((w) => w.startsWith('package-lock.json')), false);
});

const hasGit = spawnSync('git', ['--version']).status === 0;

test('com git: usa o que o git versionaria e acusa local/ e .env se o .gitignore falhar', {skip: !hasGit && 'git não instalado'}, () => {
  const root = makeRoot();
  const git = (...a) => spawnSync('git', a, {cwd: root, encoding: 'utf8'});
  assert.equal(git('init', '-q').status, 0);
  // .gitignore incompleto de propósito: não ignora local/ nem .env
  put(root, '.gitignore', 'node_modules/\nprojects/video-do-cliente/\nclients/cliente-secreto.md\n.reels-engine/\n');
  put(root, '.env', 'SEGREDO=1');
  const {mode, files} = collectFiles(root);
  assert.equal(mode, 'git');
  assert.ok(files.includes('local/REGRAS.md'));
  const r = verifyPublic(root);
  assert.ok(r.errors.some((e) => e.startsWith('local/REGRAS.md') && /camada local/.test(e)));
  assert.ok(r.errors.some((e) => e.startsWith('.env') && /segredos/.test(e)));
});

test('saídas do app ("Claude outputs/"): fora do conjunto, com aviso; no conjunto, erro', {skip: !hasGit && 'git não instalado'}, () => {
  const root = makeRoot();
  put(root, 'Claude outputs/lado-a-lado.png', 'png');
  put(root, 'Claude outputs/vitrine.mp4', 'mp4');
  // Sem git: a seleção própria não inclui a pasta, mas avisa que ela existe.
  let r = verifyPublic(root, {files: walkPublicFiles(root), mode: 'pasta'});
  assert.equal(r.errors.some((e) => e.includes('Claude outputs')), false);
  assert.ok(r.warnings.some((w) => /"Claude outputs\/" existe na pasta \(2 arquivo\(s\)/.test(w)));
  // Com git e .gitignore SEM a regra: os arquivos entram no conjunto → erro.
  spawnSync('git', ['init', '-q'], {cwd: root});
  put(root, '.gitignore', 'node_modules/\nlocal/\n.reels-engine/\nprojects/video-do-cliente/\nclients/cliente-secreto.md\n');
  r = verifyPublic(root);
  assert.ok(r.errors.some((e) => e.startsWith('Claude outputs/lado-a-lado.png') && /saída do app Claude/.test(e)));
});

test('o .gitignore do motor ignora "Claude outputs/"', () => {
  const gi = fs.readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');
  assert.match(gi, /^Claude outputs\/$/m);
});
