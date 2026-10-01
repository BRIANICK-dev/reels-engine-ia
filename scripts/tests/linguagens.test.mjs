// Testes do anti-engessamento: catálogo de linguagens visuais, presets de
// movimento, regra do GATE 1 (linguagem obrigatória, repetição) e o aviso de
// fonte sem aspas no preflight.
// Rodar na raiz: npm test
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import * as L from '../linguagens-lib.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-ling-'));
after(() => fs.rmSync(TMP, {recursive: true, force: true}));

const core = () => L.loadCatalog(REPO, {includeLocal: false});

// ── Catálogo do núcleo ─────────────────────────────────────────

test('catálogo do núcleo é válido e usa só presets que existem no engine', () => {
  const cat = core();
  assert.ok(cat.nucleo.length >= 10, 'pelo menos 10 linguagens');
  const {personalidades, entradas, transicoes} = cat.presets;
  assert.deepEqual(personalidades, ['suave', 'elastica', 'seca', 'cinematografica', 'mecanica', 'degraus']);
  assert.ok(transicoes.includes('wipe') && transicoes.includes('matchCut') && transicoes.includes('zoomThrough'));
  for (const l of cat.nucleo) {
    for (const e of l.entradas) assert.ok(entradas.includes(e), `${l.id}: entrada ${e}`);
    for (const t of l.transicoes) assert.ok(transicoes.includes(t), `${l.id}: transição ${t}`);
  }
});

test('toda personalidade de movimento é usada por pelo menos uma linguagem', () => {
  const cat = core();
  const used = new Set(cat.nucleo.map((l) => l.eixos.movimento));
  for (const p of cat.presets.personalidades) assert.ok(used.has(p), `personalidade sem linguagem: ${p}`);
});

test('linguagens realmente distintas: nenhum par coincide em mais de 2 eixos', () => {
  const cat = core();
  const clashes = [];
  for (let i = 0; i < cat.nucleo.length; i++) {
    for (let j = i + 1; j < cat.nucleo.length; j++) {
      const s = L.sharedAxes(cat.nucleo[i], cat.nucleo[j]);
      if (s.length > L.MAX_SHARED_AXES) clashes.push(`${cat.nucleo[i].id} × ${cat.nucleo[j].id}: ${s.join(', ')}`);
    }
  }
  assert.deepEqual(clashes, []);
  // Atenção especial: editorial minimalista × elegante/premium divergem em pelo menos 3 eixos.
  const by = (id) => cat.nucleo.find((l) => l.id === id);
  assert.ok(L.sharedAxes(by('editorial-minimalista'), by('elegante-premium')).length <= 1);
});

test('faixa de corte coerente com o ritmo; campos incompletos são recusados', () => {
  const {presets} = core();
  const base = core().nucleo[0];
  assert.deepEqual(L.validateLinguagem(base, presets), []);
  const {cor, ...semCor} = base;
  assert.ok(L.validateLinguagem(semCor, presets).some((p) => /falta o campo "cor"/.test(p)));
  assert.ok(L.validateLinguagem({...base, extra: 1}, presets).some((p) => /campo desconhecido "extra"/.test(p)));
  assert.ok(L.validateLinguagem({...base, corteSegundos: [0.3, 0.8]}, presets).some((p) => /fora da faixa do ritmo/.test(p)));
  assert.ok(L.validateLinguagem({...base, eixos: {...base.eixos, movimento: 'nervosa'}}, presets).some((p) => /eixos\.movimento/.test(p)));
  assert.ok(L.validateLinguagem({...base, transicoes: ['portal']}, presets).some((p) => /transicoes "portal" não existe/.test(p)));
});

// ── Catálogo local ─────────────────────────────────────────────

const rootWithLocal = (local) => {
  const root = fs.mkdtempSync(path.join(TMP, 'root-'));
  fs.mkdirSync(path.join(root, 'engine', 'src', 'animations'), {recursive: true});
  fs.copyFileSync(path.join(REPO, 'engine', 'linguagens.json'), path.join(root, 'engine', 'linguagens.json'));
  fs.copyFileSync(path.join(REPO, 'engine', 'src', 'animations', 'presets.ts'), path.join(root, 'engine', 'src', 'animations', 'presets.ts'));
  if (local !== undefined) {
    fs.mkdirSync(path.join(root, 'local'));
    fs.writeFileSync(path.join(root, 'local', 'linguagens.json'), typeof local === 'string' ? local : JSON.stringify(local));
  }
  return root;
};
const propria = {
  id: 'minha-linguagem',
  nome: 'Minha linguagem',
  resumo: 'Linguagem própria de teste.',
  quandoUsar: 'Sempre que fizer sentido.',
  evitarQuando: 'Quando não fizer.',
  eixos: {ritmo: 'rapido', layout: 'tela-cheia', textura: 'recortada', movimento: 'mecanica'},
  corteSegundos: [0.6, 1.0],
  entradas: ['fadeUp'],
  hook: {entrada: 'fadeUp', legivelAteSegundos: 0.5},
  transicoes: ['corte', 'wipe'],
  tipografia: 'Qualquer uma.',
  cor: 'Qualquer uma.',
};

