# AUTOMAÇÃO

Ferramentas automáticas do Reels Engine IA: o que existe, o que cada uma verifica e onde se liga ao fluxo (`docs/09-FLUXO-DE-PRODUCAO.md`).

## Princípios

1. **Node puro, sem dependências novas.** Tudo usa o que já está instalado na raiz: TypeScript (devDependency) para ler o código e rodar o typecheck, e o **ffprobe/ffmpeg que vem com o Remotion** (`npx remotion ffprobe`) para mídia — o mesmo binário no Windows, macOS e Linux. Imagens são lidas pelo cabeçalho do arquivo.
2. **Somente leitura sobre a produção.** Nenhuma ferramenta altera código de vídeo, assets ou MP4. O único arquivo do projeto que elas escrevem é o `project-status.json` (e o `assets-report.json`, só com `--salvar`).
3. **O controller é o ponto de integração.** Preflight e validação pós-render são pré-condições de transição (`exitChecks()` em `scripts/status-lib.mjs`) e rodam de novo no `avancar`.
4. **Automatizar o objetivo; deixar ao humano o julgamento.** Ritmo, estética e sensação continuam nos gates.
5. **Projetos sem estado não mudam.** Sem `project-status.json`, os scripts de render fazem só o render simples; as ferramentas podem ler um projeto assim, mas nunca gravam nele.

## Mapa

| Ferramenta | Comando | Etapa | Estado |
|---|---|---|---|
| Production Controller | `npm run status` | todas | Pronto |
| Asset Intelligence (base) | `npm run assets -- <slug>` | `04_ASSETS` | Pronto |
| Preflight | `npm run preflight -- <slug>` | `06_VALIDATION`, `08_DRY_RUN` | Pronto |
| Validação pós-render | `npm run inspect -- <slug>` | `09_RENDER` | Pronto |
| Registro automático do render | (dentro do `npm run render`) | `09_RENDER` | Pronto |
| Archive | `npm run archive -- <slug> --destino <pasta>` | `10_FINAL` | Pronto |
| **Agente de Render** (só Windows) | `INSTALAR-AGENTE-DE-RENDER.cmd` (uma vez) · pedidos em `.reels-engine/pedidos/` | `09_RENDER` | Pronto |
| Linguagens visuais | `npm run linguagens` | `01_CONCEPT` | Pronto |
| Camada local (validação) | `npm run local:check` | todas (roda sozinha no início dos comandos) | Pronto |
| Verificação pública | `npm run verificar-publico` | antes de publicar o motor | Pronto |
| Manuais (HTML) | `npm run manuais` | ao mudar o motor ou os manuais | Pronto |
| Testes | `npm test` (no GitHub, a cada envio: `.github/workflows/testes.yml`) | — | Pronto |
| Contact Sheets | — | `04_ASSETS` | *Futuro* |
| Análise de conteúdo de vídeo | — | `04_ASSETS` | *Futuro* |

Arquivos: `scripts/media-lib.mjs` (leitura de mídia), `linguagens-lib.mjs` + `linguagens.mjs`, `local-config.mjs`, `verificar-publico.mjs`, `assets.mjs`, `preflight-lib.mjs` + `preflight.mjs`, `inspect-lib.mjs` + `inspect.mjs`, `render-hooks.mjs`, `archive.mjs`, `manuais.mjs`, testes em `scripts/tests/`.

## Asset Intelligence — `npm run assets -- <slug>`

Ficha técnica de cada arquivo em `projects/<slug>/assets/`:

| Campo | Fonte |
|---|---|
| nome (caminho usado no `staticFile`), extensão, tipo, tamanho | sistema de arquivos |
| dimensões, orientação, proporção (exata e a comum mais próxima, ±1%) | cabeçalho da imagem (PNG, JPEG com rotação EXIF, WebP, GIF, BMP, SVG) ou ffprobe |
| duração, fps, codec, trilha de áudio | ffprobe (vídeo/áudio) |

Também aponta, sem juízo criativo: arquivos fora do `manifesto-de-assets.md`, nomes com espaço/acento, arquivo vazio, mídia horizontal ou com menos de 1080 px no menor lado ("se usado em tela cheia"), fps diferente de 30, rotação nos metadados e arquivos ilegíveis.

Opções: `--markdown` imprime linhas no formato da tabela do manifesto (conteúdo, origem e uso ficam em branco — são decisões de Claude/usuário); `--json`; `--salvar` grava `assets-report.json` (só em projetos com estado).

