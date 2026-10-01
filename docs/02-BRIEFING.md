# BRIEFING

Dois modelos, com o mesmo destino: `projects/<slug>/briefing.md`.

| Modelo | Para quem | Quando |
|---|---|---|
| **Briefing Rápido** (8 perguntas) | Qualquer pessoa, sem vocabulário técnico | Padrão. Já vem no `briefing.md` de todo projeto novo |
| **Briefing Completo** | Quem já sabe o que quer em detalhe (agência, marca com manual) | Quando o vídeo tem muitas exigências de texto, identidade ou áudio |

O usuário pode também **descrever o vídeo no chat**: o Claude registra as respostas no `briefing.md`. Enquanto o `briefing.md` estiver igual ao molde, o projeto não sai de `00_BRIEFING` (mensagem: "o briefing ainda está vazio — responda as 8 perguntas no arquivo ou descreva o vídeo no chat").

## Briefing Rápido (8 perguntas)

1. **O que é o vídeo e para quem?** (produto, serviço ou evento — e quem deve assistir)
2. **O que a pessoa deve fazer depois de assistir?** (ex.: chamar no WhatsApp, visitar a loja, comprar no site)
3. **Qual é a mensagem principal, em uma frase?**
4. **Quantos segundos?** (Reels costuma ter entre 15 e 60)
5. **Textos obrigatórios e fatos** (preços, datas, condições), escritos exatamente como devem aparecer — e o que NÃO pode aparecer ou ser dito.
6. **Que material você tem e o que falta?** Vídeos, fotos, logo, fontes, música, narração. Coloque os arquivos em `projects/<slug>/assets/`.
7. **Tom e referências** (links ou descrição). Não sabe a linguagem visual? Deixe "automático": o Claude propõe 2–3 opções.
8. **Quer aprovar cada etapa antes (recomendado) ou prefere que o Claude faça direto e mostre o resultado?**

### Como o Claude interpreta as respostas

| Resposta | Vira |
|---|---|
| 1, 2, 3 | Objetivo, público, CTA e mensagem do conceito |
| 4 | `durationSeconds` no `project.json` |
| 5 | Textos e fatos **exatos**. Nunca completar nem "melhorar" fato comercial; na falta, perguntar. O que não pode aparecer entra em Restrições |
| 6 | Inventário de assets (`04_ASSETS`) e o que pedir ao usuário |
| 7 | Tom e linguagem visual (`docs/14-LINGUAGENS-VISUAIS.md`). "Automático" = propor 2–3 caminhos com linguagens diferentes no GATE 1 |
| 8 | "Aprovar cada etapa" (ou sem resposta) = **MODO DIRETOR**. "Fazer direto" = **MODO PRODUÇÃO** com autorização para executar: GATE 1 e GATE 2 podem ser dispensados com o motivo registrado. **GATE 3 (Studio) e GATE 4 (Render) valem sempre** |

Resposta curta é resposta válida. O Claude pergunta só o que for essencial e faltar (ex.: duração, um fato da pergunta 5); o resto é escolha criativa segura, informada ao usuário.

## Briefing Completo

Use este modelo quando precisar de mais detalhe. Os campos que não se aplicam podem ficar em branco.

### Identificação

CLIENTE: {{CLIENTE}}

SEGMENTO: {{SEGMENTO}}

PROJETO: {{NOME_DO_PROJETO}}

SLUG: {{SLUG}} (minúsculas e hífens — pasta projects/<slug>/)

CAMPANHA: {{CAMPANHA}}

### Objetivo

OBJETIVO: {{OBJETIVO}}

AÇÃO DESEJADA: {{AÇÃO_DESEJADA}}

PÚBLICO: {{PÚBLICO}}

DURAÇÃO: {{DURAÇÃO}} segundos

### Conceito

TEMA: {{TEMA}}

IDEIA PRINCIPAL: {{IDEIA_PRINCIPAL}}

MENSAGEM: {{MENSAGEM}}

TOM: {{TOM}}

SENSAÇÃO: {{SENSAÇÃO}}

### Formato

TIPO: {{TIPO_DE_VIDEO}}

COMPLEXIDADE: {{COMPLEXIDADE}}

RITMO: {{RITMO}}

LINGUAGEM VISUAL: {{LINGUAGEM}} (id do catálogo — `npm run linguagens` — ou "automático")

### Texto

HEADLINE: {{HEADLINE}}

SUBHEADLINE: {{SUBHEADLINE}}

TEXTOS OBRIGATÓRIOS: {{TEXTOS_OBRIGATÓRIOS}}

CTA: {{CTA}}

### Assets

VÍDEOS: {{VÍDEOS}}

FOTOS: {{FOTOS}}

LOGO: {{LOGO}}

OUTROS: {{OUTROS_ASSETS}}

(Os arquivos vão em `projects/<slug>/assets/`.)

### Áudio

NARRAÇÃO: SIM / NÃO

TEXTO DA NARRAÇÃO: {{NARRAÇÃO}}

MÚSICA: ROYALTY-FREE / FORNECIDA / OUTRA

EFEITOS SONOROS: SIM / NÃO

### Legendas

LEGENDAS: SIM / NÃO

ESTILO: {{ESTILO_LEGENDA}}

DESTAQUE_DE_PALAVRAS: SIM / NÃO

### Identidade

CORES: {{CORES}}

TIPOGRAFIA: {{TIPOGRAFIA}}

ESTILO_VISUAL: {{ESTILO_VISUAL}}

### Referência

REFERÊNCIA: {{REFERÊNCIA}}

### Restrições

NÃO FAZER: {{RESTRIÇÕES}}

NÃO PODE APARECER OU SER DITO: {{PROIBIDO}}

### Execução

MODO: DIRETOR / PRODUÇÃO

AUTORIZAÇÃO PARA EXECUTAR: SIM / NÃO
