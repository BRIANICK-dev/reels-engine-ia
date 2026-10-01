// Testes do Agente de Render. Node puro (node:test). Rodar na raiz: npm test
//
// NUNCA renderiza: o runner de render é substituído por um falso, que só
// registra a chamada. Não toca em nenhum projeto real: cada teste monta uma
// raiz temporária com projetos de mentira (e, no teste de CLI, uma cópia de scripts/).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as A from '../agent-lib.mjs';
import * as S from '../status-lib.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG = {cliente: 'Cliente Teste', projeto: 'Projeto Teste', durationSeconds: 5};
const OUT_NAME = (v) => `cliente-teste_projeto-teste_${v}.mp4`;

/** Raiz temporária com projetos falsos. `gate4`: 'approved' | 'pending'. */
const makeRoot = ({projects = []} = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-agent-'));
  for (const p of projects) {
    const dir = path.join(root, 'projects', p.slug);
    fs.mkdirSync(path.join(dir, 'renders'), {recursive: true});
    fs.mkdirSync(path.join(dir, 'assets'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({slug: p.slug, ...CFG}));
    if (p.noStatus) continue;
    const st = S.createStatus({slug: p.slug, stage: p.stage ?? '09_RENDER', version: p.version ?? 'v01'});
    if (p.gate4 === 'approved') st.gates.GATE_4 = {status: 'approved', at: new Date().toISOString(), note: 'teste'};
    S.saveStatus(dir, st);
  }
  const P = A.agentPaths(root);
  A.ensureDirs(P);
  return {root, P};
};

const request = (P, name, body) => {
  const file = path.join(P.pedidos, name);
  fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  return file;
};

const renderReq = (id, slug = 'proj-ok', versao = 'v01') => ({$schema: A.REQUEST_SCHEMA, id, operacao: 'render', slug, versao, criadoPor: 'teste'});

/** Runner falso: conta chamadas; em sucesso cria um "MP4" de mentira no destino esperado. */
const fakeRunner = ({fail = false} = {}) => {
  const calls = [];
  const run = async ({root, slug, versao, logFile}) => {
    calls.push({slug, versao});
    fs.writeFileSync(logFile, 'render simulado\n');
    if (fail) return {code: 1, timedOut: false};
    fs.writeFileSync(path.join(root, 'projects', slug, 'renders', OUT_NAME(versao)), 'mp4-falso');
    return {code: 0, timedOut: false};
  };
  return {run, calls};
};

const snapshot = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, {recursive: true, withFileTypes: true})
        .filter((d) => d.isFile())
        .map((d) => {
          const f = path.join(d.parentPath ?? d.path, d.name);
          return `${path.relative(dir, f)}:${crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex')}`;
        })
        .sort()
    : [];

// ── Regra 1: sem pedido, nada acontece ──────────────────────────

test('sem pedido: nenhum projeto é renderizado e nada muda em projects/', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const before = snapshot(P.projects);
  const r = fakeRunner();
  for (const f of A.pendingRequests(P)) await A.processRequestFile(P, f, {runner: r.run});
  assert.equal(A.pendingRequests(P).length, 0);
  assert.equal(r.calls.length, 0, 'runner não pode ser chamado sem pedido');
  assert.deepEqual(snapshot(P.projects), before);
});

test('arquivos que não são pedidos (.txt, pastas) são ignorados', () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  fs.writeFileSync(path.join(P.pedidos, 'leia-me.txt'), 'render proj-ok');
  fs.mkdirSync(path.join(P.pedidos, 'sub.json'));
  assert.deepEqual(A.pendingRequests(P), []);
});

// ── Regra 2: slug + versão + GATE_4 aprovado ───────────────────

test('GATE_4 pendente: pedido recusado e runner NÃO é chamado', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', stage: '08_DRY_RUN', gate4: 'pending'}]});
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-gate')), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.match(rec.motivo, /GATE_4 não aprovado/);
  assert.equal(r.calls.length, 0);
  assert.ok(fs.existsSync(path.join(P.falhas, 'a.json')));
});

test('GATE_4 "legacy" ou "waived" não conta como aprovado', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', stage: '09_RENDER'}]}); // createStatus → GATE_4 legacy
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-legacy')), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.equal(r.calls.length, 0);
});

