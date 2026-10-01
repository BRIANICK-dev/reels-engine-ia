// Testes das automações: media-lib, Asset Intelligence, preflight,
// validação pós-render, registro automático do render e archive.
// Rodar na raiz: npm test
//
// Nada toca projetos reais. Cada teste monta um repositório-sandbox numa pasta
// temporária (scripts/, engine/, _MOLDE, configs + atalho para node_modules)
// e gera a mídia de teste na hora com o ffmpeg que vem com o Remotion.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as M from '../media-lib.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-f2-'));
after(() => fs.rmSync(TMP, {recursive: true, force: true}));

// ── Geradores de mídia ─────────────────────────────────────────

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const makePng = (w, h, rgb = [30, 120, 200]) => {
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).fill(Buffer.from(rgb))]);
  const raw = Buffer.concat(Array.from({length: h}, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
const makeWav = (seconds, rate = 48000) => {
  const n = Math.round(seconds * rate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
};
/** MP4 h264 via ffmpeg do Remotion (frames PNG por pipe + WAV opcional). */
const makeMp4 = (out, {w = 1080, h = 1920, fps = 30, seconds = 1, audio = true, bt709 = true} = {}) => {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  const frame = makePng(w, h);
  const frames = Buffer.concat(Array.from({length: Math.round(fps * seconds)}, () => frame));
  const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
  let wav;
  if (audio) {
    wav = path.join(TMP, `a-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    fs.writeFileSync(wav, makeWav(seconds));
    args.push('-i', wav);
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  if (bt709) args.push('-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
  if (audio) args.push('-c:a', 'aac', '-shortest');
  args.push(out);
  const r = M.runRemotionTool('ffmpeg', args, {input: frames});
  assert.equal(r.status, 0, r.stderr);
  return out;
};

// ── Sandbox de repositório ─────────────────────────────────────

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
const cli = (root, script, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {cwd: root, encoding: 'utf8', timeout: 300000});
const imp = (root, file) => import(pathToFileURL(path.join(root, 'scripts', file)).href);

/** Projeto válido: 2 s, 2 cenas, imagem + áudio + fonte, safe area, sem URL. */
const makeValidProject = (root, slug = 'teste-f2') => {
  const r = cli(root, 'new-project.mjs', slug, '--cliente', 'Loja Exemplo', '--projeto', 'Teste F2', '--duracao', '2');
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(root, 'projects', slug);
  fs.mkdirSync(path.join(dir, 'assets', 'fonts'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'assets', 'logo.png'), makePng(400, 200));
  fs.writeFileSync(path.join(dir, 'assets', 'trilha.wav'), makeWav(2));
  fs.writeFileSync(path.join(dir, 'assets', 'fonts', 'teste.woff2'), Buffer.from('wOF2-fixture'));
  fs.writeFileSync(
    path.join(dir, 'src', 'timeline.ts'),
    `import type {Scene} from './engine';\nexport const SCENES: Scene[] = [\n  {id: 'a', durationInSeconds: 1},\n  {id: 'b', durationInSeconds: 1},\n];\n`,
  );
  fs.mkdirSync(path.join(dir, 'src', 'scenes'), {recursive: true});
  fs.writeFileSync(
    path.join(dir, 'src', 'scenes', 'SceneTeste.tsx'),
    `import React from 'react';
import {AbsoluteFill, Html5Audio, Img, staticFile} from 'remotion';
import {safePadding} from '../engine';

export const SceneTeste: React.FC = () => (
  <AbsoluteFill style={safePadding('critical')}>
    <svg xmlns="http://www.w3.org/2000/svg" width={10} height={10} />
    <Img src={staticFile('logo.png')} />
    <Html5Audio src={staticFile('trilha.wav')} />
  </AbsoluteFill>
);
`,
  );
  fs.mkdirSync(path.join(dir, 'src', 'styles'), {recursive: true});
  fs.writeFileSync(
    path.join(dir, 'src', 'styles', 'fonts.ts'),
    `import {continueRender, delayRender, staticFile} from 'remotion';

export const loadFonts = (): void => {
  const handle = delayRender('fonte');
  const face = new FontFace('Teste', \`url(\${staticFile('fonts/teste.woff2')}) format('woff2')\`);
  void face.load().then((f) => {
    document.fonts.add(f);
    continueRender(handle);
  });
};
`,
  );
  fs.appendFileSync(path.join(dir, 'manifesto-de-assets.md'), '\n| logo.png | | | | | | | |\n| trilha.wav | | | | | | | |\n| fonts/teste.woff2 | | | | | | | |\n');
  return dir;
};

let ROOT_OK; // sandbox compartilhado pelos testes de leitura
before(() => {
  ROOT_OK = makeSandbox();
  makeValidProject(ROOT_OK);
});

// ── media-lib ──────────────────────────────────────────────────

test('media-lib: proporção, orientação e tipos', () => {
  assert.deepEqual(M.aspectOf(1080, 1920), {ratio: '9:16', decimal: 0.5625, label: '9:16'});
  assert.equal(M.aspectOf(1366, 768).label, '16:9'); // 1366:683 ≈ 16:9 (±1%)
  assert.equal(M.orientationOf(1080, 1920), 'vertical');
  assert.equal(M.orientationOf(1920, 1080), 'horizontal');
  assert.equal(M.orientationOf(500, 500), 'quadrado');
  assert.equal(M.typeOf('a/B.MP4'), 'video');
  assert.equal(M.typeOf('x.woff2'), 'font');
  assert.equal(M.typeOf('x.txt'), 'outro');
});

test('media-lib: dimensões de PNG, JPEG, GIF, WebP e SVG pelo cabeçalho', () => {
  const d = fs.mkdtempSync(path.join(TMP, 'img-'));
  fs.writeFileSync(path.join(d, 'a.png'), makePng(64, 32));
  assert.deepEqual([M.imageInfo(path.join(d, 'a.png')).width, M.imageInfo(path.join(d, 'a.png')).height], [64, 32]);
  // JPEG real gerado pelo ffmpeg do Remotion
  const r = M.runRemotionTool('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-frames:v', '1', path.join(d, 'b.jpg')], {input: makePng(300, 500)});
  assert.equal(r.status, 0, r.stderr);
  const j = M.imageInfo(path.join(d, 'b.jpg'));
  assert.deepEqual([j.format, j.width, j.height], ['jpeg', 300, 500]);
  const gif = Buffer.alloc(13);
  gif.write('GIF89a');
  gif.writeUInt16LE(120, 6);
  gif.writeUInt16LE(80, 8);
  fs.writeFileSync(path.join(d, 'c.gif'), gif);
  assert.equal(M.imageInfo(path.join(d, 'c.gif')).width, 120);
  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0);
  webp.write('WEBP', 8);
  webp.write('VP8X', 12);
  webp.writeUIntLE(1080 - 1, 24, 3);
  webp.writeUIntLE(1920 - 1, 27, 3);
  fs.writeFileSync(path.join(d, 'd.webp'), webp);
  assert.deepEqual([M.imageInfo(path.join(d, 'd.webp')).width, M.imageInfo(path.join(d, 'd.webp')).height], [1080, 1920]);
  fs.writeFileSync(path.join(d, 'e.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"></svg>');
  assert.equal(M.imageInfo(path.join(d, 'e.svg')).width, 200);
});

test('media-lib: ficha técnica de vídeo e áudio via ffprobe do Remotion', () => {
  const d = fs.mkdtempSync(path.join(TMP, 'av-'));
  const v = M.describeFile(makeMp4(path.join(d, 'v.mp4'), {seconds: 1}), 'v.mp4');
  assert.equal(v.type, 'video');
  assert.deepEqual([v.width, v.height, v.orientation, v.aspect.label, v.fps, v.codec], [1080, 1920, 'vertical', '9:16', 30, 'h264']);
  assert.ok(Math.abs(v.durationSec - 1) < 0.05);
  assert.equal(v.audio.codec, 'aac');
  const h = M.describeFile(makeMp4(path.join(d, 'h.mp4'), {w: 640, h: 360, fps: 25, seconds: 1, audio: false}), 'h.mp4');
  assert.equal(h.orientation, 'horizontal');
  assert.ok(h.notes.some((n) => /horizontal/.test(n)));
  assert.ok(h.notes.some((n) => /fps 25/.test(n)));
  assert.ok(h.notes.some((n) => /< 1080/.test(n)));
  fs.writeFileSync(path.join(d, 's.wav'), makeWav(0.5));
  const a = M.describeFile(path.join(d, 's.wav'), 's.wav');
  assert.equal(a.type, 'audio');
  assert.ok(Math.abs(a.durationSec - 0.5) < 0.01);
  fs.writeFileSync(path.join(d, 'x.mp4'), 'não é vídeo');
  assert.ok(M.describeFile(path.join(d, 'x.mp4'), 'x.mp4').notes.some((n) => /ffprobe/.test(n)));
});

// ── Asset Intelligence ─────────────────────────────────────────

test('assets: identifica arquivos e aponta os fora do manifesto; --salvar só em projetos com estado', async () => {
  const {analyzeAssets} = await imp(ROOT_OK, 'assets.mjs');
  const {loadProject} = await imp(ROOT_OK, 'lib.mjs');
  const dir = path.join(ROOT_OK, 'projects', 'teste-f2');
  fs.writeFileSync(path.join(dir, 'assets', 'Foto Extra.png'), makePng(1920, 1080));
  const rep = analyzeAssets(loadProject('teste-f2'));
  assert.equal(rep.total, 4);
  assert.deepEqual(rep.unregistered, ['Foto Extra.png']);
  const foto = rep.items.find((i) => i.name === 'Foto Extra.png');
  assert.deepEqual([foto.width, foto.height, foto.orientation, foto.aspect.label], [1920, 1080, 'horizontal', '16:9']);
  assert.ok(foto.notes.some((n) => /espaço ou acento/.test(n)));
  let r = cli(ROOT_OK, 'assets.mjs', 'teste-f2', '--salvar');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'assets-report.json')));
  fs.rmSync(path.join(dir, 'assets-report.json'));
  fs.rmSync(path.join(dir, 'assets', 'Foto Extra.png'));
  // projeto antigo (sem estado) não recebe arquivo
  const legacy = path.join(ROOT_OK, 'projects', 'antigo');
  fs.cpSync(dir, legacy, {recursive: true});
  fs.rmSync(path.join(legacy, 'project-status.json'));
  r = cli(ROOT_OK, 'assets.mjs', 'antigo', '--salvar');
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(path.join(legacy, 'assets-report.json')));
  fs.rmSync(legacy, {recursive: true});
});

// ── Preflight ──────────────────────────────────────────────────

test('preflight: projeto válido é aprovado (com typecheck) e o resultado é registrado', () => {
  const r = cli(ROOT_OK, 'preflight.mjs', 'teste-f2', '--json');
  const out = JSON.parse(r.stdout);
  const errs = out.checks.filter((c) => c.level === 'error');
  assert.equal(r.status, 0, JSON.stringify(errs, null, 2));
  assert.equal(out.ok, true);
  for (const area of ['estrutura', 'duração', 'formato', 'timeline', 'assets', 'fontes', 'áudio', 'safe area', 'urls', 'config', 'destino', 'typecheck']) {
    assert.ok(out.checks.some((c) => c.area === area && c.level === 'ok'), `área ${area} sem ✓`);
  }
  const st = JSON.parse(fs.readFileSync(path.join(ROOT_OK, 'projects', 'teste-f2', 'project-status.json'), 'utf8'));
  assert.equal(st.preflight.ok, true);
  assert.equal(st.history.at(-1).event, 'preflight');
});

test('preflight: detecta asset ausente, caminho inválido, URL externa, soma errada, safe area ligada, fonte sem delayRender e erro de tipo', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'quebrado');
  const {loadProject} = await imp(root, 'lib.mjs');
  const {runPreflight} = await imp(root, 'preflight-lib.mjs');
  fs.writeFileSync(
    path.join(dir, 'src', 'scenes', 'Ruim.tsx'),
    `import React from 'react';
import {Img, staticFile} from 'remotion';
const n: number = 'texto';
export const Ruim: React.FC = () => (
  <>
    <Img src={staticFile('nao-existe.png')} />
    <Img src={staticFile('assets/logo.png')} />
    <Img src={'https://exemplo.com/foto.jpg'} />
  </>
);
export const x = n;
`,
  );
  fs.writeFileSync(path.join(dir, 'src', 'timeline.ts'), `export const SCENES = [{id: 'a', durationInSeconds: 1.5}];\n`);
  const rootTsx = path.join(dir, 'src', 'Root.tsx');
  fs.writeFileSync(rootTsx, fs.readFileSync(rootTsx, 'utf8').replace('showSafeArea: false', 'showSafeArea: true'));
  const fonts = path.join(dir, 'src', 'styles', 'fonts.ts');
  fs.writeFileSync(fonts, fs.readFileSync(fonts, 'utf8').replace("const handle = delayRender('fonte');", 'const handle = 0;').replace('continueRender(handle);', 'void handle;').replace('continueRender, delayRender, ', ''));

  const r = runPreflight(loadProject('quebrado'), {typecheck: true});
  const errs = r.checks.filter((c) => c.level === 'error').map((c) => `${c.area}: ${c.msg}`).join('\n');
  assert.equal(r.ok, false);
  assert.match(errs, /assets: Arquivo referenciado não existe em assets\/: nao-existe\.png/);
  assert.match(errs, /remova o prefixo "assets\/"/);
  assert.match(errs, /urls: URL externa no código: https:\/\/exemplo\.com/);
  assert.doesNotMatch(errs, /w3\.org/);
  assert.match(errs, /timeline: Soma das cenas = 45 frames/);
  assert.match(errs, /safe area: showSafeArea: true/);
  assert.match(errs, /fontes: FontFace sem delayRender/);
  assert.match(errs, /typecheck: .*TS2322/);
});

