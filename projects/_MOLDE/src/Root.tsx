import React from 'react';
import {Composition} from 'remotion';
import project from '../project.json';
import {FORMAT, resolveDurationInFrames} from './engine';
import {Main, type MainProps} from './compositions/Main';
import {SCENES} from './timeline';

/**
 * Composição única do projeto. O id "Main" é fixo — os scripts
 * de studio/render dependem dele.
 *
 * Formato vem do engine (1080×1920 · 30 fps). A duração é calculada
 * a partir de project.json (briefing) e src/timeline.ts (storyboard).
 */
export const Root: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={Main}
      width={FORMAT.width}
      height={FORMAT.height}
      fps={FORMAT.fps}
      durationInFrames={1}
      defaultProps={{showSafeArea: false} satisfies MainProps}
      calculateMetadata={() => ({
        durationInFrames: resolveDurationInFrames({
          scenes: SCENES,
          targetSeconds: project.durationSeconds as number | null,
          fps: FORMAT.fps,
        }),
      })}
    />
  );
};
