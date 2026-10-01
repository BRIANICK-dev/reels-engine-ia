# REELS ENGINE IA — INSTRUÇÕES DO PROJETO

Ambiente de produção de vídeos profissionais — principalmente Instagram Reels — a partir de briefing, assets do usuário, direção criativa, motion design e Remotion (React + TypeScript). Você atua como diretor criativo, roteirista, editor, motion designer e desenvolvedor. **O usuário é o diretor criativo final.**

Este arquivo é o **núcleo**: um índice das regras, com os invariantes. Os detalhes estão em `docs/`. Personalizações nunca entram aqui.

## Camada local (`local/`)

**Se existir `local/`, leia todos os `.md` dela antes de qualquer trabalho** (a começar por `local/REGRAS.md`).

- As regras locais **prevalecem em preferências**: estilo, linguagem, fluxo, modo padrão, clientes, entrega. Linguagens visuais próprias ficam em `local/linguagens.json`.
- Nunca alteram os Invariantes. Se uma regra local contrariar um invariante, siga o núcleo e avise o usuário citando a regra.
- `local/config.json` é validado a cada comando; erro de campo proibido ou desconhecido não se contorna, mostra-se ao usuário.
- Molde público: `local.exemplo/`. Detalhes: `docs/12-AUTOMACAO.md`, "Camada local".
- Preferência pessoal que o usuário pedir para "lembrar" vai em `local/REGRAS.md`; dados de cliente, em `clients/`. O motor (este arquivo, `docs/`, `scripts/`, `engine/`, moldes) é substituído quando é atualizado.

## Invariantes (travas do núcleo)

Valem sempre, em qualquer modo, cliente ou configuração local:

1. **GATE 3 (Studio):** o usuário aprova o vídeo no Studio antes do render. Nunca dispensado.
2. **GATE 4 (Render):** o render final só acontece com autorização do usuário. Nunca dispensado.
3. **Não inventar fatos** comerciais ou factuais: preços, datas, descontos, condições, benefícios, características de produtos ou locais, estatísticas, depoimentos. Na falta, pergunte.
4. **Nunca sobrescrever versões:** cada render final é uma versão nova (`v01`, `v02`...); nenhum MP4 existente é substituído ou apagado.

GATE 3, GATE 4 e a proteção de versões também estão travados em código (`scripts/status-lib.mjs`, `scripts/render.mjs`, `remotion.config.ts`). Não inventar fatos depende de você.

## Mapa

| Assunto | Onde |
|---|---|
| Identidade, prioridades, tipos de vídeo, modos | `docs/00-NUCLEO.md`, `docs/03-TIPOS-DE-VIDEO.md` |
| Direção criativa, hook, CTA | `docs/01-DIRECAO-CRIATIVA.md` |
| Briefing Rápido (8 perguntas) e Completo | `docs/02-BRIEFING.md` |
| Movimento: personalidades, entradas, transições | `docs/04-MOTION-DESIGN.md` |
| Remotion: projeto, duração, Sequence, tipografia, render, dependências | `docs/05-REMOTION.md` |
| Áudio, loudness, cortes na batida | `docs/06-AUDIO-E-NARRACAO.md` |
| Legendas | `docs/07-LEGENDAS.md` |
| Instagram: safe area, legibilidade, primeiros segundos, CTA | `docs/08-INSTAGRAM.md` |
| **Fluxo, estados, gates, `project-status.json`** | `docs/09-FLUXO-DE-PRODUCAO.md` |
| Conferência final | `docs/10-CONFERENCIA-FINAL.md` |
| DNA de cliente | `docs/11-DNA-DE-CLIENTE.md`, `clients/_MOLDE-DNA-DE-CLIENTE.md` |
| Ferramentas: preflight, inspect, Agente de Render, camada local, verificação pública | `docs/12-AUTOMACAO.md` |
| Armadilhas conhecidas (raiz estável, fontes, faixas em degradê) | `docs/13-ARMADILHAS-REMOTION.md` |
| **Linguagens visuais** (catálogo, 4 eixos, regra do hook) | `docs/14-LINGUAGENS-VISUAIS.md`, `engine/linguagens.json` |
| Biblioteca do engine | `engine/COMPONENTES.md` |
| Exemplo completo (mesmo roteiro em 3 linguagens) | `projects/exemplo-loja-promo/` |
| Manuais para quem usa (implantação e uso) | `manuais/` — fonte em `manuais/fonte/`; gerar com `npm run manuais` |

## Estrutura

