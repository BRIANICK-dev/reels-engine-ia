# LINGUAGENS VISUAIS

Como evitar que todos os vídeos saiam iguais.

Uma **linguagem visual** é um pacote coerente de decisões: ritmo de corte, composição, textura, **personalidade de movimento**, entradas e transições permitidas, tipografia e cor. O conceito de cada vídeo escolhe **uma** linguagem do catálogo, e o projeto registra a escolha em `project.json` → `"linguagem"`.

- Catálogo (fonte da verdade): `engine/linguagens.json`
- Ver no terminal: `npm run linguagens` · detalhes: `npm run linguagens -- <id>` · uso por cliente: `npm run linguagens -- --cliente "<Cliente>"`
- Movimento (personalidades, entradas, transições): `engine/src/animations/presets.ts` e `docs/04-MOTION-DESIGN.md`
- Linguagens próprias: `local/linguagens.json` (ver "Linguagens próprias", abaixo)

## Regra do hook (vale para toda linguagem)

O texto do hook está **legível até 0,5 s** (frame 15 a 30 fps), qualquer que seja a personalidade. Uma linguagem pode ser lenta no corpo, **nunca no hook**.

- Cada linguagem declara no catálogo `"hook": {"entrada": "<preset>", "legivelAteSegundos": 0.5}`: a entrada do hook (uma das suas `entradas`) e o limite, que não pode passar de 0,5 s.
- No código, a entrada do hook usa `hookTiming(personalidade, fps)` do engine: começa no frame 0 e dura no máximo 0,4 s, mantendo a curva/mola da personalidade (a "cinematográfica" continua elegante, só mais curta).
- Teste: para cada linguagem, o estilo da entrada do hook no frame 15 está opaco, sem desfoque, sem máscara e no lugar. Elementos de apoio (fios, selos, peças secundárias) podem entrar depois.

```tsx
<Animate preset="blurIn" personality="cinematografica" {...hookTiming('cinematografica', fps)}>CHEGOU</Animate>
```

## Os 4 eixos

Cada linguagem se define por 4 eixos. **Nenhum par de linguagens do catálogo coincide em mais de 2 eixos** (conferido por teste): é isso que garante que elas pareçam vídeos diferentes, e não variações do mesmo.

| Eixo | Valores | O que muda na tela |
|---|---|---|
| Ritmo | `lento` (cortes de 2,5–4,5 s) · `medio` (1,2–2,5 s) · `rapido` (0,4–1,2 s) | Quanto tempo cada plano fica na tela |
| Layout | `centralizado` · `assimetrico` · `grid` · `tela-cheia` | Onde as coisas ficam dentro da zona segura |
| Textura | `limpa` · `granulada` (componente `Grain`) · `recortada` (componente `Cutout`) | A superfície da imagem |
| Movimento | `suave` · `elastica` · `seca` · `cinematografica` · `mecanica` · `degraus` | Curva, mola, duração e cadência de TODO movimento |

## Catálogo

| Linguagem | Ritmo · layout · textura · movimento | Em uma frase |
|---|---|---|
| `editorial-minimalista` | médio · assimétrico · limpa · suave | Página de revista em movimento, muito respiro |
| `elegante-premium` | lento · centralizado · limpa · cinematográfica | Luxo silencioso, caixa alta espaçada, fundo escuro |
| `tipografia-cinetica` | rápido · centralizado · limpa · seca | A palavra é a imagem, cortes rápidos e secos |
| `cinematografico-documental` | lento · tela-cheia · granulada · cinematográfica | A imagem conta a história, texto mínimo |
| `colagem-recorte` | médio · assimétrico · recortada · degraus | Papel recortado, peças tortas, quadro a quadro |
| `interface-tech` | rápido · grid · limpa · mecânica | Tela de sistema, precisão, dados |
| `retro-filme` | médio · tela-cheia · granulada · degraus | Filme antigo, grão, dissolves de projeção |
| `organico-feito-a-mao` | lento · assimétrico · granulada · degraus | Artesanal e calmo, papel com grão |
| `pop-colorido` | rápido · grid · recortada · elástica | Blocos de cor, peças que pulam com mola |
| `nativo-de-rede` | médio · tela-cheia · limpa · seca | Parece feito no celular: legendas grandes, cortes de fala |

`editorial-minimalista` e `elegante-premium` são as mais fáceis de confundir; por isso divergem em 3 dos 4 eixos (só a textura "limpa" é comum). Na prática: editorial é **assimétrico, claro, texto pequeno e movimento suave**; premium é **centralizado, escuro, caixa alta espaçada e movimento lento**.

Detalhes de cada uma (quando usar, quando evitar, tipografia, cor, entradas e transições): `npm run linguagens -- <id>` ou o próprio `engine/linguagens.json`.

## Como escolher (GATE 1)