test('pedido sem versão, sem slug ou com operação desconhecida é recusado', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const r = fakeRunner();
  const bad = [
    {$schema: A.REQUEST_SCHEMA, id: 'sem-versao', operacao: 'render', slug: 'proj-ok'},
    {$schema: A.REQUEST_SCHEMA, id: 'sem-slug', operacao: 'render', versao: 'v01'},
    {$schema: A.REQUEST_SCHEMA, id: 'op-rm', operacao: 'rm -rf', slug: 'proj-ok', versao: 'v01'},
    {$schema: A.REQUEST_SCHEMA, id: 'comando', operacao: 'render', slug: 'proj-ok', versao: 'v01', comando: 'del *.*'},
    {id: 'sem-schema', operacao: 'render', slug: 'proj-ok', versao: 'v01'},
  ];
  for (const [i, b] of bad.entries()) {
    const rec = await A.processRequestFile(P, request(P, `${i}.json`, b), {runner: r.run});
    assert.equal(rec.resultado, 'recusado', JSON.stringify(b));
  }
  const rec = await A.processRequestFile(P, request(P, 'lixo.json', 'isto não é json'), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.equal(r.calls.length, 0);
});

test('versão diferente da versão de trabalho é recusada', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved', version: 'v01'}]});
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-v02', 'proj-ok', 'v02')), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.match(rec.motivo, /versão de trabalho/);
  assert.equal(r.calls.length, 0);
});

test('etapa fora de 08/09 é recusada mesmo com GATE_4 aprovado', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', stage: '10_FINAL', gate4: 'approved'}]});
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-final')), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.equal(r.calls.length, 0);
});

// ── Regra 10: projetos protegidos ──────────────────────────────

const writeLocalConfig = (root, cfg) => {
  fs.mkdirSync(path.join(root, 'local'), {recursive: true});
  fs.writeFileSync(path.join(root, 'local', 'config.json'), typeof cfg === 'string' ? cfg : JSON.stringify(cfg));
};

test('_MOLDE e os projetos protegidos em local/config.json nunca são tocados', async () => {
  const {P, root} = makeRoot({
    projects: [
      {slug: '_MOLDE', gate4: 'approved'},
      {slug: 'projeto-entregue', gate4: 'approved'},
      {slug: 'proj-ok', gate4: 'approved'},
    ],
  });
  writeLocalConfig(root, {agente: {projetosProtegidos: ['projeto-entregue']}});
  assert.deepEqual(A.protectedSlugs(root), ['_MOLDE', 'projeto-entregue']);
  const before = snapshot(P.projects);
  const r = fakeRunner();
  for (const slug of ['_MOLDE', 'projeto-entregue']) {
    const rec = await A.processRequestFile(P, request(P, `${slug}.json`, renderReq(`p-${slug.toLowerCase().replace(/_/g, '')}`, slug)), {runner: r.run});
    assert.equal(rec.resultado, 'recusado');
  }
  assert.equal(r.calls.length, 0);
  assert.deepEqual(snapshot(P.projects), before);
  const scan = A.scanProjects(P);
  assert.equal(scan.find((p) => p.slug === 'projeto-entregue').protegido, true);
  assert.equal(scan.find((p) => p.slug === 'proj-ok').protegido, false);
});

test('sem local/config.json só o _MOLDE é protegido', () => {
  const {root} = makeRoot();
  assert.deepEqual(A.protectedSlugs(root), ['_MOLDE']);
});

test('local/config.json inválido: pedido de render falha e nada é executado', async () => {
  const {P, root} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  writeLocalConfig(root, '{ isto não é json');
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-config-invalida')), {runner: r.run});
  assert.equal(rec.resultado, 'falha');
  assert.match(rec.motivo, /config\.json inválido/);
  assert.equal(r.calls.length, 0);
});

// ── Sucesso + Regras 3 e 7 ─────────────────────────────────────

test('pedido válido: render chamado UMA vez, recibo completo, pedido consumido', async () => {
  const {P, root} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'ok.json', renderReq('pedido-ok')), {runner: r.run});
  assert.equal(rec.resultado, 'sucesso');
  assert.deepEqual(r.calls, [{slug: 'proj-ok', versao: 'v01'}]);
  // Regra 7: campos obrigatórios do recibo
  for (const k of ['projeto', 'versao', 'inicio', 'fim', 'resultado', 'arquivo', 'tamanhoBytes', 'sha256']) assert.ok(rec[k] != null, k);
  assert.equal(rec.arquivoRelativo, `projects/proj-ok/renders/${OUT_NAME('v01')}`);
  assert.equal(rec.tamanhoBytes, 'mp4-falso'.length);
  assert.equal(rec.sha256, crypto.createHash('sha256').update('mp4-falso').digest('hex'));
  // Regra 3: saiu de pedidos/, foi para concluidos/, com recibo e histórico
  assert.equal(A.pendingRequests(P).length, 0);
  assert.ok(fs.existsSync(path.join(P.concluidos, 'ok.json')));
  assert.ok(fs.existsSync(path.join(P.concluidos, 'ok.recibo.json')));
  assert.equal(A.readHistory(P).filter((h) => h.id === 'pedido-ok').length, 1);
  assert.match(fs.readFileSync(P.log, 'utf8'), /sucesso/);
  void root;
});

