# FLUXO DE PRODUÇÃO

Referência única para o fluxo de um vídeo: **estados, gates e o que fazer em cada etapa**, e o **Production Controller**, que guarda o estado persistente de cada projeto.

> Regras criativas: `docs/00-NUCLEO.md` e `docs/01-DIRECAO-CRIATIVA.md`. Ferramentas automáticas (preflight, validação pós-render, Agente de Render): `docs/12-AUTOMACAO.md`.

## Papéis

| Papel | Quem | Faz |
|---|---|---|
| **Diretor Criativo** | Usuário | Objetivo, fatos comerciais, assets, licenças, escolha do conceito, aprovação do plano, aprovação visual, autorização de render |
| **Produtor/Implementador** | Claude | Interpreta, propõe, escreve, implementa, valida, **corrige sozinho** o que for técnico e mantém o estado atualizado |
| **Infraestrutura** | Engine + scripts | Formato, safe area, timeline, render versionado, estado persistente |

Claude interrompe o fluxo só por uma **decisão humana real**. Problema técnico que Claude consegue investigar e resolver não é checkpoint.

## Estados

| Estado | O que acontece | Quem conduz | Sai quando |
|---|---|---|---|
| `00_BRIEFING` | Interpretar o briefing (Briefing Rápido: 8 perguntas), registrar `briefing.md` e `durationSeconds` | Claude (usuário fornece) | `briefing.md` diferente do molde; `cliente`, `projeto` e `durationSeconds` no `project.json` *(checado)* |
| `01_CONCEPT` | Propor a direção criativa: ideia + **linguagem visual** | Claude | **GATE 1** aprovado ou dispensado; `linguagem` válida no `project.json`; motivo se repetir a linguagem do mesmo cliente *(checado)* |
| `02_SCRIPT` | Roteiro | Claude | Roteiro escrito. Sem aprovação própria: vai ao GATE 2 junto com o storyboard |
| `03_STORYBOARD` | Storyboard cena a cena (soma = duração) | Claude | **GATE 2** aprovado ou dispensado *(checado)* |
| `04_ASSETS` | Ficha técnica (`npm run assets`), examinar conteúdo, registrar no manifesto, pedir o que falta | Claude | Assets necessários identificados e disponíveis |
| `05_IMPLEMENTATION` | `timeline.ts`, cenas, componentes | Claude | Implementação concluída |
| `06_VALIDATION` | `npm run preflight -- <slug>`, conferência técnica, correções | Claude | **Preflight** aprovado *(checado, roda no `avancar`)* |
| `07_STUDIO` | Usuário assiste no Studio | Usuário | **GATE 3** aprovado *(checado)* |
| `08_DRY_RUN` | `npm run render -- <slug> --dry-run` (inclui o preflight). Sem terminal no PC: preflight na cópia de Claude + GATE 4 | Usuário/Claude | **Preflight** aprovado e **GATE 4** aprovado *(checado, o preflight roda no `avancar`)* |
| `09_RENDER` | Render final **local**: `npm run render -- <slug>` ou, sem terminal, **pedido ao Agente de Render**. Depois, assistir o MP4 | Usuário / Agente | MP4 da versão existe e a **validação pós-render** foi aprovada *(checado, roda no `avancar`)* |
| `10_FINAL` | Entregue | — | — (revisão = reabrir etapa) |

*(checado)* = o controller recusa a transição se a condição não for atendida. Preflight e validação pós-render **rodam de novo no próprio `avancar`**: um resultado antigo nunca libera a transição. Nas demais transições, a conclusão é responsabilidade de Claude, que só avança quando a etapa está realmente pronta. Em qualquer etapa, um **bloqueio ativo** impede o avanço.

## Gates humanos

| Gate | Nome | Bloqueia a saída de | Pode ser registrado a partir de | Dispensável? |
|---|---|---|---|---|
| `GATE_1` | Conceito | `01_CONCEPT` | `01_CONCEPT` | Sim, com motivo |
| `GATE_2` | Roteiro + Storyboard | `03_STORYBOARD` | `02_SCRIPT` | Sim, com motivo |
| `GATE_3` | Studio | `07_STUDIO` | `07_STUDIO` | **Nunca** |
| `GATE_4` | Render | `08_DRY_RUN` | `07_STUDIO` | **Nunca** |

