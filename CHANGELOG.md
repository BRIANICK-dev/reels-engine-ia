# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões em [SemVer](https://semver.org/lang/pt-BR/); a versão atual está no arquivo `VERSION`.

## [1.0.0] — 2026-10-01

### Adicionado
- Primeira versão pública do Reels Engine IA, derivada de uma ferramenta de produção privada e generalizada.
- `VERSION` único na raiz, usado também como `engineVersion` dos projetos novos.
- **Camada local** (`local/`, fora do Git) com molde público em `local.exemplo/` (`REGRAS.md`, `config.json`, `termos-proibidos.txt`). As regras locais prevalecem sobre o núcleo em preferências (estilo, fluxo, clientes, modo).
- **Invariantes do núcleo** no `CLAUDE.md`: a camada local não altera GATE 3, GATE 4, a regra de não inventar fatos comerciais/factuais nem a regra de nunca sobrescrever versões.
- `scripts/local-config.mjs` e `npm run local:check`: `local/config.json` com lista fechada de campos, validado no início de todos os comandos e do agente. Campo desconhecido ou que tente alterar uma trava = erro claro, e o comando para.
- Projetos protegidos do Agente de Render configuráveis em `local/config.json` (`agente.projetosProtegidos`).
- `npm run verificar-publico`: confere o que iria para o Git (termos de `local/termos-proibidos.txt`, mídia versionada, arquivos locais e segredos, arquivos grandes).
- `docs/13-ARMADILHAS-REMOTION.md`: problemas reais do Remotion 4.0.529 (raiz de composição no Studio, `document.fonts` no TypeScript, nome de fonte com número sem aspas).
- `docs/12-AUTOMACAO.md`: seções "Camada local", "Verificação pública" e "Operação sem terminal: armadilhas do ambiente" (limite de transferência, selo C2PA em MP4, arquivo enviado em versão antiga).
- `docs/06-AUDIO-E-NARRACAO.md`: volume final (−14 LUFS) e método opcional de sincronia de cortes com a música.
- Testes da camada local, da verificação pública e dos nomes/links da documentação (inclui busca por nomes antigos).
- Política de mídia: nenhuma mídia no repositório, com uma exceção — a fonte de licença livre (OFL) do projeto de exemplo, versionada com a licença ao lado.
- **Linguagens visuais** (anti-engessamento): catálogo de 10 linguagens em `engine/linguagens.json`, cada uma com 4 eixos (ritmo, layout, textura, movimento), faixa de corte, entradas, transições, tipografia e cor; nenhum par coincide em mais de 2 eixos (teste). `docs/14-LINGUAGENS-VISUAIS.md` e `npm run linguagens` (catálogo, detalhes, uso por cliente).
- **Regra do GATE 1**: `project.json` ganha `"linguagem"`, obrigatória na saída de `01_CONCEPT`; repetir a linguagem de uma das 3 últimas produções do mesmo cliente exige `"linguagemMotivo"` (uma linha); entre clientes diferentes, só aviso. `npm run new` aceita `--linguagem`.
- **Linguagens próprias** em `local/linguagens.json`, com os mesmos campos obrigatórios do núcleo, validadas no `local:check`; ids não colidem com os do núcleo.
- **Presets de movimento** (`engine/src/animations/presets.ts`): 6 personalidades (suave, elastica, seca, cinematografica, mecanica, degraus a 12 fps), 10 entradas/saídas e 6 transições (corte, dissolve, wipe direcional, whip, zoomThrough, matchCut); todo preset recebe a personalidade.
- Componentes novos no engine (escritos do zero, genéricos): `Animate`, `RevealText` (text reveal), `KenBurns`, `SceneTrack` (cenas com transições), `ClipTrack` + `alignToBeats` (trilha de cortes com `srcFrom`/`srcTo`, para cortes na batida), `Pill`, `Scrim`, `Grain`, `Cutout`, `fontCss`/`loadFonts`/`useFonts`, `Soundtrack`.
- Preflight avisa sobre `fontFamily` com nome numérico sem aspas e confere a linguagem do projeto.
- **Briefing Rápido** (8 perguntas em linguagem simples) no `briefing.md` de todo projeto novo; Briefing Completo em `docs/02-BRIEFING.md`.
- **Regra do hook**: em toda linguagem o texto do hook fica legível até 0,5 s (`hookTiming()`; campo `hook` obrigatório no catálogo, também nas linguagens locais; teste com o movimento real de cada linguagem).
- **Legibilidade no celular**: mínimos em `engine/src/utils/legibility.ts` (texto secundário com caixa alta ≈ 40 px → `fontSize` ≥ 56; pesos finos só ≥ 80; contraste ≥ 4,5:1), avisos no preflight para valores literais e no console para `Pill`/`Cutout` (`ink`).
- **Faixas em degradê (banding)**: `Scrim` com grão por padrão (`dither`), `Grain` com `blend`; preflight avisa degradê sem grão; armadilha 4 no `docs/13`.
- Regra do **CTA no último frame**: o frame final mostra o CTA completo e funciona sozinho.
- **Manuais** em `manuais/` (HTML único, offline, claro/escuro, índice, busca e botão copiar): `implantacao.html` (do zero ao primeiro teste, com "Deu erro?", licenças, glossário e checklist final) e `uso.html` (do briefing ao MP4: pastas e slug, Briefing Rápido com exemplos bons × ruins, as 10 linguagens com miniaturas animadas, os 4 gates, ajustes e versões, clientes recorrentes, camada local, comandos, glossário).
- Manuais online no GitHub Pages (`.github/workflows/manuais.yml`, publica só `manuais/`) e testes automáticos no GitHub Actions (`.github/workflows/testes.yml`: `npm ci`, typecheck, `npm test`, manuais em dia e verificação pública).
- `npm run manuais` gera os manuais a partir de `manuais/fonte/`, puxando versão, linguagens e perguntas do briefing do próprio motor; `scripts/tests/manuais.test.mjs` confere que estão em dia e coerentes com o motor.
- Pasta `Claude outputs/` (arquivos enviados ao chat gravados pelo app na pasta conectada) no `.gitignore`; `verificar-publico` avisa se existir e dá erro se entrar no conjunto publicado.
- Testes do projeto de exemplo: cópia do engine idêntica ao motor, só a fonte livre como mídia, preflight sem avisos.
- Projeto de exemplo `projects/exemplo-loja-promo/`: o mesmo roteiro em três linguagens contrastantes (composições `Main` e `Vitrine-<linguagem>`), só com a fonte Inter (OFL), sem música.
- Lançador do agente com hash da pasta no nome (`ReelsEngineIA-AgenteRender-<hash>.vbs`): duas instalações não colidem.
- Scripts `npm run assets`, `preflight`, `inspect` e `archive` no `package.json` (antes documentados, mas ausentes).
- `.gitattributes` garantindo CRLF nos scripts do Windows.

