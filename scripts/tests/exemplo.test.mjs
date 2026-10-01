// Testes do projeto de exemplo (projects/exemplo-loja-promo): o que precisa
// continuar verdadeiro para ele renderizar logo depois do clone.
// Rodar na raiz: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EX = path.join(REPO, 'projects', 'exemplo-loja-promo');

const files = (dir, base = dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name), base) : e.name === '.gitkeep' ? [] : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')],
  );

test('exemplo: a cópia do engine é idêntica a engine/src (acompanha o motor)', () => {
  const a = files(path.join(REPO, 'engine', 'src')).sort();
  const b = files(path.join(EX, 'src', 'engine')).sort();
  assert.deepEqual(b, a, 'arquivos diferentes: copie engine/src para projects/exemplo-loja-promo/src/engine');
  for (const f of a) {
    assert.equal(
      fs.readFileSync(path.join(EX, 'src', 'engine', f), 'utf8'),
      fs.readFileSync(path.join(REPO, 'engine', 'src', f), 'utf8'),
      `src/engine/${f} difere de engine/src/${f}`,
    );
  }
});

test('exemplo: só a fonte livre como mídia, licença ao lado, sem estado de produção', () => {
  const assets = files(path.join(EX, 'assets')).sort();
  assert.deepEqual(assets, ['fonts/OFL.txt', 'fonts/inter-latin-wght-normal.woff2']);
  assert.match(fs.readFileSync(path.join(EX, 'assets', 'fonts', 'OFL.txt'), 'utf8'), /SIL Open Font License/);
  assert.equal(fs.existsSync(path.join(EX, 'project-status.json')), false, 'o exemplo vai para o Git sem project-status.json');
  const cfg = JSON.parse(fs.readFileSync(path.join(EX, 'project.json'), 'utf8'));
  assert.equal(cfg.linguagem, 'tipografia-cinetica');
  assert.equal(cfg.durationSeconds, 10);
});

test('exemplo: preflight aprovado, sem avisos (legibilidade, degradês, fontes, safe area)', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'preflight.mjs'), 'exemplo-loja-promo', '--sem-typecheck', '--json'], {cwd: REPO, encoding: 'utf8', timeout: 120000});
  const res = JSON.parse(r.stdout);
  const problems = res.checks.filter((c) => c.level === 'error' || c.level === 'warn').map((c) => `[${c.area}] ${c.msg}`);
  assert.deepEqual(problems, []);
  assert.equal(res.ok, true);
});