- **GATE 1** é condicional: existe para quando há mais de um conceito válido ou uma decisão criativa relevante. Se o briefing já define a direção (típico do MODO PRODUÇÃO com autorização), o gate é **dispensado com o motivo registrado**, sem aprovação artificial.
- **GATE 2 — Roteiro + Storyboard** é **uma aprovação única e conjunta** do roteiro e do storyboard/plano visual (narrativa, estrutura e direção visual). Não existe aprovação separada do roteiro: `02_SCRIPT` termina sem gate e o roteiro é apresentado junto com o storyboard, na saída de `03_STORYBOARD`. O controller aceita registrar o GATE 2 já em `02_SCRIPT` só para o caso de o usuário aprovar o pacote completo antes da hora; nunca como aprovação só do roteiro. Mudança significativa no roteiro ou no storyboard depois da aprovação exige nova aprovação do GATE 2.
- **GATE 3** e **GATE 4** protegem o que é visual e irreversível. A autorização do render pode vir junto com a aprovação do Studio ("aprovado, pode renderizar"), mas o render só acontece depois do dry-run.
- Uma aprovação só é registrada quando o usuário **de fato** aprovou nesta conversa (ou deixou a autorização explícita no briefing, para os gates dispensáveis). Nunca inferir aprovação de silêncio.
- GATE 3 e GATE 4 são **travas do núcleo**: nenhuma regra da camada local (`local/`) os dispensa (ver `CLAUDE.md`, seção "Invariantes").

## O que fazer em cada etapa

As etapas seguem a ordem do controller. O inventário de assets pode começar antes de `04_ASSETS` (por exemplo, para apoiar o conceito), mas só se conclui nessa etapa.

### Criação do projeto

Definir o slug e criar a pasta:

`npm run new -- <slug> --cliente "<Cliente>" --projeto "<Projeto>" --duracao <s>`

Todo o trabalho deste vídeo acontece dentro de `projects/<slug>/`. O `npm run new` copia o molde (`projects/_MOLDE/`), congela uma cópia do engine em `src/engine/` e cria o `project-status.json` em `00_BRIEFING`.

### `00_BRIEFING`

Interpretar o briefing e identificar objetivo, público, mensagem, duração, formato e restrições. O `briefing.md` de todo projeto novo traz o **Briefing Rápido** (8 perguntas, em linguagem simples); o usuário responde no arquivo ou descreve o vídeo no chat, e o Claude registra. Como cada resposta é interpretada (inclusive o modo de trabalho da pergunta 8): `docs/02-BRIEFING.md`.

Copiar a duração para `durationSeconds` em `project.json`. Se o cliente tiver DNA em `clients/`, consultar (`docs/11-DNA-DE-CLIENTE.md`); o briefing prevalece.

**Checado:** enquanto o `briefing.md` estiver igual ao molde, o controller não avança e o status mostra: "o briefing ainda está vazio — responda as 8 perguntas no arquivo ou descreva o vídeo no chat". Num projeto recém-criado, o status também lembra de colocar os arquivos em `projects/<slug>/assets/`.

### `01_CONCEPT`

Definir a ideia central do vídeo **e a linguagem visual** (`docs/14-LINGUAGENS-VISUAIS.md`). Em MODO DIRETOR, apresentar 2–3 caminhos com linguagens diferentes e aguardar a escolha (GATE 1). Em MODO PRODUÇÃO com a direção já definida no briefing, dispensar o GATE 1 com o motivo.

**Checado na saída:**

- `project.json` → `"linguagem"` com um id válido do catálogo (`npm run linguagens`);
- se a linguagem repete a de uma das **3 últimas produções do mesmo cliente**, `project.json` → `"linguagemMotivo"` com o motivo em uma linha. Repetir a de outros clientes gera só aviso.

### `02_SCRIPT`

Organizar narrativa e textos. O roteiro não é aprovado sozinho: segue para o GATE 2 junto com o storyboard.

### `03_STORYBOARD`

Planejar cena por cena em `storyboard.md`. A soma das cenas deve ser igual à duração do briefing. Apresentar roteiro + storyboard e aguardar o GATE 2 (ou dispensá-lo com autorização explícita, em MODO PRODUÇÃO).

### `04_ASSETS`

Os arquivos ficam em `projects/<slug>/assets/`. Comece por `npm run assets -- <slug>` (ficha técnica automática; `--markdown` gera as linhas do manifesto). Examinar cada arquivo e registrar em `manifesto-de-assets.md`:

- nome;
- tipo;
- duração, quando aplicável;
- resolução;
- orientação;
- conteúdo relevante;
- origem e backup.

Pedir ao usuário o que faltar (com `bloquear`, se impedir o avanço).

### `05_IMPLEMENTATION`

