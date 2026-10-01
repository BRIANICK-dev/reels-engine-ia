// Testes dos manuais (manuais/implantacao.html e manuais/uso.html):
//   - os arquivos gerados estão em dia com manuais/fonte/ (rode "npm run manuais");
//   - funcionam offline (nada externo carregado, nenhum data: URI) e não trazem mídia;
//   - âncoras, links entre os dois manuais e ids estão corretos;
//   - o que os manuais citam existe no motor (comandos, linguagens, perguntas do briefing, versão).
// Rodar na raiz: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {MANUAIS, gerarManuais, perguntasDoMolde} from '../manuais.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(REPO, 'manuais');
const ler = (rel) => fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8');
const gerado = Object.fromEntries(MANUAIS.map((n) => [n, ler(`manuais/${n}.html`)]));
const fonte = Object.fromEntries(MANUAIS.map((n) => [n, ler(`manuais/fonte/${n}.html`)]));
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const semScripts = (html) => html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');

test('manuais: os arquivos gerados estão em dia com manuais/fonte/ (rode "npm run manuais")', async () => {
  const novo = await gerarManuais(REPO);
  for (const n of MANUAIS) assert.equal(gerado[n], novo[`manuais/${n}.html`], `manuais/${n}.html desatualizado — rode: npm run manuais`);
});

test('manuais: funcionam offline (sem script, estilo, fonte ou imagem externa; sem data: URI)', () => {
  for (const n of MANUAIS) {
    const h = gerado[n];
    assert.doesNotMatch(h, /<script[^>]+src=/i, `${n}: <script src> externo`);
    assert.doesNotMatch(h, /<link[^>]+href=/i, `${n}: <link href> externo`);
    assert.doesNotMatch(h, /@import|url\(\s*['"]?https?:/i, `${n}: CSS externo`);
    assert.doesNotMatch(h, /<img\b|<iframe\b|<video\b|<audio\b/i, `${n}: mídia embutida`);
    assert.doesNotMatch(h, /data:[a-z]+\/[a-z0-9.+-]+[;,]/i, `${n}: data: URI`);
  }
});

test('manuais: links externos só para endereços oficiais conhecidos', () => {
  const PERMITIDOS = ['nodejs.org', 'github.com', 'git-scm.com', 'code.claude.com', 'www.remotion.dev'];
  for (const n of MANUAIS) {
    for (const m of semScripts(gerado[n]).matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      const host = new URL(m[1]).host;
      assert.ok(PERMITIDOS.includes(host), `${n}: link externo não previsto: ${m[1]}`);
    }
  }
});

test('manuais: a pasta manuais/ não contém mídia', () => {
  const ok = new Set(['.html', '.css', '.js', '.mjs', '.md']);
  const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const fora = walk(DIR).filter((f) => !ok.has(path.extname(f).toLowerCase())).map((f) => path.relative(REPO, f));
  assert.deepEqual(fora, []);
});

test('manuais: ids únicos, âncoras internas e links entre os manuais existem', () => {
  const html = Object.fromEntries(MANUAIS.map((n) => [n, semScripts(gerado[n])]));
  const todos = Object.fromEntries(MANUAIS.map((n) => [n, ids(html[n])]));
  for (const n of MANUAIS) {
    const dup = todos[n].filter((id, i, a) => a.indexOf(id) !== i);
    assert.deepEqual(dup, [], `${n}: ids repetidos`);
    for (const m of html[n].matchAll(/href="([a-z]*\.html)?#([^"]+)"/g)) {
      const alvo = m[1] ? m[1].replace('.html', '') : n;
      assert.ok(MANUAIS.includes(alvo), `${n}: link para manual inexistente: ${m[0]}`);
      assert.ok(todos[alvo].includes(m[2]), `${n}: âncora inexistente: ${m[0]}`);
    }
    for (const m of html[n].matchAll(/href="([a-z]+\.html)"/g)) assert.ok(MANUAIS.includes(m[1].replace('.html', '')), `${n}: ${m[0]}`);
  }
});

test('manuais: todo "npm run <comando>" citado existe no package.json', () => {
  const scripts = Object.keys(JSON.parse(ler('package.json')).scripts);
  for (const n of MANUAIS) {
    for (const m of semScripts(gerado[n]).matchAll(/npm run ([a-z][\w:-]*)/g)) {
      assert.ok(scripts.includes(m[1]), `${n}: "npm run ${m[1]}" não existe no package.json`);
    }
  }
});

test('manuais: as 10 linguagens do catálogo têm cartão e miniatura (e nenhuma sobra)', async () => {
  const cat = JSON.parse(ler('engine/linguagens.json')).linguagens.map((l) => l.id).sort();
  const {MINIATURAS} = await import(pathToFileURL(path.join(DIR, 'fonte', 'graficos.mjs')).href);
  assert.deepEqual(Object.keys(MINIATURAS).sort(), cat);
  for (const id of cat) assert.ok(gerado.uso.includes(`id="lang-${id}"`), `uso: sem cartão para ${id}`);
});

test('manuais: as 8 perguntas do Briefing Rápido vêm do molde', () => {
  const p = perguntasDoMolde(REPO);
  assert.deepEqual(Object.keys(p), ['1', '2', '3', '4', '5', '6', '7', '8']);
  for (let i = 1; i <= 8; i++) assert.ok(fonte.uso.includes(`{{PERGUNTA:${i}}}`), `fonte do uso sem {{PERGUNTA:${i}}}`);
});

test('manuais: mostram a versão do motor (VERSION)', () => {
  const v = ler('VERSION').trim();
  for (const n of MANUAIS) assert.ok(gerado[n].includes(`motor v${v}`), `${n} sem "motor v${v}"`);
});

test('manuais: subtítulos (h3) sem numeração; numeração só nos passos', () => {
  for (const n of MANUAIS) {
    for (const m of fonte[n].matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)) assert.doesNotMatch(m[1].trim(), /^\d+[.)]\s/, `${n}: h3 numerado: ${m[1]}`);
  }
});

test('manuais: licença do Remotion marcada como resumo, com link oficial (manual e README)', () => {
  const imp = gerado.implantacao;
  assert.match(imp, /Resumo — não substitui a licença oficial/);
  assert.match(imp, /Em caso de dúvida, vale o texto oficial/);
  assert.match(imp, /href="https:\/\/www\.remotion\.dev\/license"/);
  const readme = ler('README.md');
  assert.match(readme, /resumo/i);
  assert.match(readme, /https:\/\/www\.remotion\.dev\/license/);
  assert.match(readme, /em caso de dúvida, vale o texto oficial/i);
});

test('manuais: tamanho razoável (até 400 KB cada)', () => {
  for (const n of MANUAIS) assert.ok(Buffer.byteLength(gerado[n]) < 400 * 1024, `${n} passou de 400 KB`);
});
