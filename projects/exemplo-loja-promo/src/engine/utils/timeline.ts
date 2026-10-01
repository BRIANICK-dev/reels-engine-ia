/**
 * Utilitários de timeline.
 *
 * A duração de um vídeo NUNCA é fixa no engine:
 *  1. project.json → "durationSeconds" (vem do briefing) é a duração-alvo.
 *  2. src/timeline.ts → SCENES (vem do storyboard). Se houver cenas,
 *     a soma delas precisa bater exatamente com a duração-alvo.
 */

export type Scene = {
  /** Identificador curto, ex.: "hook", "cena-02", "cta" */
  id: string;
  /** Duração em segundos. Prefira múltiplos de 1/30 (ex.: 1.5, 2.2) */
  durationInSeconds: number;
  /** Descrição opcional, espelhando o storyboard */
  label?: string;
};

export type SceneTiming = Scene & {from: number; durationInFrames: number};

export const secondsToFrames = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);

/** Calcula início (from) e duração em frames de cada cena, em sequência. */
export const getSceneTimings = (scenes: Scene[], fps: number): SceneTiming[] => {
  let cursor = 0;
  return scenes.map((scene) => {
    const durationInFrames = secondsToFrames(scene.durationInSeconds, fps);
    const timing = {...scene, from: cursor, durationInFrames};
    cursor += durationInFrames;
    return timing;
  });
};

/**
 * Resolve a duração final da composição.
 * Lança erro (visível no Studio e no render) se a duração não estiver
 * definida ou se a soma das cenas divergir do briefing.
 */
export const resolveDurationInFrames = ({
  scenes,
  targetSeconds,
  fps,
}: {
  scenes: Scene[];
  targetSeconds: number | null | undefined;
  fps: number;
}): number => {
  if (typeof targetSeconds !== 'number' || !(targetSeconds > 0)) {
    throw new Error(
      'Duração não definida: preencha "durationSeconds" em project.json com a duração do briefing.',
    );
  }

  const target = secondsToFrames(targetSeconds, fps);
  if (scenes.length === 0) return target;

  const invalid = scenes.find((s) => !(s.durationInSeconds > 0));
  if (invalid) {
    throw new Error(`Cena "${invalid.id}" sem duração válida em src/timeline.ts.`);
  }

  const sum = getSceneTimings(scenes, fps).reduce((acc, s) => acc + s.durationInFrames, 0);
  if (sum !== target) {
    throw new Error(
      `A soma das cenas (${sum} frames = ${(sum / fps).toFixed(2)}s) difere da duração do briefing ` +
        `(${target} frames = ${targetSeconds}s). Ajuste src/timeline.ts ou project.json.`,
    );
  }
  return sum;
};
