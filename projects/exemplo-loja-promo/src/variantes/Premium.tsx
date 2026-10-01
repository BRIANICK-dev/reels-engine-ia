import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Animate, FORMAT, Scrim, SceneTrack, type TrackItem, hookTiming, safePadding, secondsToFrames} from '../engine';
import {ROTEIRO} from '../roteiro';
import {FONT} from '../styles/fonts';
import {CENAS} from './cenas';

/**
 * Elegante / premium — ritmo lento · centralizado · limpa · movimento "cinematografica".
 * Um elemento por vez, caixa alta espaçada, fundo escuro, fio metálico como detalhe.
 * Lenta no corpo, nunca no hook: o hook usa hookTiming() e está legível até 0,5 s.
 */
const PERSONALIDADE = 'cinematografica' as const;
const FUNDO = '#0B0B0C';
const TEXTO = '#EDE6DA';
const METAL = '#B8975A';

const Titulo: React.FC<{
  children: React.ReactNode;
  size?: number;
  delay?: number;
  preset?: 'fade' | 'blurIn' | 'maskUp';
  /** Hook: entrada curta (hookTiming), legível até 0,5 s. */
  hook?: boolean;
}> = ({children, size = 80, delay = 6, preset = 'blurIn', hook = false}) => (
  <Animate preset={preset} personality={PERSONALIDADE} {...(hook ? hookTiming(PERSONALIDADE, FORMAT.fps) : {delay})}>
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 300,
        fontSize: size,
        letterSpacing: '0.38em',
        textTransform: 'uppercase',
        color: TEXTO,
        textAlign: 'center',
        lineHeight: 1.5,
        whiteSpace: 'pre-line',
        paddingLeft: '0.38em', // compensa o espaçamento após a última letra
      }}
    >
      {children}
    </div>
  </Animate>
);

const Fio: React.FC<{delay?: number}> = ({delay = 18}) => (
  <Animate preset="maskLeft" personality={PERSONALIDADE} delay={delay} style={{margin: '44px auto'}}>
    <div style={{width: 180, height: 2, background: METAL}} />
  </Animate>
);

const Quadro: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: FUNDO}}>
    {/* Vinheta escura com grão (dither) para não virar faixas na recompressão do Instagram. */}
    <Scrim direction="radial" color="#000000" opacity={0.85} coverage={0.55} dither={0.045} />
    <AbsoluteFill style={{...safePadding('critical'), alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

const CONTEUDO: React.ReactNode[] = [
  <Quadro key="p01">
    <Titulo size={96} hook>
      {ROTEIRO.hook}
    </Titulo>
    <Fio delay={8} />
  </Quadro>,
  <Quadro key="p02">
    <Titulo size={80}>{'a coleção\nde verão'}</Titulo>
    <Fio delay={20} />
    <Animate preset="fade" personality={PERSONALIDADE} delay={30}>
      <div style={{fontFamily: FONT, fontWeight: 500, fontSize: 58, letterSpacing: '0.18em', lineHeight: 1.45, color: METAL, textTransform: 'uppercase', textAlign: 'center'}}>
        {ROTEIRO.apoio[0]}
        <br />
        {ROTEIRO.apoio[1]}
      </div>
    </Animate>
  </Quadro>,
  <Quadro key="p03">
    <Fio delay={4} />
    <Titulo size={96} preset="maskUp">
      {ROTEIRO.marca}
    </Titulo>
    <Fio delay={24} />
  </Quadro>,
  <Quadro key="p04">
    <Titulo size={84} preset="fade">
      {'visite\na loja'}
    </Titulo>
    <Fio delay={20} />
  </Quadro>,
];

export const Premium: React.FC = () => {
  const {fps} = useVideoConfig();
  const items: TrackItem[] = CENAS['elegante-premium'].map((c, i) => ({
    id: c.id,
    durationInFrames: secondsToFrames(c.durationInSeconds, fps),
    content: CONTEUDO[i],
  }));
  return <SceneTrack items={items} personality={PERSONALIDADE} defaultTransition={{type: 'dissolve', durationInFrames: 20}} />;
};