- Transcrever o storyboard para `src/timeline.ts` (`SCENES`).
- Criar as cenas em `src/scenes/` e os componentes em `src/components/`.
- Usar o engine a partir de `src/engine/`, sem editá-lo para o vídeo.
- Aplicar a linguagem visual: faixa de corte, personalidade de movimento em todos os presets, só as entradas e transições da linguagem (`docs/14-LINGUAGENS-VISUAIS.md`, "Aplicando a linguagem no código").
- Antes da primeira cena, ler `docs/13-ARMADILHAS-REMOTION.md` (raiz estável, fontes com aspas, still de conferência).

### `06_VALIDATION`

- `npm run preflight -- <slug>` (inclui o typecheck do projeto; também roda no `avancar`).
- `docs/10-CONFERENCIA-FINAL.md`.
- Erro de preflight é tarefa técnica: corrigir e rodar de novo, sem devolver ao usuário.

### `07_STUDIO`

- `npm run studio -- <slug>` com `showSafeArea` ligado para conferir e **desligado** no final.
- O usuário assiste e aprova (GATE 3). Ajustes pedidos aqui: `reabrir 05` (ver Revisões).

### `08_DRY_RUN`

- `npm run render -- <slug> --dry-run` (inclui o preflight).
- Autorização do render (GATE 4).

### `09_RENDER`

`npm run render -- <slug>` gera `renders/<cliente>_<projeto>_vNN.mp4` na próxima versão livre e registra em `versoes.md`. Em projetos com estado, a validação técnica do MP4 (`npm run inspect`) roda e é registrada automaticamente em seguida.

Sem terminal no PC do usuário, o mesmo render é disparado por um **pedido ao Agente de Render** depois do GATE 4 (ver "Sem shell no computador do usuário", abaixo). O MP4 final nunca é gerado na nuvem.

### `10_FINAL`

Entregue. Opcionalmente, `npm run archive -- <slug> --destino "<pasta de backup>"` para uma cópia verificada.

Se algum componente se mostrar reutilizável, propor ao usuário a promoção para o engine (`engine/COMPONENTES.md`).

## Estado persistente — `project-status.json`

Cada projeto tem `projects/<slug>/project-status.json`, criado pelo `npm run new`. É a **fonte de verdade operacional**: o histórico do chat não é necessário para saber em que ponto o projeto está.

Separação de responsabilidades (sem duplicação):

| Arquivo | Guarda | Muda |
|---|---|---|
| `project.json` | Identidade e configuração (cliente, projeto, duração, linguagem visual, versão do engine) | Raramente; lido pelo render e pelo controller |
| `project-status.json` | Etapa, conclusões, aprovações, bloqueios, próxima ação, histórico | A cada transição |
| `versoes.md` | Registro dos MP4 gerados (escrito pelo `render.mjs`) | A cada render |
| `briefing.md`, `storyboard.md`, `manifesto-de-assets.md` | Conteúdo das decisões | Nas etapas correspondentes |

### Estrutura

```json
{
  "$schema": "reels-engine.project-status/1",
  "slug": "loja-exemplo-promo-natal",
  "stage": "03_STORYBOARD",
  "projectVersion": "v01",
  "completed": ["00_BRIEFING", "01_CONCEPT", "02_SCRIPT"],
  "gates": {
    "GATE_1": {"status": "approved", "at": "2026-10-01T14:02:11.000Z", "note": "Conceito B — vitrine em movimento"},
    "GATE_2": {"status": "pending"},
    "GATE_3": {"status": "pending"},
    "GATE_4": {"status": "pending"}
  },
  "blockers": [
    {"id": "B1", "text": "Falta a foto do produto principal", "owner": "usuario", "since": "2026-10-01T14:10:00.000Z"}
  ],
  "nextAction": null,
  "lastRender": null,
  "createdAt": "2026-10-01T13:40:00.000Z",
  "updatedAt": "2026-10-01T14:10:00.000Z",
  "history": [
    {"at": "…", "event": "init", "stage": "00_BRIEFING", "detail": "Projeto criado."},
    {"at": "…", "event": "advance", "stage": "01_CONCEPT", "detail": "00_BRIEFING → 01_CONCEPT", "from": "00_BRIEFING"}
  ]
}
```

