// Linguagens visuais — catálogo, validação e histórico de uso.
//
// O catálogo do núcleo fica em engine/linguagens.json; quem usa a ferramenta
// pode acrescentar linguagens próprias em local/linguagens.json (fora do Git),
// com os MESMOS campos obrigatórios e ids que não colidem com os do núcleo.
//
// Os ids de personalidade, entrada e transição vêm de
// engine/src/animations/presets.ts (fonte da verdade do movimento).
//
// Documentação: docs/14-LINGUAGENS-VISUAIS.md
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CATALOG_SCHEMA = 'reels-engine.linguagens/1';
export const CORE_CATALOG = path.join('engine', 'linguagens.json');
export const LOCAL_CATALOG = path.join('local', 'linguagens.json');
export const PRESETS_FILE = path.join('engine', 'src', 'animations', 'presets.ts');
export const EXAMPLE_SLUG = 'exemplo-loja-promo';
export const REPEAT_WINDOW = 3;
export const MAX_SHARED_AXES = 2;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const AXES = {
  ritmo: ['lento', 'medio', 'rapido'],
  layout: ['centralizado', 'assimetrico', 'grid', 'tela-cheia'],
  textura: ['limpa', 'granulada', 'recortada'],
  // movimento: as personalidades de presets.ts
};

/** Faixa de duração de corte (segundos) coerente com cada ritmo. */
export const RHYTHM_BANDS = {lento: [2.5, 4.5], medio: [1.2, 2.5], rapido: [0.4, 1.2]};

const REQUIRED = ['id', 'nome', 'resumo', 'quandoUsar', 'evitarQuando', 'eixos', 'corteSegundos', 'entradas', 'hook', 'transicoes', 'tipografia', 'cor'];
const TEXT_FIELDS = ['nome', 'resumo', 'quandoUsar', 'evitarQuando', 'tipografia', 'cor'];

export class LinguagensError extends Error {}

