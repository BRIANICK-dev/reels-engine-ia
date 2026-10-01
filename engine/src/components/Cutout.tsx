import React from 'react';
import type {CSSProperties} from 'react';
import {random} from 'remotion';
import {warnLowContrast} from '../utils/legibility';

export type CutoutProps = {
  children: React.ReactNode;
  /** Cor do "papel" em volta do conteúdo. */
  paper?: string;
  /** Cor do texto sobre o papel (herdada pelos filhos). Confere o contraste mínimo de 4,5:1. */
  ink?: string;
  /** Rotação em graus (colagem raramente fica reta). */
  rotate?: number;
  /** Borda rasgada irregular. A semente fixa o formato (determinístico). */
  torn?: boolean;
  seed?: string;
  padding?: number;
  shadow?: string;
  style?: CSSProperties;
};

const tornPolygon = (seed: string, points = 28, depth = 1.6) => {
  const pts: string[] = [];
  const side = (n: number, fn: (t: number, j: number) => string) => {
    for (let i = 0; i < n; i++) pts.push(fn(i / n, random(`${seed}-${pts.length}`) * depth));
  };
  side(points, (t, j) => `${t * 100}% ${j}%`);
  side(points, (t, j) => `${100 - j}% ${t * 100}%`);
  side(points, (t, j) => `${100 - t * 100}% ${100 - j}%`);
  side(points, (t, j) => `${j}% ${100 - t * 100}%`);
  return `polygon(${pts.join(', ')})`;
};

/**
 * Textura "recortada": o conteúdo vira um pedaço de papel recortado, com
 * borda, leve rotação e sombra dura. Para colagem, adesivos e feito à mão.
 */
export const Cutout: React.FC<CutoutProps> = ({
  children,
  paper = '#ffffff',
  ink = '#111111',
  rotate = -2,
  torn = false,
  seed = 'recorte',
  padding = 18,
  shadow = '10px 12px 0 rgba(0,0,0,0.28)',
  style,
}) => {
  warnLowContrast('Cutout', ink, paper);
  return (
    <div style={{display: 'inline-block', transform: `rotate(${rotate}deg)`, filter: `drop-shadow(${shadow})`, ...style}}>
      <div style={{background: paper, color: ink, padding, clipPath: torn ? tornPolygon(seed) : undefined}}>{children}</div>
    </div>
  );
};
