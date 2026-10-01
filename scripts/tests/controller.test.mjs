// Testes do Production Controller. Node puro (node:test), sem dependências.
// Rodar na raiz: npm test
//
// Não toca em nenhum projeto real: os testes de integração copiam scripts/,
// engine/ e projects/_MOLDE/ para uma pasta temporária e trabalham lá.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as S from '../status-lib.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Unidade: transições puras ──────────────────────────────────

const cfg = {cliente: 'Cliente Teste', projeto: 'Projeto Teste', durationSeconds: 30, linguagem: 'tipografia-cinetica'};
// Resultados aprovados (Fase 2): o avancar de 06/08 exige preflight e o de 09 exige inspect.
const PF = {ok: true, errors: 0, warnings: 0};
const INSP = {ok: true, errors: 0, warnings: 0};

test('estado inicial é válido e começa em 00_BRIEFING', () => {
  const s = S.createStatus({slug: 'x'});
  assert.equal(s.stage, '00_BRIEFING');
  assert.deepEqual(s.completed, []);
  assert.equal(s.projectVersion, 'v01');
  assert.deepEqual(S.validateStatus(s), []);
  for (const g of Object.keys(S.GATES)) assert.equal(s.gates[g].status, 'pending');
});

test('00_BRIEFING exige cliente, projeto e durationSeconds', () => {
  const s = S.createStatus({slug: 'x'});
  assert.throws(() => S.advance(s, {config: {cliente: 'A', projeto: 'B', durationSeconds: null}}), /durationSeconds/);
  const s1 = S.advance(s, {config: cfg});
  assert.equal(s1.stage, '01_CONCEPT');
  assert.deepEqual(s1.completed, ['00_BRIEFING']);
  assert.equal(s.stage, '00_BRIEFING', 'transição não pode mutar o objeto original');
});

test('GATE 1 bloqueia a saída do conceito; aprovação libera', () => {
  let s = S.advance(S.createStatus({slug: 'x'}), {config: cfg});
  assert.throws(() => S.advance(s, {config: cfg}), /GATE_1/);
  assert.throws(() => S.approve(s, 'GATE_1', {}), /--nota/);
  s = S.approve(s, 'gate1', {note: 'Conceito B'});
  assert.equal(s.gates.GATE_1.status, 'approved');
  s = S.advance(s, {config: cfg});
  assert.equal(s.stage, '02_SCRIPT');
});

test('GATE 1 e 2 podem ser dispensados com motivo; GATE 3 e 4 nunca', () => {
  let s = S.advance(S.createStatus({slug: 'x'}), {config: cfg});
  assert.throws(() => S.waive(s, 'GATE_1', {}), /--motivo/);
  s = S.waive(s, 'GATE_1', {reason: 'Briefing MODO PRODUÇÃO define o conceito'});
  assert.equal(s.gates.GATE_1.status, 'waived');
  assert.throws(() => S.waive(s, 'GATE_3', {reason: 'x'}), /não pode ser dispensado/);
  assert.throws(() => S.waive(s, 'GATE_4', {reason: 'x'}), /não pode ser dispensado/);
});

test('GATE 2 pode ser aprovado em 02_SCRIPT e só é exigido ao sair de 03_STORYBOARD', () => {
  let s = S.createStatus({slug: 'x', stage: '02_SCRIPT'});
  assert.throws(() => S.approve(s, 'GATE_3', {note: 'x'}), /a partir de 07_STUDIO/);
  s = S.advance(s, {config: cfg}); // 02 → 03 sem gate (roteiro e storyboard são aprovados juntos)
  assert.equal(s.stage, '03_STORYBOARD');
  assert.throws(() => S.advance(s, {config: cfg}), /GATE_2/);
  s = S.approve(s, 'GATE_2', {note: 'Roteiro + storyboard v1'});
  s = S.advance(s, {config: cfg});
  assert.equal(s.stage, '04_ASSETS');
});

test('bloqueio ativo impede avanço; desbloqueio libera', () => {
  let s = S.createStatus({slug: 'x', stage: '04_ASSETS'});
  s = S.block(s, 'Falta o vídeo de drone', {owner: 'usuario'});
  assert.equal(s.blockers[0].id, 'B1');
  assert.throws(() => S.advance(s, {config: cfg}), /bloqueio/);
  assert.match(S.waitingFor(s)[0], /B1/);
  s = S.unblock(s, 'b1', {note: 'Recebido'});
  s = S.advance(s, {config: cfg});
  assert.equal(s.stage, '05_IMPLEMENTATION');
  assert.throws(() => S.unblock(s, 'B1'), /Nenhum bloqueio ativo/);
});

