import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

export type GrainProps = {
  /** Intensidade (0–1). Discreto: 0.08–0.18. */
  opacity?: number;
  /** Quantas vezes por segundo o grão muda. Padrão: 12 (cadência de filme). */
  changesPerSecond?: number;
  /** Tamanho do grão: maior = mais fino. */
  frequency?: number;
  /**
   * Mistura com a imagem. "overlay" (padrão) realça a textura em tons médios
   * e claros (papel, foto). Sobre fundos muito escuros o overlay quase some:
   * use "normal" com opacidade baixa (0.03–0.05) para quebrar faixas de degradê.
   */
  blend?: 'overlay' | 'normal' | 'soft-light' | 'multiply' | 'screen';
};

/**
 * Textura "granulada": ruído de filme por cima da cena, gerado em SVG
 * (nenhum arquivo de mídia). Determinístico: o mesmo frame gera o mesmo grão.
 */
export const Grain: React.FC<GrainProps> = ({opacity = 0.12, changesPerSecond = 12, frequency = 0.9, blend = 'overlay'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seed = Math.floor(frame / Math.max(1, fps / changesPerSecond));
  const id = `grain-${seed}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: blend}}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};
