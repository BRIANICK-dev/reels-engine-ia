import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {
  Animate,
  FORMAT,
  type Entrance,
  SceneTrack,
  hookTiming,
  type TrackItem,
  type TransitionSpec,
  fitFontSize,
  safeBox,
  safePadding,
  secondsToFrames,
} from '../engine';
import {FONT} from '../styles/fonts';
import {CENAS} from './cenas';

/**
 * Tipografia cinética — ritmo rápido · centralizado · limpa · movimento "seca".
 * A palavra é a imagem: uma ou duas por corte, peso máximo, cores que se alternam.
 */
const PERSONALIDADE = 'seca' as const;
const ENTRADAS: Entrance[] = ['popIn', 'scaleIn', 'slideLeft', 'maskLeft'];
const CORES = [
  {fundo: '#0E0E0E', texto: '#F2FF3D'},
  {fundo: '#F2FF3D', texto: '#0E0E0E'},
];
/** Transição depois de cada corte (índice → tipo). Os demais: corte seco. */
const TRANSICOES: Record<number, TransitionSpec> = {
  3: {type: 'whip', direction: 'esquerda'},
  7: {type: 'zoomThrough'},
  9: {type: 'whip', direction: 'cima'},
};

const Palavra: React.FC<{texto: string; i: number}> = ({texto, i}) => {
  const cor = CORES[i % CORES.length];
  const linhas = texto.split('\n');
  const size = fitFontSize({
    lines: linhas,
    maxWidth: safeBox('critical').width,
    maxFontSize: 330,
    fontFamily: FONT,
    fontWeight: 900,
    letterSpacingEm: -0.045,
  });
  return (
    <AbsoluteFill style={{background: cor.fundo, ...safePadding('critical'), alignItems: 'center', justifyContent: 'center'}}>
      <Animate preset={ENTRADAS[i % ENTRADAS.length]} personality={PERSONALIDADE} {...(i === 0 ? hookTiming(PERSONALIDADE, FORMAT.fps) : {})}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: size,
            letterSpacing: '-0.045em',
            lineHeight: 0.88,
            color: cor.texto,
            textAlign: 'center',
            whiteSpace: 'pre',
          }}
        >
          {texto}
        </div>
      </Animate>
    </AbsoluteFill>
  );
};

export const Cinetica: React.FC = () => {
  const {fps} = useVideoConfig();
  const items: TrackItem[] = CENAS['tipografia-cinetica'].map((c, i) => ({
    id: c.id,
    durationInFrames: secondsToFrames(c.durationInSeconds, fps),
    transition: TRANSICOES[i],
    content: <Palavra texto={c.label ?? ''} i={i} />,
  }));
  return <SceneTrack items={items} personality={PERSONALIDADE} />;
};