test('local/linguagens.json: aceito com os mesmos campos; entra no catálogo como "local"', () => {
  const cat = L.loadCatalog(rootWithLocal({$schema: L.CATALOG_SCHEMA, linguagens: [propria]}));
  assert.ok(cat.ids.includes('minha-linguagem'));
  assert.equal(cat.todas.find((l) => l.id === 'minha-linguagem').origem, 'local');
  // O molde público também é válido.
  assert.doesNotThrow(() => L.loadCatalog(rootWithLocal(fs.readFileSync(path.join(REPO, 'local.exemplo', 'linguagens.json'), 'utf8'))));
});

test('local/linguagens.json: campo faltando, id do núcleo, JSON quebrado e campo extra são erros', () => {
  const {cor, ...semCor} = propria;
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [semCor]})), /local\/linguagens\.json: linguagem "minha-linguagem": falta o campo "cor"/);
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [{...propria, id: 'pop-colorido'}]})), /id "pop-colorido" já existe no núcleo/);
  assert.throws(() => L.loadCatalog(rootWithLocal('{ quebrado')), /local\/linguagens\.json inválido/);
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [], gates: {}})), /campo desconhecido "gates"/);
});

test('local/linguagens.json: linguagem parecida demais com uma do núcleo gera aviso', () => {
  const clone = {...propria, eixos: {ritmo: 'rapido', layout: 'grid', textura: 'recortada', movimento: 'elastica'}, corteSegundos: [0.5, 1.2]};
  const cat = L.loadCatalog(rootWithLocal({linguagens: [clone]}));
  assert.ok(cat.avisos.some((a) => /"minha-linguagem" coincide com "pop-colorido" em 4 eixos/.test(a)));
});

// ── Repetição ──────────────────────────────────────────────────

test('repetição: mesmo cliente nas 3 últimas produções exige motivo; outros clientes só avisam', () => {
  const h = [
    {slug: 'p5', clienteKey: 'loja-a', linguagem: 'pop-colorido', criadoEm: '2026-05'},
    {slug: 'p4', clienteKey: 'loja-b', linguagem: 'retro-filme', criadoEm: '2026-04'},
    {slug: 'p3', clienteKey: 'loja-a', linguagem: 'retro-filme', criadoEm: '2026-03'},
    {slug: 'p2', clienteKey: 'loja-a', linguagem: 'interface-tech', criadoEm: '2026-02'},
    {slug: 'p1', clienteKey: 'loja-a', linguagem: 'elegante-premium', criadoEm: '2026-01'},
  ];
  assert.deepEqual(L.repetition({slug: 'novo', cliente: 'Loja A', linguagem: 'retro-filme'}, h), {mesmoCliente: ['p3'], outrosClientes: ['p4']});
  // p1 é a 4ª produção da Loja A: fora da janela de 3.
  assert.deepEqual(L.repetition({slug: 'novo', cliente: 'Loja A', linguagem: 'elegante-premium'}, h).mesmoCliente, []);
  assert.deepEqual(L.repetition({slug: 'p5', cliente: 'Loja A', linguagem: 'pop-colorido'}, h).mesmoCliente, [], 'o próprio projeto não conta');
  assert.equal(L.validReason('Pedido do cliente: manter a campanha'), true);
  assert.equal(L.validReason('curto'), false);
  assert.equal(L.validReason('linha um\nlinha dois bem longa'), false);
});

// ── Integração com o controller ────────────────────────────────