### Alterado
- Documentação reorganizada e com nomes em português, sem acento: `00-NUCLEO`, `09-FLUXO-DE-PRODUCAO` (fluxo e Production Controller num documento só), `10-CONFERENCIA-FINAL`, `11-DNA-DE-CLIENTE`, `12-AUTOMACAO`, `13-ARMADILHAS-REMOTION`; `engine/COMPONENTES.md`.
- Moldes em português: `projects/_MOLDE/` (com `manifesto-de-assets.md` e `referencias/`) e `clients/_MOLDE-DNA-DE-CLIENTE.md`.
- Node.js 24 como versão de referência (`.nvmrc`); `engines` aceita `>=24`.
- Pasta do agente: `.reels-engine/`. Schemas: `reels-engine.project-status/1`, `reels-engine.render-request/1`, `reels-engine.render-receipt/1`.
- Projetos sem `project-status.json` passam a ser tratados como "sem controle de estado".
- `CLAUDE.md` reescrito como índice + invariantes (~11 mil caracteres); os detalhes ficam nos docs.
- Molde de projeto revisado: placeholder dentro dos mínimos de legibilidade, padrões do motor documentados no `Main.tsx`, linguagem visual no `storyboard.md`, "por onde começar" no README.
- `00_BRIEFING` só termina com o `briefing.md` preenchido (diferente do molde). O status de um projeto novo diz o que falta (preencher o briefing, colocar os arquivos em `assets/`) em vez de "aguardando: nada".

### Removido
- Operação `montar` do Agente de Render (transferência de MP4 em partes a partir da nuvem).
- Resquícios da primeira versão do engine (`engine/package.json`, `remotion.config.ts`, `tsconfig.json`, `briefs/`, `public/`, `renders/`, `VERSION`).