## Preflight — `npm run preflight -- <slug>`

| Área | Verifica | Nível |
|---|---|---|
| estrutura | `project.json` (cliente/projeto), entry, `Root.tsx`, `timeline.ts`, `Main.tsx`, cópia do engine, `assets/`; docs do projeto | erro / aviso |
| duração | `durationSeconds` definido e múltiplo de 1/30 s | erro / aviso |
| formato | `FORMAT` da cópia do engine e `<Composition id="Main">`: 1080×1920 · 30 fps (literal ou `FORMAT.*`) | erro |
| timeline | `SCENES` avaliado de verdade: soma = duração, ids únicos, durações válidas | erro / aviso |
| assets | todo `staticFile('...')` e todo texto com caminho de mídia/fonte existe em `assets/`; `staticFile` dinâmico precisa casar com algum arquivo; caminhos absolutos, `..`, `\` ou prefixo `assets/` | erro |
| fontes | fonte local referenciada e presente; `FontFace` exige `delayRender` (ou `useFonts`/`loadFonts` do engine); `fontFamily` com nome numérico sem aspas (armadilha 3) | erro / aviso |
| linguagem | `linguagem` do `project.json` existe no catálogo; mostra ritmo, faixa de corte, movimento e transições | erro / ok |
| legibilidade | `fontSize` literal < 56; peso < 400 com `fontSize` < 80; par `color` × `background` literal com contraste < 4,5:1 (`docs/08-INSTAGRAM.md`) | aviso |
| degradês | degradê no código (`linear/radial/conic-gradient`) sem `<Grain>` por cima (armadilha 4) | aviso |
| áudio | áudio/vídeo referenciado é legível pelo ffprobe e tem a trilha esperada | erro |
| safe area | `showSafeArea: true` no código; `SAFE_AREA`/`safeBox` válidos; uso das zonas pelo código | erro / aviso |
| urls | nenhuma URL `http(s)://` no código do projeto (namespaces `w3.org` do SVG são permitidos) | erro |
| config | `remotion.config.ts` com H.264 · yuv420p · BT.709 · `setOverwriteOutput(false)` | erro |
| destino | próximo arquivo de render livre; coerência com a versão de trabalho | erro / aviso |
| typecheck | `tsc` só dos arquivos deste projeto (um erro em outro projeto não reprova este) | erro |

`--sem-typecheck` pula o `tsc` numa conferência rápida. **O `avancar` sempre roda o preflight completo.** O `--dry-run` de um projeto com estado inclui o preflight e sai com erro se ele reprovar.

Limites conhecidos: safe area é verificada pela estrutura do código, não pela imagem (a conferência visual continua no GATE 3); `staticFile(variável)` é coberto pelos literais de caminho do código, e `staticFile` com template só pode ser conferido por padrão.

## Validação pós-render — `npm run inspect -- <slug>`

| Item | Esperado |
|---|---|
| existência e destino | `projects/<slug>/renders/<cliente>_<projeto>_vNN.mp4` (nome gerado do `project.json`) |
| versão | a versão mais recente a partir da versão de trabalho; aviso se diferir do estado ou faltar em `versoes.md` |
| contêiner / codec | MP4 · h264 · yuv420p |
| cor | `color_range=tv` · `color_space=bt709` (primaries/transfer bt709: aviso) |
| resolução / fps | 1080×1920 · 30/1 |
| duração | `durationSeconds` ± 1 frame; nº de frames |
| áudio | trilha obrigatória se o código usa áudio; aac recomendado; áudio e vídeo com a mesma duração |
| tamanho | arquivo com menos de 1 KB = render incompleto; informa tamanho e bitrate |

`--version v02` valida uma versão específica. Substitui o comando ffprobe manual do checklist.

## Registro automático do render

Em projetos com estado, depois de um render **final** bem-sucedido, o `render.mjs` carrega `render-hooks.mjs`, roda a validação pós-render e registra `renders` e `lastRender` no estado. Garantias:

- roda **depois** do MP4 e do `versoes.md` estarem prontos, dentro de `try/catch`: uma falha vira só aviso e o render continua valendo;
- não muda a etapa, não aprova gates, não mexe no MP4;
- rascunhos (`--draft`, `--frames`, `--scale`) não são registrados;
- projetos sem `project-status.json` nem carregam o arquivo de ganchos.