const makeSandbox = () => {
  const root = fs.mkdtempSync(path.join(TMP, 'repo-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), {recursive: true, filter: (p) => !p.includes(`${path.sep}tests`)});
  fs.cpSync(path.join(REPO, 'engine', 'src'), path.join(root, 'engine', 'src'), {recursive: true});
  fs.copyFileSync(path.join(REPO, 'engine', 'linguagens.json'), path.join(root, 'engine', 'linguagens.json'));
  fs.copyFileSync(path.join(REPO, 'VERSION'), path.join(root, 'VERSION'));
  fs.cpSync(path.join(REPO, 'projects', '_MOLDE'), path.join(root, 'projects', '_MOLDE'), {recursive: true});
  for (const f of ['package.json', 'tsconfig.json', 'remotion.config.ts']) fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  return root;
};
const cli = (root, script, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {cwd: root, encoding: 'utf8', timeout: 120000});

/** Cria um projeto e o leva até 01_CONCEPT com GATE 1 aprovado. */
const toConcept = (root, slug, cliente, linguagem) => {
  assert.equal(cli(root, 'new-project.mjs', slug, '--cliente', cliente, '--projeto', slug, '--duracao', '10', '--linguagem', linguagem).status, 0);
  const dir = path.join(root, 'projects', slug);
  fs.appendFileSync(path.join(dir, 'briefing.md'), '\nBriefing registrado a partir do chat.\n');
  assert.equal(cli(root, 'status.mjs', slug, 'avancar').status, 0);
  assert.equal(cli(root, 'status.mjs', slug, 'aprovar', 'GATE_1', '--nota', 'ok').status, 0);
  return dir;
};

test('integração: repetir a linguagem do mesmo cliente exige "linguagemMotivo"; outro cliente só avisa', () => {
  const root = makeSandbox();
  toConcept(root, 'loja-a-verao', 'Loja A', 'retro-filme');
  assert.equal(cli(root, 'status.mjs', 'loja-a-verao', 'avancar').status, 0);

  // Mesmo cliente, mesma linguagem: bloqueia até registrar o motivo (uma linha).
  const dir = toConcept(root, 'loja-a-inverno', 'Loja A', 'retro-filme');
  let r = cli(root, 'status.mjs', 'loja-a-inverno', 'avancar');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /repete a de uma produção recente do mesmo cliente \(loja-a-verao\)/);
  const pj = path.join(dir, 'project.json');
  fs.writeFileSync(pj, JSON.stringify({...JSON.parse(fs.readFileSync(pj, 'utf8')), linguagemMotivo: 'Continuação da mesma campanha, a pedido do cliente'}));
  assert.equal(cli(root, 'status.mjs', 'loja-a-inverno', 'avancar').status, 0);

  // Outro cliente, mesma linguagem: passa, com aviso.
  toConcept(root, 'loja-b-promo', 'Loja B', 'retro-filme');
  r = cli(root, 'status.mjs', 'loja-b-promo');
  assert.match(r.stdout, /Avisos:[\s\S]*"retro-filme" também foi usada recentemente para outros clientes/);
  r = cli(root, 'status.mjs', 'loja-b-promo', 'avancar');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Aviso: a linguagem "retro-filme"/);

  // --linguagem inexistente é recusada já na criação; a CLI lista o uso por cliente.
  r = cli(root, 'new-project.mjs', 'x-y', '--cliente', 'Loja A', '--projeto', 'X', '--linguagem', 'nao-existe');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /não existe no catálogo/);
  r = cli(root, 'linguagens.mjs', '--cliente', 'Loja A');
  assert.match(r.stdout, /loja-a-inverno\s+retro-filme/);
});

// ── Fonte sem aspas (D6 / armadilha 3) ─────────────────────────

test('preflight: fontFamily com número e sem aspas gera aviso; com aspas ou fontCss não', async () => {
  const {unquotedNumericFamilies} = await import(pathToFileURL(path.join(REPO, 'scripts', 'preflight-lib.mjs')).href);
  assert.deepEqual(unquotedNumericFamilies('Fonte 2, sans-serif'), ['Fonte 2']);
  assert.deepEqual(unquotedNumericFamilies("'Fonte 2', sans-serif"), []);
  assert.deepEqual(unquotedNumericFamilies('"Mono 3D", Arial, sans-serif'), []);
  assert.deepEqual(unquotedNumericFamilies('Arial, sans-serif'), []);

  const root = makeSandbox();
  assert.equal(cli(root, 'new-project.mjs', 'fonte-teste', '--cliente', 'Loja', '--projeto', 'Fonte', '--duracao', '2').status, 0);
  const main = path.join(root, 'projects', 'fonte-teste', 'src', 'compositions', 'Main.tsx');
  fs.writeFileSync(main, fs.readFileSync(main, 'utf8').replace(`fontFamily: "'Arial', sans-serif"`, "fontFamily: 'Fonte 2, sans-serif'"));
  const r = cli(root, 'preflight.mjs', 'fonte-teste', '--sem-typecheck');
  assert.match(r.stdout, /Main\.tsx:\d+: fontFamily "Fonte 2, sans-serif" — o nome "Fonte 2" tem número e está sem aspas/);
});

// ── Hook legível rápido (toda linguagem) ───────────────────────

