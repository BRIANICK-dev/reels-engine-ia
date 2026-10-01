# ÁUDIO E NARRAÇÃO

## Música

Priorizar: - música fornecida pelo usuário; - música royalty-free; -
trilhas com licença adequada.

Nunca assumir que uma música comercial pode ser usada.

## Mixagem

A música não deve competir com narração ou efeitos.

Usar fades e ajustes de volume quando necessário.

## Volume final (loudness)

Referência para Reels: cerca de **−14 LUFS** integrados no MP4 final
(música + efeitos + narração).

-   Meça sempre no arquivo renderizado (rascunho ou final), não na
    trilha isolada, com o ffmpeg que vem com o Remotion:
    `npx remotion ffmpeg -hide_banner -nostats -i <arquivo>.mp4 -vn -af loudnorm=print_format=summary -f null -`
    (o valor "Input Integrated" é o loudness integrado). O ffmpeg do
    Remotion não tem o filtro `ebur128`; com um ffmpeg completo
    instalado no sistema, `-af ebur128` também serve.
-   Uma música comercial masterizada costuma chegar perto de −10 LUFS a
    volume 1. Como ordem de grandeza, volumes entre 0,5 e 0,65 na
    `<Audio>` costumam levar a mistura para perto de −14 LUFS, mas o
    valor certo depende da faixa e dos efeitos: meça e ajuste.
-   Depois de acrescentar efeitos sonoros, meça de novo.

## Sincronia de cortes com a música (método opcional)

Quando os cortes precisam cair no tempo da música, não confie só na
grade de um detector automático de batidas: ele costuma acertar o
andamento (BPM) e errar a **fase**, ficando alguns décimos de segundo
adiantado ou atrasado. Cortes nessa grade parecem "quase" no tempo.

Método que funciona (exige Python com uma biblioteca de análise de
áudio, como a librosa; **não faz parte do motor**, que é só Node):

1.  Separar a parte percussiva da música (HPSS).
2.  Encontrar os picos de energia na faixa grave (abaixo de ~120 Hz,
    onde está o bumbo), com passo curto de análise (~5 ms).
3.  Escolher o ponto de início da música (`trimBefore`, em frames) para
    que um bumbo real caia exatamente no corte mais importante.
4.  Conferir **todos** os cortes contra os bumbos reais (desvio aceitável:
    até 1 frame) e medir de novo no rascunho renderizado.

Sem Python disponível, ajuste a sincronia no Studio, a olho e ouvido,
e registre a decisão no `storyboard.md`.

## Sound design

Pode usar: - whoosh; - impact; - click; - pop; - riser; - ambience; -
natureza; - água; - ambiente de pessoas.

O efeito deve reforçar o movimento ou narrativa.

## Narração

Se houver narração: 1. definir roteiro; 2. dividir por cenas; 3. estimar
timing; 4. sincronizar cenas; 5. sincronizar legendas.

Se o ambiente não tiver uma ferramenta de geração de voz, preparar o
projeto para receber um arquivo de áudio.

Nunca declarar que uma voz foi gerada se o arquivo não existir.

## Voz

Respeitar: - idioma; - gênero/estilo quando solicitado; - velocidade; -
tom; - pausas.

Não imitar a voz de uma pessoa real sem autorização apropriada.