## Archive — `npm run archive -- <slug> --destino "<pasta>"`

Cópia verificada de um projeto concluído para uma pasta de backup (Drive, HD externo):

- **só copia** — nunca move, renomeia ou apaga, nem na origem nem no destino;
- cria `<destino>/<slug>_<versão>_<data>/` e recusa se já existir;
- recusa destinos dentro do repositório;
- confere cada arquivo por SHA-256 e grava `ARCHIVE-MANIFEST.json` por último (sem manifesto = cópia incompleta);
- em projetos com estado exige `10_FINAL` e registra em `archives`; em projetos sem estado, faz a cópia sem gravar nada no projeto;
- `--dry-run` mostra o que seria copiado.

## Linguagens visuais — `npm run linguagens`

Catálogo em `engine/linguagens.json` (+ `local/linguagens.json`). Somente leitura.

- `npm run linguagens`: lista as linguagens com os 4 eixos;
- `npm run linguagens -- <id>`: detalhes (quando usar, faixa de corte, entradas, transições, tipografia, cor);
- `npm run linguagens -- --cliente "<Cliente>"`: linguagens das produções desse cliente, marcando as 3 últimas (as que exigem motivo para repetir).

A regra do GATE 1 (linguagem obrigatória na saída de `01_CONCEPT`, motivo para repetir a do mesmo cliente) fica no controller (`exitChecks()` em `scripts/status-lib.mjs`). O `npm run new` aceita `--linguagem <id>`.

## Camada local — `npm run local:check`

A pasta `local/` guarda as personalizações de quem usa a ferramenta. Fica **fora do Git**; o molde público é `local.exemplo/`.

| Arquivo | Lido por | Conteúdo |
|---|---|---|
| `local/REGRAS.md` (e outros `.md`) | Claude | Preferências: estilo, fluxo, modo padrão, clientes, entrega |
| `local/config.json` | scripts | Só o que algum script usa (hoje: `agente.projetosProtegidos`) |
| `local/linguagens.json` | scripts e Claude | Linguagens visuais próprias, com os mesmos campos do núcleo (`docs/14-LINGUAGENS-VISUAIS.md`) |
| `local/termos-proibidos.txt` | `verificar-publico` | Termos que nunca podem ir para um repositório público |

**Precedência e trava.** As regras de `local/` prevalecem sobre o núcleo em **preferências**. Nunca alteram as quatro travas do núcleo (seção "Invariantes" do `CLAUDE.md`): GATE 3, GATE 4, não inventar fatos comerciais ou factuais e nunca sobrescrever versões.

**Validação do `config.json`** (`scripts/local-config.mjs`, coberta por teste):

- lista **fechada** de campos: `$schema` (opcional, `reels-engine.local-config/1`) e `agente.projetosProtegidos` (lista de slugs válidos). Campo desconhecido = erro, com a indicação de que preferências vão no `REGRAS.md`;
- campo que tente mexer numa trava (qualquer chave, em qualquer nível, que fale de gate/aprovação/dispensa, sobrescrita/versão ou fatos/inventar) = erro específico: "tenta alterar uma trava do núcleo";
- roda sozinha no início de `new`, `status`, `studio`, `render`, `preflight`, `assets`, `inspect`, `archive` e no agente. Com erro, o comando para e nada é gravado;
- arquivo ausente é normal: vale só o núcleo.

**Validação do `local/linguagens.json`** (`scripts/linguagens-lib.mjs`, coberta por teste): mesmos campos obrigatórios do núcleo, nenhum campo a mais, ids que não colidem com os do núcleo, eixos/entradas/transições que existem no engine, faixa de corte coerente com o ritmo. Roda no `local:check`, no `npm run linguagens`, no `status` e no `preflight`. Linguagem local parecida demais com uma do núcleo (mais de 2 eixos iguais) gera aviso.

**Limite conhecido.** As regras em `.md` não são verificáveis por script. A proteção delas é dupla: a instrução explícita no `CLAUDE.md` e as travas **em código**, que não dependem da camada local (`status-lib`: GATE 3 e 4 não dispensáveis; `render.mjs`: sem `--overwrite`/`--output`, próxima versão livre; `remotion.config.ts`: `setOverwriteOutput(false)`). A regra de não inventar fatos depende só da instrução.

## Verificação pública — `npm run verificar-publico`

