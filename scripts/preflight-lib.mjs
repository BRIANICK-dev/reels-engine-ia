// Preflight — verificação técnica automática de um projeto antes do Studio,
// do dry-run e do render. Somente leitura: nunca altera o projeto.
//
// Usa a própria instalação da raiz: TypeScript (já é devDependency) para ler
// o código com precisão (AST) e rodar o typecheck do projeto; ffprobe do
// Remotion (media-lib) para conferir áudio/vídeo. Nenhuma dependência nova.
//
// Resultado: lista de checagens {area, level, msg}, level = error | warn | ok | info.
// Qualquer "error" reprova o preflight. Documentação: docs/12-AUTOMACAO.md
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MEDIA_EXT_RE, probe, typeOf, walkFiles} from './media-lib.mjs';
import {existingRenderVersions, renderBase, stageIndex, versionLabel} from './status-lib.mjs';
import {loadCatalog} from './linguagens-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));

let tsMod;
const ts = () => {
  if (!tsMod) {
    try {
      tsMod = require('typescript');
    } catch {
      throw new Error('TypeScript não instalado na raiz (rode "npm ci").');
    }
  }
  return tsMod;
};

export const EXPECTED = {width: 1080, height: 1920, fps: 30};
const SRC_EXT = /\.(tsx?|jsx?|mjs)$/;
const ALLOWED_URL = /^https?:\/\/www\.w3\.org\//i; // namespaces de SVG/XML (xmlns), não são downloads

// ─────────────────────────────────────────────────────────────
// Avaliação isolada de módulos TS (timeline.ts, format.ts, safeArea.ts)
// ─────────────────────────────────────────────────────────────

/** Proxy inerte que substitui pacotes externos (remotion, react...) durante a avaliação. */
const inert = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === '__esModule' ? false : inert),
  apply: () => inert,
  construct: () => inert,
});

/**
 * Carrega um módulo TS/TSX do projeto e devolve seus exports. Imports relativos
 * são resolvidos e transpilados; pacotes externos viram um proxy inerte.
 * Roda num contexto vm isolado, com tempo limite.
 */
export const evalModule = (entry) => {
  const cache = new Map();
  const resolve = (from, spec) => {
    const base = path.resolve(path.dirname(from), spec);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    throw new Error(`import não encontrado: "${spec}" em ${path.basename(from)}`);
  };
  const load = (file) => {
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith('.json')) {
      const m = {exports: JSON.parse(fs.readFileSync(file, 'utf8'))};
      cache.set(file, m);
      return m.exports;
    }
    const T = ts();
    const out = T.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {module: T.ModuleKind.CommonJS, target: T.ScriptTarget.ES2020, jsx: T.JsxEmit.ReactJSX, esModuleInterop: true},
    }).outputText;
    const module = {exports: {}};
    cache.set(file, module);
    const req = (spec) => (spec.startsWith('.') ? load(resolve(file, spec)) : inert);
    const ctx = vm.createContext({__m: module, __r: req, console: {log() {}, warn() {}, error() {}}});
    new vm.Script(`(function (exports, require, module) {${out}\n})(__m.exports, __r, __m);`, {filename: file}).runInContext(ctx, {timeout: 2000});
    return module.exports;
  };
  return load(entry);
};

// ─────────────────────────────────────────────────────────────
// Leitura do código-fonte (AST)
// ─────────────────────────────────────────────────────────────

/** Arquivos-fonte do projeto, sem a cópia do engine. */
export const projectSources = (srcDir) =>
  walkFiles(srcDir)
    .filter((f) => SRC_EXT.test(f) && !f.startsWith('engine/'))
    .map((f) => path.join(srcDir, f));

/**
 * Extrai de um arquivo: chamadas staticFile(), literais de texto que parecem
 * arquivos de mídia/fonte, URLs, e marcadores de uso (FontFace, delayRender...).
 */
