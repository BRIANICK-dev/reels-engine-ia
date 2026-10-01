import React from 'react';
import {AbsoluteFill} from 'remotion';
import project from '../../project.json';
import {SafeAreaOverlay, useFonts} from '../engine';
import {FONTS} from '../styles/fonts';
import {VARIANTES} from '../variantes';

export type MainProps = {
  /** Guia de safe area — ative só no Studio. Deve ser false no render. */
  showSafeArea: boolean;
  /** Linguagem a mostrar. Padrão: a do project.json. */
  linguagem?: string;
};

/**
 * Raiz ESTÁVEL (docs/13-ARMADILHAS-REMOTION.md, item 1): o AbsoluteFill nunca
 * troca; só o conteúdo interno espera a fonte carregar.
 */
export const Main: React.FC<MainProps> = ({showSafeArea, linguagem}) => {
  const ready = useFonts(FONTS);
  const id = linguagem ?? (project.linguagem as string);
  const Variante = VARIANTES[id];
  if (!Variante) throw new Error(`O exemplo não tem implementação para a linguagem "${id}".`);
  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {ready ? <Variante /> : null}
      {showSafeArea ? <SafeAreaOverlay /> : null}
    </AbsoluteFill>
  );
};