test('próxima ação: padrão por etapa, personalizável e reiniciada ao avançar', () => {
  let s = S.createStatus({slug: 'x', stage: '05_IMPLEMENTATION'});
  assert.equal(S.nextActionOf(s).owner, 'claude');
  s = S.setNext(s, 'Ajustar a cena 3', {owner: 'claude'});
  assert.equal(S.nextActionOf(s).text, 'Ajustar a cena 3');
  s = S.advance(s, {config: cfg});
  assert.equal(S.nextActionOf(s).text, S.DEFAULT_NEXT['06_VALIDATION'].text);
});

test('reabrir invalida só os gates dependentes e preserva os anteriores', () => {
  let s = S.createStatus({slug: 'x', stage: '01_CONCEPT'});
  s = S.approve(s, 'GATE_1', {note: 'A'});
  s = S.advance(s, {config: cfg});
  s = S.approve(s, 'GATE_2', {note: 'B'});
  s = S.advance(s, {config: cfg}); // 03
  s = S.advance(s, {config: cfg}); // 04
  s = S.advance(s, {config: cfg}); // 05
  s = S.advance(s, {config: cfg}); // 06
  s = S.advance(s, {config: cfg, preflight: PF}); // 07
  s = S.approve(s, 'GATE_3', {note: 'Studio ok'});
  assert.throws(() => S.reopen(s, '05', {}), /--motivo/);
  s = S.reopen(s, '05', {reason: 'Trocar música'});
  assert.equal(s.stage, '05_IMPLEMENTATION');
  assert.equal(s.gates.GATE_1.status, 'approved');
  assert.equal(s.gates.GATE_2.status, 'approved');
  assert.equal(s.gates.GATE_3.status, 'pending');
  assert.equal(s.projectVersion, 'v01', 'sem render concluído, a versão não muda');
  assert.deepEqual(S.validateStatus(s), []);
  assert.throws(() => S.reopen(s, '08', {reason: 'x'}), /ainda não foi alcançada/);
});

test('gates 3 e 4 bloqueiam Studio → dry-run → render', () => {
  let s = S.createStatus({slug: 'x', stage: '07_STUDIO'});
  assert.throws(() => S.advance(s, {config: cfg}), /GATE_3/);
  s = S.approve(s, 'GATE_3', {note: 'ok'});
  s = S.advance(s, {config: cfg});
  assert.equal(s.stage, '08_DRY_RUN');
  assert.throws(() => S.advance(s, {config: cfg}), /GATE_4/);
  s = S.approve(s, 'GATE_4', {note: 'Pode renderizar'});
  assert.throws(() => S.advance(s, {config: cfg}), /Preflight ainda não executado/);
  assert.throws(() => S.advance(s, {config: cfg, preflight: {ok: false, errors: 2, warnings: 0}}), /Preflight reprovado/);
  s = S.advance(s, {config: cfg, preflight: PF});
  assert.equal(s.stage, '09_RENDER');
});

test('09_RENDER exige o MP4 da versão em renders/; revisão pós-render abre v02', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-renders-'));
  const ctx = {config: cfg, rendersDir: dir, inspect: INSP};
  let s = S.createStatus({slug: 'x', stage: '09_RENDER'});
  assert.throws(() => S.advance(s, {config: cfg, rendersDir: dir}), /cliente-teste_projeto-teste_v01\.mp4/);
  assert.throws(() => S.advance(s, ctx), /cliente-teste_projeto-teste_v01\.mp4/);
  fs.writeFileSync(path.join(dir, 'cliente-teste_projeto-teste_v01.mp4'), '');
  s = S.advance(s, ctx);
  assert.equal(s.stage, '10_FINAL');
  assert.equal(s.lastRender.file, 'cliente-teste_projeto-teste_v01.mp4');
  assert.deepEqual(S.validateStatus(s), []);
  assert.throws(() => S.advance(s, ctx), /já está em 10_FINAL/);
  s = S.reopen(s, '05_IMPLEMENTATION', {reason: 'Cliente pediu novo CTA'});
  assert.equal(s.projectVersion, 'v02');
  assert.equal(s.gates.GATE_3.status, 'pending');
  assert.equal(s.gates.GATE_4.status, 'pending');
  fs.rmSync(dir, {recursive: true});
});

