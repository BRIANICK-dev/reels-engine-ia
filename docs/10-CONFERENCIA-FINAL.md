# CONFERÊNCIA FINAL

> Os itens técnicos marcados com **[auto]** são verificados pelo `npm run preflight -- <slug>` (antes do Studio e do render) e pelo `npm run inspect -- <slug>` (depois do render, também automático). Os demais continuam sendo conferência de Claude e do usuário. Detalhes: `docs/12-AUTOMACAO.md`.

## Criativo

-   [ ] O vídeo atende ao objetivo?
-   [ ] O hook é claro e está legível até 0,5 s (frame 15)?
-   [ ] A narrativa possui progressão?
-   [ ] O ritmo é coerente?
-   [ ] O CTA está adequado e o último frame mostra o CTA completo, funcionando sozinho?
-   [ ] Os efeitos têm função?
-   [ ] A linguagem visual do `project.json` está aplicada (faixa de corte, personalidade de movimento, entradas e transições permitidas, layout e textura)?

## Conteúdo

-   [ ] Nenhuma informação foi inventada?
-   [ ] Todos os textos obrigatórios foram utilizados?
-   [ ] Preços e datas estão corretos conforme briefing?
-   [ ] A identidade do cliente foi respeitada?

## Visual

-   [ ] 1080×1920?
-   [ ] Safe area respeitada (zona critical para headline/CTA, safe para o resto)?
-   [ ] Frame de capa legível no recorte 3:4?
-   [ ] `showSafeArea` desligado?
-   [ ] Textos legíveis (texto secundário com fontSize ≥ 56, pesos finos só ≥ 80, contraste ≥ 4,5:1)? **[auto — preflight, para valores literais]**
-   [ ] Títulos grandes ajustados com `fitFontSize()` (nenhuma linha passa da zona)?
-   [ ] Fontes carregadas de arquivo (não dependem do sistema)?
-   [ ] Nome de fonte usado com aspas no CSS (ex.: `"'Fonte 2', sans-serif"`) e conferido num still com texto? (`docs/13-ARMADILHAS-REMOTION.md`)
-   [ ] Degradês (vinhetas, Scrim) com grão leve, sem faixas?
-   [ ] Composição equilibrada?
-   [ ] Assets corretamente enquadrados?

## Motion

-   [ ] Animações suaves?
-   [ ] Easing adequado?
-   [ ] Transições coerentes e entre as permitidas pela linguagem?
-   [ ] Não há excesso de efeitos?
-   [ ] Elementos não se sobrepõem de forma indesejada?

## Áudio

-   [ ] Música disponível?
-   [ ] Licença adequada?
-   [ ] Volume equilibrado?
-   [ ] Narração sincronizada?
-   [ ] Efeitos sonoros funcionando?

## Técnico

-   [ ] 30 fps?
-   [ ] Duração correta (soma de `SCENES` = `durationSeconds`)? **[auto]**
-   [ ] `npm run typecheck` sem erros? **[auto — typecheck do projeto no preflight]**
-   [ ] Assets usados só de `projects/<slug>/assets/` e registrados em `manifesto-de-assets.md`?
-   [ ] Assets encontrados? **[auto]**
-   [ ] Imports corretos?
-   [ ] Código sem erros?
-   [ ] Render concluído?
-   [ ] MP4 final gerado?
-   [ ] `ffprobe`: h264 · yuv420p · color_range=tv · bt709 · 1080×1920 · 30/1 · duração correta? **[auto — `npm run inspect`]**
-   [ ] Duração total obtida no `Main.tsx` e passada como `totalFrames` (nenhuma cena usa `useVideoConfig().durationInFrames` para o total)?

## Entrega

-   [ ] Nome do arquivo correto (`cliente_projeto_vNN.mp4`)?
-   [ ] Versão nova (nenhuma anterior sobrescrita)?
-   [ ] Versão registrada em `versoes.md` com observações?
-   [ ] Arquivo final acessível?
