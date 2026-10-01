// Camada local — carregamento e validação de local/config.json.
//
// local/ guarda as personalizações de quem usa a ferramenta (fora do Git).
// As regras em local/*.md são lidas pelo Claude; este arquivo cuida da parte
// que os SCRIPTS leem: local/config.json.
//
// Trava do núcleo (CLAUDE.md, seção "Invariantes"): a camada local prevalece
// em preferências, mas NUNCA altera GATE 3, GATE 4, a regra de não inventar
// fatos comerciais/factuais nem a regra de nunca sobrescrever versões.
// Um campo que tente mexer nisso é recusado com erro claro, e o comando para.
//
// Uso (na raiz):
//   npm run local:check        → valida local/config.json e local/linguagens.json e mostra o que está ativo
//
// Documentação: docs/12-AUTOMACAO.md, seção "Camada local".
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOCAL_DIR = 'local';
export const LOCAL_CONFIG = path.join(LOCAL_DIR, 'config.json');
export const LOCAL_CONFIG_SCHEMA = 'reels-engine.local-config/1';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class LocalConfigError extends Error {}

/**
 * Campos aceitos (lista fechada). Só entra aqui o que algum script lê.
 * Preferências de estilo, fluxo, clientes e modo ficam em local/REGRAS.md.
 */
const ALLOWED = {
  $schema: 'value',
  agente: 'object',
  'agente.projetosProtegidos': 'value',
};

/**
 * Travas do núcleo. A chave é normalizada (minúsculas, sem acento, só letras
 * e números) e comparada com os padrões abaixo, em qualquer nível do JSON.
 */
const LOCKS = [
  {re: /gate|aprova|approv|dispens|waiv/, trava: 'GATE 3 / GATE 4 (aprovação humana obrigatória)'},
  {re: /sobrescr|overwrit|versao|versoes|version/, trava: 'nunca sobrescrever versões'},
  {re: /invent|fato|fact/, trava: 'não inventar fatos comerciais ou factuais'},
];

const normalizeKey = (k) =>
  String(k)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const lockFor = (key) => {
  if (key === '$schema') return null;
  const n = normalizeKey(key);
  return LOCKS.find((l) => l.re.test(n)) ?? null;
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Valida o objeto já lido do JSON. Lança LocalConfigError na primeira violação. */
export const validateLocalConfig = (cfg) => {
  if (!isPlainObject(cfg)) throw new LocalConfigError(`${LOCAL_CONFIG} inválido: o conteúdo precisa ser um objeto JSON ({...}).`);

  // 1. Travas: varre TODAS as chaves, em qualquer nível, antes de qualquer outra regra.
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      const lock = lockFor(k);
      if (lock) {
        throw new LocalConfigError(
          `${LOCAL_CONFIG}: o campo "${p}" tenta alterar uma trava do núcleo (${lock.trava}). ` +
            'A camada local só muda preferências; travas não podem ser alteradas. Remova o campo.',
        );
      }
      if (isPlainObject(v)) walk(v, p);
    }
  };
  walk(cfg, '');

  // 2. Lista fechada de campos.
  const check = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      const kind = ALLOWED[p];
      if (!kind) {
        throw new LocalConfigError(
          `${LOCAL_CONFIG}: campo desconhecido "${p}". Campos aceitos: ${Object.keys(ALLOWED).filter((a) => ALLOWED[a] === 'value').join(', ')}. ` +
            'Preferências (estilo, fluxo, clientes, modo) vão em local/REGRAS.md.',
        );
      }
      if (kind === 'object') {
        if (!isPlainObject(v)) throw new LocalConfigError(`${LOCAL_CONFIG}: "${p}" deve ser um objeto.`);
        check(v, p);
      }
    }
  };
  check(cfg, '');

  // 3. Valores.
  if ('$schema' in cfg && cfg.$schema !== LOCAL_CONFIG_SCHEMA) {
    throw new LocalConfigError(`${LOCAL_CONFIG}: "$schema" deve ser "${LOCAL_CONFIG_SCHEMA}" (encontrado: ${JSON.stringify(cfg.$schema)}).`);
  }
  const prot = cfg.agente?.projetosProtegidos;
  if (prot !== undefined) {
    if (!Array.isArray(prot) || !prot.every((s) => typeof s === 'string')) {
      throw new LocalConfigError(`${LOCAL_CONFIG}: "agente.projetosProtegidos" deve ser uma lista de slugs.`);
    }
    const bad = prot.filter((s) => !SLUG_RE.test(s));
    if (bad.length) {
      throw new LocalConfigError(`${LOCAL_CONFIG}: slug inválido em "agente.projetosProtegidos": ${bad.map((s) => JSON.stringify(s)).join(', ')}.`);
    }
  }
  return cfg;
};

/**
 * Lê e valida local/config.json.
 * Arquivo ausente → {exists: false, config: {}}. Arquivo inválido → LocalConfigError.
 */
export const loadLocalConfig = (root) => {
  const file = path.join(root, LOCAL_CONFIG);
  if (!fs.existsSync(file)) return {exists: false, file, config: {}};
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new LocalConfigError(`${LOCAL_CONFIG} inválido: ${e.message}`);
  }
  return {exists: true, file, config: validateLocalConfig(cfg)};
};

// ── CLI: npm run local:check ─────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const {LinguagensError, LOCAL_CATALOG, loadCatalog} = await import('./linguagens-lib.mjs');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const hasDir = fs.existsSync(path.join(root, LOCAL_DIR));
  try {
    const {exists, config} = loadLocalConfig(root);
    console.log('\nCAMADA LOCAL\n');
    console.log(`  local/:              ${hasDir ? 'existe' : 'não existe (usando só o núcleo)'}`);
    if (hasDir) {
      const md = fs.readdirSync(path.join(root, LOCAL_DIR)).filter((f) => f.toLowerCase().endsWith('.md'));
      console.log(`  regras (.md):        ${md.length ? md.join(', ') : 'nenhuma'}`);
    }
    console.log(`  config.json:         ${exists ? 'válido' : 'ausente'}`);
    const prot = config.agente?.projetosProtegidos ?? [];
    console.log(`  projetos protegidos: ${prot.length ? prot.join(', ') : 'nenhum além do _MOLDE'}`);
    const hasLocalCatalog = fs.existsSync(path.join(root, LOCAL_CATALOG));
    const cat = loadCatalog(root);
    console.log(`  linguagens.json:     ${hasLocalCatalog ? `válido — ${cat.local.length} linguagem(ns) própria(s): ${cat.local.map((l) => l.id).join(', ') || '—'}` : 'ausente (só o catálogo do núcleo)'}`);
    for (const a of cat.avisos) console.log(`  ⚠ ${a}`);
    console.log('\n  Travas do núcleo (não mudam pela camada local): GATE 3, GATE 4,');
    console.log('  não inventar fatos, nunca sobrescrever versões.\n');
  } catch (e) {
    if (!(e instanceof LocalConfigError) && !(e instanceof LinguagensError)) throw e;
    console.error(`\n✖ ${e.message}\n`);
    process.exit(1);
  }
}
