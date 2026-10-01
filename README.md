# Reels Engine IA

Ambiente open source para produzir **Instagram Reels** (1080×1920 · 9:16 · 30 fps) a partir de um briefing e dos seus assets, com [Remotion](https://www.remotion.dev/) (React + TypeScript) e render local. Compatível com Claude (Cowork e Claude Code): as regras de produção ficam em `CLAUDE.md` e `docs/`, e cada vídeo vive numa pasta própria em `projects/<slug>/`.

[![Testes](https://github.com/BRIANICK-dev/reels-engine-ia/actions/workflows/testes.yml/badge.svg)](https://github.com/BRIANICK-dev/reels-engine-ia/actions/workflows/testes.yml)

## Manuais

Para quem não programa, os dois manuais explicam tudo passo a passo:

| Manual | Ler online | Na pasta baixada |
|---|---|---|
| **Implantação** — do zero ao primeiro teste: Node 24, download, terminal, Cowork ou Claude Code, Agente de Render, "Deu erro?" | [abrir](https://brianick-dev.github.io/reels-engine-ia/implantacao.html) | `manuais/implantacao.html` |
| **Uso** — do briefing ao MP4: pastas e slug, Briefing Rápido, linguagens visuais, gates, ajustes e versões | [abrir](https://brianick-dev.github.io/reels-engine-ia/uso.html) | `manuais/uso.html` |

A versão online acompanha sempre a versão mais nova do motor. Se você tem uma versão anterior instalada, abra o manual que veio na sua pasta (dois cliques no arquivo; funciona offline).

## Baixar

- **Sem programar:** botão verde **Code** → **Download ZIP** (ou o ZIP da versão em [Releases](https://github.com/BRIANICK-dev/reels-engine-ia/releases)). Depois siga o [Manual de Implantação](https://brianick-dev.github.io/reels-engine-ia/implantacao.html).
- **Com git:** `git clone https://github.com/BRIANICK-dev/reels-engine-ia.git`

## Requisitos

- **Node.js 24** (veja `.nvmrc`). Versões mais novas também funcionam; a 24 é a versão testada.
- Windows, macOS ou Linux. O **Agente de Render** (render disparado pelo Claude sem terminal) é **só para Windows**; no macOS e no Linux o render final é feito pelo terminal.

## Uso rápido

```bash
npm ci                                                         # 1ª vez (instala as versões exatas do lock)
npm run new -- loja-exemplo-promo-natal --cliente "Loja Exemplo" --projeto "Promo Natal" --duracao 30
# responda as 8 perguntas de projects/loja-exemplo-promo-natal/briefing.md (ou descreva o vídeo no chat)
# coloque a mídia em projects/loja-exemplo-promo-natal/assets/
npm run status -- loja-exemplo-promo-natal                     # etapa atual e próxima ação
npm run studio -- loja-exemplo-promo-natal                     # preview no Remotion Studio
npm run render -- loja-exemplo-promo-natal                     # → renders/loja-exemplo_promo-natal_v01.mp4
```

Nenhuma versão é sobrescrita: cada render final vira `v01`, `v02`...

## Vídeos que não parecem todos iguais

Cada vídeo escolhe uma **linguagem visual** de um catálogo de 10 (`npm run linguagens`): tipografia cinética, elegante/premium, colagem, interface/tech, retrô, pop e outras. Cada linguagem define ritmo de corte, layout, textura e uma **personalidade de movimento** (suave, elástica, seca, cinematográfica, mecânica ou quadro a quadro), com entradas e transições próprias. O motor pede um motivo quando o mesmo cliente repete a linguagem das últimas produções. Veja `docs/14-LINGUAGENS-VISUAIS.md` e o projeto `projects/exemplo-loja-promo/`, que faz o mesmo roteiro em três linguagens.

## Pastas

| Pasta / arquivo | Função |
|---|---|
| `CLAUDE.md` | Instruções centrais para o Claude (arquitetura, comandos, regras) |
| `docs/` | Conhecimento permanente e regras de produção |
| `engine/` | Biblioteca reutilizável de componentes. Não renderiza vídeos |
| `projects/` | Um diretório independente por vídeo. `_MOLDE/` é o molde |
| `clients/` | DNA de clientes recorrentes (molde: `_MOLDE-DNA-DE-CLIENTE.md`) |
| `local.exemplo/` | Molde da camada local: copie para `local/` e personalize |
| `local/` | **Suas** regras e configurações (fora do Git). Prevalecem sobre o núcleo em preferências, sem alterar as travas |
| `scripts/` | Automação: criar projeto, preview, render versionado, estado de produção (`status`), `assets`, `preflight`, `inspect`, `archive`, camada local, verificação pública e Agente de Render |
| `VERSION` | Versão do motor (semver) |

## Personalize sem mexer no motor

Suas preferências (estilo, fluxo, modo padrão, regras sobre clientes) ficam em `local/`, fora do Git, e nunca são apagadas quando o motor é atualizado:

1. Copie `local.exemplo/` para `local/`.
2. Edite `local/REGRAS.md`.
3. Opcional: crie linguagens visuais próprias em `local/linguagens.json`.
4. Confira com `npm run local:check`.

A camada local prevalece sobre o núcleo em preferências, mas **não** altera quatro travas: a aprovação no Studio (GATE 3), a autorização do render (GATE 4), a regra de não inventar fatos comerciais e a regra de nunca sobrescrever versões. Detalhes em `local.exemplo/README.md`.

## Agente de Render (Windows)

Dê dois cliques em `INSTALAR-AGENTE-DE-RENDER.cmd` uma única vez. A partir daí, renders aprovados no chat com o Claude aparecem sozinhos em `projects/<slug>/renders/`, sem terminal. Detalhes em `docs/12-AUTOMACAO.md`.

## O que vai para o Git

O repositório guarda o **motor**: código, configuração, documentação e moldes. Seus projetos, clientes e a camada local ficam fora do Git por padrão (veja `.gitignore`). Para versionar os seus vídeos, use um repositório **privado** seu. Mídia (`assets/`, `renders/`) fica só no computador: faça backup e registre a origem em `manifesto-de-assets.md`.

**Mídia no repositório.** Nenhum vídeo, música, imagem, logo ou render é versionado. A única exceção é a **fonte de licença livre (OFL) do projeto de exemplo**, versionada com o arquivo da licença ao lado para que o exemplo renderize logo depois do clone. `npm run verificar-publico` confere isso (e procura os termos de `local/termos-proibidos.txt`) antes de você publicar um fork.

## Licenças e direitos

- **Reels Engine IA:** licença MIT (veja `LICENSE`).
- **Remotion:** tem licença própria (não é MIT). **Resumo**, conferido em 30/09/2026, que não substitui a licença: o uso é gratuito para pessoas físicas, empresas com fins lucrativos de até 3 funcionários, organizações sem fins lucrativos e para avaliação; empresas acima desse limite precisam comprar uma licença de empresa. Leia a [licença oficial da Remotion](https://www.remotion.dev/license) — em caso de dúvida, vale o texto oficial.
- **Músicas, fontes, imagens e vídeos** que você usar nos seus projetos têm licenças próprias (a fonte do projeto de exemplo é OFL; a licença acompanha o arquivo). A ferramenta não concede nenhum direito sobre eles: confirme que você pode usá-los antes de publicar.

"Claude" é marca da Anthropic. O Reels Engine IA é um projeto independente, compatível com Claude.
