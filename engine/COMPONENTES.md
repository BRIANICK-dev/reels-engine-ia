# ENGINE — CATÁLOGO E PROMOÇÃO DE COMPONENTES

Versão atual: ver `VERSION` na raiz do repositório (versão única do motor).

## Catálogo

| Item | Arquivo | Função | Desde |
|---|---|---|---|
| `FORMAT` | `constants/format.ts` | 1080×1920, 30 fps, H.264, MP4 | 1.0.0 |
| `SAFE_AREA`, `INSTAGRAM_UI`, `COVER_CROPS`, `CAPTION_BAND`, `safePadding()` | `constants/safeArea.ts` | Estratégia de safe area por zonas | 1.0.0 |
| `Scene`, `secondsToFrames()`, `getSceneTimings()`, `resolveDurationInFrames()` | `utils/timeline.ts` | Duração a partir do briefing/storyboard | 1.0.0 |
| `safeBox()` | `constants/safeArea.ts` | Caixa útil de uma zona em px (critical = 810 × 1140) | 1.0.0 |
| `measureTextWidth()`, `fitFontSize()` | `utils/fitText.ts` | Ajusta o tamanho de títulos para caber na zona (sem dependências) | 1.0.0 |
| `SafeAreaOverlay` | `components/SafeAreaOverlay.tsx` | Guia visual de safe area no Studio | 1.0.0 |
| `PERSONALITIES`, `PERSONALITY`, `motionProgress()` | `animations/presets.ts` | Personalidades de movimento (suave, elastica, seca, cinematografica, mecanica, degraus) | 1.0.0 |
| `ENTRANCES`, `entranceStyle()`, `exitStyle()`, `staggerDelay()` | `animations/presets.ts` | Entradas e saídas com personalidade | 1.0.0 |
| `TRANSITIONS`, `transitionStyle()`, `transitionDuration()` | `animations/presets.ts` | Transições: corte, dissolve, wipe, whip, zoomThrough, matchCut | 1.0.0 |
| `Animate`, `animationStyle()` | `animations/Animate.tsx` | Aplica um preset de entrada/saída ao conteúdo | 1.0.0 |
| `RevealText` | `animations/Animate.tsx` | Text reveal por letra, palavra ou linha (stagger) | 1.0.0 |
| `KenBurns` | `animations/KenBurns.tsx` | Zoom + pan lento sobre imagem ou vídeo | 1.0.0 |
| `SceneTrack`, `resolveTransitions()`, `trackDuration()` | `components/SceneTrack.tsx` | Trilha de cenas com transições (sobreposição sem mudar a duração) | 1.0.0 |
| `ClipTrack`, `clipFrames()`, `alignToBeats()` | `components/ClipTrack.tsx` | Trilha de cortes com `srcFrom`/`srcTo`, pensada para cortes na batida | 1.0.0 |
| `Pill` | `components/Pill.tsx` | Etiqueta arredondada (selos, datas, CTAs curtos) | 1.0.0 |
| `Scrim` | `components/Scrim.tsx` | Degradê de legibilidade sobre imagem/vídeo, com grão contra faixas (`dither`) | 1.0.0 |
| `Grain` | `components/Grain.tsx` | Textura granulada (grão em SVG, sem mídia); também quebra faixas de degradê | 1.0.0 |
| `Cutout` | `components/Cutout.tsx` | Textura recortada (papel, sombra dura, borda rasgada) | 1.0.0 |
| `HOOK_LEGIBLE_SECONDS`, `hookTiming()` | `animations/presets.ts` | Regra do hook: entrada que termina até 0,4 s, texto legível até 0,5 s em qualquer personalidade | 1.0.0 |
| `LEGIBILITY`, `contrastRatio()`, `warnLowContrast()` | `utils/legibility.ts` | Mínimos de legibilidade no celular e contraste WCAG (Pill e Cutout avisam no console) | 1.0.0 |
| `fontCss()`, `loadFonts()`, `useFonts()` | `utils/fonts.ts` | Fonte de arquivo com nome seguro para CSS e render que espera a fonte | 1.0.0 |
| `Soundtrack` | `audio/Soundtrack.tsx` | Trilha com entrada/saída de volume e `trimBefore` (só código; nenhum áudio no repositório) | 1.0.0 |

O catálogo de linguagens visuais que usa esses presets fica em `engine/linguagens.json` (fora de `src/`: não é copiado para os projetos; é lido pelos scripts). Todo id de personalidade, entrada ou transição citado nele precisa existir em `presets.ts` — conferido por teste.

Previstos para a v1.1: contador animado, balão de chat, seletor/picker. Também fica para depois o gerador de efeitos sonoros.

## Quando promover

Um componente de projeto vira componente do engine quando:

1. resolveu bem um problema real num vídeo aprovado;
2. tende a se repetir em outros vídeos ou clientes;
3. o usuário aprovou a promoção.

## Como promover

1. Copiar de `projects/<slug>/src/components/` para `engine/src/<categoria>/`.
2. **Generalizar:** textos, cores, fontes, durações e assets viram props com defaults neutros. Nenhum dado de cliente pode ficar no engine.
3. Importar apenas de `remotion`, `react` ou do próprio engine, nunca de arquivos de projeto.
4. Exportar em `engine/src/index.ts`.
5. Registrar no catálogo acima.
6. Atualizar o `VERSION` da raiz (e o `CHANGELOG.md`):
   - patch: correção;
   - minor: componente novo;
   - major: mudança que quebra a API.
7. Copiar `engine/src/` para `projects/exemplo-loja-promo/src/engine/` (a cópia do exemplo acompanha o motor; um teste confere).
8. Rodar `npm run typecheck` e `npm test`.

Projetos existentes **não** são atualizados automaticamente. Se um projeto em andamento precisar da versão nova, copie o arquivo conscientemente para o `src/engine/` dele e atualize o `engineVersion` no `project.json`.
