import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Grain} from './Grain';

export type ScrimProps = {
  /** De onde a sombra vem. "radial" escurece as bordas (vinheta). */
  direction?: 'baixo' | 'cima' | 'esquerda' | 'direita' | 'radial';
  color?: string;
  /** Opacidade máxima (0–1). */
  opacity?: number;
  /** Fração da tela coberta pelo degradê (0–1). */
  coverage?: number;
  /**
   * Grão leve por cima do degradê (0 = desliga). Degradês suaves, sobretudo
   * escuros, viram faixas ("banding") depois da recompressão do Instagram;
   * o grão quebra as faixas. Padrão: 0.04 (mistura normal, que funciona também sobre preto).
   */
  dither?: number;
};

const toRgba = (color: string, alpha: number) => {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Degradê de legibilidade: escurece (ou clareia) uma parte da imagem para o
 * texto ler bem por cima de fotos e vídeos. Coloque entre a mídia e o texto.
 */
export const Scrim: React.FC<ScrimProps> = ({direction = 'baixo', color = '#000000', opacity = 0.6, coverage = 0.5, dither = 0.04}) => {
  const solid = toRgba(color, opacity);
  const clear = toRgba(color, 0);
  const stop = `${Math.round(Math.min(1, Math.max(0, coverage)) * 100)}%`;
  const background =
    direction === 'radial'
      ? `radial-gradient(ellipse at center, ${clear} ${100 - parseInt(stop, 10)}%, ${solid} 100%)`
      : `linear-gradient(to ${{baixo: 'top', cima: 'bottom', esquerda: 'right', direita: 'left'}[direction]}, ${solid} 0%, ${clear} ${stop})`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background}} />
      {dither > 0 ? <Grain opacity={dither} blend="normal" /> : null}
    </AbsoluteFill>
  );
};
