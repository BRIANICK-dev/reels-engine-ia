import React from 'react';
import type {CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  type Entrance,
  type Personality,
  entranceStyle,
  exitStyle,
  motionProgress,
  staggerDelay,
} from './presets';

export type AnimateProps = {
  /** Tipo de entrada (ver ENTRANCES em presets.ts). */
  preset: Entrance;
  /** Personalidade do movimento — vem da linguagem do projeto. */
  personality: Personality;
  /** Início da entrada, em frames (relativo à Sequence em que está). */
  delay?: number;
  /** Duração da entrada em frames. Padrão: a da personalidade. */
  durationInFrames?: number;
  /** Frame (relativo) em que a saída começa. Sem valor: não sai. */
  exitAt?: number;
  /** Tipo de saída. Padrão: o mesmo da entrada, ao contrário. */
  exitPreset?: Entrance;
  /** Duração da saída em frames. Padrão: a da personalidade. */
  exitDurationInFrames?: number;
  /** Deslocamento base em px. */
  distance?: number;
  style?: CSSProperties;
  children: React.ReactNode;
};

/** Estilo combinado de entrada + saída no frame dado (útil fora de componentes). */
export const animationStyle = ({
  frame,
  fps,
  preset,
  personality,
  delay = 0,
  durationInFrames,
  exitAt,
  exitPreset,
  exitDurationInFrames,
  distance = 80,
}: Omit<AnimateProps, 'children' | 'style'> & {frame: number; fps: number}): CSSProperties => {
  if (exitAt !== undefined && frame >= exitAt) {
    const q = motionProgress({frame, fps, personality, delay: exitAt, durationInFrames: exitDurationInFrames});
    return exitStyle(exitPreset ?? preset, Math.min(1, q), distance);
  }
  const p = motionProgress({frame, fps, personality, delay, durationInFrames});
  return entranceStyle(preset, p, distance);
};

/**
 * Aplica um preset de entrada (e, opcionalmente, de saída) ao conteúdo.
 * O frame é o da Sequence em que o componente está.
 *
 *   <Animate preset="fadeUp" personality="suave" delay={6}>...</Animate>
 */
export const Animate: React.FC<AnimateProps> = ({style, children, ...opts}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <div style={{...style, ...animationStyle({...opts, frame, fps})}}>{children}</div>;
};

export type RevealTextProps = Omit<AnimateProps, 'children' | 'preset'> & {
  text: string;
  /** Unidade que entra de cada vez. Linhas: separe com "\n". */
  by?: 'letras' | 'palavras' | 'linhas';
  preset?: Entrance;
  /** Intervalo entre unidades, em frames. */
  gap?: number;
  /** Estilo de cada unidade (inline-block). */
  unitStyle?: CSSProperties;
};

/**
 * Revelação de texto por letra, palavra ou linha (text reveal / stagger).
 * Cada unidade usa o mesmo preset e a mesma personalidade, com atraso escalonado.
 */
export const RevealText: React.FC<RevealTextProps> = ({
  text,
  by = 'palavras',
  preset = 'fadeUp',
  gap = 3,
  delay = 0,
  style,
  unitStyle,
  ...opts
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const units =
    by === 'linhas' ? text.split('\n') : by === 'palavras' ? text.split(/(\s+)/) : Array.from(text);
  let i = 0;
  return (
    <div style={{...style, whiteSpace: by === 'linhas' ? 'normal' : 'pre-wrap'}}>
      {units.map((u, k) => {
        if (by !== 'linhas' && /^\s+$/.test(u)) return <span key={k}>{u}</span>;
        const d = staggerDelay(i++, gap, delay);
        const s = animationStyle({...opts, preset, delay: d, frame, fps});
        return (
          <span key={k} style={{display: by === 'linhas' ? 'block' : 'inline-block', ...unitStyle, ...s}}>
            {u}
          </span>
        );
      })}
    </div>
  );
};
