// Gera os manuais (HTML autossuficientes, funcionam offline) a partir de manuais/fonte/.
//
// Uso (na raiz):
//   npm run manuais                 → grava manuais/implantacao.html e manuais/uso.html
//   npm run manuais -- --verificar  → só confere se os arquivos gerados estão em dia
//
// Fonte: manuais/fonte/{implantacao,uso}.html (conteúdo), estilo.css, app.js e graficos.mjs.
// Dados que vêm do próprio motor (nunca copiados à mão):
//   - VERSION                         → {{VERSION}}
//   - engine/linguagens.json          → {{LINGUAGENS}} (cartões com miniatura)
//   - projects/_MOLDE/briefing.md     → {{PERGUNTA:n}} (título das 8 perguntas)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT_DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANUAIS = ['implantacao', 'uso'];
const AVISO = '<!-- Gerado por "npm run manuais" a partir de manuais/fonte/. Não edite este arquivo: edite a fonte e gere de novo. -->';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const num = (x) => String(x).replace('.', ',');
const PT = {
  medio: 'médio', rapido: 'rápido', lento: 'lento', assimetrico: 'assimétrico', centralizado: 'centralizado', grid: 'grade',
  'tela-cheia': 'tela cheia', limpa: 'limpa', granulada: 'granulada', recortada: 'recortada', suave: 'suave', elastica: 'elástica',
  seca: 'seca', cinematografica: 'cinematográfica', mecanica: 'mecânica', degraus: 'degraus',
};

/** Títulos das 8 perguntas do Briefing Rápido, lidos do molde. */
export function perguntasDoMolde(root = ROOT_DEFAULT) {
  const md = fs.readFileSync(path.join(root, 'projects', '_MOLDE', 'briefing.md'), 'utf8');
  const out = {};
  for (const m of md.matchAll(/^## (\d)\. (.+)$/gm)) out[m[1]] = m[2].trim();
  return out;
}

function cartoes(catalogo, MINIATURAS) {
  return catalogo
    .map((l) => {
      const mini = MINIATURAS[l.id];
      if (!mini) throw new Error(`Sem miniatura para a linguagem "${l.id}" em manuais/fonte/graficos.mjs.`);
      const e = l.eixos;
      const chips = ['ritmo', 'layout', 'textura', 'movimento'].map((k) => `<span class="chip">${k} <b>${PT[e[k]] ?? esc(e[k])}</b></span>`).join('');
      const [a, b] = l.corteSegundos;
      return `          <article class="lang" id="lang-${l.id}" data-busca="${esc(l.nome)}">
            <div class="thumb ${mini.classe}"><svg viewBox="0 0 90 160" role="img" aria-label="Miniatura ilustrativa: ${esc(l.nome)}">${mini.svg}</svg></div>
            <div class="lh">
              <h4>${esc(l.nome)}</h4><span class="id">${l.id}</span>
              <p>${esc(l.resumo)}</p>
            </div>
            <div class="lb">
              <div class="chips">${chips}</div>
              <dl><dt>Bom para</dt><dd>${esc(l.quandoUsar)}</dd><dt>Evite</dt><dd>${esc(l.evitarQuando)}</dd><dt>Cortes</dt><dd>de ${num(a)} a ${num(b)} s por cena</dd></dl>
            </div>
          </article>`;
    })
    .join('\n');
}

/** Devolve {"manuais/<nome>.html": conteúdo} sem gravar nada. */
export async function gerarManuais(root = ROOT_DEFAULT) {
  const fonte = path.join(root, 'manuais', 'fonte');
  const ler = (f) => fs.readFileSync(path.join(fonte, f), 'utf8');
  const {ICONES, LOGO, MINIATURAS} = await import(pathToFileURL(path.join(fonte, 'graficos.mjs')).href);
  const css = ler('estilo.css');
  const js = ler('app.js');
  const versao = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  const catalogo = JSON.parse(fs.readFileSync(path.join(root, 'engine', 'linguagens.json'), 'utf8')).linguagens;
  const perguntas = perguntasDoMolde(root);

  const out = {};
  for (const nome of MANUAIS) {
    let html = ler(`${nome}.html`);
    html = html
      .replace('{{CSS}}', () => css)
      .replace('{{JS}}', () => js)
      .replace('{{LINGUAGENS}}', () => cartoes(catalogo, MINIATURAS))
      .replaceAll('{{VERSION}}', versao)
      .replaceAll('{{LOGO}}', LOGO)
      .replace(/\{\{I:(\w+)\}\}/g, (_, k) => {
        if (!ICONES[k]) throw new Error(`Ícone desconhecido em ${nome}.html: {{I:${k}}}`);
        return ICONES[k];
      })
      .replace(/\{\{PERGUNTA:(\d)\}\}/g, (_, n) => {
        if (!perguntas[n]) throw new Error(`Pergunta ${n} não encontrada em projects/_MOLDE/briefing.md`);
        return esc(perguntas[n]);
      });
    const resto = html.match(/\{\{[^}]*\}\}/g);
    if (resto) throw new Error(`Marcadores não resolvidos em ${nome}.html: ${[...new Set(resto)].join(', ')}`);
    html = html.replace(/^<!doctype html>\n/i, (m) => `${m}${AVISO}\n`);
    out[`manuais/${nome}.html`] = html.replace(/\r\n/g, '\n');
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const verificar = process.argv.includes('--verificar');
  const arquivos = await gerarManuais();
  const fora = [];
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    const abs = path.join(ROOT_DEFAULT, ...rel.split('/'));
    const atual = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (atual === conteudo) {
      console.log(`  ✔ ${rel} em dia`);
      continue;
    }
    if (verificar) {
      fora.push(rel);
      console.log(`  ✖ ${rel} desatualizado`);
    } else {
      fs.writeFileSync(abs, conteudo);
      console.log(`  ✔ ${rel} gerado (${(Buffer.byteLength(conteudo) / 1024).toFixed(0)} KB)`);
    }
  }
  if (fora.length) {
    console.log('\nRode "npm run manuais" para gerar de novo.\n');
    process.exit(1);
  }
}