test('preflight: resolução/fps errados no Root e arquivo de áudio corrompido', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'formato');
  const {loadProject} = await imp(root, 'lib.mjs');
  const {runPreflight} = await imp(root, 'preflight-lib.mjs');
  const rootTsx = path.join(dir, 'src', 'Root.tsx');
  fs.writeFileSync(rootTsx, fs.readFileSync(rootTsx, 'utf8').replace('width={FORMAT.width}', 'width={1920}').replace('fps={FORMAT.fps}', 'fps={25}'));
  fs.writeFileSync(path.join(dir, 'assets', 'trilha.wav'), 'corrompido');
  const r = runPreflight(loadProject('formato'), {typecheck: false});
  const errs = r.checks.filter((c) => c.level === 'error').map((c) => c.msg).join('\n');
  assert.match(errs, /width = 1920 \(esperado 1080\)/);
  assert.match(errs, /fps = 25 \(esperado 30\)/);
  assert.match(errs, /trilha\.wav: ffprobe não conseguiu ler/);
});

test('controller: avancar em 06_VALIDATION roda o preflight, bloqueia se reprovar e libera após correção', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'fluxo');
  const S = await imp(root, 'status-lib.mjs');
  const file = path.join(dir, 'project-status.json');
  fs.writeFileSync(file, JSON.stringify(S.createStatus({slug: 'fluxo', stage: '06_VALIDATION'}), null, 2));
  const scene = path.join(dir, 'src', 'scenes', 'SceneTeste.tsx');
  const good = fs.readFileSync(scene, 'utf8');
  fs.writeFileSync(scene, good.replace("staticFile('logo.png')", "staticFile('sumiu.png')"));
  let r = cli(root, 'status.mjs', 'fluxo', 'avancar');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /PREFLIGHT — fluxo/);
  assert.match(r.stderr, /Preflight reprovado — 06_VALIDATION continua aberta/);
  let st = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(st.stage, '06_VALIDATION');
  assert.equal(st.preflight.ok, false);
  assert.ok(st.preflight.problems.some((p) => /sumiu\.png/.test(p)));
  fs.writeFileSync(scene, good);
  r = cli(root, 'status.mjs', 'fluxo', 'avancar');
  assert.equal(r.status, 0, r.stderr);
  st = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(st.stage, '07_STUDIO');
  assert.equal(st.preflight.ok, true);
  assert.match(cli(root, 'status.mjs', 'fluxo').stdout, /Preflight:\s+✓ aprovado/);
});

