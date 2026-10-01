# DNA DE CLIENTE: GUIA DE USO

O DNA de cliente reúne o que vale para **todos os vídeos** de um cliente recorrente: identidade, linguagem, CTAs e informações factuais estáveis.

- **Molde (fonte única):** `clients/_MOLDE-DNA-DE-CLIENTE.md`
- **Fichas:** `clients/<slug-do-cliente>.md` (ex.: `clients/loja-exemplo.md`)

Este documento explica **como usar** o DNA. Os campos ficam só no molde.

## Quando criar

- Cliente com mais de um vídeo previsto.
- Quando o usuário fornecer ou aprovar informações de identidade (cores, tipografia, tom, CTAs).

Não criar o DNA a partir de suposições. Campo sem informação confirmada fica em branco ou marcado como "a confirmar".

## Como criar

1. Copiar `clients/_MOLDE-DNA-DE-CLIENTE.md` para `clients/<slug-do-cliente>.md`.
2. Preencher apenas com informações fornecidas ou aprovadas pelo usuário.
3. Registrar a data da última revisão.

## Precedência

1. **Briefing do vídeo:** manda sempre.
2. **DNA do cliente:** vale quando o briefing não especifica.
3. **Camada local (`local/REGRAS.md`), regras gerais sobre clientes:** vale quando nem o briefing nem o DNA especificam.
4. **Docs gerais (`docs/`):** padrão da ferramenta.

Nenhum desses níveis muda as travas do núcleo (GATE 3, GATE 4, não inventar fatos, nunca sobrescrever versões).

Se o briefing contrariar o DNA, seguir o briefing e perguntar se o DNA deve ser atualizado.

## Informações factuais

Preços, horários, condições e regras mudam com o tempo. No DNA, elas servem só de **referência**. Antes de usar num vídeo, confirmar com o usuário se ainda valem, principalmente em vídeos de oferta.

## Assets recorrentes

Logos e fontes do cliente são listados no DNA, mas os arquivos são copiados para `projects/<slug>/assets/` de cada vídeo. Não existe pasta de assets compartilhada entre projetos.

## Linguagens visuais

O DNA pode indicar linguagens que combinam (ou não) com o cliente, mas não fixa uma linguagem para sempre: repetir a mesma linguagem nas últimas produções do mesmo cliente exige motivo no GATE 1 (`docs/14-LINGUAGENS-VISUAIS.md`). Para ver o histórico: `npm run linguagens -- --cliente "<Cliente>"`.

## Manutenção

Ao fim de um vídeo, se surgirem decisões que devem valer para os próximos (um CTA novo aprovado, uma expressão a evitar), propor a atualização do DNA ao usuário.
