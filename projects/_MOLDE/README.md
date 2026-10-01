# PROJETO — {{SLUG}}

Cliente: {{CLIENTE}}
Projeto: {{PROJETO}}

> Não copie esta pasta à mão. Crie projetos com:
> `npm run new -- <slug> --cliente "<cliente>" --projeto "<projeto>"`

## Estrutura

> A coluna "Git" vale para quem versiona os próprios projetos num repositório privado.
> No repositório público do Reels Engine IA, a pasta `projects/` fica fora do Git (exceto o molde e o exemplo).

| Caminho | Conteúdo | Git |
|---|---|---|
| `project.json` | Slug, cliente, projeto, duração (briefing), linguagem visual (GATE 1), versão do engine | Sim |
| `project-status.json` | Estado de produção: etapa, gates, bloqueios, próxima ação (criado pelo `npm run new`) | Sim |
| `briefing.md` | Briefing do vídeo (Briefing Rápido: 8 perguntas) | Sim |
| `storyboard.md` | Storyboard cena a cena | Sim |
| `manifesto-de-assets.md` | Inventário dos assets (nome, tipo, resolução, origem, backup) | Sim |
| `versoes.md` | Registro de renders (preenchido pelo `npm run render`) | Sim |
| `src/` | Código Remotion do vídeo | Sim |
| `src/engine/` | Cópia congelada do engine no momento da criação | Sim |
| `assets/` | Fotos, vídeos, áudio, logos, fontes deste projeto | **Não** (só local) |
| `referencias/` | Referências visuais (mídia fica local; `.md` vai para o Git) | Só `.md` |
| `renders/` | MP4 finais `cliente_projeto_v01.mp4` | **Não** (só local) |

## Comandos (rodar na raiz do repositório)

```
npm run status -- {{SLUG}}          # etapa atual, gates e próxima ação
npm run assets -- {{SLUG}}          # ficha técnica dos arquivos de assets/
npm run preflight -- {{SLUG}}       # verificação técnica completa
npm run studio -- {{SLUG}}          # preview no Remotion Studio
npm run render -- {{SLUG}} --dry-run  # mostra o que seria renderizado
npm run render -- {{SLUG}}          # renderiza a próxima versão livre (valida e registra o MP4)
npm run inspect -- {{SLUG}}         # valida de novo o MP4 final
```

## Por onde começar

1. Responda as 8 perguntas de `briefing.md` (ou descreva o vídeo no chat).
2. Coloque os arquivos em `assets/`.
3. `npm run status -- {{SLUG}}` mostra a etapa e o que falta.

Referência de implementação (linguagem visual, presets, hook, CTA, fontes): `projects/exemplo-loja-promo/` e `docs/14-LINGUAGENS-VISUAIS.md`.

## Assets

Use sempre `staticFile('nome-do-arquivo.ext')` — o caminho é relativo a `assets/` deste projeto.
Nunca referencie arquivos de outro projeto nem caminhos absolutos.
