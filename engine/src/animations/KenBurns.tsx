import React from 'react';
import type {CSSProperties} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {type Personality, motionProgress} from './presets';

type Frame = {scale: number; x?: number; y?: number};

export type KenBurnsProps = {
  /** Enquadramento inicial e final (escala e deslocamento em % da tela). */
  from?: Frame;
  to?: Frame;
  /** Personalidade do movimento. Padrão: cinematografica. */
  personality?: Personality;
  /** Duração do movimento em frames. Padrão: a duração da Sequence em que está. */
  durationInFrames?: number;
  style?: CSSProperties;
  children: React.ReactNode;
};

/**
 * Movimento lento de câmera sobre uma imagem ou vídeo (zoom + pan).
 * Coloque dentro da Sequence da cena: o movimento ocupa a cena inteira.
 */
export const KenBurns: React.FC<KenBurnsProps> = ({
  from = {scale: 1, x: 0, y: 0},
  to = {scale: 1.12, x: 0, y: -2},
  personality = 'cinematografica',
  durationInFrames,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames: seq} = useVideoConfig();
  const p = motionProgress({frame, fps, personality, durationInFrames: durationInFrames ?? seq});
  const lerp = (a = 0, b = 0) => a + (b - a) * p;
  return (
    <AbsoluteFill style={{overflow: 'hidden', ...style}}>
      <AbsoluteFill
        style={{
          transform: `translate(${lerp(from.x, to.x)}%, ${lerp(from.y, to.y)}%) scale(${lerp(from.scale, to.scale)})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
