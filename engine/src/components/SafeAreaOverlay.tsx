import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COVER_CROPS, INSTAGRAM_UI, SAFE_AREA, type Insets} from '../constants/safeArea';

/**
 * Guia visual de safe area para uso no Remotion Studio.
 * Ative pela prop `showSafeArea` da composição. NUNCA deixe ativo no render final
 * (o valor padrão em defaultProps deve ser false).
 *
 *  - Tracejado ciano  → zona safe
 *  - Linha amarela    → zona crítica
 *  - Áreas vermelhas  → interface do Instagram
 *  - Linhas magenta   → recorte da grade do perfil (3:4)
 */
const Zone: React.FC<{insets: Insets; border: string}> = ({insets, border}) => (
  <div
    style={{
      position: 'absolute',
      top: insets.top,
      left: insets.left,
      right: insets.right,
      bottom: insets.bottom,
      border,
      boxSizing: 'border-box',
    }}
  />
);

const Region: React.FC<{r: {x: number; y: number; width: number; height: number}}> = ({r}) => (
  <div
    style={{
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.width,
      height: r.height,
      backgroundColor: 'rgba(255, 40, 40, 0.18)',
    }}
  />
);

export const SafeAreaOverlay: React.FC = () => {
  const grid = COVER_CROPS.grid3x4;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 9999}}>
      <Region r={INSTAGRAM_UI.topBar} />
      <Region r={INSTAGRAM_UI.rightActions} />
      <Region r={INSTAGRAM_UI.bottomInfo} />
      <Zone insets={SAFE_AREA.safe} border="3px dashed rgba(0, 220, 255, 0.9)" />
      <Zone insets={SAFE_AREA.critical} border="3px solid rgba(255, 210, 0, 0.9)" />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: grid.y,
          height: grid.height,
          borderTop: '2px solid rgba(255, 0, 200, 0.8)',
          borderBottom: '2px solid rgba(255, 0, 200, 0.8)',
        }}
      />
    </AbsoluteFill>
  );
};