/** Lê as listas de ids exportadas por presets.ts (PERSONALITIES, ENTRANCES, TRANSITIONS). */
export const readPresetIds = (root = DEFAULT_ROOT) => {
  const text = fs.readFileSync(path.join(root, PRESETS_FILE), 'utf8');
  const list = (name) => {
    const m = text.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`));
    if (!m) throw new LinguagensError(`${PRESETS_FILE}: lista ${name} não encontrada.`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  const hook = text.match(/export const HOOK_LEGIBLE_SECONDS = ([\d.]+);/);
  if (!hook) throw new LinguagensError(`${PRESETS_FILE}: HOOK_LEGIBLE_SECONDS não encontrado.`);
  return {personalidades: list('PERSONALITIES'), entradas: list('ENTRANCES'), transicoes: list('TRANSITIONS'), hookSegundos: Number(hook[1])};
};

/** Valida UMA linguagem. Devolve a lista de problemas (vazia = válida). */
export const validateLinguagem = (l, presets) => {
  const out = [];
  const who = l && typeof l.id === 'string' ? `"${l.id}"` : '(sem id)';
  if (!l || typeof l !== 'object' || Array.isArray(l)) return [`linguagem ${who}: precisa ser um objeto.`];
  for (const k of REQUIRED) if (!(k in l)) out.push(`linguagem ${who}: falta o campo "${k}".`);
  for (const k of Object.keys(l)) if (!REQUIRED.includes(k)) out.push(`linguagem ${who}: campo desconhecido "${k}".`);
  if ('id' in l && (typeof l.id !== 'string' || !ID_RE.test(l.id))) out.push(`linguagem ${who}: id inválido (minúsculas, números e hífens).`);
  for (const k of TEXT_FIELDS) if (k in l && (typeof l[k] !== 'string' || !l[k].trim())) out.push(`linguagem ${who}: "${k}" deve ser um texto não vazio.`);

  const e = l.eixos;
  if ('eixos' in l) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) out.push(`linguagem ${who}: "eixos" deve ser um objeto.`);
    else {
      const allowed = {...AXES, movimento: presets.personalidades};
      for (const k of Object.keys(e)) if (!(k in allowed)) out.push(`linguagem ${who}: eixo desconhecido "${k}".`);
      for (const [k, values] of Object.entries(allowed)) {
        if (!values.includes(e[k])) out.push(`linguagem ${who}: eixos.${k} deve ser um de: ${values.join(', ')}.`);
      }
    }
  }
  const c = l.corteSegundos;
  if ('corteSegundos' in l) {
    if (!Array.isArray(c) || c.length !== 2 || !c.every((n) => typeof n === 'number' && n > 0) || c[0] > c[1]) {
      out.push(`linguagem ${who}: "corteSegundos" deve ser [mínimo, máximo] em segundos.`);
    } else if (e && RHYTHM_BANDS[e.ritmo]) {
      const [lo, hi] = RHYTHM_BANDS[e.ritmo];
      if (c[0] < lo || c[1] > hi) out.push(`linguagem ${who}: corteSegundos [${c}] fora da faixa do ritmo "${e.ritmo}" (${lo}–${hi} s).`);
    }
  }
  if ('hook' in l) {
    const h = l.hook;
    const limit = presets.hookSegundos ?? 0.5;
    if (!h || typeof h !== 'object' || Array.isArray(h)) out.push(`linguagem ${who}: "hook" deve ser um objeto {entrada, legivelAteSegundos}.`);
    else {
      for (const k of Object.keys(h)) if (!['entrada', 'legivelAteSegundos'].includes(k)) out.push(`linguagem ${who}: hook.${k} desconhecido.`);
      if (!Array.isArray(l.entradas) || !l.entradas.includes(h.entrada)) out.push(`linguagem ${who}: hook.entrada "${h.entrada}" precisa ser uma das entradas da linguagem.`);
      if (typeof h.legivelAteSegundos !== 'number' || !(h.legivelAteSegundos > 0) || h.legivelAteSegundos > limit) {
        out.push(`linguagem ${who}: hook.legivelAteSegundos deve ser > 0 e no máximo ${limit} s (regra do hook: legível até ${limit} s em toda linguagem).`);
      }
    }
  }
  for (const [k, valid] of [['entradas', presets.entradas], ['transicoes', presets.transicoes]]) {
    if (!(k in l)) continue;
    const v = l[k];
    if (!Array.isArray(v) || !v.length) out.push(`linguagem ${who}: "${k}" deve ser uma lista não vazia.`);
    else for (const id of v) if (!valid.includes(id)) out.push(`linguagem ${who}: ${k} "${id}" não existe no engine (válidos: ${valid.join(', ')}).`);
  }
  return out;
};

/** Quantos eixos duas linguagens têm em comum. */
export const sharedAxes = (a, b) => ['ritmo', 'layout', 'textura', 'movimento'].filter((k) => a.eixos[k] === b.eixos[k]);

const readCatalogFile = (file, label) => {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new LinguagensError(`${label} inválido: ${e.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LinguagensError(`${label}: o conteúdo precisa ser um objeto JSON.`);
  for (const k of Object.keys(data)) if (!['$schema', 'linguagens'].includes(k)) throw new LinguagensError(`${label}: campo desconhecido "${k}".`);
  if ('$schema' in data && data.$schema !== CATALOG_SCHEMA) throw new LinguagensError(`${label}: "$schema" deve ser "${CATALOG_SCHEMA}".`);
  if (!Array.isArray(data.linguagens)) throw new LinguagensError(`${label}: "linguagens" deve ser uma lista.`);
  return data.linguagens;
};

/**
 * Carrega e valida o catálogo: núcleo + local (se existir).
 * Devolve {nucleo, local, todas, ids, presets, avisos}. Qualquer problema = LinguagensError.
 */
export const loadCatalog = (root = DEFAULT_ROOT, {includeLocal = true} = {}) => {
  const presets = readPresetIds(root);
  const nucleo = readCatalogFile(path.join(root, CORE_CATALOG), CORE_CATALOG.split(path.sep).join('/'));
  const problems = nucleo.flatMap((l) => validateLinguagem(l, presets));
  const localFile = path.join(root, LOCAL_CATALOG);
  const local = includeLocal && fs.existsSync(localFile) ? readCatalogFile(localFile, 'local/linguagens.json') : [];
  problems.push(...local.flatMap((l) => validateLinguagem(l, presets).map((p) => `local/linguagens.json: ${p}`)));

  const seen = new Map();
  for (const [l, origem] of [...nucleo.map((l) => [l, 'núcleo']), ...local.map((l) => [l, 'local'])]) {
    if (!l || typeof l.id !== 'string') continue;
    if (seen.has(l.id)) {
      problems.push(
        origem === 'local' && seen.get(l.id) === 'núcleo'
          ? `local/linguagens.json: o id "${l.id}" já existe no núcleo. Use outro id.`
          : `id repetido: "${l.id}" (${origem}).`,
      );
    }
    seen.set(l.id, origem);
  }
  if (problems.length) throw new LinguagensError(`Catálogo de linguagens inválido:\n  - ${problems.join('\n  - ')}`);

  const avisos = [];
  for (const l of local) {
    for (const n of nucleo) {
      const s = sharedAxes(l, n);
      if (s.length > MAX_SHARED_AXES) avisos.push(`local/linguagens.json: "${l.id}" coincide com "${n.id}" em ${s.length} eixos (${s.join(', ')}); talvez não seja uma linguagem realmente diferente.`);
    }
  }
  const todas = [...nucleo.map((l) => ({...l, origem: 'nucleo'})), ...local.map((l) => ({...l, origem: 'local'}))];
  return {nucleo, local, todas, ids: todas.map((l) => l.id), presets, avisos};
};

// ── Histórico de uso ─────────────────────────────────────────────

export const clienteKey = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Produções registradas em projects/: {slug, cliente, clienteKey, linguagem, criadoEm}.
 * Ignora moldes (pastas com "_"), o projeto de exemplo e projetos sem linguagem.
 * Ordem: mais recente primeiro (createdAt do estado ou do project.json).
 */
export const productionHistory = (projectsDir) => {
  if (!fs.existsSync(projectsDir)) return [];
  const out = [];
  for (const d of fs.readdirSync(projectsDir, {withFileTypes: true})) {
    if (!d.isDirectory() || d.name.startsWith('_') || d.name === EXAMPLE_SLUG) continue;
    const dir = path.join(projectsDir, d.name);
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
    } catch {
      continue;
    }
    if (typeof cfg.linguagem !== 'string' || !cfg.linguagem) continue;
    let criadoEm = cfg.createdAt ?? '';
    try {
      criadoEm = JSON.parse(fs.readFileSync(path.join(dir, 'project-status.json'), 'utf8')).createdAt ?? criadoEm;
    } catch {
      // sem estado: usa a data do project.json
    }
    out.push({slug: d.name, cliente: cfg.cliente ?? '', clienteKey: clienteKey(cfg.cliente), linguagem: cfg.linguagem, criadoEm: String(criadoEm)});
  }
  return out.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : a.slug.localeCompare(b.slug)));
};

/**
 * Repetição de linguagem em relação às últimas produções.
 *  - mesmoCliente: produções do MESMO cliente (as 3 mais recentes) com a mesma linguagem → exige motivo.
 *  - outrosClientes: produções de OUTROS clientes (as 3 mais recentes) com a mesma linguagem → só aviso.
 */
export const repetition = ({slug, cliente, linguagem}, history) => {
  if (!linguagem) return {mesmoCliente: [], outrosClientes: []};
  const key = clienteKey(cliente);
  const others = history.filter((h) => h.slug !== slug);
  const same = others.filter((h) => h.clienteKey === key).slice(0, REPEAT_WINDOW);
  const diff = others.filter((h) => h.clienteKey !== key).slice(0, REPEAT_WINDOW);
  return {
    mesmoCliente: same.filter((h) => h.linguagem === linguagem).map((h) => h.slug),
    outrosClientes: diff.filter((h) => h.linguagem === linguagem).map((h) => h.slug),
  };
};

/** Motivo válido: uma linha, com pelo menos 10 caracteres. */
export const validReason = (text) => typeof text === 'string' && text.trim().length >= 10 && !/[\r\n]/.test(text);
