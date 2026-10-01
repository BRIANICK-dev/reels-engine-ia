import React from 'react';
import type {CSSProperties} from 'react';
import {warnLowContrast} from '../utils/legibility';

export type PillProps = {
  children: React.ReactNode;
  background?: string;
  color?: string;
  /** Use fontCss() de utils/fonts.ts (nome da fonte entre aspas). */
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: CSSProperties['fontWeight'];
  paddingX?: number;
  paddingY?: number;
  /** Raio da borda. Padrão: totalmente arredondado. */
  radius?: number | string;
  borderColor?: string;
  style?: CSSProperties;
};

/**
 * Etiqueta arredondada ("pílula") para selos, categorias, datas e CTAs curtos.
 * Sem cores de marca por padrão: passe as do projeto.
 */
export const Pill: React.FC<PillProps> = ({
  children,
  background = '#F4F4F4',
  color = '#111111',
  fontFamily,
  fontSize = 40,
  fontWeight = 700,
  paddingX = 36,
  paddingY = 14,
  radius = 999,
  borderColor,
  style,
}) => {
  warnLowContrast('Pill', color, background);
  return (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background,
      color,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight: 1.1,
      padding: `${paddingY}px ${paddingX}px`,
      borderRadius: radius,
      border: borderColor ? `3px solid ${borderColor}` : undefined,
      whiteSpace: 'nowrap',
      width: 'fit-content', // não estica dentro de containers flex em coluna
      ...style,
    }}
  >
    {children}
  </div>
  );
};
