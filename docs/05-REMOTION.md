# REMOTION E JAVASCRIPT

## Tecnologia principal

Remotion + React + TypeScript, com render **local** no computador do usuário (Node + Remotion CLI).

## Arquitetura

| Camada | Local | Papel |
|---|---|---|
| Ambiente de execução | raiz: `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json` | Uma instalação para todos os projetos |
| Biblioteca | `engine/src/` | Componentes reutilizáveis, sem nenhum dado de cliente |
| Projeto | `projects/<slug>/` | Código, assets, duração e renders de um vídeo |

Cada projeto recebe uma **cópia congelada** do engine em `src/engine/` no momento da criação.

## Estrutura de um projeto

```
projects/<slug>/
├── project.json          slug, cliente, projeto, durationSeconds, engineVersion
├── briefing.md · storyboard.md · manifesto-de-assets.md · versoes.md
├── assets/               pasta pública (staticFile)
├── referencias/
├── renders/
└── src/
    ├── index.ts          registerRoot (entry point)
    ├── Root.tsx          <Composition id="Main"> — id fixo
    ├── timeline.ts       SCENES (espelha o storyboard)
    ├── compositions/Main.tsx
    ├── scenes/           uma cena por arquivo (criar quando necessário)
    ├── components/       componentes próprios do projeto
    ├── animations/ · audio/ · utils/ · styles/   (quando necessário)
    └── engine/           cópia do engine — NÃO editar para o vídeo
```

## Comandos

```bash
npm ci                                          # instalar (1ª vez)
npm run new -- <slug> --cliente "X" --projeto "Y" --duracao 30
npm run studio -- <slug>                        # preview
npm run render -- <slug> --dry-run              # simulação
npm run render -- <slug>                        # render versionado
npm run render -- <slug> --draft                # rascunho (renders/_rascunhos/)
npm run typecheck
```

Os scripts rodam o Remotion a partir da raiz, com o entry `projects/<slug>/src/index.ts` e `--public-dir=projects/<slug>/assets`.

## Assets

- `staticFile('foto.jpg')` resolve para `projects/<slug>/assets/foto.jpg`. Subpastas funcionam: `staticFile('video/abertura.mp4')`.
- Não inventar caminhos. Antes de usar um asset, confirmar que ele existe.
- Nomes de arquivo sem espaços nem acentos, de preferência (`abertura-produto-01.mp4`).
- Fontes da marca: coloque os arquivos em `assets/fonts/` e carregue com `useFonts()` do engine (ou `loadFonts()`), que usa `FontFace` e segura o render com `delayRender`/`continueRender` até a fonte carregar. Use o nome com `fontCss()` (entre aspas). **Não dependa de fontes de sistema em vídeos reais**: elas variam entre computadores (ex.: Segoe UI no Windows, outra fonte em outra máquina) e mudam largura e quebra dos textos. Se for usar `@remotion/fonts`, adicione o pacote na mesma versão exata do Remotion, seguindo a política de dependências abaixo.

## Duração

- `durationSeconds` em `project.json` é a duração do briefing.
- `SCENES` em `src/timeline.ts` é o storyboard. A soma precisa ser igual à duração, senão o Studio e o render acusam erro.
- Use `getSceneTimings(SCENES, FORMAT.fps)` para obter `from` e `durationInFrames` de cada `<Sequence>`.
- Use durações múltiplas de 1/30 s para evitar arredondamento de frames.

## Duração da composição × duração de uma `<Sequence>`

Dentro de uma `<Sequence>`, o Remotion **reescreve o contexto**:

| Chamada | Fora de uma Sequence | Dentro de uma Sequence |
|---|---|---|
| `useCurrentFrame()` | frame global (0 → total−1) | frame **local**: 0 no início da Sequence |
| `useVideoConfig().durationInFrames` | duração **total** da composição | duração **da Sequence** |
| `useVideoConfig().width/height/fps` | da composição | da composição (salvo se a Sequence definir width/height) |

Consequências e regra do projeto:

1. **Obtenha a duração total no nível da composição** (`compositions/Main.tsx`), onde `useVideoConfig()` ainda devolve o total, e **passe-a explicitamente como prop `totalFrames`** para cenas e componentes que precisem dela (barra de progresso, deriva de fundo contínua, HUD, fade global).
2. Componentes que precisam do **frame global** recebem `sequenceFrom` (o `from` da Sequence) e somam: `frameGlobal = useCurrentFrame() + sequenceFrom`.
3. Nunca use `useVideoConfig().durationInFrames` dentro de uma cena para calcular algo "até o fim do vídeo": o resultado seria o fim **da cena**.
4. Efeitos globais (fade-out final, música de fundo, overlay de safe area) ficam **fora** das Sequences, em `Main.tsx`.
5. Transições sobrepostas: a cena que sai pode ter `durationInFrames = cena + TRANSITION_FRAMES`; isso **não** altera a soma de `SCENES` (a duração do vídeo continua vindo do briefing).

## Tipografia e safe area