/** Carrega engine/src/animations/presets.ts de verdade (TypeScript transpilado + remotion real). */
const loadPresets = () => {
  const req = createRequire(path.join(REPO, 'package.json'));
  const ts = req('typescript');
  const src = fs.readFileSync(path.join(REPO, 'engine', 'src', 'animations', 'presets.ts'), 'utf8');
  const out = ts.transpileModule(src, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const m = {exports: {}};
  new Function('exports', 'require', 'module', out)(m.exports, req, m);
  return m.exports;
};

/** O estilo deixa o texto legível? Opaco, sem desfoque, sem máscara cobrindo, no lugar. */
const legible = (st) => {
  const opacity = st.opacity ?? 1;
  const blur = Number((st.filter ?? '').match(/blur\(([\d.]+)px\)/)?.[1] ?? 0);
  const clip = st.clipPath ? [...st.clipPath.matchAll(/(-?[\d.]+)%/g)].map((x) => Number(x[1])) : [];
  const scale = Number((st.transform ?? '').match(/scale\(([\d.]+)\)/)?.[1] ?? 1);
  const move = [...(st.transform ?? '').matchAll(/translate[XY]\((-?[\d.]+)px\)/g)].map((x) => Math.abs(Number(x[1])));
  return opacity >= 0.95 && blur <= 1 && clip.every((v) => v <= 0) && scale >= 0.95 && move.every((v) => v <= 4);
};

test('hook: em TODA linguagem, o texto do hook está legível até o frame 15 (0,5 s)', () => {
  const P = loadPresets();
  assert.equal(P.HOOK_LEGIBLE_SECONDS, 0.5);
  const fps = 30;
  for (const l of core().nucleo) {
    assert.ok(l.hook.legivelAteSegundos <= 0.5, `${l.id}: hook.legivelAteSegundos`);
    const t = P.hookTiming(l.eixos.movimento, fps);
    const frame = Math.round(l.hook.legivelAteSegundos * fps);
    const st = P.entranceStyle(l.hook.entrada, P.motionProgress({frame, fps, personality: l.eixos.movimento, ...t}));
    assert.ok(legible(st), `${l.id} (${l.hook.entrada} · ${l.eixos.movimento}) não está legível no frame ${frame}: ${JSON.stringify(st)}`);
  }
  // Sem hookTiming, a personalidade lenta NÃO estaria legível: a regra faz diferença.
  const lento = P.entranceStyle('blurIn', P.motionProgress({frame: 15, fps, personality: 'cinematografica'}));
  assert.equal(legible(lento), false);
});

test('hook: local/linguagens.json sem hook ou com hook lento é recusado', () => {
  const {hook, ...semHook} = propria;
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [semHook]})), /falta o campo "hook"/);
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [{...propria, hook: {entrada: 'fadeUp', legivelAteSegundos: 0.8}}]})), /no máximo 0\.5 s/);
  assert.throws(() => L.loadCatalog(rootWithLocal({linguagens: [{...propria, hook: {entrada: 'popIn', legivelAteSegundos: 0.5}}]})), /precisa ser uma das entradas/);
});

test('exemplo: o hook de cada variante usa hookTiming() e o CTA final funciona sozinho', () => {
  const dir = path.join(REPO, 'projects', 'exemplo-loja-promo', 'src', 'variantes');
  for (const f of ['Cinetica.tsx', 'Premium.tsx', 'Colagem.tsx']) assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /hookTiming\(/, f);
  const cenas = fs.readFileSync(path.join(dir, 'cenas.ts'), 'utf8');
  for (const id of ['c12', 'p04', 'k06']) {
    const label = cenas.match(new RegExp(`id: '${id}'[^}]*label: '([^']*)'`))[1].replace(/\\n/g, ' ');
    assert.match(label, /visite a loja/i, `${id}: o último corte precisa trazer o CTA completo ("${label}")`);
  }
});

test('legibilidade: mínimos do preflight iguais aos do engine', async () => {
  const {LEGIBILITY} = await import(pathToFileURL(path.join(REPO, 'scripts', 'preflight-lib.mjs')).href);
  const ts = fs.readFileSync(path.join(REPO, 'engine', 'src', 'utils', 'legibility.ts'), 'utf8');
  const num = (k) => Number(ts.match(new RegExp(`${k}: ([\\d.]+)`))[1]);
  assert.equal(LEGIBILITY.minFontSize, num('minFontSize'));
  assert.equal(LEGIBILITY.minFontSizeThin, num('minFontSizeThin'));
  assert.equal(LEGIBILITY.minContrast, num('minContrast'));
});
