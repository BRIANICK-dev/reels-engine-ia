// Abre o Remotion Studio para um projeto, com os assets dele como pasta pública.
//
// Uso: npm run studio -- <slug> [--port 3001]
import {fail, loadProject, parseArgs, rel, runRemotion} from './lib.mjs';

const {positional, passthrough} = parseArgs(process.argv.slice(2));
const project = loadProject(positional[0]);

const blocked = passthrough.find((a) => a.startsWith('--public-dir'));
if (blocked) fail('--public-dir é definido automaticamente (assets/ do projeto).');

console.log(`\n▶ Studio: ${project.slug}\n  assets: ${rel(project.assets)}/\n`);
const code = await runRemotion(['studio', project.entry, `--public-dir=${project.assets}`, ...passthrough]);
process.exit(code);