| Campo | Significado |
|---|---|
| `stage` | Etapa atual (um dos 11 estados) |
| `completed` | Etapas concluídas: sempre todas as anteriores a `stage` (em `10_FINAL`, todas) |
| `gates` | Aprovações do usuário. `status`: `pending`, `approved`, `waived` (dispensado, com motivo em `note`) ou `legacy` (etapa anterior à adoção do controller) |
| `projectVersion` | Versão de trabalho (`v01`...). Coincide com o sufixo do MP4. Sobe quando uma revisão reabre o projeto depois de um render concluído |
| `blockers` | Bloqueios. Ativo = sem `resolvedAt`. `owner`: `usuario`, `claude` ou `ambiente` |
| `nextAction` | Próxima ação definida por Claude. `null` = usar a ação padrão da etapa |
| `lastRender` | Último MP4 final registrado (pelo render automático, pelo `inspect` ou ao concluir `09_RENDER`), com o resumo da validação em `inspect` |
| `preflight` | Último preflight: `ok`, `errors`, `warnings`, `fingerprint` do projeto e lista curta de problemas *(opcional)* |
| `renders` | Renders finais registrados, cada um com `file`, `version`, `at`, `source` e `inspect` *(opcional)* |
| `archives` | Arquivamentos feitos com `npm run archive` *(opcional)* |
| `updatedAt` | Última alteração |
| `history` | Log só de acréscimo: `init`, `advance`, `approve`, `waive`, `block`, `unblock`, `next`, `note`, `reopen`, `preflight`, `render`, `inspect`, `archive` |

O arquivo é gravado de forma atômica e **validado a cada leitura e gravação**: estados incoerentes (etapa pulada, etapa com gate concluída sem aprovação, campos inválidos) são recusados e nada é gravado por cima.

## Comandos (`npm run status`)

| Ação | Comando |
|---|---|
| Ver todos os projetos | `npm run status` |
| Relatório do projeto | `npm run status -- <slug>` |
| Concluir a etapa e avançar | `npm run status -- <slug> avancar [--nota "..."]` |
| Registrar aprovação | `npm run status -- <slug> aprovar GATE_1 --nota "o que foi aprovado"` |
| Dispensar gate (1 ou 2) | `npm run status -- <slug> dispensar GATE_1 --motivo "..."` |
| Bloquear | `npm run status -- <slug> bloquear "texto" --responsavel usuario` |
| Desbloquear | `npm run status -- <slug> desbloquear B1` (ou `todos`) |
| Definir próxima ação | `npm run status -- <slug> proxima "texto" [--responsavel usuario]` |
| Anotar | `npm run status -- <slug> nota "texto"` |
| Reabrir etapa (revisão) | `npm run status -- <slug> reabrir 05_IMPLEMENTATION --motivo "..."` |
| Validar o arquivo | `npm run status -- <slug> validar` |
| Adotar em projeto antigo | `npm run status -- <slug> init --etapa <ETAPA>` |

Etapas aceitam forma curta (`05`, `studio`); gates também (`1`, `gate2`). `--json` imprime o estado bruto.

Ferramentas de verificação (detalhes em `docs/12-AUTOMACAO.md`):

| Ação | Comando |
|---|---|
| Ficha técnica dos assets (04) | `npm run assets -- <slug>` (`--markdown` para o manifesto) |
| Preflight (06/08) | `npm run preflight -- <slug>` |
| Validação pós-render (09) | `npm run inspect -- <slug>` |
| Arquivar projeto concluído (10) | `npm run archive -- <slug> --destino "<pasta de backup>"` |

**Registro automático do render.** Em projetos com estado, todo render final bem-sucedido roda a validação pós-render e registra `renders`/`lastRender` no estado. Isso **não muda a etapa, não aprova gates e não altera o MP4 nem o `versoes.md`**; se algo falhar no registro, o render continua valendo e aparece só um aviso. O registro avisa quando o render aconteceu antes de `09_RENDER`, sem GATE 4 aprovado ou numa versão diferente da versão de trabalho.

## Revisões e versionamento

`reabrir <ETAPA>` volta o projeto para uma etapa anterior:

- etapas a partir dela deixam de estar concluídas;
- gates cuja etapa de saída é igual ou posterior voltam a `pending` (as aprovações anteriores **são preservadas**);
- se o render da versão atual já foi concluído, `projectVersion` sobe (`v01` → `v02`), alinhado com a próxima versão livre do `render.mjs`.

Exemplos: ajuste pedido no Studio → `reabrir 05` (mantém GATE 1 e 2; GATE 3 e 4 voltam a pendente). Cliente muda o roteiro depois da entrega → `reabrir 02` (invalida o GATE 2 em diante, abre v02). Reabrir uma etapa já aprovada pelo usuário (**GATE 1 ou GATE 2**) só com o pedido ou a concordância dele.

Na revisão, modificar somente o necessário e renderizar de novo: o resultado é automaticamente a versão seguinte. **Nunca sobrescrever uma versão anterior.** Anotar em `versoes.md` o que mudou.