test('o mesmo pedido (mesmo id) nunca executa duas vezes', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const r = fakeRunner();
  await A.processRequestFile(P, request(P, 'ok.json', renderReq('pedido-unico')), {runner: r.run});
  // alguém recoloca o mesmo pedido (mesmo id, outro arquivo)
  const rec2 = await A.processRequestFile(P, request(P, 'ok-de-novo.json', renderReq('pedido-unico')), {runner: r.run});
  assert.equal(rec2.resultado, 'recusado');
  assert.match(rec2.motivo, /já foi processado/);
  assert.equal(r.calls.length, 1);
});

test('versão existente nunca é sobrescrita', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const target = path.join(P.projects, 'proj-ok', 'renders', OUT_NAME('v01'));
  fs.writeFileSync(target, 'aprovado');
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-existente')), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.equal(r.calls.length, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), 'aprovado');
});

// ── Regra 6: erro registrado, sem repetição ────────────────────

test('render com erro: registra falha e não tenta de novo', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const r = fakeRunner({fail: true});
  const rec = await A.processRequestFile(P, request(P, 'a.json', renderReq('pedido-erro')), {runner: r.run});
  assert.equal(rec.resultado, 'falha');
  assert.match(rec.motivo, /código 1/);
  assert.equal(A.pendingRequests(P).length, 0, 'pedido com erro não volta para a fila');
  for (const f of A.pendingRequests(P)) await A.processRequestFile(P, f, {runner: r.run});
  assert.equal(r.calls.length, 1);
  assert.ok(fs.existsSync(path.join(P.falhas, 'a.recibo.json')));
});

test('pedido interrompido (agente desligado no meio) vira falha e não é repetido', () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  fs.writeFileSync(path.join(P.emExecucao, 'x.json'), JSON.stringify(renderReq('pedido-interrompido')));
  fs.writeFileSync(path.join(P.tmp, 'y.mp4.partial'), 'lixo');
  const out = A.recoverInterrupted(P);
  assert.equal(out.length, 1);
  assert.equal(out[0].resultado, 'interrompido');
  assert.equal(fs.readdirSync(P.emExecucao).length, 0);
  assert.equal(A.pendingRequests(P).length, 0);
  assert.ok(!fs.existsSync(path.join(P.tmp, 'y.mp4.partial')));
  assert.ok(A.readHistory(P).some((h) => h.id === 'pedido-interrompido'));
});

// ── Operações fora da lista fechada ───────────────────────────

test('operação "montar" (removida) é recusada como qualquer operação desconhecida', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}]});
  const r = fakeRunner();
  const body = {$schema: A.REQUEST_SCHEMA, id: 'montar-legado', operacao: 'montar', slug: 'proj-ok', versao: 'v01'};
  const rec = await A.processRequestFile(P, request(P, 'm.json', body), {runner: r.run});
  assert.equal(rec.resultado, 'recusado');
  assert.match(rec.motivo, /operacao/);
  assert.equal(r.calls.length, 0);
});

// ── Verificar (saúde do agente) ────────────────────────────────

test('verificar: responde com os projetos e não executa nada', async () => {
  const {P} = makeRoot({projects: [{slug: 'proj-ok', gate4: 'approved'}, {slug: 'antigo', noStatus: true}]});
  const before = snapshot(P.projects);
  const r = fakeRunner();
  const rec = await A.processRequestFile(P, request(P, 'v.json', {$schema: A.REQUEST_SCHEMA, id: 'verificar-1', operacao: 'verificar'}), {runner: r.run});
  assert.equal(rec.resultado, 'sucesso');
  assert.deepEqual(rec.projetos.map((p) => p.slug).sort(), ['antigo', 'proj-ok']);
  assert.equal(rec.projetos.find((p) => p.slug === 'proj-ok').gate4, 'approved');
  assert.equal(r.calls.length, 0);
  assert.deepEqual(snapshot(P.projects), before);
});

