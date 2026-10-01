# Camada local — molde

A pasta `local/` guarda **as suas** regras e configurações: o jeito como você trabalha, seus clientes, seu modo preferido, a lista de termos que nunca podem ser publicados. Ela fica **fora do Git** e é separada do núcleo (`CLAUDE.md`, `docs/`, `scripts/`), para que atualizar o motor nunca apague as suas personalizações.

Esta pasta (`local.exemplo/`) é só o **molde** e vai para o Git. Não escreva nada seu aqui.

## Como ativar

1. Copie a pasta `local.exemplo` inteira e renomeie a cópia para `local` (na raiz do repositório, ao lado do `CLAUDE.md`).
2. Edite `local/REGRAS.md` com as suas preferências.
3. Se usar o Agente de Render, liste em `local/config.json` os projetos entregues que não podem ganhar nova versão por engano.
4. Se for publicar o motor ou um fork, liste em `local/termos-proibidos.txt` o que nunca pode aparecer num repositório público.
5. Confira com `npm run local:check`.

## Arquivos

| Arquivo | Quem lê | Para quê |
|---|---|---|
| `REGRAS.md` | Claude, antes de qualquer trabalho | Preferências: estilo, fluxo, modo padrão, clientes, entrega |
| `config.json` | Os scripts | Só o que algum script usa. Hoje: `agente.projetosProtegidos` |
| `termos-proibidos.txt` | `npm run verificar-publico` | Termos que nunca podem ir para um repositório público |
| `linguagens.json` | Os scripts e o Claude | Linguagens visuais próprias, com os mesmos campos do núcleo (modelo em `docs/14-LINGUAGENS-VISUAIS.md`). Vem vazio |

Pode criar outros arquivos `.md` em `local/` (por exemplo, um por assunto): o Claude lê todos.

## O que a camada local pode e não pode mudar

**Pode (prevalece sobre o núcleo):** preferências de estilo, ritmo e linguagem; linguagens visuais próprias; fluxo de trabalho e modo padrão (DIRETOR ou PRODUÇÃO); regras sobre clientes; formato das entregas e dos relatórios.

**Não pode (travas do núcleo):**

1. **GATE 3 (Studio)**: o vídeo é sempre aprovado por você no Studio antes do render.
2. **GATE 4 (Render)**: o render final só acontece com a sua autorização.
3. **Não inventar fatos** comerciais ou factuais: preços, datas, descontos, estatísticas, depoimentos.
4. **Nunca sobrescrever versões**: cada render final é uma versão nova (v01, v02...).

Se o `config.json` tiver um campo que tente mexer nisso, os comandos param com um erro claro até o campo ser removido. Se o `REGRAS.md` pedir algo assim, o Claude segue o núcleo e avisa.