test('validateStatus detecta estados incoerentes (edição manual errada)', () => {
  const s = S.createStatus({slug: 'x', stage: '05_IMPLEMENTATION'});
  assert.deepEqual(S.validateStatus(s), []); // init tardio: gates anteriores = legacy
  const bad = structuredClone(s);
  bad.stage = '08_DRY_RUN'; // pulou etapas sem registrar
  assert.ok(S.validateStatus(bad).some((p) => /completed inconsistente/.test(p)));
  const bad2 = S.createStatus({slug: 'x', stage: '09_RENDER'});
  bad2.gates.GATE_3 = {status: 'pending'};
  assert.ok(S.validateStatus(bad2).some((p) => /GATE_3/.test(p)));
  assert.ok(S.validateStatus({}).length > 0);
});

test('normalização de etapas e gates', () => {
  assert.equal(S.normalizeStage('5'), '05_IMPLEMENTATION');
  assert.equal(S.normalizeStage('studio'), '07_STUDIO');
  assert.equal(S.normalizeGate('4'), 'GATE_4');
  assert.throws(() => S.normalizeStage('99'), /Etapa inválida/);
  assert.throws(() => S.normalizeGate('GATE_9'), /Gate inválido/);
});

// ── Integração: CLI real em processos separados (= sessões novas) ──

const makeSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-sandbox-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), {recursive: true, filter: (p) => !p.includes(`${path.sep}tests`)});
  fs.cpSync(path.join(REPO, 'engine', 'src'), path.join(root, 'engine', 'src'), {recursive: true});
  fs.copyFileSync(path.join(REPO, 'VERSION'), path.join(root, 'VERSION'));
  fs.copyFileSync(path.join(REPO, 'engine', 'linguagens.json'), path.join(root, 'engine', 'linguagens.json'));
  fs.cpSync(path.join(REPO, 'projects', '_MOLDE'), path.join(root, 'projects', '_MOLDE'), {recursive: true});
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"sandbox","private":true}');
  return root;
};
const cli = (root, script, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {cwd: root, encoding: 'utf8'});