Confere o que **iria para o Git** antes de publicar o motor. Somente leitura.

- **Conjunto verificado:** se a pasta for um repositório git, os arquivos que o git versionaria (`git ls-files --cached --others --exclude-standard`); senão, a mesma seleção feita pelo próprio script, com as regras de conteúdo do usuário do `.gitignore` (`projects/*` exceto `_MOLDE` e o exemplo, `clients/*` exceto o molde, `local/`, `.reels-engine/`, `node_modules/`, mídia de `assets/`, `renders/` e `referencias/`).
- **Erros:** termo de `local/termos-proibidos.txt` em nome ou conteúdo de arquivo (sem diferenciar maiúsculas nem acentos); mídia (vídeo, áudio, imagem, fonte) fora da exceção do projeto de exemplo; qualquer arquivo de `local/`, `.reels-engine/`, `Claude outputs/` ou `.env`; fonte do exemplo sem um arquivo de licença na mesma pasta.
- **Avisos:** arquivo acima de 1 MB (exceto `package-lock.json`); `local/termos-proibidos.txt` ausente (só as checagens estruturais rodam); pasta `Claude outputs/` presente no disco (apague antes de publicar).
- Sai com código 1 se houver erro. A lista de termos fica em `local/`, fora do Git: os nomes que ela protege nunca vão para o repositório.

## Manuais — `npm run manuais`

Os manuais para quem usa a ferramenta (`manuais/implantacao.html` e `manuais/uso.html`) são **gerados**: arquivos HTML únicos, com CSS e JS embutidos, que funcionam offline.

- Fonte: `manuais/fonte/` (`implantacao.html`, `uso.html`, `estilo.css`, `app.js`, `graficos.mjs`). Edite a fonte, nunca o HTML gerado.
- `npm run manuais` gera os dois arquivos; `npm run manuais -- --verificar` só confere se estão em dia.
- Dados que vêm do motor, sem cópia à mão: a versão (`VERSION`), os cartões das linguagens (`engine/linguagens.json`) e os títulos das 8 perguntas (`projects/_MOLDE/briefing.md`). Ao mudar qualquer um deles, gere de novo.
- Ilustrações e miniaturas são SVG escrito no código (`graficos.mjs`): nenhum arquivo de imagem nem `data:` URI.
- Publicação online: `.github/workflows/manuais.yml` envia só `manuais/implantacao.html` e `manuais/uso.html` (a página inicial é a Implantação) ao GitHub Pages a cada mudança nos manuais. Ativação, uma vez: Settings → Pages → Source: GitHub Actions. Em repositório privado o job é pulado.
- `scripts/tests/manuais.test.mjs` confere: gerado em dia, nada externo, âncoras e links entre os manuais, comandos citados existentes no `package.json`, uma miniatura por linguagem, perguntas do molde, versão e tamanho.

## Agente de Render (Windows)

### Por que existe

O MP4 final precisa **nascer** em `projects/<slug>/renders/`, no PC do usuário. Renderizar na nuvem e transferir não funciona:

- a transferência nuvem → PC aceita no máximo **20 MB por arquivo**, e o chat aceita 30 MB. Um Reels final (CRF 18) tem 40–60 MB;
- o app desktop **altera todo MP4** gravado na pasta, inserindo um selo C2PA. O arquivo não chega byte a byte igual.

Quando Claude não tem terminal no PC, quem roda o render oficial localmente é o agente.

**Só Windows.** No macOS e no Linux não há agente: o render final é feito pelo terminal, com `npm run render -- <slug>`.

### O que é

- `scripts/agent.mjs` é um processo Node em segundo plano. Sobe **sozinho a cada login no Windows**, sem janela, e não depende do Claude estar aberto.
- `scripts/agent-lib.mjs` concentra todas as regras e é testado em `scripts/tests/agent.test.mjs`.
- `scripts/agent-install.mjs` é o instalador, executado **uma única vez** (`INSTALAR-AGENTE-DE-RENDER.cmd` ou `npm run agent:install`). Ele cria `ReelsEngineIA-AgenteRender-<hash>.vbs` na pasta Inicializar do usuário (o `<hash>` identifica a pasta do repositório, então duas instalações não colidem), sem administrador, e inicia o agente na hora. Para remover: `npm run agent:install -- --remover`.

**Se a pasta do repositório mudar de lugar:** antes de mover, rode `npm run agent:install -- --remover`; depois de mover, rode o instalador de novo. O lançador guarda o caminho absoluto.