// ── Validação pós-render + registro automático ────────────────

test('inspect: MP4 correto é aprovado; resolução, fps, duração, áudio e cor errados são reprovados', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'insp');
  const {loadProject} = await imp(root, 'lib.mjs');
  const {runInspect} = await imp(root, 'inspect-lib.mjs');
  const renders = path.join(dir, 'renders');
  const name = (v) => path.join(renders, `loja-exemplo_teste-f2_${v}.mp4`);
  makeMp4(name('v01'), {seconds: 2});
  let r = runInspect(loadProject('insp'), {});
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => c.level !== 'ok'), null, 2));
  assert.equal(r.version, 'v01');

  makeMp4(name('v02'), {w: 1920, h: 1080, fps: 25, seconds: 1, audio: false, bt709: false});
  r = runInspect(loadProject('insp'), {});
  assert.equal(r.version, 'v02');
  const errs = r.checks.filter((c) => c.level === 'error').map((c) => c.msg).join('\n');
  assert.match(errs, /1920×1080 \(esperado 1080×1920\)/);
  assert.match(errs, /fps 25\/1/);
  assert.match(errs, /Duração 1\.000s ≠ 2s/);
  assert.match(errs, /usa áudio, mas o MP4 não tem trilha de áudio/);
  assert.match(errs, /color_space/);
  assert.equal(runInspect(loadProject('insp'), {version: 'v01'}).ok, true);

  fs.writeFileSync(name('v03'), 'x');
  r = runInspect(loadProject('insp'), {});
  assert.match(r.checks[r.checks.length - 1].msg, /render incompleto/);
});