export const scanSource = (file) => {
  const T = ts();
  const text = fs.readFileSync(file, 'utf8');
  const sf = T.createSourceFile(file, text, T.ScriptTarget.Latest, true, file.endsWith('x') ? T.ScriptKind.TSX : T.ScriptKind.TS);
  const r = {file, staticRefs: [], dynamicRefs: [], opaqueRefs: 0, literals: [], urls: [], fontFamilies: [], textStyles: [], colorPairs: []};
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const templateRegex = (node) => {
    let src = `^${escapeRe(node.head.text)}`;
    for (const span of node.templateSpans) src += `.+${escapeRe(span.literal.text)}`;
    return {pattern: `${src}$`, display: node.getText().slice(1, -1)};
  };
  const visit = (node) => {
    if (T.isCallExpression(node) && T.isIdentifier(node.expression) && node.expression.text === 'staticFile') {
      const a = node.arguments[0];
      if (a && (T.isStringLiteral(a) || T.isNoSubstitutionTemplateLiteral(a))) r.staticRefs.push({path: a.text, line: line(a)});
      else if (a && T.isTemplateExpression(a)) r.dynamicRefs.push({...templateRegex(a), line: line(a)});
      else r.opaqueRefs++;
    }
    if (T.isStringLiteral(node) || T.isNoSubstitutionTemplateLiteral(node)) {
      const v = node.text;
      if (/^(https?:)?\/\//i.test(v) || /\burl\(\s*['"]?https?:/i.test(v) || /@import\s+(url\()?['"]?https?:/i.test(v)) {
        if (!ALLOWED_URL.test(v)) r.urls.push({value: v, line: line(node)});
      } else if (MEDIA_EXT_RE.test(v) && !/\s{2,}|\n/.test(v) && v.length < 260) {
        r.literals.push({path: v, line: line(node)});
      }
    }
    // Legibilidade: fontSize/fontWeight literais e pares de cor literais (texto × fundo).
    const literalOf = (init) =>
      !init ? undefined
      : T.isNumericLiteral(init) ? Number(init.text)
      : T.isStringLiteral(init) || T.isNoSubstitutionTemplateLiteral(init) ? init.text
      : T.isJsxExpression(init) && init.expression ? literalOf(init.expression)
      : undefined;
    const collect = (props, nameOf, initOf, at) => {
      const v = {};
      for (const p of props) {
        const n = nameOf(p);
        if (n) v[n] = literalOf(initOf(p));
      }
      if (typeof v.fontSize === 'number') r.textStyles.push({fontSize: v.fontSize, fontWeight: typeof v.fontWeight === 'number' ? v.fontWeight : Number(v.fontWeight) || null, line: line(at)});
      const bg = v.background ?? v.backgroundColor;
      if (typeof v.color === 'string' && typeof bg === 'string') r.colorPairs.push({color: v.color, background: bg, line: line(at)});
    };
    if (T.isObjectLiteralExpression(node)) {
      collect(node.properties.filter(T.isPropertyAssignment), (p) => p.name.getText().replace(/['"]/g, ''), (p) => p.initializer, node);
    }
    if (T.isJsxSelfClosingElement(node) || T.isJsxOpeningElement(node)) {
      collect(node.attributes.properties.filter(T.isJsxAttribute), (p) => p.name.getText(), (p) => p.initializer, node);
    }
    // fontFamily: '...' (objeto de estilo) e font-family: ... (CSS em texto)
    if (T.isPropertyAssignment(node) && node.name.getText().replace(/['"]/g, '') === 'fontFamily') {
      const init = node.initializer;
      if (T.isStringLiteral(init) || T.isNoSubstitutionTemplateLiteral(init)) r.fontFamilies.push({value: init.text, line: line(init)});
    }
    if ((T.isStringLiteral(node) || T.isNoSubstitutionTemplateLiteral(node)) && /font-family\s*:/i.test(node.text)) {
      for (const m of node.text.matchAll(/font-family\s*:\s*([^;}]+)/gi)) r.fontFamilies.push({value: m[1].trim(), line: line(node)});
    }
    if (T.isTemplateExpression(node)) {
      const heads = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
      if (/https?:\/\//i.test(heads)) r.urls.push({value: node.getText(), line: line(node)});
    }
    T.forEachChild(node, visit);
  };
  visit(sf);
  r.uses = {
    fontFace: /\bnew\s+FontFace\s*\(/.test(text),
    loadFont: /\b(loadFonts?|useFonts)\s*\(/.test(text) || /@remotion\/(google-)?fonts/.test(text),
    delayRender: /\bdelayRender\s*\(/.test(text),
    safeZones: /\b(safePadding|safeBox|SAFE_AREA|CAPTION_BAND|fitFontSize)\b/.test(text),
    safeOverlay: /\bSafeAreaOverlay\b/.test(text),
    audioComponent: /<(Audio|Html5Audio|Soundtrack)\b/.test(text),
    videoComponent: /<(Video|OffthreadVideo|Html5Video|ClipTrack)\b/.test(text),
    showSafeAreaTrue: /\bshowSafeArea\s*:\s*true\b/.test(text),
    gradient: /\b(radial|linear|conic)-gradient\(/.test(text),
    grain: /<Grain\b/.test(text),
  };
  // Atributos da <Composition> (Root.tsx)
  const comp = [];
  const findComp = (node) => {
    if ((T.isJsxSelfClosingElement(node) || T.isJsxOpeningElement(node)) && node.tagName.getText() === 'Composition') {
      const attrs = {};
      for (const p of node.attributes.properties) {
        if (!T.isJsxAttribute(p) || !p.initializer) continue;
        const init = p.initializer;
        attrs[p.name.getText()] = T.isStringLiteral(init) ? {literal: init.text} : {expr: init.expression?.getText() ?? ''};
      }
      comp.push(attrs);
    }
    T.forEachChild(node, findComp);
  };
  findComp(sf);
  r.compositions = comp;
  return r;
};

/** Famílias de uma lista font-family que têm um token numérico e estão sem aspas. */
/** Mínimos de legibilidade — espelham engine/src/utils/legibility.ts (conferido por teste). */
export const LEGIBILITY = {minFontSize: 56, minFontSizeThin: 80, minContrast: 4.5};

const hexRgb = (c) => {
  const m = String(c).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const relLum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Razão de contraste WCAG entre duas cores hex; null se alguma não for hex. */
export const contrastRatio = (a, b) => {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [relLum(ca), relLum(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const unquotedNumericFamilies = (value) =>
  String(value)
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f && !/^['"]/.test(f) && /(^|\s)\d/.test(f));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tipos de mídia (audio, video, image, font) referenciados no código do projeto. */
export const referencedMediaTypes = (project) => {
  const src = path.join(project.dir, 'src');
  const assetFiles = walkFiles(project.assets);
  const types = new Set();
  for (const f of fs.existsSync(src) ? projectSources(src) : []) {
    const sc = scanSource(f);
    for (const r of [...sc.staticRefs, ...sc.literals]) types.add(typeOf(r.path));
    for (const d of sc.dynamicRefs) {
      const re = new RegExp(d.pattern);
      for (const a of assetFiles) if (re.test(a)) types.add(typeOf(a));
    }
    if (sc.uses.audioComponent) types.add('audio-component');
  }
  return types;
};

// ─────────────────────────────────────────────────────────────
// Fingerprint (para saber se um preflight registrado ficou desatualizado)
// ─────────────────────────────────────────────────────────────

export const projectFingerprint = (projectDir) => {
  const h = crypto.createHash('sha256');
  const add = (dir, prefix) => {
    for (const f of walkFiles(dir)) {
      const st = fs.statSync(path.join(dir, f));
      h.update(`${prefix}/${f}\0${st.size}\0${Math.round(st.mtimeMs)}\n`);
    }
  };
  add(path.join(projectDir, 'src'), 'src');
  add(path.join(projectDir, 'assets'), 'assets');
  const pj = path.join(projectDir, 'project.json');
  if (fs.existsSync(pj)) h.update(fs.readFileSync(pj));
  return h.digest('hex').slice(0, 16);
};

// ─────────────────────────────────────────────────────────────
// Typecheck só deste projeto
// ─────────────────────────────────────────────────────────────

export const typecheckProject = (projectDir) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-engine-tc-'));
  const cfg = path.join(tmp, 'tsconfig.json');
  const abs = (p) => p.split(path.sep).join('/');
  fs.writeFileSync(cfg, JSON.stringify({extends: abs(path.join(ROOT, 'tsconfig.json')), include: [abs(path.join(projectDir, 'src')) + '/**/*'], exclude: []}));
  try {
    const tsc = require.resolve('typescript/bin/tsc');
    const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', cfg], {cwd: ROOT, encoding: 'utf8', timeout: 300000});
    if (r.error) return {ok: false, errors: [`tsc não executou: ${r.error.message}`]};
    const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /error TS\d+/.test(l));
    const clean = lines.map((l) => l.replace(abs(projectDir) + '/', '').replace(projectDir + path.sep, '').trim());
    return {ok: r.status === 0, errors: r.status === 0 ? [] : clean.length ? clean : [`tsc saiu com código ${r.status}`]};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
};

// ─────────────────────────────────────────────────────────────
// Preflight
// ─────────────────────────────────────────────────────────────

/**
 * Executa todas as checagens. `project` = retorno de loadProject() (scripts/lib.mjs).
 * opts: {typecheck = true, probeMedia = true, status = objeto de estado (opcional)}
 */
export const runPreflight = (project, {typecheck = true, probeMedia = true, status = null} = {}) => {
  const checks = [];
  const add = (area, level, msg) => checks.push({area, level, msg});
  const {dir, config} = project;
  const src = path.join(dir, 'src');
  const assetsDir = project.assets;
  const relSrc = (f) => path.relative(dir, f).split(path.sep).join('/');

  // ── Estrutura ────────────────────────────────────────────
  const required = ['project.json', 'src/index.ts', 'src/Root.tsx', 'src/timeline.ts', 'src/compositions/Main.tsx', 'src/engine/index.ts', 'assets'];
  const missing = required.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) add('estrutura', 'error', `Faltando: ${missing.join(', ')}.`);
  else add('estrutura', 'ok', 'Estrutura do projeto completa (entry, Root, timeline, Main, cópia do engine, assets/).');
  for (const f of ['briefing.md', 'storyboard.md', 'manifesto-de-assets.md', 'versoes.md']) {
    if (!fs.existsSync(path.join(dir, f))) add('estrutura', 'warn', `${f} não existe.`);
  }
  for (const k of ['cliente', 'projeto']) {
    if (!config[k] || /\{\{.+\}\}/.test(config[k])) add('estrutura', 'error', `"${k}" não definido em project.json.`);
  }
  if (!status) add('estrutura', 'info', 'Sem project-status.json (projeto sem controle de estado).');

  // ── Linguagem visual ─────────────────────────────────────
  if (typeof config.linguagem === 'string' && config.linguagem) {
    try {
      const cat = loadCatalog(ROOT);
      const l = cat.todas.find((x) => x.id === config.linguagem);
      if (!l) add('linguagem', 'error', `Linguagem "${config.linguagem}" (project.json) não existe no catálogo (npm run linguagens).`);
      else add('linguagem', 'ok', `Linguagem: ${l.nome} — ritmo ${l.eixos.ritmo}, cortes de ${l.corteSegundos[0]}–${l.corteSegundos[1]} s, movimento "${l.eixos.movimento}", transições: ${l.transicoes.join(', ')}.`);
    } catch (e) {
      add('linguagem', 'error', e.message.split('\n')[0]);
    }
  } else if (status && stageIndex(status.stage) > stageIndex('01_CONCEPT')) {
    add('linguagem', 'info', 'Sem "linguagem" no project.json (projeto anterior à regra do GATE 1).');
  }

  // ── Duração ──────────────────────────────────────────────
  const fps = EXPECTED.fps;
  const dur = config.durationSeconds;
  let targetFrames = null;
  if (typeof dur !== 'number' || !(dur > 0)) add('duração', 'error', '"durationSeconds" não definido em project.json.');
  else {
    targetFrames = Math.round(dur * fps);
    if (Math.abs(dur * fps - targetFrames) > 1e-6) add('duração', 'warn', `${dur}s não é múltiplo de 1/${fps}s: vira ${targetFrames} frames (${(targetFrames / fps).toFixed(3)}s).`);
    else add('duração', 'ok', `Duração total ${dur}s = ${targetFrames} frames a ${fps} fps.`);
  }

  // ── Formato (engine copy + Root) ─────────────────────────
  let format = null;
  const fmtFile = path.join(src, 'engine', 'constants', 'format.ts');
  if (fs.existsSync(fmtFile)) {
    try {
      format = evalModule(fmtFile).FORMAT;
    } catch (e) {
      add('formato', 'warn', `Não foi possível ler src/engine/constants/format.ts: ${e.message}`);
    }
  }
  if (format) {
    const bad = ['width', 'height', 'fps'].filter((k) => format[k] !== EXPECTED[k]);
    if (bad.length) add('formato', 'error', `FORMAT do engine do projeto = ${format.width}×${format.height} · ${format.fps} fps (esperado 1080×1920 · 30 fps).`);
  }
  const rootFile = path.join(src, 'Root.tsx');
  if (fs.existsSync(rootFile)) {
    const root = scanSource(rootFile);
    const main = root.compositions.find((c) => c.id?.literal === 'Main');
    if (!root.compositions.length) add('formato', 'error', 'Root.tsx não declara <Composition>.');
    else if (!main) add('formato', 'error', 'Nenhuma <Composition id="Main"> em Root.tsx (os scripts dependem desse id).');
    else {
      const resolveAttr = (key) => {
        const a = main[key];
        if (!a) return {value: undefined, how: 'ausente'};
        const m = a.expr?.match(/^FORMAT\.(width|height|fps)$/);
        if (m) return {value: format?.[m[1]], how: `FORMAT.${m[1]}`};
        if (a.expr !== undefined && /^\d+(\.\d+)?$/.test(a.expr)) return {value: Number(a.expr), how: 'literal'};
        return {value: undefined, how: `expressão "${a.expr ?? a.literal}"`};
      };
      const res = {};
      let unverifiable = false;
      for (const k of ['width', 'height', 'fps']) {
        const {value, how} = resolveAttr(k);
        res[k] = value;
        if (value === undefined) {
          unverifiable = true;
          add('formato', 'warn', `Composition "Main": ${k} não verificável (${how}).`);
        } else if (value !== EXPECTED[k]) add('formato', 'error', `Composition "Main": ${k} = ${value} (esperado ${EXPECTED[k]}).`);
      }
      if (!unverifiable && res.width === 1080 && res.height === 1920 && res.fps === 30) add('formato', 'ok', 'Composition "Main" em 1080×1920 · 30 fps.');
      if (main.durationInFrames && !main.calculateMetadata) add('formato', 'warn', 'durationInFrames fixo sem calculateMetadata: a duração não vem do project.json/timeline.');
    }
  }

  // ── Timeline ─────────────────────────────────────────────
  const tlFile = path.join(src, 'timeline.ts');
  if (fs.existsSync(tlFile)) {
    let scenes = null;
    try {
      scenes = evalModule(tlFile).SCENES;
    } catch (e) {
      add('timeline', 'warn', `Não foi possível avaliar src/timeline.ts (${e.message}). A soma será conferida pelo Studio/render.`);
    }
    if (scenes && !Array.isArray(scenes)) add('timeline', 'error', 'src/timeline.ts não exporta SCENES como lista.');
    else if (scenes) {
      if (!scenes.length) add('timeline', 'warn', 'SCENES vazio: a duração vem só do project.json (storyboard ainda não transcrito?).');
      else {
        const ids = scenes.map((s) => s.id);
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dup.length) add('timeline', 'error', `ids de cena repetidos: ${[...new Set(dup)].join(', ')}.`);
        const invalid = scenes.filter((s) => !(s.durationInSeconds > 0));
        if (invalid.length) add('timeline', 'error', `Cenas sem duração válida: ${invalid.map((s) => s.id).join(', ')}.`);
        const frac = scenes.filter((s) => s.durationInSeconds > 0 && Math.abs(s.durationInSeconds * fps - Math.round(s.durationInSeconds * fps)) > 1e-6);
        if (frac.length) add('timeline', 'warn', `Durações que não são múltiplas de 1/30 s (arredondadas): ${frac.map((s) => s.id).join(', ')}.`);
        const sum = scenes.reduce((a, s) => a + Math.round((s.durationInSeconds || 0) * fps), 0);
        if (targetFrames !== null) {
          if (sum !== targetFrames) add('timeline', 'error', `Soma das cenas = ${sum} frames (${(sum / fps).toFixed(2)}s) ≠ duração ${targetFrames} frames (${dur}s).`);
          else add('timeline', 'ok', `${scenes.length} cenas somando ${sum} frames = duração do briefing.`);
        }
      }
    }
  }

  // ── Leitura do código ────────────────────────────────────
  const files = fs.existsSync(src) ? projectSources(src) : [];
  const scans = [];
  for (const f of files) {
    try {
      scans.push(scanSource(f));
    } catch (e) {
      add('código', 'warn', `Não foi possível analisar ${relSrc(f)}: ${e.message}`);
    }
  }
  const assetFiles = walkFiles(assetsDir);
  const assetSet = new Set(assetFiles);

  // ── Assets referenciados ─────────────────────────────────
  const referenced = new Map(); // path → [{file, line}]
  const pushRef = (p, where) => referenced.set(p, [...(referenced.get(p) ?? []), where]);
  const pathProblems = [];
  for (const s of scans) {
    for (const r of s.staticRefs) pushRef(r.path, `${relSrc(s.file)}:${r.line}`);
    for (const r of s.literals) {
      if (/^[a-z]+:\/\//i.test(r.path)) continue;
      pushRef(r.path, `${relSrc(s.file)}:${r.line}`);
    }
  }
  const missingRefs = [];
  for (const [p, where] of referenced) {
    const norm = p.replace(/^\.\//, '');
    if (/^([a-zA-Z]:[\\/]|\/|\\)/.test(p) || p.includes('..') || p.includes('\\')) {
      pathProblems.push(`"${p}" (${where[0]}) — use caminho relativo a assets/ com "/"`);
    } else if (norm.startsWith('assets/') && !assetSet.has(norm)) {
      pathProblems.push(`"${p}" (${where[0]}) — staticFile() já parte de assets/; remova o prefixo "assets/"`);
    } else if (!assetSet.has(norm)) missingRefs.push(`${p} (${where.join(', ')})`);
  }
  for (const m of pathProblems) add('assets', 'error', `Caminho inválido: ${m}.`);
  for (const m of missingRefs) add('assets', 'error', `Arquivo referenciado não existe em assets/: ${m}.`);
  const dynamic = scans.flatMap((s) => s.dynamicRefs.map((d) => ({...d, file: relSrc(s.file)})));
  const dynamicMatches = new Set();
  for (const d of dynamic) {
    const re = new RegExp(d.pattern);
    const hits = assetFiles.filter((f) => re.test(f));
    hits.forEach((h) => dynamicMatches.add(h));
    if (!hits.length) add('assets', 'error', `staticFile(\`${d.display}\`) (${d.file}:${d.line}) não casa com nenhum arquivo em assets/.`);
    else add('assets', 'info', `staticFile(\`${d.display}\`) é dinâmico: ${hits.length} arquivo(s) compatível(is). Nomes exatos não verificáveis estaticamente.`);
  }
  const opaque = scans.reduce((a, s) => a + s.opaqueRefs, 0);
  if (opaque) add('assets', 'info', `${opaque} chamada(s) staticFile(variável): conferidas pelos literais de caminho no código.`);
  const okRefs = [...referenced.keys()].filter((p) => assetSet.has(p.replace(/^\.\//, ''))).length;
  if (!missingRefs.length && !pathProblems.length) add('assets', 'ok', `${okRefs} referência(s) literal(is) a assets — todas existem.`);
  const used = new Set([...referenced.keys()].map((p) => p.replace(/^\.\//, '')).concat([...dynamicMatches]));
  const unused = assetFiles.filter((f) => !used.has(f) && ['image', 'video', 'audio', 'font'].includes(typeOf(f)));
  if (unused.length) add('assets', 'info', `Mídia em assets/ não referenciada no código: ${unused.join(', ')}.`);
  const empty = assetFiles.filter((f) => fs.statSync(path.join(assetsDir, f)).size === 0);
  if (empty.length) add('assets', 'error', `Arquivo(s) vazio(s) em assets/: ${empty.join(', ')}.`);

  // ── Fontes ───────────────────────────────────────────────
  const usedList = [...used];
  const fontRefs = usedList.filter((p) => typeOf(p) === 'font');
  const anyUse = (k) => scans.some((s) => s.uses[k]);
  if (!fontRefs.length && !anyUse('loadFont')) {
    add('fontes', 'warn', 'Nenhum arquivo de fonte referenciado: os textos dependerão de fontes do sistema (varia entre computadores).');
  } else {
    if (fontRefs.length) add('fontes', 'ok', `${fontRefs.length} arquivo(s) de fonte local referenciado(s) e presente(s).`);
    if (fontRefs.length && !anyUse('fontFace') && !anyUse('loadFont')) add('fontes', 'warn', 'Arquivos de fonte referenciados, mas nenhum carregamento com FontFace/loadFont encontrado.');
    if (anyUse('fontFace') && !anyUse('delayRender')) add('fontes', 'error', 'FontFace sem delayRender(): frames podem ser renderizados antes da fonte carregar.');
  }
  // Nome de família com número e sem aspas é CSS inválido: o navegador ignora e usa a fonte padrão
  // (docs/13-ARMADILHAS-REMOTION.md, item 3).
  for (const sc of scans) {
    for (const ff of sc.fontFamilies) {
      const bad = unquotedNumericFamilies(ff.value);
      if (bad.length) {
        add('fontes', 'warn', `${relSrc(sc.file)}:${ff.line}: fontFamily "${ff.value}" — o nome ${bad.map((b) => `"${b}"`).join(', ')} tem número e está sem aspas; o navegador vai ignorar. Use fontCss() do engine ou "'${bad[0]}', sans-serif".`);
      }
    }
  }

  // ── Legibilidade no celular ──────────────────────────────
  // Mínimos (engine/src/utils/legibility.ts, docs/08-INSTAGRAM.md): caixa alta ≥ ~40 px
  // (fontSize ≥ 56), peso fino só com corpo ≥ 80, contraste ≥ 4,5:1.
  let legIssues = 0;
  for (const sc of scans) {
    for (const t of sc.textStyles) {
      if (t.fontSize < LEGIBILITY.minFontSize) {
        legIssues++;
        add('legibilidade', 'warn', `${relSrc(sc.file)}:${t.line}: fontSize ${t.fontSize} — abaixo do mínimo para celular (caixa alta ≈ ${Math.round(t.fontSize * 0.7)} px; mínimo ~40 px = fontSize ${LEGIBILITY.minFontSize}).`);
      } else if (t.fontWeight && t.fontWeight < 400 && t.fontSize < LEGIBILITY.minFontSizeThin) {
        legIssues++;
        add('legibilidade', 'warn', `${relSrc(sc.file)}:${t.line}: peso ${t.fontWeight} com fontSize ${t.fontSize} — fino demais para o celular (peso abaixo de 400 só com fontSize ≥ ${LEGIBILITY.minFontSizeThin}).`);
      }
    }
    for (const c of sc.colorPairs) {
      const ratio = contrastRatio(c.color, c.background);
      if (ratio !== null && ratio < LEGIBILITY.minContrast) {
        legIssues++;
        add('legibilidade', 'warn', `${relSrc(sc.file)}:${c.line}: contraste ${ratio.toFixed(2)}:1 entre ${c.color} e ${c.background} (mínimo ${LEGIBILITY.minContrast}:1).`);
      }
    }
  }
  if (!legIssues) add('legibilidade', 'ok', 'Tamanhos, pesos e pares de cor literais dentro dos mínimos (cores calculadas em tempo de execução são conferidas por Pill/Cutout no console).');

  // ── Faixas em degradês (banding) ─────────────────────────
  if (anyUse('gradient') && !anyUse('grain')) {
    add('degradês', 'warn', 'Degradê no código sem <Grain>: degradês suaves (sobretudo escuros) viram faixas na recompressão do Instagram. Aplique Grain leve por cima (docs/13-ARMADILHAS-REMOTION.md, item 4).');
  }

  // ── Áudio / vídeo ────────────────────────────────────────
  const mediaUsed = usedList.filter((p) => assetSet.has(p) && ['audio', 'video'].includes(typeOf(p)));
  const audioUsed = mediaUsed.filter((p) => typeOf(p) === 'audio');
  if (!mediaUsed.length) add('áudio', 'info', 'Nenhum áudio/vídeo referenciado (vídeo sem trilha).');
  if (probeMedia && mediaUsed.length) {
    let longest = 0;
    let bad = 0;
    for (const p of mediaUsed) {
      const info = probe(path.join(assetsDir, p));
      if (info.error) {
        bad++;
        add('áudio', 'error', `${p}: ffprobe não conseguiu ler (${info.error}).`);
        continue;
      }
      if (typeOf(p) === 'audio' && !info.audio) {
        bad++;
        add('áudio', 'error', `${p}: nenhuma trilha de áudio.`);
      }
      if (typeOf(p) === 'video' && !info.video) {
        bad++;
        add('áudio', 'error', `${p}: nenhuma trilha de vídeo.`);
      }
      if (typeOf(p) === 'audio') longest = Math.max(longest, info.durationSec ?? 0);
    }
    if (!bad) add('áudio', 'ok', `${mediaUsed.length} arquivo(s) de áudio/vídeo legível(is) pelo ffprobe.`);
    if (audioUsed.length && dur > 0 && longest + 1e-3 < dur) {
      add('áudio', 'info', `O áudio mais longo tem ${longest.toFixed(2)}s, menos que os ${dur}s do vídeo (confira se a trilha acaba antes do fim).`);
    }
  }
  if (audioUsed.length && !anyUse('audioComponent')) add('áudio', 'warn', 'Há arquivos de áudio referenciados, mas nenhum <Audio>/<Html5Audio> no código.');

  // ── Safe area ────────────────────────────────────────────
  if (scans.some((s) => s.uses.showSafeAreaTrue)) {
    const where = scans.filter((s) => s.uses.showSafeAreaTrue).map((s) => relSrc(s.file));
    add('safe area', 'error', `showSafeArea: true em ${where.join(', ')} — o guia apareceria no render. Deve ser false.`);
  }
  if (!fs.existsSync(path.join(src, 'engine', 'constants', 'safeArea.ts'))) add('safe area', 'error', 'src/engine/constants/safeArea.ts não existe na cópia do engine.');
  else {
    try {
      const sa = evalModule(path.join(src, 'engine', 'constants', 'safeArea.ts'));
      const c = sa.SAFE_AREA?.critical;
      const box = typeof sa.safeBox === 'function' ? sa.safeBox('critical') : null;
      if (!c || !box || !(box.width > 0 && box.height > 0)) add('safe area', 'error', 'SAFE_AREA/safeBox inválidos na cópia do engine.');
    } catch (e) {
      add('safe area', 'warn', `Não foi possível avaliar safeArea.ts: ${e.message}`);
    }
  }
  const zoneUsers = scans.filter((s) => s.uses.safeZones).length;
  if (!zoneUsers) add('safe area', 'warn', 'Nenhum arquivo usa safePadding/safeBox/SAFE_AREA/fitFontSize: textos podem estar fora das zonas.');
  else add('safe area', 'ok', `${zoneUsers} arquivo(s) posicionam conteúdo pelas zonas do engine. Conferência visual continua no Studio (GATE 3).`);
  if (!anyUse('safeOverlay')) add('safe area', 'info', 'SafeAreaOverlay não é usado: não há guia visual para o Studio.');

  // ── URLs externas ────────────────────────────────────────
  const urls = scans.flatMap((s) => s.urls.map((u) => `${u.value.slice(0, 80)} (${relSrc(s.file)}:${u.line})`));
  if (urls.length) for (const u of urls) add('urls', 'error', `URL externa no código: ${u}. Baixe o arquivo para assets/ (render local e reprodutível).`);
  else add('urls', 'ok', 'Nenhuma URL externa no código do projeto.');

  // ── Config global ────────────────────────────────────────
  const rcPath = path.join(ROOT, 'remotion.config.ts');
  if (!fs.existsSync(rcPath)) add('config', 'error', 'remotion.config.ts não encontrado na raiz.');
  else {
    const rc = fs.readFileSync(rcPath, 'utf8');
    const need = [
      [/setCodec\(\s*['"]h264['"]\s*\)/, "setCodec('h264')"],
      [/setPixelFormat\(\s*['"]yuv420p['"]\s*\)/, "setPixelFormat('yuv420p')"],
      [/setColorSpace\(\s*['"]bt709['"]\s*\)/, "setColorSpace('bt709')"],
      [/setOverwriteOutput\(\s*false\s*\)/, 'setOverwriteOutput(false)'],
    ];
    const lacking = need.filter(([re]) => !re.test(rc)).map(([, n]) => n);
    if (lacking.length) add('config', 'error', `remotion.config.ts sem: ${lacking.join(', ')}.`);
    else add('config', 'ok', 'Config global: H.264 · yuv420p · BT.709 · sem sobrescrita.');
  }

  // ── Destino do render ────────────────────────────────────
  if (config.cliente && config.projeto) {
    const base = renderBase(config);
    const versions = existingRenderVersions(project.renders, config);
    const next = versionLabel((versions.length ? Math.max(...versions) : 0) + 1);
    const dest = `renders/${base}_${next}.mp4`;
    if (fs.existsSync(path.join(dir, dest))) add('destino', 'error', `${dest} já existe.`);
    else add('destino', 'ok', `Próximo render: ${dest}${versions.length ? ` (existentes: ${versions.map(versionLabel).join(', ')})` : ''}.`);
    if (status && status.projectVersion !== next && status.stage !== '10_FINAL') {
      const done = versions.includes(Number(status.projectVersion.slice(1)));
      if (done) add('destino', 'info', `${status.projectVersion} (versão de trabalho) já foi renderizada; um novo render geraria ${next}.`);
      else add('destino', 'warn', `Versão de trabalho no estado = ${status.projectVersion}, mas o render geraria ${next}.`);
    }
  }

  // ── Typecheck ────────────────────────────────────────────
  if (typecheck) {
    const tc = typecheckProject(dir);
    if (tc.ok) add('typecheck', 'ok', 'TypeScript sem erros neste projeto.');
    else {
      for (const e of tc.errors.slice(0, 15)) add('typecheck', 'error', e);
      if (tc.errors.length > 15) add('typecheck', 'error', `… e mais ${tc.errors.length - 15} erro(s).`);
    }
  } else add('typecheck', 'info', 'Typecheck não executado nesta rodada.');

  const errors = checks.filter((c) => c.level === 'error').length;
  const warnings = checks.filter((c) => c.level === 'warn').length;
  return {
    slug: project.slug,
    at: new Date().toISOString(),
    ok: errors === 0,
    errors,
    warnings,
    typecheck,
    fingerprint: projectFingerprint(dir),
    checks,
  };
};

const ICON = {error: '✖', warn: '⚠', ok: '✓', info: '·'};

export const formatPreflight = (r) => {
  const lines = [`PREFLIGHT — ${r.slug}`, ''];
  let area = null;
  for (const c of r.checks) {
    if (c.area !== area) {
      area = c.area;
      lines.push(`[${area}]`);
    }
    lines.push(`  ${ICON[c.level]} ${c.msg}`);
  }
  lines.push('', r.ok ? `✔ APROVADO — ${r.warnings} aviso(s).` : `✖ REPROVADO — ${r.errors} erro(s), ${r.warnings} aviso(s).`);
  return lines.join('\n');
};

/** Resumo compacto para gravar no project-status.json. */
export const preflightSummary = (r) => ({
  at: r.at,
  ok: r.ok,
  errors: r.errors,
  warnings: r.warnings,
  typecheck: r.typecheck,
  fingerprint: r.fingerprint,
  problems: r.checks.filter((c) => c.level === 'error' || c.level === 'warn').slice(0, 30).map((c) => `${c.level === 'error' ? 'ERRO' : 'aviso'} [${c.area}] ${c.msg}`),
});
