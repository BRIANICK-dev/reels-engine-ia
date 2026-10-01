# BRIEFING — {{SLUG}}

> **Briefing Rápido.** Responda as 8 perguntas abaixo, do seu jeito (frases curtas bastam),
> ou descreva o vídeo no chat e o Claude registra aqui. Quer detalhar mais?
> O Briefing Completo está em `docs/02-BRIEFING.md`.

CLIENTE: {{CLIENTE}}

PROJETO: {{PROJETO}}

## 1. O que é o vídeo e para quem?

(produto, serviço ou evento — e quem deve assistir)

___

## 2. O que a pessoa deve fazer depois de assistir?

(ex.: chamar no WhatsApp, visitar a loja, comprar no site, seguir o perfil)

___

## 3. Qual é a mensagem principal, em uma frase?

___

## 4. Quantos segundos?

(Reels costuma ter entre 15 e 60 segundos)

___

## 5. Textos obrigatórios e fatos

Preços, datas e condições, escritos exatamente como devem aparecer — e o que NÃO pode aparecer ou ser dito.

___

## 6. Que material você tem e o que falta?

Vídeos, fotos, logo, fontes, música, narração. Coloque os arquivos em `projects/{{SLUG}}/assets/`.

___

## 7. Tom e referências

Links ou descrição. Não sabe a linguagem visual? Deixe "automático": o Claude propõe 2–3 opções.

___

## 8. Quer aprovar cada etapa antes (recomendado) ou prefere que o Claude faça direto e mostre o resultado?

___

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