test('render: registro automático pós-render grava render + validação sem mudar a etapa', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'reg');
  const S = await imp(root, 'status-lib.mjs');
  const {loadProject} = await imp(root, 'lib.mjs');
  const {afterFinalRender} = await imp(root, 'render-hooks.mjs');
  const file = path.join(dir, 'project-status.json');
  let st = S.createStatus({slug: 'reg', stage: '09_RENDER'});
  fs.writeFileSync(file, JSON.stringify(st, null, 2));
  makeMp4(path.join(dir, 'renders', 'loja-exemplo_teste-f2_v01.mp4'), {seconds: 2});
  const log = console.log;
  console.log = () => {};
  try {
    afterFinalRender(loadProject('reg'), {file: 'loja-exemplo_teste-f2_v01.mp4', version: 'v01'});
  } finally {
    console.log = log;
  }
  st = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(st.stage, '09_RENDER', 'o registro não avança sozinho');
  assert.equal(st.renders.length, 1);
  assert.equal(st.lastRender.inspect.ok, true);
  assert.equal(st.lastRender.inspect.video.width, 1080);
  assert.match(st.history.at(-1).detail, /registrado — validação técnica aprovada/);
  assert.match(st.history.at(-1).detail, /GATE 4 \(Render\) não estava aprovado/);
  assert.deepEqual(S.validateStatus(st), []);
  // O avancar de 09_RENDER roda a validação de novo e conclui
  const r = cli(root, 'status.mjs', 'reg', 'avancar');
  assert.equal(r.status, 0, r.stderr);
  st = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(st.stage, '10_FINAL');
  assert.equal(st.lastRender.file, 'loja-exemplo_teste-f2_v01.mp4');
});