// ── Instância única ────────────────────────────────────────────

test('lock: uma segunda instância não inicia enquanto a primeira vive', () => {
  const {P} = makeRoot();
  fs.writeFileSync(P.lock, JSON.stringify({pid: process.ppid, desde: 'x'})); // processo vivo (o pai)
  assert.equal(A.acquireLock(P), false);
  fs.writeFileSync(P.lock, JSON.stringify({pid: 999999, desde: 'x'})); // pid morto
  assert.equal(A.acquireLock(P), true);
});

test('lançador do Windows: nome com hash da pasta, estável e distinto entre instalações', () => {
  const a = A.vbsName('C:\\Users\\x\\Reels Engine IA');
  assert.match(a, /^ReelsEngineIA-AgenteRender-[0-9a-f]{8}\.vbs$/);
  assert.equal(a, A.vbsName('C:\\Users\\x\\Reels Engine IA'));
  assert.notEqual(a, A.vbsName('C:\\Users\\x\\Outra Pasta'));
});

test('lançador do Windows: roda node oculto, sem esperar, na raiz certa', () => {
  const vbs = A.vbsContent('C:\\Program Files\\nodejs\\node.exe', 'C:\\Users\\x\\Meus "Videos"');
  assert.match(vbs, /sh\.Run """C:\\Program Files\\nodejs\\node\.exe"" ""C:\\Users\\x\\Meus ""Videos""[\\/]scripts[\\/]agent\.mjs""", 0, False/);
  assert.match(vbs, /CurrentDirectory = "C:\\Users\\x\\Meus ""Videos"""/);
});

// ── CLI real (sem render): inicia, acha projects/, lê pedido, respeita GATE_4 ──

test('CLI: agent.mjs --uma-vez inicia, reconhece projetos, recusa GATE_4 pendente e sai', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-agent-cli-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), {recursive: true});
  fs.writeFileSync(path.join(root, 'package.json'), fs.readFileSync(path.join(REPO, 'package.json')));
  const mk = (slug, stage, gate4) => {
    const dir = path.join(root, 'projects', slug);
    fs.mkdirSync(path.join(dir, 'renders'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({slug, ...CFG}));
    const st = S.createStatus({slug, stage});
    if (gate4) st.gates.GATE_4 = {status: 'approved', at: new Date().toISOString()};
    S.saveStatus(dir, st);
  };
  mk('proj-pendente', '08_DRY_RUN', false);
  mk('proj-aprovado', '09_RENDER', true);
  const P = A.agentPaths(root);
  fs.mkdirSync(P.pedidos, {recursive: true});
  fs.writeFileSync(path.join(P.pedidos, '01.json'), JSON.stringify(renderReq('cli-pendente', 'proj-pendente')));

  const diag = spawnSync(process.execPath, ['scripts/agent.mjs', '--diagnostico'], {cwd: root, encoding: 'utf8'});
  assert.equal(diag.status, 0, diag.stderr);
  assert.match(diag.stdout, /projects\/ encontrada: sim/);
  assert.match(diag.stdout, /proj-aprovado .*GATE_4=approved/);
  assert.match(diag.stdout, /pedidos pendentes: 1/);
  assert.ok(fs.existsSync(path.join(P.pedidos, '01.json')), '--diagnostico não consome pedidos');

  const run = spawnSync(process.execPath, ['scripts/agent.mjs', '--uma-vez'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const log = fs.readFileSync(P.log, 'utf8');
  assert.match(log, /iniciado/);
  assert.match(log, /2 projeto\(s\) reconhecido\(s\)/);
  assert.match(log, /GATE_4 não aprovado/);
  const rec = JSON.parse(fs.readFileSync(path.join(P.falhas, '01.recibo.json'), 'utf8'));
  assert.equal(rec.resultado, 'recusado');
  assert.deepEqual(fs.readdirSync(path.join(root, 'projects', 'proj-pendente', 'renders')), []);
  assert.deepEqual(fs.readdirSync(path.join(root, 'projects', 'proj-aprovado', 'renders')), [], 'projeto aprovado SEM pedido não renderiza');
  assert.ok(fs.existsSync(P.status), 'heartbeat gravado');
  assert.ok(!fs.existsSync(P.lock), 'lock liberado ao sair');
});
