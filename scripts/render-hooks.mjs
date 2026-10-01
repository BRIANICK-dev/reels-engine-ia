// Ganchos do render.mjs — carregados SÓ em projetos com project-status.json.
// Projetos sem controle de estado nunca chegam a importar este arquivo.
//
//  - dryRunPreflight: o --dry-run passa a incluir o preflight (e falha se ele reprovar).
//  - afterFinalRender: depois de um render final bem-sucedido, valida o MP4 e
//    registra render + validação no estado. Não muda a etapa, não aprova gates
//    e não altera o MP4 nem o versoes.md.
import {formatInspect, inspectSummary, runInspect} from './inspect-lib.mjs';
import {formatPreflight, preflightSummary, runPreflight} from './preflight-lib.mjs';
import {loadStatus, recordPreflight, recordRender, saveStatus} from './status-lib.mjs';

export const dryRunPreflight = (project) => {
  const status = loadStatus(project.dir);
  console.log('▶ Preflight (projeto com estado)...\n');
  const r = runPreflight(project, {typecheck: true, status});
  console.log(`${formatPreflight(r)}\n`);
  if (status) saveStatus(project.dir, recordPreflight(status, preflightSummary(r)));
  if (!r.ok) console.log('✖ Dry-run com preflight reprovado: corrija antes do render final.\n');
  return r.ok;
};

export const afterFinalRender = (project, {file, version}) => {
  console.log('▶ Validação pós-render automática...\n');
  const status = loadStatus(project.dir);
  const r = runInspect(project, {version, status});
  console.log(`${formatInspect(r)}\n`);
  if (!status) return r;
  const next = recordRender(status, {file, version, inspect: inspectSummary(r)});
  saveStatus(project.dir, next);
  console.log(`✔ Render registrado no project-status.json (${next.history.at(-1).detail}).`);
  if (next.stage === '09_RENDER' && r.ok) {
    console.log(`  Próximo passo: assistir o MP4 fora do Studio e concluir com npm run status -- ${project.slug} avancar\n`);
  } else if (!r.ok) {
    console.log(`  ⚠ A validação técnica reprovou: o avancar de 09_RENDER ficará bloqueado até um render válido.\n`);
  }
  return r;
};