1. Leia o briefing: objetivo, público, material disponível, tom (pergunta 7 do Briefing Rápido).
2. Se o usuário indicou uma linguagem, use-a. Se deixou "automático", **proponha 2–3 caminhos com linguagens diferentes** — de preferência divergindo em pelo menos 2 eixos entre si — cada um com uma frase de ideia e o porquê.
3. Material manda: sem bons vídeos/fotos, evite `cinematografico-documental` e `nativo-de-rede`; muito texto obrigatório pede ritmo médio ou lento.
4. Registre a escolhida em `project.json` → `"linguagem": "<id>"`.

**Regra do controller.** A saída de `01_CONCEPT` exige:

- `"linguagem"` preenchida com um id válido do catálogo (núcleo ou local);
- se essa linguagem **repete a de uma das 3 últimas produções do mesmo cliente**, um motivo de uma linha em `project.json` → `"linguagemMotivo"` (ex.: `"Continuação da mesma campanha, a pedido do cliente"`). Sem motivo, o controller não avança;
- entre **clientes diferentes**, repetir a linguagem das 3 últimas produções gera só um **aviso**.

"Últimas produções" = projetos em `projects/` com `"linguagem"` registrada, do mais recente para o mais antigo (moldes e o projeto de exemplo não contam). O cliente é comparado pelo nome em `project.json`, sem diferenciar maiúsculas e acentos.

## Aplicando a linguagem no código

A linguagem vira decisões concretas na implementação (`05_IMPLEMENTATION`):

| Decisão | Onde |
|---|---|
| Duração de cada corte dentro da faixa de `corteSegundos` | `src/timeline.ts` (SCENES) |
| Personalidade em TODO movimento | `personality` de `Animate`, `RevealText`, `KenBurns`, `SceneTrack`, `ClipTrack` |
| Só as entradas e transições listadas na linguagem | `preset` do `Animate`; `transition` dos itens do `SceneTrack` |
| Hook | entrada `hook.entrada` com `hookTiming()` — legível até 0,5 s |
| Layout e textura | composição das cenas; `Grain` (granulada), `Cutout` (recortada) |
| CTA | o último frame mostra o CTA completo e funciona sozinho |
| Tipografia e cor | constantes do projeto (`src/styles/`), fonte com `fontCss()` |

```tsx
const PERSONALIDADE = 'degraus'; // eixos.movimento da linguagem do projeto
<SceneTrack personality={PERSONALIDADE} items={itens} defaultTransition={{type: 'wipe', direction: 'direita'}} />
<Animate preset="popIn" personality={PERSONALIDADE} delay={staggerDelay(i, 5)}>...</Animate>
```

Uma linguagem é um ponto de partida, não uma prisão: fugir dela num momento pontual (uma transição fora da lista para um efeito específico) é permitido quando tem motivo narrativo — registre no `storyboard.md`. O que não se faz é ignorar a linguagem e voltar à mesma curva e ao mesmo layout de sempre.

## Exemplo no repositório

`projects/exemplo-loja-promo/` faz **o mesmo roteiro** em três linguagens contrastantes (`tipografia-cinetica`, `elegante-premium`, `colagem-recorte`). No Studio, compare as composições `Vitrine-<linguagem>`; a composição `Main` usa a linguagem do `project.json`.

## Linguagens próprias (`local/linguagens.json`)

Quem usa a ferramenta pode criar linguagens próprias, fora do Git, sem mexer no núcleo:

```json
{
  "$schema": "reels-engine.linguagens/1",
  "linguagens": [
    {
      "id": "minha-linguagem",
      "nome": "Minha linguagem",
      "resumo": "…",
      "quandoUsar": "…",
      "evitarQuando": "…",
      "eixos": {"ritmo": "rapido", "layout": "tela-cheia", "textura": "recortada", "movimento": "mecanica"},
      "corteSegundos": [0.6, 1.0],
      "entradas": ["fadeUp"],
      "hook": {"entrada": "fadeUp", "legivelAteSegundos": 0.5},
      "transicoes": ["corte", "wipe"],
      "tipografia": "…",
      "cor": "…"
    }
  ]
}
```

- Os campos são os **mesmos** do núcleo, todos obrigatórios; campo a mais é erro.
- O `id` não pode repetir um id do núcleo.
- Valores de eixo, entradas e transições precisam existir no engine; `corteSegundos` precisa caber na faixa do ritmo; `hook.entrada` é uma das `entradas` e `hook.legivelAteSegundos` vai até 0,5.
- Validação: `npm run local:check` (também roda no `npm run linguagens`, no `status` e no `preflight`). Uma linguagem local que coincida com uma do núcleo em mais de 2 eixos gera aviso: talvez não seja realmente diferente.
- A camada local nunca altera as travas do núcleo (`CLAUDE.md`, "Invariantes").
