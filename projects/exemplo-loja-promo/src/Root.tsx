import React from 'react';
import {Composition} from 'remotion';
import project from '../project.json';
import {FORMAT, resolveDurationInFrames} from './engine';
import {Main, type MainProps} from './compositions/Main';
import {SCENES} from './timeline';
import {CENAS, LINGUAGENS_DO_EXEMPLO} from './variantes/cenas';

/**
 * "Main" é a composição oficial (id fixo — scripts de studio/render dependem
 * dele) e usa a linguagem do project.json.
 *
 * As composições "Vitrine-<linguagem>" mostram o MESMO roteiro nas outras
 * linguagens, para comparar no Studio. O render oficial é só o do Main.
 */
export const Root: React.FC = () => {
  return (
    <>
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
      {LINGUAGENS_DO_EXEMPLO.map((id) => (
        <Composition
          key={id}
          id={`Vitrine-${id}`}
          component={Main}
          width={FORMAT.width}
          height={FORMAT.height}
          fps={FORMAT.fps}
          durationInFrames={1}
          defaultProps={{showSafeArea: false, linguagem: id} satisfies MainProps}
          calculateMetadata={() => ({
            durationInFrames: resolveDurationInFrames({
              scenes: CENAS[id],
              targetSeconds: project.durationSeconds as number | null,
              fps: FORMAT.fps,
            }),
          })}
        />
      ))}
    </>
  );
};
