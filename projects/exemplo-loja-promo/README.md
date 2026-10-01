# PROJETO DE EXEMPLO — exemplo-loja-promo

Mostra o anti-engessamento do motor: **o mesmo roteiro em três linguagens visuais** (`docs/14-LINGUAGENS-VISUAIS.md`). Renderiza logo depois do clone, sem nenhum arquivo extra.

Marca e textos são fictícios ("Loja Exemplo"). Nenhum preço, data ou condição: o motor nunca inventa fatos comerciais. A única mídia é a fonte **Inter** (licença SIL OFL 1.1, em `assets/fonts/`, com o `OFL.txt` ao lado). Sem música, sem fotos, sem vídeos: tudo é tipografia e grafismo em código.

## As três linguagens

| Composição | Linguagem | Ritmo · layout · textura · movimento |
|---|---|---|
| `Main` | a do `project.json` (`tipografia-cinetica`) | rápido · centralizado · limpa · seca |
| `Vitrine-elegante-premium` | elegante / premium | lento · centralizado · limpa · cinematografica |
| `Vitrine-colagem-recorte` | colagem / recorte | médio · assimétrico · recortada · degraus |

O que cada uma demonstra, além da linguagem:

- **Hook legível até 0,5 s** em todas, inclusive na elegante (lenta no corpo, rápida no hook): `hookTiming()`.
- **Último frame com o CTA completo** ("Visite a loja") em todas.
- **Legibilidade no celular**: textos secundários com corpo ≥ 56 px, pesos finos só em corpo grande, pares de cor com contraste ≥ 4,5:1 (o `Cutout` confere).
- **Grão contra faixas**: a vinheta escura da elegante tem `dither` (grão leve); o papel da colagem tem textura de grão.
- **Raiz estável + fonte carregada antes de medir o texto**: `src/compositions/Main.tsx` com `useFonts()`.

## Como ver e renderizar (na raiz do repositório)

```
npm run studio -- exemplo-loja-promo     # escolha a composição na lista (Main ou Vitrine-*)
npm run preflight -- exemplo-loja-promo  # verificação técnica
npm run render -- exemplo-loja-promo     # → renders/loja-exemplo_promo_v01.mp4 (linguagem do Main)
```

Para trocar a linguagem do `Main`, mude `"linguagem"` no `project.json` para uma das três acima.

O exemplo vai para o Git **sem** `project-status.json` (cada clone começa limpo) e por isso não tem controle de estado: o `render` faz o render simples. Para experimentar o fluxo completo (briefing → gates → render), crie um projeto seu com `npm run new` — não use o exemplo para os seus vídeos.

## Arquivos que valem a leitura

| Arquivo | O que mostra |
|---|---|
| `briefing.md` | Briefing Rápido respondido (as 8 perguntas) |
| `storyboard.md` | Cortes das três linguagens |
| `src/roteiro.ts` | O texto único, compartilhado pelas três |
| `src/variantes/cenas.ts` | Os cortes de cada linguagem (a timeline do `Main` vem daqui) |
| `src/variantes/Cinetica.tsx`, `Premium.tsx`, `Colagem.tsx` | Uma implementação por linguagem, com `SceneTrack`, `Animate`, `hookTiming`, `Scrim`, `Grain`, `Cutout` |
| `src/compositions/Main.tsx` | Raiz estável + `useFonts()` |
| `src/styles/fonts.ts` | Fonte com `fontCss()` (nome entre aspas) |
| `manifesto-de-assets.md` | A fonte e a licença |

`src/engine/` é a cópia do engine do motor. Diferente de um projeto comum (cópia congelada), a cópia do exemplo acompanha o motor: um teste confere que ela é idêntica a `engine/src/`.
