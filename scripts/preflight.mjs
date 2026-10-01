// Preflight automático — verificação técnica de um projeto (somente leitura).
//
// Uso (na raiz):
//   npm run preflight -- <slug>                 → relatório completo (inclui typecheck do projeto)
//   npm run preflight -- <slug> --sem-typecheck → mais rápido, sem tsc
//   npm run preflight -- <slug> --json          → saída estruturada
//
// Também roda automaticamente em:
//   - npm run status -- <slug> avancar   (ao sair de 06_VALIDATION e de 08_DRY_RUN)
//   - npm run render -- <slug> --dry-run (projetos com estado)
// Em projetos com estado o resultado é registrado no project-status.json.
//
// Sai com código 1 se houver erro. Documentação: docs/12-AUTOMACAO.md
import {fail, loadProject, parseArgs} from './lib.mjs';
import {formatPreflight, preflightSummary, runPreflight} from './preflight-lib.mjs';
import {StatusError, loadStatus, recordPreflight, saveStatus} from './status-lib.mjs';

const {positional, flags} = parseArgs(process.argv.slice(2));
const project = loadProject(positional[0]);

let status = null;
try {
  status = loadStatus(project.dir);
} catch (e) {
  if (e instanceof StatusError) fail(e.message);
  throw e;
}

const result = runPreflight(project, {typecheck: !flags['sem-typecheck'], status});

if (status) {
  try {
    saveStatus(project.dir, recordPreflight(status, preflightSummary(result)));
  } catch (e) {
    console.error(`⚠ Preflight concluído, mas não foi possível registrar no estado: ${e.message}`);
  }
}

console.log(flags.json ? JSON.stringify(result, null, 2) : `\n${formatPreflight(result)}\n`);
process.exit(result.ok ? 0 : 1);
