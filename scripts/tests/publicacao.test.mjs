// Testes dos arquivos de publicação no GitHub (.github/workflows/):
//   - testes.yml roda a mesma verificação que o usuário roda no PC (Node do .nvmrc, npm ci, npm test);
//   - manuais.yml publica SÓ os manuais e é pulado enquanto o repositório for privado;
//   - todo "npm run <comando>" usado existe no package.json.
// Rodar na raiz: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WF = path.join(REPO, '.github', 'workflows');
const ler = (f) => fs.readFileSync(path.join(WF, f), 'utf8');

test('publicação: só os dois workflows previstos', () => {
  assert.deepEqual(fs.readdirSync(WF).sort(), ['manuais.yml', 'testes.yml']);
});

test('publicação: workflows em runner fixo (ubuntu-24.04), nunca ubuntu-latest', () => {
  for (const f of fs.readdirSync(WF)) {
    const y = ler(f);
    assert.match(y, /runs-on: ubuntu-24\.04/, `${f}: runner fixo`);
    assert.doesNotMatch(y, /ubuntu-latest/, `${f}: ubuntu-latest muda de versão sem aviso`);
  }
});

test('publicação: formulário de Issue "Relato de instalação" com os campos combinados e link no manual e no README', () => {
  const f = path.join(REPO, '.github', 'ISSUE_TEMPLATE', 'relato-de-instalacao.yml');
  const y = fs.readFileSync(f, 'utf8');
  for (const id of ['sistema', 'versao-sistema', 'node', 'npm-test', 'passo', 'tela']) assert.match(y, new RegExp(`id: ${id}\\b`), `campo ${id}`);
  assert.match(y, /^name: Relato de instalação$/m);
  const url = 'https://github.com/BRIANICK-dev/reels-engine-ia/issues/new?template=relato-de-instalacao.yml';
  assert.ok(fs.readFileSync(path.join(REPO, 'README.md'), 'utf8').includes(url), 'link no README');
  assert.ok(fs.readFileSync(path.join(REPO, 'manuais', 'fonte', 'implantacao.html'), 'utf8').includes(url), 'link no manual');
  // os passos do formulário seguem a numeração do manual
  const manual = fs.readFileSync(path.join(REPO, 'manuais', 'fonte', 'implantacao.html'), 'utf8');
  for (const m of y.matchAll(/^\s+- "(\d+)\. ([^"(]+?)\s*(?:\(|")/gm)) {
    assert.ok(new RegExp(`<span class="n">${m[1]}</span>`).test(manual), `passo ${m[1]} existe no índice do manual`);
  }
});

test('publicação: testes.yml usa o Node do .nvmrc, o lock exato e o npm test', () => {
  const y = ler('testes.yml');
  assert.match(y, /node-version-file: \.nvmrc/);
  assert.match(y, /run: npm ci\b/);
  assert.match(y, /run: npm test\b/);
  assert.match(y, /run: npm run typecheck\b/);
  assert.match(y, /npm run manuais -- --verificar/);
  assert.match(y, /permissions:\s*\n\s*contents: read/);
});

test('publicação: manuais.yml publica só os manuais e é pulado em repositório privado', () => {
  const y = ler('manuais.yml');
  assert.match(y, /if: \$\{\{ !github\.event\.repository\.private \}\}/);
  assert.match(y, /cp manuais\/implantacao\.html manuais\/uso\.html site\//);
  assert.match(y, /path: site\b/);
  assert.doesNotMatch(y, /path: \.\s*$/m, 'não publicar o repositório inteiro');
});

test('publicação: todo "npm run" dos workflows existe no package.json', () => {
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts);
  for (const f of fs.readdirSync(WF)) {
    for (const m of ler(f).matchAll(/npm run ([a-z][\w:-]*)/g)) assert.ok(scripts.includes(m[1]), `${f}: "npm run ${m[1]}" não existe`);
  }
});