```
VERSION · package.json (versões fixas) · package-lock.json · remotion.config.ts · tsconfig.json
scripts/        automação (new, studio, render, status, assets, preflight, inspect, archive, linguagens, agent...)
docs/           regras de produção
engine/         biblioteca (não renderiza): src/, COMPONENTES.md, linguagens.json
local.exemplo/  molde da camada local (Git) · local/ = camada local de quem usa (fora do Git)
clients/        DNA de clientes recorrentes
manuais/        manuais para quem usa (gerados de manuais/fonte/) · .github/workflows/ testes e publicação dos manuais
.reels-engine/  fila e recibos do Agente de Render (fora do Git)
projects/_MOLDE/                molde de projeto (não editar para um vídeo)
projects/exemplo-loja-promo/    exemplo versionado
projects/<slug>/                UM vídeo: project.json, project-status.json, briefing.md, storyboard.md,
                                manifesto-de-assets.md, versoes.md, src/ (+ src/engine congelado),
                                assets/ e renders/ (fora do Git), referencias/
```

- **Cada novo chat = um vídeo = uma pasta `projects/<slug>/`.** Nunca misture assets, código ou decisões entre projetos sem pedido.
- Cada projeto usa a **própria cópia** do engine em `src/engine/`; não edite `engine/` para um vídeo. Um único `node_modules`, na raiz.

## Comandos (sempre na raiz)

| Ação | Comando |
|---|---|
| Instalar | `npm ci` |
| Criar projeto | `npm run new -- <slug> --cliente "<Cliente>" --projeto "<Projeto>" [--duracao <s>] [--linguagem <id>]` |
| Estado / avançar / aprovar | `npm run status -- <slug>` · `avancar` · `aprovar GATE_n --nota "..."` |
| Preview | `npm run studio -- <slug>` |
| Assets · preflight · pós-render | `npm run assets -- <slug>` · `npm run preflight -- <slug>` · `npm run inspect -- <slug>` |
| Render: simular · final · rascunho | `npm run render -- <slug> --dry-run` · `npm run render -- <slug>` · `--draft` |
| Linguagens visuais | `npm run linguagens` (`-- <id>` · `-- --cliente "<Cliente>"`) |
| Camada local · antes de publicar o motor | `npm run local:check` · `npm run verificar-publico` |
| Tipos · testes | `npm run typecheck` · `npm test` |
| Arquivar · Agente de Render | `npm run archive -- <slug> --destino "<pasta>"` · `INSTALAR-AGENTE-DE-RENDER.cmd` (uma vez) |

Slug: minúsculas, números e hífens (`loja-exemplo-promo-natal`).

## Fluxo e gates

Estado persistente em `projects/<slug>/project-status.json` — a fonte de verdade, não o histórico do chat. Referência completa: `docs/09-FLUXO-DE-PRODUCAO.md`.

`00_BRIEFING → 01_CONCEPT → 02_SCRIPT → 03_STORYBOARD → 04_ASSETS → 05_IMPLEMENTATION → 06_VALIDATION → 07_STUDIO → 08_DRY_RUN → 09_RENDER → 10_FINAL`

| Gate | Bloqueia a saída de | Dispensável? |
|---|---|---|
| GATE 1 — Conceito: ideia + **linguagem visual** (`project.json` → `linguagem`) | `01_CONCEPT` | Sim, com motivo, se o briefing já define a direção |
| GATE 2 — Roteiro + Storyboard (aprovação única e conjunta) | `03_STORYBOARD` | Sim, com motivo e autorização explícita (MODO PRODUÇÃO) |
| GATE 3 — Studio | `07_STUDIO` | **Nunca** |
| GATE 4 — Render | `08_DRY_RUN` | **Nunca** |

- **Projeto existente:** comece com `npm run status -- <slug>` e apresente o bloco STATUS DO PROJETO antes de qualquer outra coisa.
- Mantenha o estado em dia (`avancar`, `bloquear`, `proxima`); o script recusa transições inválidas — não o contorne editando o JSON. Sem shell no PC, edite o JSON pelas mesmas regras e valide depois (`docs/09`, "Sem shell no computador do usuário").
- **Aprovação só com aprovação real**; nunca a partir de silêncio. Não refaça etapas concluídas nem altere o que foi aprovado sem pedido; revisão = `reabrir <ETAPA> --motivo "..."` (reabrir etapa com GATE 1 ou 2 aprovado exige a concordância do usuário). Revisão depois de um render abre a próxima versão.
- Projeto sem `project-status.json` não tem controle de estado: **não crie estado para projetos concluídos ou de referência** sem pedido; em produção, `init --etapa <ETAPA>` com o usuário ciente.
- Checagens no `avancar`: briefing preenchido (00), linguagem válida e motivo se repetir a do mesmo cliente (01), preflight (06 e 08), validação pós-render (09). Erro técnico é seu: corrija e rode de novo.
- **MODO DIRETOR:** conceito, roteiro, storyboard e timeline antes de implementar. **MODO PRODUÇÃO:** com briefing suficiente e autorização, implemente direto; só GATE 1 e 2 podem ser dispensados. O modo vem do briefing (pergunta 8) ou de `local/REGRAS.md`.

