# BRIEFING — exemplo-loja-promo

> **Briefing Rápido.** Responda as 8 perguntas abaixo, do seu jeito (frases curtas bastam),
> ou descreva o vídeo no chat e o Claude registra aqui. Quer detalhar mais?
> O Briefing Completo está em `docs/02-BRIEFING.md`.

CLIENTE: Loja Exemplo

PROJETO: Promo

## 1. O que é o vídeo e para quem?

(produto, serviço ou evento — e quem deve assistir)

Promoção fictícia da coleção de verão da "Loja Exemplo" (uma loja de roupas inventada), para quem segue a loja no Instagram.

## 2. O que a pessoa deve fazer depois de assistir?

(ex.: chamar no WhatsApp, visitar a loja, comprar no site, seguir o perfil)

Visitar a loja.

## 3. Qual é a mensagem principal, em uma frase?

Chegou a coleção de verão: cores leves, peças novas.

## 4. Quantos segundos?

(Reels costuma ter entre 15 e 60 segundos)

10 segundos.

## 5. Textos obrigatórios e fatos

Preços, datas e condições, escritos exatamente como devem aparecer — e o que NÃO pode aparecer ou ser dito.

Textos: "Chegou", "a coleção de verão", "cores leves", "peças novas", "Loja Exemplo", "Visite a loja". Sem preços, datas ou condições: nada disso pode aparecer.

## 6. Que material você tem e o que falta?

Vídeos, fotos, logo, fontes, música, narração. Coloque os arquivos em `projects/exemplo-loja-promo/assets/`.

Só a fonte Inter (licença OFL, em assets/fonts/, com o OFL.txt). Sem fotos, vídeos ou música: tudo é tipografia e grafismo em código.

## 7. Tom e referências

Links ou descrição. Não sabe a linguagem visual? Deixe "automático": o Claude propõe 2–3 opções.

Automático. Este exemplo mostra o MESMO roteiro em três linguagens: tipografia-cinetica (composição Main), elegante-premium e colagem-recorte (composições Vitrine-<linguagem>).

## 8. Quer aprovar cada etapa antes (recomendado) ou prefere que o Claude faça direto e mostre o resultado?

Aprovar cada etapa (MODO DIRETOR).

<!--
Para o Claude:
- Resposta 8 "aprovar cada etapa" (ou em branco) = MODO DIRETOR.
  "Fazer direto" = MODO PRODUÇÃO com autorização para executar: GATE 1 e GATE 2 podem ser
  dispensados com o motivo registrado. GATE 3 (Studio) e GATE 4 (Render) valem sempre.
- Resposta 7 "automático" = propor 2–3 caminhos com linguagens diferentes no GATE 1
  (docs/14-LINGUAGENS-VISUAIS.md).
- A duração da resposta 4 vai para "durationSeconds" em project.json.
- Nunca invente fatos da resposta 5: na falta, pergunte.
-->
