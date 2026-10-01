# ARMADILHAS DO REMOTION

Problemas reais encontrados em produção com a versão do Remotion fixada no `package.json` (4.0.529) e o TypeScript do projeto. Cada item traz o sintoma, a causa e a regra que evita o problema.

> Este documento trata do **Remotion, do React, do TypeScript e do que acontece com o vídeo depois do render** (recompressão). As armadilhas do fluxo com agente (transferência nuvem → PC, selo C2PA em MP4, arquivo enviado em versão antiga) estão em `docs/12-AUTOMACAO.md`, seção "Operação sem terminal: armadilhas do ambiente". A sincronia de cortes com a música está em `docs/06-AUDIO-E-NARRACAO.md`.
>
> Ao atualizar o Remotion (procedimento em `docs/05-REMOTION.md`), revise este documento: um item pode deixar de valer ou mudar de forma.

## 1. Raiz da composição que "some" no Studio

**Sintoma.** No Remotion Studio aparece só o fundo, a timeline mostra um único `<AbsoluteFill>` e o elemento raiz fica sem filhos. O Player e o render final **não** são afetados: o problema existe só no Studio.

**Causa.** Nesta versão, no Studio, o `<AbsoluteFill>` é um item interativo da timeline. Na primeira montagem ele guarda um vínculo com o JSX de origem e trata `children` como campo de conteúdo. Se a composição devolve primeiro um `<AbsoluteFill>` **sem filhos** (por exemplo, enquanto a fonte carrega) e depois outro `<AbsoluteFill>` **com** as cenas, na mesma posição da árvore, o React reaproveita a instância. O vínculo da primeira versão (sem filhos) prevalece e as cenas não aparecem.

Formas de confirmar: trocar a raiz por `<div>` faz o conteúdo aparecer; remover o estado intermediário faz aparecer; dar uma `key` diferente ao estado intermediário (forçando nova montagem) também.

**Regra.** Nunca troque um `<AbsoluteFill>` por outro `<AbsoluteFill>` com estrutura diferente na mesma posição (retorno antecipado, ternário entre dois ramos). Mantenha **uma raiz estável** e condicione só o conteúdo interno:

```tsx
// Evite
if (!fontReady) return <AbsoluteFill style={fundo} />;
return <AbsoluteFill style={fundo}>{cenas}</AbsoluteFill>;

// Prefira
return <AbsoluteFill style={fundo}>{fontReady ? cenas : null}</AbsoluteFill>;
```

O hook `useFonts()` do engine segue esse padrão: devolve `true` quando a fonte carregou e só libera o render depois que a composição redesenhou com ela (importante quando o layout mede o texto com `fitFontSize()`).

## 2. `document.fonts` e o TypeScript

**Sintoma.** O typecheck falha em `document.fonts.add(...)` ou ao iterar `document.fonts`.

**Causa.** Com o TypeScript 5.9, essas APIs dependem de `"DOM.Iterable"` em `compilerOptions.lib`. O `tsconfig.json` da raiz já inclui a entrada; o problema volta se alguém a remover ou criar um `tsconfig` próprio.

**Regra.** Mantenha `"lib": ["DOM", "DOM.Iterable", ...]` no `tsconfig.json` da raiz. Valide sempre com a versão **exata** do TypeScript do `package.json` (`npm run typecheck`), não com um `tsc` global.

## 3. Nome de fonte com número precisa de aspas no CSS

**Sintoma.** Os textos saem numa fonte serifada (a padrão do navegador), mas com o **tamanho certo**.

**Causa.** Em `style={{fontFamily: 'Fonte 2'}}` o valor vira `font-family: Fonte 2` no CSS. Sem aspas, um nome de família com um token numérico é CSS inválido e o navegador ignora a declaração. A medição com `fitFontSize()` usa o canvas, que aceita o nome entre aspas, por isso o tamanho calculado está certo e só a exibição sai errada. Acontece com qualquer família cujo nome tenha número ("… 2", "… 1", "… 3D").

**Regra.** Defina **uma constante** com o nome já entre aspas e o fallback — o engine tem `fontCss()` para isso — e use-a em todo `fontFamily`:

```ts
// src/styles/fonts.ts
export const FONT_CSS = "'Fonte 2', sans-serif"; // ou: fontCss('Fonte 2')
```

Aspas em todos os nomes de fonte são um hábito seguro, mesmo sem número. O **preflight avisa** quando encontra `fontFamily` com nome numérico sem aspas.

**Detecte cedo.** Antes de seguir com a implementação, renderize **um still com texto** e confira a fonte na imagem:

```bash
npx remotion still projects/<slug>/src/index.ts Main projects/<slug>/renders/_rascunhos/still-texto.png --frame=30 --public-dir=projects/<slug>/assets
```

O still fica em `renders/_rascunhos/` (fora da contagem de versões). Use um nome novo a cada conferência: nada é sobrescrito.

## 4. Faixas em degradês escuros depois da recompressão (banding)

**Sintoma.** No Studio e no MP4 a vinheta ou o degradê escuro parecem suaves; publicado no Instagram, aparecem faixas (degraus de cor) concêntricas ou horizontais.

**Causa.** O Instagram recomprime o vídeo com bitrate baixo. Degradês suaves em tons escuros têm poucos níveis de cor por pixel e nenhuma variação fina; o codificador agrupa áreas vizinhas no mesmo nível e as transições viram degraus visíveis.

**Regra.** Todo degradê suave (vinheta, `Scrim`, fundo em gradiente) leva um **grão leve** por cima, que quebra as faixas:

- `Scrim` já aplica grão por padrão (`dither`, 0,04, mistura normal). Não desligue (`dither={0}`) em fundos escuros.
- Degradê próprio (`linear-gradient`, `radial-gradient`): coloque `<Grain opacity={0.04} blend="normal" />` por cima. Sobre preto, a mistura `overlay` (padrão do `Grain`) quase some — use `normal` com opacidade baixa.
- Fundos chapados claros (papel, bege) também ganham com textura: `<Grain blend="multiply" opacity={0.3} />`.

O **preflight avisa** quando encontra degradê no código sem `<Grain>`. Medido no exemplo: o grão da vinheta (desvio de ~1–2 níveis de cinza) sobrevive ao H.264 CRF 18 e a uma recompressão a 2,5 Mbps.
