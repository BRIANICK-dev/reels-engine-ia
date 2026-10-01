# REGRAS PARA INSTAGRAM REELS

## Padrão

1080 × 1920 · 9:16 · 30 fps · MP4 / H.264

## Safe area: estratégia por zonas

Uma margem única para tudo ou desperdiça tela (fundos) ou coloca informação crítica sob a interface do app. Por isso cada elemento usa **a zona que corresponde à sua importância**.

| Zona | Uso | Margens (topo · direita · base · esquerda) |
|---|---|---|
| **bleed** | Fundos, vídeo e fotos em tela cheia, texturas | 0 · 0 · 0 · 0 |
| **safe** | Textos secundários, logos, legendas, grafismos | 220 · 140 · 380 · 60 |
| **critical** | Headline, CTA, preço/data/condição, logo obrigatório, informação que não pode ser perdida | 300 · 180 · 480 · 90 |

Por que as margens são **assimétricas**:

- **Topo:** cabeçalho do Reels e ícone de câmera.
- **Direita:** coluna de ações (curtir, comentar, compartilhar, áudio), aproximadamente de y≈1000 até o rodapé. Por isso a margem direita é maior que a esquerda.
- **Base:** usuário, legenda do post e música. É a área mais crítica.

Regras complementares:

- **Legendas:** a base do bloco fica dentro da faixa `CAPTION_BAND` (y 1180 a 1540). Nunca abaixo disso.
- **Capa e grade do perfil:** a grade mostra um recorte central **3:4** (1080×1440, de y=240 a y=1680). O frame de capa precisa ter a mensagem principal dentro desse recorte. O feed pode mostrar recorte 4:5 (1080×1350).
- **Elementos grandes** podem atravessar zonas (uma imagem que entra pela borda, por exemplo), desde que o **conteúdo legível** respeite a zona adequada.
- **Títulos grandes:** o tamanho de fonte do design é um **máximo**. A largura útil da zona critical é **810 px** (`safeBox('critical').width`). Use `fitFontSize()` para garantir que a linha mais longa caiba. Palavras longas ("INESQUECÍVEL", "EXPERIÊNCIA") a 144 px estouram a zona e entram na coluna de ações. Detalhes em `docs/05-REMOTION.md`, seção Tipografia e safe area.
- **Alinhamento:** como as margens laterais são assimétricas (esquerda 90, direita 180 na zona critical), um bloco centralizado no quadro fica opticamente deslocado. Prefira alinhar à esquerda dentro da zona ou centralizar na **caixa da zona** (não no quadro).
- **Rosto e ponto de interesse** das imagens: prefira enquadrá-los fora da coluna direita e da faixa inferior.

Implementação:

- Os valores ficam em `engine/src/constants/safeArea.ts`: `SAFE_AREA`, `INSTAGRAM_UI`, `COVER_CROPS`, `CAPTION_BAND`.
- `safePadding('critical')` aplica a zona como padding em um container; `safeBox('critical')` devolve a caixa útil em px (x, y, width, height).
- `<SafeAreaOverlay />` mostra as zonas no Studio (prop `showSafeArea`). **Desligue antes do render.**

Manutenção: os valores são **valores de referência**, calibrados na interface atual do app, e o Instagram muda a interface com o tempo. A cada trimestre, ou quando notar sobreposição, publique um teste em rascunho, confira no celular e ajuste `safeArea.ts` (e o `VERSION` do engine).

## Legibilidade

O vídeo deve funcionar numa tela de celular. Mínimos do motor (`engine/src/utils/legibility.ts`):

| Item | Mínimo | Na prática |
|---|---|---|
| Texto secundário | altura de caixa alta ≈ **40 px** (quadro de 1080 px) | `fontSize` ≥ **56** nas fontes sem serifa comuns; em caixa baixa, ≥ **72** |
| Pesos finos (abaixo de 400) | só em corpo grande | `fontSize` ≥ **80** |
| Contraste texto × fundo | **4,5:1** (WCAG AA) | `contrastRatio()` do engine calcula |

O **preflight avisa** (seção "legibilidade") quando encontra no código um `fontSize` abaixo do mínimo, um peso fino em corpo pequeno ou um par de cores literais (`color` × `background`) abaixo de 4,5:1. Cores calculadas em tempo de execução são conferidas por `Pill` e `Cutout` (parâmetro `ink`), que avisam no console do Studio e no log do render. Sobre foto ou vídeo, use `Scrim` para garantir o contraste.

Evitar também: excesso de elementos e muitas mensagens simultâneas.

## Primeiros segundos

Priorizar um hook visual ou textual forte, dentro da zona **critical**.

**Regra do hook:** em qualquer linguagem, o texto do hook está **legível até 0,5 s** (frame 15 a 30 fps). Uma linguagem lenta pode ser lenta no corpo, nunca no hook: use `hookTiming(personalidade, fps)` na entrada do hook (`docs/14-LINGUAGENS-VISUAIS.md`).

## CTA

O CTA fica sempre na zona **critical**, aparece em momento apropriado e tem tempo de tela suficiente para ser lido.

**O frame final precisa funcionar sozinho**: é o que fica na tela quando o vídeo para e o que aparece em capturas e prévias. Ele mostra o CTA completo ("Visite a loja", não só "a loja"), mesmo quando os cortes anteriores dividem a frase palavra por palavra.

## Exportação

MP4 / H.264 / yuv420p · BT.709 (faixa tv) / 1080×1920 / 30 fps, gerado com `npm run render`. Sempre validar o arquivo final.
