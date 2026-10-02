// Testes da documentação e dos nomes de arquivos do motor:
//   - nenhum arquivo ou referência com os nomes antigos (anteriores à padronização
//     em português) sobrevive;
//   - todo caminho de doc/script citado nos arquivos do motor existe.
// Rodar na raiz: npm test
//
// Só olha o motor (a mesma seleção do verificar-publico, sem git): projetos,
// clientes e a camada local de quem usa a ferramenta ficam de fora.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {walkPublicFiles} from '../verificar-publico.mjs';

const THIS = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(THIS), '..', '..');
const SELF = path.relative(REPO, THIS).split(path.sep).join('/');

const TEXT_EXT = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.json', '.cmd', '.txt', '.html', '.css', '.yml', '.gitignore', '.gitattributes', '.nvmrc', '']);
const motorFiles = () =>
  walkPublicFiles(REPO).filter((f) => {
    if (f === SELF || f === 'package-lock.json') return false;
    const base = path.posix.basename(f);
    const ext = base.startsWith('.') && !base.slice(1).includes('.') ? base : path.posix.extname(base);
    return TEXT_EXT.has(ext);
  });
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');

/** Arquivos e pastas que deixaram de existir (renomeados ou fundidos). */
const OBSOLETE_PATHS = [
  'docs/00-CORE.md',
  'docs/10-CHECKLIST.md',
  'docs/11-CLIENT-DNA.md',
  'docs/11-CLIENT-DNA-TEMPLATE.md',
  'docs/12-PRODUCTION-WORKFLOW.md',
  'docs/13-AUTOMATION.md',
  'clients/_CLIENT-DNA-TEMPLATE.md',
  'engine/COMPONENTS.md',
  'projects/_TEMPLATE',
];

/** Nomes antigos que não podem mais ser citados em nenhum arquivo do motor. */
const OLD_NAMES = [
  '00-CORE',
  '10-CHECKLIST',
  'CLIENT-DNA',
  '12-PRODUCTION-WORKFLOW',
  '13-AUTOMATION',
  'COMPONENTS.md',
  '_TEMPLATE',
  'assets-manifest',
  'reference/',
];

test('arquivos obsoletos não existem mais (apague-os se o teste falhar)', () => {
  const left = OBSOLETE_PATHS.filter((p) => fs.existsSync(path.join(REPO, ...p.split('/'))));
  assert.deepEqual(left, [], `Arquivos/pastas obsoletos ainda presentes — apague: ${left.join(', ')}`);
});

test('nenhum arquivo do motor cita nomes antigos', () => {
  const hits = [];
  for (const f of motorFiles()) {
    // .github/ISSUE_TEMPLATE é o nome exigido pelo GitHub, não um nome antigo do motor.
    const lines = read(f).replaceAll('ISSUE_TEMPLATE', 'ISSUE-MODELOS').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const name of OLD_NAMES) if (line.includes(name)) hits.push(`${f}:${i + 1} → "${name}"`);
    });
  }
  assert.deepEqual(hits, [], `Referências a nomes antigos:\n  ${hits.join('\n  ')}`);
});

test('nomes de docs e moldes: português, sem acento, sem cedilha, sem espaço', () => {
  const bad = motorFiles()
    .concat(walkPublicFiles(REPO).filter((f) => f.startsWith('docs/')))
    .filter((f) => f.startsWith('docs/') || f.startsWith('local.exemplo/') || f.startsWith('clients/') || f.startsWith('projects/_MOLDE/'))
    .filter((f) => /[^\x00-\x7f]|\s/.test(f));
  assert.deepEqual([...new Set(bad)], []);
  const docs = fs.readdirSync(path.join(REPO, 'docs')).filter((f) => f.endsWith('.md'));
  for (const d of docs) assert.match(d, /^\d{2}-[A-Z0-9-]+\.md$/, `nome fora do padrão: docs/${d}`);
});

test('todo caminho de doc, script ou molde citado existe', () => {
  const RE = /(?<![\w./-])((?:docs|engine|scripts|clients|local\.exemplo|projects\/_MOLDE)\/[\w.\-/]*\.(?:md|mjs|ts|tsx|json|txt))(?![\w/])/g;
  const missing = [];
  // CHANGELOG cita arquivos removidos de propósito; testes criam arquivos fictícios.
  const files = motorFiles().filter((f) => f !== 'CHANGELOG.md' && !f.startsWith('scripts/tests/'));
  for (const f of files) {
    const lines = read(f).split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(RE)) {
        const p = m[1];
        if (p.startsWith('clients/') && !p.startsWith('clients/_')) continue; // fichas de exemplo, conteúdo do usuário
        if (!fs.existsSync(path.join(REPO, ...p.split('/')))) missing.push(`${f}:${i + 1} → ${p}`);
      }
    });
  }
  assert.deepEqual(missing, [], `Caminhos citados que não existem:\n  ${missing.join('\n  ')}`);
});