### Pastas (`.reels-engine/`, local, fora do Git)

| Caminho | Conteúdo |
|---|---|
| `pedidos/` | Pedidos pendentes (`*.json`), gravados por Claude |
| `em-execucao/` | O pedido em processamento. Ele sai de `pedidos/` **antes** de executar |
| `concluidos/` | Pedido + `*.recibo.json` de sucesso |
| `falhas/` | Pedido + recibo de `recusado`, `falha` ou `interrompido` |
| `logs/<id>.log` | Saída completa do `render.mjs` daquele pedido |
| `historico.jsonl` | Um recibo por linha. Base da regra "nunca duas vezes" |
| `agente.log` | Linha do tempo legível: início, projetos reconhecidos, cada pedido e resultado |
| `agente-status.json` | Sinal de vida, a cada 30 s: pid, `ultimoSinal`, pedidos pendentes |
| `tmp/` | Temporários do próprio agente |

### Operações (lista fechada)

| `operacao` | Faz | Exige |
|---|---|---|
| `render` | Executa `node scripts/render.mjs <slug> --version <versao>`: o render oficial, com validação pós-render e registro no estado | slug, versão, GATE 4 aprovado |
| `verificar` | Nada. Responde com o diagnóstico e a lista de projetos | — |

Nenhum texto do pedido vira comando. O caminho do MP4 é **calculado pelo sistema** (`project.json` + versão), nunca lido do pedido.

### Formato do pedido

```json
{
  "$schema": "reels-engine.render-request/1",
  "id": "20261010-1530_loja-exemplo-promo-natal_v01",
  "operacao": "render",
  "slug": "loja-exemplo-promo-natal",
  "versao": "v01",
  "criadoEm": "2026-10-10T15:30:00Z",
  "criadoPor": "claude",
  "nota": "GATE 4 aprovado no chat em 10/10"
}
```

Campos fora da lista são **recusados**. O `id` precisa ser único: um id já visto no histórico é recusado.

### Travas (todas cobertas por teste)

1. **Sem pedido, nada acontece.** O agente não varre projetos para decidir renderizar; só lê `pedidos/`.
2. `render` exige, **todos**:
   - `GATE_4.status === "approved"` (`legacy` e `waived` não contam);
   - `projectVersion` igual à versão do pedido;
   - etapa `08_DRY_RUN` ou `09_RENDER`;
   - MP4 daquela versão ainda inexistente.
3. **Um pedido nunca executa duas vezes.** Ele sai de `pedidos/` antes de executar e o `id` entra no histórico.
4. **Nunca altera, sobrescreve ou exclui** assets, código, renders ou arquivos de projetos:
   - `render` usa `--version` (o `render.mjs` aborta se o arquivo existir) e `setOverwriteOutput(false)`;
   - o agente só apaga os próprios temporários (`.reels-engine/tmp/*.partial`) e o próprio lock.
5. **Projetos protegidos** nunca são tocados, mesmo com pedido: `_MOLDE` sempre, mais os slugs listados em `local/config.json`:

   ```json
   {"$schema": "reels-engine.local-config/1", "agente": {"projetosProtegidos": ["projeto-entregue-2026"]}}
   ```

   Use para vídeos entregues que não podem ganhar nova versão por engano. Se o `local/config.json` estiver inválido (JSON quebrado, campo desconhecido ou campo que tente alterar uma trava do núcleo), o agente recusa todos os pedidos até ser corrigido (nunca "desprotege" em silêncio).
6. **Erro não se repete.**
   - Falha, recusa ou tempo esgotado (90 min): registrado em `falhas/` e encerrado.
   - Pedido em execução quando o PC desligou: vira `interrompido` na próxima inicialização, sem nova tentativa.
7. **Recibo completo:** projeto, versão, início/fim, resultado, motivo, caminho do MP4, tamanho em bytes, SHA-256, validação pós-render, log.
8. **Instância única:** `agente.lock` com pid. Uma segunda instância sai sem fazer nada.

### Operação sem terminal: armadilhas do ambiente

Valem quando Claude trabalha numa nuvem (por exemplo, no Cowork) e só alcança a pasta do usuário por transferência de arquivos, sem terminal no PC.

**1. O render final nunca é feito na nuvem.**