test('render --dry-run: projeto com estado inclui o preflight; projeto sem estado segue o render simples', () => {
  const root = ROOT_OK;
  let r = cli(root, 'render.mjs', 'teste-f2', '--dry-run');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /--dry-run: nada foi renderizado/);
  assert.match(r.stdout, /PREFLIGHT — teste-f2/);
  const legacy = path.join(root, 'projects', 'legado');
  fs.cpSync(path.join(root, 'projects', 'teste-f2'), legacy, {recursive: true});
  fs.rmSync(path.join(legacy, 'project-status.json'));
  r = cli(root, 'render.mjs', 'legado', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /PREFLIGHT/);
  assert.ok(!fs.existsSync(path.join(legacy, 'project-status.json')));
  fs.rmSync(legacy, {recursive: true});
});

// ── Archive ────────────────────────────────────────────────────

test('archive: exige 10_FINAL, copia com verificação SHA-256, nunca sobrescreve, recusa destino no repositório', async () => {
  const root = makeSandbox();
  const dir = makeValidProject(root, 'arq');
  const S = await imp(root, 'status-lib.mjs');
  const file = path.join(dir, 'project-status.json');
  const dest = fs.mkdtempSync(path.join(TMP, 'backup-'));
  let r = cli(root, 'archive.mjs', 'arq', '--destino', dest);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /exige 10_FINAL/);
  fs.writeFileSync(file, JSON.stringify(S.createStatus({slug: 'arq', stage: '10_FINAL'}), null, 2));
  r = cli(root, 'archive.mjs', 'arq', '--destino', path.join(root, 'backup'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dentro do repositório/);
  r = cli(root, 'archive.mjs', 'arq', '--destino', dest);
  assert.equal(r.status, 0, r.stderr);
  const [folder] = fs.readdirSync(dest);
  const man = JSON.parse(fs.readFileSync(path.join(dest, folder, 'ARCHIVE-MANIFEST.json'), 'utf8'));
  assert.equal(man.slug, 'arq');
  assert.ok(man.entries.some((e) => e.path === 'assets/logo.png'));
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'logo.png')), 'origem intacta');
  const st = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(st.archives.length, 1);
  r = cli(root, 'archive.mjs', 'arq', '--destino', dest);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /já existe/);
});