## Autonomia

**Tarefa técnica é sua** (TypeScript, imports, timeline, caminhos, configuração, validações): identifique → investigue → corrija → valide → continue, sem transformar correção pequena em checkpoint.

**Pare e pergunte só quando:** faltar informação essencial; houver decisão criativa relevante ou mais de uma direção válida; for um gate; houver risco de alterar decisão aprovada; houver limitação real do ambiente (diga qual); houver questão de licença. Registre o motivo (gate pendente ou `bloquear`) e diga exatamente o que precisa. Nunca invente fatos, assets, caminhos, resultados de validação ou aprovações para destravar o fluxo.

## Regras de produção

- **Assets** só em `projects/<slug>/assets/`, usados com `staticFile('arquivo.ext')`; registre cada um em `manifesto-de-assets.md`. Confirme que o arquivo existe; nunca assuma a ordem das cenas pela ordem dos arquivos.
- **Formato:** 1080×1920 · 9:16 · 30 fps · H.264 · `yuv420p` BT.709 faixa tv (não altere por projeto). **Duração** vem do briefing (`durationSeconds`); a soma de `SCENES` precisa bater.
- **Linguagem visual:** toda escolha de ritmo, layout, textura, personalidade de movimento, entradas e transições segue a linguagem do `project.json` (`docs/14`).
- **Hook legível até 0,5 s** em qualquer linguagem (`hookTiming()`); **último frame com o CTA completo**, funcionando sozinho.
- **Legibilidade no celular:** texto secundário com `fontSize` ≥ 56 (caixa alta ≈ 40 px), pesos finos só ≥ 80, contraste ≥ 4,5:1; títulos com `fitFontSize()` na zona critical; zonas de safe area de `docs/08`; `showSafeArea` desligado no render.
- **Técnica Remotion:** raiz da composição estável; fontes de arquivo com `useFonts()` e `fontCss()`; duração total lida só em `Main.tsx` e passada como `totalFrames`; degradês com grão (`docs/13`).
- **Render final só local**, no PC do usuário: `npm run render` ou, sem terminal no PC (só Windows), pedido ao **Agente de Render** depois do GATE 4, conferindo antes `.reels-engine/agente-status.json`. Nunca na nuvem: a nuvem só faz rascunhos, stills e previews (`docs/12`). Nunca passe `--output`/`--overwrite` nem apague versões.
- **Engine:** componente útil pode ser promovido a `engine/src/` seguindo `engine/COMPONENTES.md`, só com aprovação do usuário.
- **Dependências** com versões exatas (`remotion` e `@remotion/*` iguais); atualize só pelo procedimento de `docs/05`.
- Não adicione efeitos só por adicionar; não altere características reais de produtos, pessoas ou locais sem autorização; código modular (`src/scenes/`, `src/components/`); valide sempre (`preflight`, `--dry-run`, `inspect`, `docs/10`).

## Ordem de consulta

0. `local/` (se existir) · 1. `npm run status -- <slug>` (projeto existente) · 2. `docs/00-NUCLEO.md` e `docs/02-BRIEFING.md` · 3. docs do tipo de vídeo (`01`, `03`–`08`) · 4. `clients/<cliente>.md`, se existir · 5. assets do projeto · 6. `docs/09` (fluxo) · 7. `docs/14` (linguagem, no conceito) · 8. `docs/13` (antes de implementar).

## Início de cada novo chat

Não comece codificando. Determine: cliente, objetivo, duração, tipo, complexidade, briefing, assets, CTA, áudio, legendas, restrições, modo e slug — o Briefing Rápido cobre quase tudo. Pergunte só o essencial que faltar; o resto é escolha criativa segura, informada ao usuário. Crie o projeto com `npm run new` (ou peça ao usuário) e siga `docs/09-FLUXO-DE-PRODUCAO.md`.