- A transferência nuvem → PC tem limite por arquivo (20 MB na gravação na pasta, 30 MB no envio pelo chat). Um Reels final CRF 18 de 30 s costuma ter 40–60 MB; um de 50 s pode passar de 100 MB. Dividir o MP4 em partes e pedir ao usuário para juntá-las não é um fluxo aceitável: por isso a operação de montagem não existe no agente.
- O MP4 final nasce no PC, pelo **Agente de Render** (seções acima).
- A nuvem continua útil para **QA**: rascunhos e previews (`--scale=0.5` e reencode em CRF 23–25 costumam ficar entre 9 e 18 MB), stills e análise de áudio.
- Para rodar o Remotion na nuvem: use o Chromium já instalado no ambiente, apontando `--browser-executable=<caminho do headless shell>` se o Remotion não o encontrar sozinho, e `--concurrency` de no máximo 2. Como referência, 50 s a 540p levam cerca de 6 minutos.
- Depois do render feito pelo agente, a passagem `09_RENDER → 10_FINAL` sem terminal é feita editando o JSON: **parta da cópia do PC** (que já tem `lastRender` gravado pelo render), acrescente `09_RENDER` e `10_FINAL` em `completed`, uma entrada `advance` no `history` e atualize `updatedAt`. Valide com `npm run status -- <slug> validar` na próxima oportunidade.

**2. O app desktop altera todo MP4 gravado na pasta do usuário (selo C2PA).**

- Todo arquivo que começa com cabeçalho MP4 (`ftyp` no offset 4) recebe, ao ser gravado pela ferramenta de transferência, uma caixa `uuid` de alguns kilobytes (manifesto C2PA) logo depois do `ftyp`. Os offsets internos são corrigidos e o conteúdo decodificado continua idêntico, mas o arquivo **não fica igual byte a byte** ao gerado na nuvem.
- Consequência: um hash (SHA-256) calculado na nuvem não confere com o do PC. Previews enviados à pasta servem para assistir, não para comparação binária. O hash oficial é o do recibo do agente, calculado no PC.

**3. Reusar o mesmo caminho de envio pode gravar a versão ANTIGA do arquivo.**

- Sintoma: a transferência responde "gravado", mas o arquivo no PC continua na versão anterior. Caso típico: um `project-status.json` com o GATE 4 aprovado na nuvem chega ao PC ainda pendente, e o agente recusa o pedido por "GATE_4 não aprovado".
- Causa provável: o arquivo de saída na nuvem foi sobrescrito no **mesmo caminho** usado num envio anterior, e o envio reaproveitou o conteúdo já enviado.
- Regras:
  - para cada nova versão de um arquivo, use um **caminho de saída novo** na nuvem (ex.: `saida/sync/st2/`, `st3/`...);
  - depois de todo envio crítico (estado do projeto, pedido de render), **baixe de novo** o arquivo do PC e confira o conteúdo (etapa, gates, versão) antes de dar o passo seguinte.

**4. Arquivos enviados ao chat são gravados na pasta conectada.**

- Tudo o que o Claude envia como arquivo no chat (stills, previews, vídeos de comparação) o app desktop também grava em `Claude outputs/`, na raiz da pasta conectada.
- Essa pasta é saída de trabalho, não parte do motor nem dos projetos: está no `.gitignore`, e o `npm run verificar-publico` **avisa** que ela existe (apague antes de publicar) e dá **erro** se algum arquivo dela entrar no conjunto publicado.
- Nunca use `Claude outputs/` como lugar de assets de projeto: assets ficam em `projects/<slug>/assets/`.

### Diagnóstico

- `npm run agent:check`: somente leitura. Mostra raiz, projetos, etapa, versão, GATE 4, pedidos pendentes e último sinal.
- `npm run agent:status`: mostra se o início automático está instalado e se o agente está ativo.
- Claude também pode gravar um pedido `verificar` e ler o recibo, sem acesso ao terminal.

## Próximas peças (não implementadas)

- **Contact Sheets:** miniaturas por vídeo/intervalo para apoiar a escolha de trechos em `04_ASSETS`.
- **Análise de conteúdo de vídeo:** identificação de trechos (cortes, movimento, cenas) — além da ficha técnica atual.

## Extensão do estado

O schema é `reels-engine.project-status/1`. Os campos `preflight`, `renders`, `lastRender.inspect` e `archives` são **opcionais**. Uma mudança incompatível exigirá `reels-engine.project-status/2` e migração explícita.
