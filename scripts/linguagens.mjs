// Catálogo de linguagens visuais.
//
// Uso (na raiz):
//   npm run linguagens                          → catálogo (núcleo + local), com os 4 eixos
//   npm run linguagens -- <id>                  → detalhes de uma linguagem
//   npm run linguagens -- --cliente "Loja X"    → linguagens usadas nas últimas produções do cliente
//   npm run linguagens -- --json                → saída estruturada
//
// Documentação: docs/14-LINGUAGENS-VISUAIS.md
import {PROJECTS_DIR, ROOT, assertLocalConfig, fail, parseArgs} from './lib.mjs';
import {LinguagensError, REPEAT_WINDOW, clienteKey, loadCatalog, productionHistory} from './linguagens-lib.mjs';

assertLocalConfig();
const {positional, flags} = parseArgs(process.argv.slice(2));

let cat;
try {
  cat = loadCatalog(ROOT);
} catch (e) {
  if (e instanceof LinguagensError) fail(e.message);
  throw e;
}

if (flags.json) {
  console.log(JSON.stringify({linguagens: cat.todas, presets: cat.presets}, null, 2));
  process.exit(0);
}

const eixos = (l) => `${l.eixos.ritmo} · ${l.eixos.layout} · ${l.eixos.textura} · ${l.eixos.movimento}`;

if (typeof flags.cliente === 'string') {
  const key = clienteKey(flags.cliente);
  const hist = productionHistory(PROJECTS_DIR).filter((h) => h.clienteKey === key);
  console.log(`\nLINGUAGENS — cliente "${flags.cliente}"\n`);
  if (!hist.length) console.log('  Nenhuma produção com linguagem registrada para este cliente.');
  hist.forEach((h, i) => {
    const mark = i < REPEAT_WINDOW ? '●' : '·';
    console.log(`  ${mark} ${h.slug.padEnd(32)} ${h.linguagem.padEnd(28)} ${h.criadoEm.slice(0, 10)}`);
  });
  if (hist.length) {
    const recent = [...new Set(hist.slice(0, REPEAT_WINDOW).map((h) => h.linguagem))];
    console.log(`\n  ● = últimas ${REPEAT_WINDOW} produções. Repetir ${recent.join(', ')} exige motivo no GATE 1 ("linguagemMotivo").`);
  }
  console.log('');
  process.exit(0);
}

const id = positional[0];
if (id) {
  const l = cat.todas.find((x) => x.id === id);
  if (!l) fail(`Linguagem "${id}" não existe. Rode npm run linguagens para ver o catálogo.`);
  console.log(`\n${l.nome} (${l.id})${l.origem === 'local' ? ' — linguagem local' : ''}\n`);
  console.log(`  ${l.resumo}\n`);
  console.log(`  Eixos:        ${eixos(l)}`);
  console.log(`  Cortes:       ${l.corteSegundos[0]}–${l.corteSegundos[1]} s`);
  console.log(`  Entradas:     ${l.entradas.join(', ')}`);
  console.log(`  Hook:         ${l.hook.entrada}, legível até ${l.hook.legivelAteSegundos} s`);
  console.log(`  Transições:   ${l.transicoes.join(', ')}`);
  console.log(`  Tipografia:   ${l.tipografia}`);
  console.log(`  Cor:          ${l.cor}`);
  console.log(`  Quando usar:  ${l.quandoUsar}`);
  console.log(`  Evitar:       ${l.evitarQuando}\n`);
  process.exit(0);
}

console.log('\nLINGUAGENS VISUAIS  (ritmo · layout · textura · movimento)\n');
for (const l of cat.todas) {
  console.log(`  ${l.id.padEnd(28)} ${eixos(l).padEnd(48)}${l.origem === 'local' ? ' [local]' : ''}`);
  console.log(`  ${''.padEnd(28)} ${l.resumo}`);
}
for (const a of cat.avisos) console.log(`\n  ⚠ ${a}`);
console.log(`\n  Detalhes: npm run linguagens -- <id>   ·   Uso por cliente: npm run linguagens -- --cliente "<Cliente>"\n`);
