# MOTION DESIGN

## Princípios

Use: - easing; - anticipation; - overshoot; - follow through; -
stagger; - scale; - opacity; - position; - rotation.

Evite movimentos lineares sem propósito.

**O movimento tem personalidade.** Se todo vídeo usa a mesma curva e a
mesma mola, todos parecem o mesmo vídeo. Cada linguagem visual
(`docs/14-LINGUAGENS-VISUAIS.md`) declara a sua personalidade, e todo
movimento do projeto usa essa personalidade.

## Personalidades de movimento

Definidas em `engine/src/animations/presets.ts` (`PERSONALITY`). Todo
preset recebe a personalidade como parâmetro.

| Personalidade | Como se move | Duração padrão | Combina com |
|---|---|---|---|
| `suave` | Desacelera com calma no fim | 18 frames | Editorial, institucional |
| `elastica` | Mola que passa do ponto e volta (overshoot) | 26 frames | Pop, infantil, divertido |
| `seca` | Arranque quase instantâneo, parada firme | 8 frames | Tipografia cinética, UGC, impacto |
| `cinematografica` | Longa, acelera e desacelera devagar | 40 frames | Premium, documental |
| `mecanica` | Velocidade constante, parada seca | 12 frames | Interface, tech, dados |
| `degraus` | Segura frames em cadência de 12 fps (quadro a quadro) | 15 frames | Retrô, colagem, feito à mão |

Durações a 30 fps; escalam com o fps. `motionProgress()` devolve o
progresso (0 → 1) de qualquer movimento com a personalidade escolhida.

## Textos e elementos: entradas e saídas

| Entrada | Efeito |
|---|---|
| `fade` | Aparece |
| `fadeUp` / `fadeDown` | Aparece subindo / descendo |
| `slideLeft` / `slideRight` | Desliza para a esquerda / direita |
| `scaleIn` | Cresce de 85% |
| `popIn` | Cresce de 40% (com `elastica`, passa do tamanho e volta) |
| `blurIn` | Sai do desfoque |
| `maskUp` / `maskLeft` | Revelado por máscara, de baixo para cima / da esquerda para a direita |

A saída é a mesma entrada ao contrário (`exitAt` e `exitPreset`).

```tsx
<Animate preset="fadeUp" personality="suave" delay={6} exitAt={80}>...</Animate>
```

**Text reveal / stagger:** `RevealText` revela por letra, palavra ou
linha, com o mesmo preset e a mesma personalidade e atraso escalonado:

```tsx
<RevealText text={'cores leves\npeças novas'} by="linhas" preset="maskUp" personality="cinematografica" gap={8} />
```

A animação nunca deve prejudicar a leitura: o texto termina **parado e
legível** dentro da zona correta.

**Hook:** a entrada do hook usa `hookTiming(personalidade, fps)` — começa
no frame 0 e termina até 0,4 s, para o texto estar legível em 0,5 s em
qualquer personalidade (`docs/14-LINGUAGENS-VISUAIS.md`).

## Imagens

`KenBurns` (zoom + pan lento, personalidade `cinematografica` por padrão),
pan, parallax, crop animado, reveal.

## Vídeos

Priorizar cortes, enquadramentos, velocidade e ritmo antes de efeitos.

**Trilha de cortes:** `ClipTrack` toca trechos de vídeos/imagens em
sequência, cada um de `srcFrom` a `srcTo` (segundos da mídia de origem).
Para cortar na batida, `alignToBeats(clipes, batidas)` recalcula cada
trecho para durar exatamente de uma batida à seguinte (as batidas vêm da
análise de áudio: `docs/06-AUDIO-E-NARRACAO.md`). Nas transições com
sobreposição, o clipe que sai continua tocando alguns frames além do
`srcTo`: garanta material na origem.

## Transições

Presets em `engine/src/animations/presets.ts` (`TRANSITIONS`). Cada
linguagem declara as transições permitidas.

| Transição | Efeito | Duração padrão |
|---|---|---|
| `corte` | Corte seco, exato no frame | — |
| `matchCut` | Corte seco em que forma, posição ou movimento continuam de uma cena para a outra. O motor garante o corte exato; o casamento visual é da direção (storyboard) | — |
| `dissolve` | A cena nova aparece por cima da anterior | 12 frames |
| `wipe` | A cena nova é revelada por uma borda que atravessa a tela (`direction`: esquerda, direita, cima, baixo) | 10 frames |
| `whip` | Chicote: as duas cenas passam deslizando com desfoque de movimento | 8 frames |
| `zoomThrough` | A cena que sai avança para a câmera e a nova chega de perto | 10 frames |

A curva de toda transição segue a personalidade (um `wipe` em `degraus`
anda quadro a quadro; em `cinematografica`, lento).

**Como usar:** `SceneTrack` monta as cenas em sequência com as transições;
cada item declara a transição para o próximo. A sobreposição **não muda a
duração total** (a cena que sai continua por baixo nos primeiros frames da
próxima — `docs/05-REMOTION.md`, regra 5).

```tsx
<SceneTrack
  personality="seca"
  items={[
    {id: 'hook', durationInFrames: 30, content: <Hook />, transition: {type: 'whip', direction: 'esquerda'}},
    {id: 'cta', durationInFrames: 45, content: <Cta />},
  ]}
/>
```

Não repetir a mesma transição sem motivo.

## Texturas

- `Grain`: grão de filme gerado em SVG (textura "granulada"), sem arquivo de mídia. `blend`: `overlay` (padrão, tons médios e claros), `multiply` (papel), `normal` com opacidade baixa (fundos escuros — quebra faixas de degradê).
- `Cutout`: pedaço de papel recortado, com rotação, sombra dura e borda rasgada opcional (textura "recortada").

## Safe area

Siga a estratégia por zonas de `docs/08-INSTAGRAM.md`:

- **bleed:** fundos;
- **safe:** elementos secundários;
- **critical:** headline e CTA.

Animações de entrada podem começar fora da zona, desde que o texto fique **legível e parado** dentro da zona correta. Em layouts assimétricos e de colagem, confira no Studio com `showSafeArea` que nenhuma peça de texto passa da zona critical.

## Complexidade

A complexidade deve ser proporcional ao objetivo.

Um vídeo simples e bem executado é preferível a um vídeo cheio de
efeitos sem função narrativa.
