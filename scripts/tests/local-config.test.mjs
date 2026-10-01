// Testes da camada local: validação de local/config.json e da trava do núcleo
// (GATE 3, GATE 4, não inventar fatos, nunca sobrescrever versões).
// Rodar na raiz: npm test
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LOCAL_CONFIG_SCHEMA, LocalConfigError, loadLocalConfig, validateLocalConfig} from '../local-config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-local-'));
after(() => fs.rmSync(TMP, {recursive: true, force: true}));

const rootWith = (content) => {
  const root = fs.mkdtempSync(path.join(TMP, 'root-'));
  if (content !== undefined) {
    fs.mkdirSync(path.join(root, 'local'), {recursive: true});
    fs.writeFileSync(path.join(root, 'local', 'config.json'), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
};

const throwsLocal = (fn, re) => assert.throws(fn, (e) => e instanceof LocalConfigError && re.test(e.message));

test('sem local/config.json: vale só o núcleo', () => {
  const r = loadLocalConfig(rootWith());
  assert.equal(r.exists, false);
  assert.deepEqual(r.config, {});
});

test('config válida (com e sem $schema) é aceita', () => {
  const a = loadLocalConfig(rootWith({agente: {projetosProtegidos: ['projeto-entregue']}}));
  assert.deepEqual(a.config.agente.projetosProtegidos, ['projeto-entregue']);
  const b = loadLocalConfig(rootWith({$schema: LOCAL_CONFIG_SCHEMA, agente: {projetosProtegidos: []}}));
  assert.equal(b.exists, true);
  // O molde público também precisa ser válido.
  const molde = JSON.parse(fs.readFileSync(path.join(REPO, 'local.exemplo', 'config.json'), 'utf8'));
  assert.doesNotThrow(() => validateLocalConfig(molde));
});

test('JSON quebrado é erro claro', () => {
  throwsLocal(() => loadLocalConfig(rootWith('{ isto não é json')), /config\.json inválido/);
  throwsLocal(() => loadLocalConfig(rootWith('[]')), /precisa ser um objeto/);
});

test('trava: campos que tentam alterar GATE 3/GATE 4 são recusados', () => {
  for (const cfg of [
    {gates: {GATE_3: 'waived'}},
    {GATE_4: 'dispensado'},
    {fluxo: {dispensarGate3: true}},
    {agente: {aprovacaoAutomatica: true}},
    {preferencias: {waiveGate4: true}},
  ]) {
    throwsLocal(() => validateLocalConfig(cfg), /trava do núcleo \(GATE 3 \/ GATE 4/);
  }
});

test('trava: campos sobre sobrescrever versões são recusados', () => {
  for (const cfg of [{render: {overwrite: true}}, {sobrescreverVersoes: true}, {agente: {versao: 'v01'}}]) {
    throwsLocal(() => validateLocalConfig(cfg), /trava do núcleo \(nunca sobrescrever versões\)/);
  }
});

test('trava: campos sobre inventar fatos são recusados (com ou sem acento)', () => {
  for (const cfg of [{permitirInventarFatos: true}, {conteudo: {fatosLivres: true}}, {'inventar-preços': true}]) {
    throwsLocal(() => validateLocalConfig(cfg), /trava do núcleo \(não inventar fatos/);
  }
});

test('lista fechada: campo desconhecido aponta para o REGRAS.md', () => {
  throwsLocal(() => validateLocalConfig({modoPadrao: 'producao'}), /campo desconhecido "modoPadrao".*REGRAS\.md/);
  throwsLocal(() => validateLocalConfig({agente: {intervalo: 5}}), /campo desconhecido "agente\.intervalo"/);
});

test('valores inválidos: $schema errado, lista que não é de slugs', () => {
  throwsLocal(() => validateLocalConfig({$schema: 'outro/9'}), /"\$schema" deve ser/);
  throwsLocal(() => validateLocalConfig({agente: {projetosProtegidos: 'projeto'}}), /lista de slugs/);
  throwsLocal(() => validateLocalConfig({agente: {projetosProtegidos: ['Projeto Com Espaço']}}), /slug inválido/);
  throwsLocal(() => validateLocalConfig({agente: []}), /"agente" deve ser um objeto/);
});

// ── Integração: os comandos param com erro claro ────────────────

const makeSandbox = () => {
  const root = fs.mkdtempSync(path.join(TMP, 'repo-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), {recursive: true, filter: (p) => !p.includes(`${path.sep}tests`)});
  fs.cpSync(path.join(REPO, 'engine', 'src'), path.join(root, 'engine', 'src'), {recursive: true});
  fs.copyFileSync(path.join(REPO, 'VERSION'), path.join(root, 'VERSION'));
  fs.copyFileSync(path.join(REPO, 'engine', 'linguagens.json'), path.join(root, 'engine', 'linguagens.json'));
  fs.cpSync(path.join(REPO, 'projects', '_MOLDE'), path.join(root, 'projects', '_MOLDE'), {recursive: true});
  for (const f of ['package.json', 'tsconfig.json', 'remotion.config.ts']) fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  return root;
};
const cli = (root, script, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {cwd: root, encoding: 'utf8', timeout: 120000});

test('integração: campo proibido faz new, status e local:check pararem sem gravar nada', () => {
  const root = makeSandbox();
  assert.equal(cli(root, 'new-project.mjs', 'proj-a', '--cliente', 'Loja Exemplo', '--projeto', 'Promo').status, 0);
  fs.mkdirSync(path.join(root, 'local'));
  fs.writeFileSync(path.join(root, 'local', 'config.json'), JSON.stringify({gates: {GATE_4: 'waived'}}));

  const n = cli(root, 'new-project.mjs', 'proj-b', '--cliente', 'Loja Exemplo', '--projeto', 'Outra');
  assert.equal(n.status, 1);
  assert.match(n.stderr, /trava do núcleo/);
  assert.equal(fs.existsSync(path.join(root, 'projects', 'proj-b')), false);

  const statusBefore = fs.readFileSync(path.join(root, 'projects', 'proj-a', 'project-status.json'), 'utf8');
  for (const args of [[], ['proj-a'], ['proj-a', 'nota', 'texto']]) {
    const s = cli(root, 'status.mjs', ...args);
    assert.equal(s.status, 1, `status ${args.join(' ')}`);
    assert.match(s.stderr, /trava do núcleo/);
  }
  assert.equal(fs.readFileSync(path.join(root, 'projects', 'proj-a', 'project-status.json'), 'utf8'), statusBefore);

  const c = cli(root, 'local-config.mjs');
  assert.equal(c.status, 1);
  assert.match(c.stderr, /trava do núcleo/);

  // Corrigido o arquivo, tudo volta a funcionar.
  fs.writeFileSync(path.join(root, 'local', 'config.json'), JSON.stringify({agente: {projetosProtegidos: ['proj-a']}}));
  assert.equal(cli(root, 'status.mjs', 'proj-a').status, 0);
  const ok = cli(root, 'local-config.mjs');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /projetos protegidos: proj-a/);
});
