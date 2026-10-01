import React from 'react';
import {AbsoluteFill} from 'remotion';
import project from '../../project.json';
import {SafeAreaOverlay, safePadding} from '../engine';

export type MainProps = {
  /** Guia de safe area — ative só no Studio. Deve ser false no render. */
  showSafeArea: boolean;
};

/**
 * Placeholder neutro. Substitua pela composição do vídeo depois que o
 * storyboard for aprovado. Referência completa: projects/exemplo-loja-promo/.
 *
 * Padrões do motor (docs/14-LINGUAGENS-VISUAIS.md, docs/13-ARMADILHAS-REMOTION.md):
 *  - raiz ESTÁVEL: este AbsoluteFill nunca troca; só o conteúdo interno muda;
 *  - fonte de arquivo: const ready = useFonts(FONTS) e {ready ? <Cenas /> : null};
 *  - cenas e transições: <SceneTrack personality={...} items={...} />, com a
 *    personalidade da linguagem do project.json;
 *  - hook legível até 0,5 s: entrada com {...hookTiming(personalidade, fps)};
 *  - último frame com o CTA completo; textos ≥ fontSize 56, contraste ≥ 4,5:1.
 * Assets deste projeto: staticFile('arquivo.ext') (lidos de projects/<slug>/assets/).
 */
export const Main: React.FC<MainProps> = ({showSafeArea}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#111111'}}>
      <AbsoluteFill
        style={{
          ...safePadding('critical'),
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontFamily: "'Arial', sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{fontSize: 56, opacity: 0.6}}>{project.slug}</div>
        <div style={{fontSize: 72, fontWeight: 700, marginTop: 24}}>Composição ainda não criada</div>
      </AbsoluteFill>
      {showSafeArea ? <SafeAreaOverlay /> : null}
    </AbsoluteFill>
  );
};