- Todo texto fica dentro de um container com `safePadding(zona)`: **critical** para headline, CTA e informação essencial; **safe** para o restante.
- Texto com `whiteSpace: 'nowrap'` e tamanho fixo **pode estourar a zona**: uma palavra de 10 letras em caixa alta a 144 px bold passa de 900 px, e a critical tem 810 px de largura (invade a coluna de ações do Instagram).
- Regra: títulos grandes usam `fitFontSize()` do engine, com `maxWidth: safeBox('critical').width`, passando as linhas exatamente como serão exibidas. O tamanho do design vira o **máximo**, não um valor fixo.
- Se `fitFontSize` avisar que nem o mínimo coube, o texto precisa ser reescrito ou quebrado em mais linhas; não reduza a margem.
- Com fontes de arquivo, meça **depois** de carregar a fonte.
- Valide no Studio com `showSafeArea` ligado, inclusive nos frames de entrada e saída das animações (o texto pode passar pela borda da zona em movimento, mas deve **assentar** dentro dela).

## Componentização

- Componentes pequenos e de uma responsabilidade só; nada de um componente gigante.
- Constantes centralizadas (cores e tipografia do cliente em `src/styles/` ou `src/constants.ts`).
- Uma cena por arquivo em `src/scenes/`.
- Nomes claros e timeline legível.
- Componente que se provar útil → promover para o engine (`engine/COMPONENTES.md`).

## Render e versões

| Item | Padrão |
|---|---|
| Formato | 1080×1920 · 9:16 · 30 fps |
| Codec | H.264 · MP4 · CRF 18 |
| Cor | `yuv420p` · faixa limitada (`tv`) · BT.709 (matriz, primárias e transferência) |
| Destino | `projects/<slug>/renders/` |
| Nome | `<cliente>_<projeto>_v01.mp4` (gerado a partir do `project.json`) |
| Sobrescrita | **Proibida**: próxima versão livre automática; `--version vNN` aborta se existir |
| Rascunhos | `--draft`, `--frames` ou `--scale` → `renders/_rascunhos/` (fora da contagem de versões) |
| Registro | Cada versão final é anotada em `versoes.md` |

Flags bloqueadas no render: `--output`, `--overwrite`, `--public-dir`, `--codec`, `--fps`, `--width`, `--height`, `--pixel-format`, `--color-space`.

### Espaço de cor

O Remotion captura os frames como JPEG, que é **faixa completa (0–255) em BT.601**. Sem configuração explícita, o MP4 sai como `yuvj420p`, `color_range=pc`, `color_space=bt470bg`. Isso é tecnicamente válido, mas players, editores e plataformas que ignoram a flag de faixa mostram **pretos lavados ou contraste estourado**.

Por isso o `remotion.config.ts` define `Config.setColorSpace('bt709')`. A saída passa a ser `yuv420p`, `color_range=tv`, `bt709` em matriz, primárias e transferência: o padrão de vídeo HD que o Instagram e os players móveis esperam. Não altere isso por projeto.

Conferência com ffprobe (o Remotion já traz o binário):

```bash
npx remotion ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,pix_fmt,color_range,color_space,color_transfer,color_primaries,width,height,r_frame_rate,duration -of default=nw=1 projects/<slug>/renders/<arquivo>.mp4
```

Esperado:

- `codec_name=h264`
- `pix_fmt=yuv420p`
- `color_range=tv`
- `color_space=bt709`, `color_transfer=bt709`, `color_primaries=bt709`
- `width=1080`, `height=1920`
- `r_frame_rate=30/1`
- `duration` igual a `durationSeconds`

## Validação técnica

Antes do render final, verificar:

- `npm run typecheck` sem erros;
- `npm run render -- <slug> --dry-run` com nome e versão corretos;
- depois do render: `ffprobe` conforme a seção Espaço de cor;
- no Studio: assets carregando, duração correta, `showSafeArea` conferido e depois **desligado**;
- áudio presente e com volume correto;
- textos revisados contra o briefing;
- conferência final em `docs/10-CONFERENCIA-FINAL.md`.

## Armadilhas conhecidas

Problemas reais já encontrados nesta versão do Remotion (raiz de composição que some no Studio, `document.fonts` no TypeScript, nome de fonte com número sem aspas, faixas em degradês escuros depois da recompressão): `docs/13-ARMADILHAS-REMOTION.md`. Leia antes de implementar a primeira cena de um projeto.

## Dependências

- Versões **exatas** no `package.json`: nada de `^`, `~` ou `latest`.
- `remotion` e todos os `@remotion/*` sempre na **mesma versão**.
- Sempre instalar com `npm ci`. O `package-lock.json` é versionado.

Procedimento de atualização, só quando houver motivo:

1. Trocar a versão de **todos** os pacotes `remotion`/`@remotion/*` no `package.json` para o mesmo número.
2. `npm install` para atualizar o lock.
3. `npm run typecheck`.
4. Rascunho de um projeto de teste (`--draft --frames=0-60`) e conferência.
5. Versionar `package.json` e `package-lock.json` juntos.

Atenção: a atualização afeta todos os projetos, inclusive os antigos. Projetos com versões aprovadas devem ser re-testados antes de um novo render.