## Início de sessão (recuperação de estado)

Todo chat que retoma um projeto começa assim:

1. `npm run status -- <slug>` (ou ler `projects/<slug>/project-status.json`).
2. Informar ao usuário, no formato:

```
STATUS DO PROJETO
Etapa atual: 03_STORYBOARD
Concluído: ✓ briefing ✓ conceito ✓ roteiro
Aguardando: → aprovação do storyboard (GATE 2)
Bloqueios: nenhum
Próxima ação: aguardar aprovação do usuário.
```

3. Seguir a partir da próxima ação. **Não refazer etapas concluídas e não reabrir decisões aprovadas** sem pedido.

Projeto sem `project-status.json` não tem controle de estado (por exemplo, um vídeo feito antes de adotar a ferramenta ou copiado de outro lugar). Se ainda estiver em produção, adotar com `init --etapa <ETAPA>` (os gates anteriores ficam como `legacy`, sem aprovação inventada). Projetos concluídos e de referência **ficam como estão**, salvo pedido do usuário. Para formalizar um projeto já entregue, a pedido do usuário: `init --etapa 09_RENDER` (a versão de trabalho é o render já existente), anotar as aprovações históricas com `nota` e fechar em `10_FINAL` com o `avancar`, que valida o MP4, sem nenhuma alteração no vídeo, no código ou nos assets.

## Sem shell no computador do usuário

Se Claude não puder rodar `node` onde o projeto está, o arquivo de estado pode ser lido e editado diretamente, seguindo **as mesmas regras**: acrescentar uma entrada em `history`, atualizar `updatedAt`, manter `completed` coerente com `stage` e nunca marcar gate como `approved` sem aprovação real. Na próxima oportunidade, confirmar com `npm run status -- <slug> validar`.

Nesse caso, **o render final é sempre feito pelo Agente de Render**, nunca na nuvem:

1. GATE 4 aprovado e projeto em `08_DRY_RUN` ou `09_RENDER`, com `projectVersion` = versão a renderizar.
2. Conferir se o agente está vivo pelo `.reels-engine/agente-status.json`, com `ultimoSinal` recente.
3. Gravar o pedido `.reels-engine/pedidos/<data>_<slug>_<versao>.json` (`operacao: "render"`). O formato está em `docs/12-AUTOMACAO.md`.
4. Ler o recibo em `.reels-engine/concluidos/` (sucesso) ou `.reels-engine/falhas/` (recusado, falha ou interrompido). **Nunca regravar um pedido que falhou com o mesmo `id`**: corrigir a causa e criar um pedido novo, com a concordância do usuário.
5. **Baixar de novo o `project-status.json` do PC antes de qualquer edição**, porque o render local também grava nele (`renders`, `lastRender`).

As armadilhas desse modo de trabalho (limite de transferência, selo C2PA em MP4, arquivo enviado em versão antiga) estão em `docs/12-AUTOMACAO.md`, seção "Operação sem terminal: armadilhas do ambiente".

## Quando Claude pergunta × quando age sozinho

**Pergunta / para** somente quando:

1. falta uma informação essencial (fato comercial, duração, asset indispensável);
2. há uma decisão criativa relevante ou mais de uma direção válida;
3. é um gate (aprovação humana);
4. uma mudança pode alterar significativamente uma decisão aprovada;
5. há uma limitação real do ambiente que Claude não consegue contornar;
6. há questão de licença ou direito de uso.

Ao parar, registrar o motivo (`bloquear` ou gate pendente) e dizer exatamente o que precisa do usuário. Nunca perguntar "o que devo fazer?" quando a resposta está no briefing, no projeto, nos docs ou no código.

**Age sozinho** em tudo que é técnico e resolvível:

- erro de TypeScript, import, componente, timeline, caminho de asset, configuração inconsistente;
- validações repetitivas (typecheck, soma das cenas, conferência técnica);
- atualização do estado (`avancar`, `proxima`, `nota`) nas etapas sem gate.

Procedimento diante de um problema técnico: identificar → investigar a causa → consultar docs/código/configuração → decidir a correção → implementar → validar → continuar o fluxo. Correção técnica pequena **não vira checkpoint humano**: entra no relatório da etapa.

## Responsabilidades da Engine

A Engine e os scripts garantem o que não deve depender de memória: formato 1080×1920 · 30 fps, safe area, timeline a partir do briefing, render versionado sem sobrescrita, o estado persistente e a validação das transições. As ferramentas automáticas estão em `docs/12-AUTOMACAO.md`.
