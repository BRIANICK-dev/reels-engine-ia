import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  type Direction,
  type Personality,
  type Transition,
  motionProgress,
  transitionDuration,
  transitionStyle,
} from '../animations/presets';

export type TransitionSpec = {
  type: Transition;
  /** Duração da sobreposição, em frames. Padrão: a do tipo (corte e match cut = 0). */
  durationInFrames?: number;
  /** Para onde o movimento vai (wipe e whip). */
  direction?: Direction;
};

export type TrackItem = {
  id: string;
  durationInFrames: number;
  content: React.ReactNode;
  /** Transição para o PRÓXIMO item. Sem valor: usa a padrão da trilha. */
  transition?: TransitionSpec;
};

/** Resolve as transições de cada fronteira (i → i+1) e suas durações em frames. */
export const resolveTransitions = (
  items: Pick<TrackItem, 'durationInFrames' | 'transition'>[],
  fps: number,
  fallback: TransitionSpec = {type: 'corte'},
): (TransitionSpec & {frames: number})[] =>
  items.slice(0, -1).map((item, i) => {
    const spec = item.transition ?? fallback;
    const max = Math.min(item.durationInFrames, items[i + 1].durationInFrames);
    return {...spec, frames: Math.min(max, transitionDuration(spec.type, fps, spec.durationInFrames))};
  });

/** Duração total da trilha. Transições se sobrepõem às cenas: não somam tempo. */
export const trackDuration = (items: Pick<TrackItem, 'durationInFrames'>[]): number =>
  items.reduce((acc, it) => acc + it.durationInFrames, 0);

const Layer: React.FC<{
  duration: number;
  inT: (TransitionSpec & {frames: number}) | null;
  outT: (TransitionSpec & {frames: number}) | null;
  personality: Personality;
  children: React.ReactNode;
}> = ({duration, inT, outT, personality, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let style: React.CSSProperties = {};
  if (inT && inT.frames > 0 && frame < inT.frames) {
    const p = motionProgress({frame, fps, personality, durationInFrames: inT.frames});
    style = transitionStyle(inT.type, p, 'in', inT.direction);
  } else if (outT && outT.frames > 0 && frame >= duration) {
    const p = motionProgress({frame: frame - duration, fps, personality, durationInFrames: outT.frames});
    style = transitionStyle(outT.type, p, 'out', outT.direction);
  }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export type SceneTrackProps = {
  items: TrackItem[];
  /** Personalidade usada nas transições. */
  personality: Personality;
  /** Transição usada quando o item não declara a sua. Padrão: corte. */
  defaultTransition?: TransitionSpec;
};

/**
 * Trilha de cenas com transições.
 *
 * Cada item ocupa `durationInFrames` na linha do tempo. Numa transição com
 * sobreposição, a cena que sai continua visível por baixo durante os primeiros
 * frames da próxima — a duração total do vídeo não muda (docs/05-REMOTION.md,
 * regra 5). Dentro de cada item, useCurrentFrame() começa em 0.
 */
export const SceneTrack: React.FC<SceneTrackProps> = ({items, personality, defaultTransition}) => {
  const {fps} = useVideoConfig();
  const bounds = resolveTransitions(items, fps, defaultTransition);
  let cursor = 0;
  return (
    <AbsoluteFill>
      {items.map((item, i) => {
        const from = cursor;
        cursor += item.durationInFrames;
        const outT = bounds[i] ?? null;
        const inT = i > 0 ? bounds[i - 1] : null;
        const extra = outT ? outT.frames : 0;
        return (
          <Sequence key={item.id} name={item.id} from={from} durationInFrames={item.durationInFrames + extra}>
            <Layer duration={item.durationInFrames} inT={inT} outT={outT} personality={personality}>
              {item.content}
            </Layer>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
