# STORYBOARD — exemplo-loja-promo

> O MESMO roteiro (src/roteiro.ts) em três linguagens visuais, 10 s cada.
> A composição `Main` usa a linguagem do `project.json` (`tipografia-cinetica`);
> as outras duas estão nas composições `Vitrine-elegante-premium` e `Vitrine-colagem-recorte`.
> Os cortes de cada linguagem estão em `src/variantes/cenas.ts` (a timeline do Main vem de lá).

Roteiro: "Chegou a coleção de verão. Cores leves, peças novas. Loja Exemplo. Visite a loja."

## Main — tipografia cinética (rápido · centralizado · limpa · seca)

| # | Tempo | Duração | Asset | Enquadramento | Movimento | Texto | Animação | Transição | Áudio | Objetivo narrativo |
|---|---|---|---|---|---|---|---|---|---|---|
| c01 | 0.0–1.0 s | 1.0 s | — (tipografia) | centralizado | — | CHEGOU | popIn · seca | corte | — | hook (amarelo sobre preto) |
| c02 | 1.0–1.9 s | 0.9 s | — (tipografia) | centralizado | — | A / COLEÇÃO | scaleIn · seca | corte | — | tema (preto sobre amarelo) |
| c03 | 1.9–2.4 s | 0.5 s | — (tipografia) | centralizado | — | DE | slideLeft · seca | corte | — | tema (amarelo sobre preto) |
| c04 | 2.4–3.4 s | 1.0 s | — (tipografia) | centralizado | — | VERÃO | maskLeft · seca | whip (esquerda) | — | tema (preto sobre amarelo) |
| c05 | 3.4–4.1 s | 0.7 s | — (tipografia) | centralizado | — | CORES | popIn · seca | corte | — | tema (amarelo sobre preto) |
| c06 | 4.1–4.9 s | 0.8 s | — (tipografia) | centralizado | — | LEVES | scaleIn · seca | corte | — | tema (preto sobre amarelo) |
| c07 | 4.9–5.6 s | 0.7 s | — (tipografia) | centralizado | — | PEÇAS | slideLeft · seca | corte | — | tema (amarelo sobre preto) |
| c08 | 5.6–6.4 s | 0.8 s | — (tipografia) | centralizado | — | NOVAS | maskLeft · seca | zoomThrough | — | tema (preto sobre amarelo) |
| c09 | 6.4–7.1 s | 0.7 s | — (tipografia) | centralizado | — | LOJA | popIn · seca | corte | — | marca (amarelo sobre preto) |
| c10 | 7.1–8.1 s | 1.0 s | — (tipografia) | centralizado | — | EXEMPLO | scaleIn · seca | whip (cima) | — | marca (preto sobre amarelo) |
| c11 | 8.1–9.0 s | 0.9 s | — (tipografia) | centralizado | — | VISITE | slideLeft · seca | corte | — | CTA (amarelo sobre preto) |
| c12 | 9.0–10.0 s | 1.0 s | — (tipografia) | centralizado | — | A LOJA | maskLeft · seca | corte | — | CTA (preto sobre amarelo) |

## Vitrine — elegante / premium (lento · centralizado · limpa · cinematografica)

| # | Duração | Texto | Animação | Transição |
|---|---|---|---|---|
| p01 | 2,5 s | CHEGOU + fio metálico | blurIn · cinematografica | dissolve |
| p02 | 2,5 s | A COLEÇÃO DE VERÃO + fio + "cores leves · peças novas" | blurIn, maskLeft, fade | dissolve |
| p03 | 2,5 s | LOJA EXEMPLO entre dois fios | maskUp | dissolve |
| p04 | 2,5 s | VISITE A LOJA + fio | fade | — |

## Vitrine — colagem / recorte (médio · assimétrico · recortada · degraus)

| # | Duração | Peças (papel recortado) | Animação | Transição |
|---|---|---|---|---|
| k01 | 1,5 s | "Chegou!" (rasgado) + círculo + selo "novo" | popIn · degraus, escalonado | corte |
| k02 | 2,0 s | "a coleção" + "de verão" (rasgado) + faixa | slideRight/slideLeft | wipe (direita) |
| k03 | 1,5 s | círculo + "cores" + "leves" | popIn | corte |
| k04 | 1,5 s | "peças" + "novas" + faixa | slideRight/slideLeft | wipe (cima) |
| k05 | 1,5 s | "Loja" + "Exemplo" | popIn | corte |
| k06 | 2,0 s | "Visite" + "a loja" + seta | slideRight/popIn | — |
