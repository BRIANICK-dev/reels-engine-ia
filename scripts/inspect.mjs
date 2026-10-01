// Validação pós-render do MP4 final (somente leitura sobre o vídeo).
//
// Uso (na raiz):
//   npm run inspect -- <slug>                → valida a versão mais recente (a partir da versão de trabalho)
//   npm run inspect -- <slug> --version v02  → valida uma versão específica
//   npm run inspect -- <slug> --json
//
// Também roda automaticamente: depois de todo render final (render.mjs) e no
// avancar de 09_RENDER. Em projetos com estado o resultado é registrado no
// project-status.json. Sai com código 1 se reprovar.
import {fail, loadProject, parseArgs} from './lib.mjs';
import {formatInspect, inspectSummary, runInspect} from './inspect-lib.mjs';
import {StatusError, loadStatus, recordInspect, saveStatus} from './status-lib.mjs';

const {positional, flags} = parseArgs(process.argv.slice(2));
const project = loadProject(positional[0], {forRender: true});

let status = null;
try {
  status = loadStatus(project.dir);
} catch (e) {
  if (e instanceof StatusError) fail(e.message);
  throw e;
}

let result;
try {
  result = runInspect(project, {version: flags.version, status});
} catch (e) {
  fail(e.message);
}

if (status && result.file) {
  try {
    saveStatus(project.dir, recordInspect(status, {file: result.file, version: result.version, inspect: inspectSummary(result)}));
  } catch (e) {
    console.error(`⚠ Validação concluída, mas não foi possível registrar no estado: ${e.message}`);
  }
}

console.log(flags.json ? JSON.stringify(result, null, 2) : `\n${formatInspect(result)}\n`);
process.exit(result.ok ? 0 : 1);