test('integração: new cria o estado, CLI transita e o estado sobrevive entre processos', () => {
  const root = makeSandbox();
  try {
    let r = cli(root, 'new-project.mjs', 'teste-controller', '--cliente', 'Loja Exemplo', '--projeto', 'Teste Controller', '--duracao', '15');
    assert.equal(r.status, 0, r.stderr);
    const file = path.join(root, 'projects', 'teste-controller', 'project-status.json');
    assert.ok(fs.existsSync(file), 'new-project deve criar project-status.json');

    // Primeira tela do usuário novo: diz o que falta, sem "nada — o fluxo pode seguir".
    const dir = path.join(root, 'projects', 'teste-controller');
    r = cli(root, 'status.mjs', 'teste-controller');
    assert.match(r.stdout, /o briefing ainda está vazio — responda as 8 perguntas no arquivo ou descreva o vídeo no chat/);
    assert.match(r.stdout, /colocar os arquivos do vídeo .* em projects\/teste-controller\/assets\//);
    assert.doesNotMatch(r.stdout, /o fluxo pode seguir/);
    r = cli(root, 'status.mjs');
    assert.match(r.stdout, /teste-controller .*aguardando: o briefing ainda está vazio/);

    // Briefing igual ao molde bloqueia a saída de 00_BRIEFING.
    r = cli(root, 'status.mjs', 'teste-controller', 'avancar');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /o briefing ainda está vazio/);
    fs.appendFileSync(path.join(dir, 'briefing.md'), '\nResumo do chat: vídeo de 15 s para a coleção nova.\n');

    // Sessão 1: avança briefing, tenta passar do conceito sem gate e sem linguagem (falha), aprova.
    assert.equal(cli(root, 'status.mjs', 'teste-controller', 'avancar').status, 0);
    r = cli(root, 'status.mjs', 'teste-controller', 'avancar');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /GATE_1/);
    assert.match(r.stderr, /Linguagem visual não definida/);
    assert.equal(cli(root, 'status.mjs', 'teste-controller', 'aprovar', 'GATE_1', '--nota', 'Conceito A').status, 0);
    const pj = path.join(dir, 'project.json');
    fs.writeFileSync(pj, JSON.stringify({...JSON.parse(fs.readFileSync(pj, 'utf8')), linguagem: 'nao-existe'}));
    r = cli(root, 'status.mjs', 'teste-controller', 'avancar');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /"nao-existe" não existe no catálogo/);
    fs.writeFileSync(pj, JSON.stringify({...JSON.parse(fs.readFileSync(pj, 'utf8')), linguagem: 'colagem-recorte'}));
    assert.equal(cli(root, 'status.mjs', 'teste-controller', 'avancar').status, 0);
    assert.equal(cli(root, 'status.mjs', 'teste-controller', 'bloquear', 'Aguardando trilha', '--responsavel', 'usuario').status, 0);

    // Sessão 2 (processo novo, sem memória): o estado é recuperado do disco.
    r = cli(root, 'status.mjs', 'teste-controller', '--json');
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    assert.equal(s.stage, '02_SCRIPT');
    assert.deepEqual(s.completed, ['00_BRIEFING', '01_CONCEPT']);
    assert.equal(s.gates.GATE_1.note, 'Conceito A');
    assert.equal(s.blockers[0].text, 'Aguardando trilha');
    assert.ok(s.history.length >= 5);

    r = cli(root, 'status.mjs', 'teste-controller');
    assert.match(r.stdout, /STATUS DO PROJETO — teste-controller/);
    assert.match(r.stdout, /Etapa atual:\s+02_SCRIPT/);
    assert.match(r.stdout, /✓ 01_CONCEPT/);
    assert.match(r.stdout, /B1 \[usuario\] Aguardando trilha/);

    // Arquivo corrompido é detectado e nada é gravado por cima.
    const good = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, good.replace('"02_SCRIPT"', '"07_STUDIO"'));
    r = cli(root, 'status.mjs', 'teste-controller', 'avancar');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /inválido/);
    fs.writeFileSync(file, good);
    assert.equal(cli(root, 'status.mjs', 'teste-controller', 'validar').status, 0);

    // Lista geral e projetos sem controle de estado.
    fs.mkdirSync(path.join(root, 'projects', 'legado', 'src'), {recursive: true});
    fs.writeFileSync(path.join(root, 'projects', 'legado', 'project.json'), '{"slug":"legado","cliente":"A","projeto":"B","durationSeconds":5}');
    fs.writeFileSync(path.join(root, 'projects', 'legado', 'src', 'index.ts'), '');
    r = cli(root, 'status.mjs');
    assert.match(r.stdout, /teste-controller\s+02_SCRIPT/);
    assert.match(r.stdout, /legado\s+sem controle de estado/);
    r = cli(root, 'status.mjs', 'legado');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /sem controle de estado/);
    assert.ok(!fs.existsSync(path.join(root, 'projects', 'legado', 'project-status.json')), 'consultar não pode criar arquivo');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('integração: init em projeto sem controle de estado respeita renders existentes e não duplica', () => {
  const root = makeSandbox();
  try {
    const dir = path.join(root, 'projects', 'antigo');
    fs.mkdirSync(path.join(dir, 'src'), {recursive: true});
    fs.mkdirSync(path.join(dir, 'renders'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'project.json'), '{"slug":"antigo","cliente":"Cli","projeto":"Proj","durationSeconds":10}');
    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), '');
    fs.writeFileSync(path.join(dir, 'renders', 'cli_proj_v01.mp4'), '');
    let r = cli(root, 'status.mjs', 'antigo', 'init', '--etapa', '07_STUDIO');
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'project-status.json'), 'utf8'));
    assert.equal(s.stage, '07_STUDIO');
    assert.equal(s.projectVersion, 'v02', 'v01 já existe em disco: a próxima versão de trabalho é v02');
    assert.equal(s.gates.GATE_1.status, 'legacy');
    assert.equal(s.gates.GATE_3.status, 'pending');
    r = cli(root, 'status.mjs', 'antigo', 'init');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /já existe/);
    // init em 09_RENDER com render já em disco: a versão é a existente (será validada), não a próxima.
    fs.rmSync(path.join(dir, 'project-status.json'));
    r = cli(root, 'status.mjs', 'antigo', 'init', '--etapa', '09_RENDER');
    assert.equal(r.status, 0, r.stderr);
    const s9 = JSON.parse(fs.readFileSync(path.join(dir, 'project-status.json'), 'utf8'));
    assert.equal(s9.projectVersion, 'v01');
    assert.equal(s9.gates.GATE_4.status, 'legacy');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
