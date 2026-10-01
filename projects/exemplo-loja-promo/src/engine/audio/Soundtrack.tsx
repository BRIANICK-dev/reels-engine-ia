import React from 'react';
import {Audio, interpolate, useVideoConfig} from 'remotion';

export type SoundtrackProps = {
  /** Arquivo já resolvido: staticFile('audio/trilha.mp3'). Confirme a licença. */
  src: string;
  /** Volume base (0–1). Meça o resultado em LUFS (docs/06-AUDIO-E-NARRACAO.md). */
  volume?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  /** Pula o começo da faixa (segundos) — use para alinhar a batida ao corte principal. */
  trimBeforeSeconds?: number;
  /** Duração total do vídeo em frames. Coloque o Soundtrack no Main.tsx e passe totalFrames. */
  totalFrames?: number;
  loop?: boolean;
};

/**
 * Trilha sonora com entrada e saída de volume. Use fora das Sequences
 * (em compositions/Main.tsx), para cobrir o vídeo inteiro.
 */
export const Soundtrack: React.FC<SoundtrackProps> = ({
  src,
  volume = 0.6,
  fadeInSeconds = 0,
  fadeOutSeconds = 1,
  trimBeforeSeconds = 0,
  totalFrames,
  loop = false,
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const total = totalFrames ?? durationInFrames;
  const fi = Math.round(fadeInSeconds * fps);
  const fo = Math.round(fadeOutSeconds * fps);
  return (
    <Audio
      src={src}
      loop={loop}
      trimBefore={Math.round(trimBeforeSeconds * fps)}
      volume={(f) => {
        const up = fi > 0 ? interpolate(f, [0, fi], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
        const down = fo > 0 ? interpolate(f, [total - fo, total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
        return volume * Math.min(up, down);
      }}
    />
  );
};
