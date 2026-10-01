/**
 * Presets de movimento — personalidades, entradas/saídas e transições.
 *
 * O problema que isto resolve: quando todo vídeo usa a mesma curva e a mesma
 * mola, todos parecem o mesmo vídeo. Aqui o MOVIMENTO tem personalidade
 * nomeada, e cada linguagem visual (engine/linguagens.json) declara a sua.
 *
 *  - Personalidade: COMO algo se move (curva, mola, duração, cadência).
 *  - Entrada/saída: O QUE se move (fade, deslize, máscara, escala...).
 *  - Transição: como uma cena passa para a próxima.
 *
 * Todo preset recebe a personalidade como parâmetro. As listas abaixo são a
 * fonte da verdade dos ids usados em engine/linguagens.json (conferido por teste).
 * Documentação: docs/04-MOTION-DESIGN.md e docs/14-LINGUAGENS-VISUAIS.md.
 */
import type {CSSProperties} from 'react';
import {Easing, spring} from 'remotion';

export const PERSONALITIES = ['suave', 'elastica', 'seca', 'cinematografica', 'mecanica', 'degraus'] as const;
export const ENTRANCES = ['fade', 'fadeUp', 'fadeDown', 'slideLeft', 'slideRight', 'scaleIn', 'popIn', 'blurIn', 'maskUp', 'maskLeft'] as const;
export const TRANSITIONS = ['corte', 'dissolve', 'wipe', 'whip', 'zoomThrough', 'matchCut'] as const;

export type Personality = (typeof PERSONALITIES)[number];
export type Entrance = (typeof ENTRANCES)[number];
export type Transition = (typeof TRANSITIONS)[number];
export type Direction = 'esquerda' | 'direita' | 'cima' | 'baixo';

type PersonalityDef = {
  /** Duração padrão de um movimento, em frames a 30 fps (escala com o fps). */
  durationFrames: number;
  /** Curva de aceleração (quando não é mola). */
  easing?: (t: number) => number;
  /** Mola (passa de 1 e volta: overshoot). */
  spring?: {damping: number; stiffness: number; mass: number};
  /** Cadência em "degraus": segura frames, como animação quadro a quadro. */
  stepFps?: number;
  descricao: string;
};

export const PERSONALITY: Record<Personality, PersonalityDef> = {
  suave: {
    durationFrames: 18,
    easing: Easing.bezier(0.33, 0, 0.2, 1),
    descricao: 'Desacelera com calma no fim. Neutra, confortável, sem chamar atenção para si.',
  },
  elastica: {
    durationFrames: 26,
    spring: {damping: 8, stiffness: 150, mass: 0.8},
    descricao: 'Mola com overshoot: passa do ponto e volta. Divertida, enérgica.',
  },
  seca: {
    durationFrames: 8,
    easing: Easing.bezier(0.05, 0.9, 0.1, 1),
    descricao: 'Arranque quase instantâneo e parada firme. Direta, impactante.',
  },
  cinematografica: {
    durationFrames: 40,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
    descricao: 'Longa, acelera e desacelera devagar. Contemplativa, elegante.',
  },
  mecanica: {
    durationFrames: 12,
    easing: Easing.linear,
    descricao: 'Velocidade constante e parada seca. Precisa, técnica, de interface.',
  },
  degraus: {
    durationFrames: 15,
    easing: Easing.bezier(0.2, 0, 0.2, 1),
    stepFps: 12,
    descricao: 'Segura frames em cadência de 12 fps, como animação quadro a quadro. Retrô, colagem, feito à mão.',
  },
};

/** Duração padrão (em frames do projeto) de um movimento da personalidade. */
export const personalityDuration = (personality: Personality, fps: number): number =>
  Math.max(1, Math.round(PERSONALITY[personality].durationFrames * (fps / 30)));

/**
 * Progresso de um movimento (0 → 1) no frame dado, com a personalidade.
 * Molas podem passar de 1 (overshoot). Antes do `delay`, devolve 0.
 */
export const motionProgress = ({
  frame,
  fps,
  personality,
  delay = 0,
  durationInFrames,
}: {
  frame: number;
  fps: number;
  personality: Personality;
  delay?: number;
  durationInFrames?: number;
}): number => {
  const def = PERSONALITY[personality];
  const dur = Math.max(1, Math.round(durationInFrames ?? personalityDuration(personality, fps)));
  let f = frame - delay;
  if (def.stepFps) {
    const step = fps / def.stepFps;
    f = Math.floor(f / step) * step;
  }
  if (f <= 0) return 0;
  if (def.spring) return spring({frame: f, fps, config: def.spring, durationInFrames: dur});
  return (def.easing ?? Easing.linear)(Math.min(1, f / dur));
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Estilo de uma ENTRADA no progresso `p` (0 = invisível, 1 = no lugar).
 * `distance` é o deslocamento base em px (os deslizes usam 3×).
 */
export const entranceStyle = (preset: Entrance, p: number, distance = 80): CSSProperties => {
  const o = clamp01(p);
  const rest = 1 - p;
  switch (preset) {
    case 'fade':
      return {opacity: o};
    case 'fadeUp':
      return {opacity: o, transform: `translateY(${rest * distance}px)`};
    case 'fadeDown':
      return {opacity: o, transform: `translateY(${-rest * distance}px)`};
    case 'slideLeft':
      return {opacity: o, transform: `translateX(${rest * distance * 3}px)`};
    case 'slideRight':
      return {opacity: o, transform: `translateX(${-rest * distance * 3}px)`};
    case 'scaleIn':
      return {opacity: o, transform: `scale(${0.85 + 0.15 * p})`};
    case 'popIn':
      return {opacity: o, transform: `scale(${0.4 + 0.6 * p})`};
    case 'blurIn':
      return {opacity: o, filter: `blur(${(1 - o) * 18}px)`, transform: `scale(${1.04 - 0.04 * o})`};
    // Máscaras: a área de corte é ampliada (valores negativos) para não cortar acentos
    // e descendentes quando a entrelinha é apertada; revelado por completo, sai o corte.
    case 'maskUp':
      return o >= 1
        ? {transform: `translateY(${rest * distance * 0.5}px)`}
        : {clipPath: `inset(${(1 - o) * 140 - 40}% -20% -40% -20%)`, transform: `translateY(${rest * distance * 0.5}px)`};
    case 'maskLeft':
      return o >= 1 ? {} : {clipPath: `inset(-40% ${(1 - o) * 120 - 20}% -40% -20%)`};
    default:
      return {};
  }
};

/** Estilo de uma SAÍDA no progresso `q` (0 = no lugar, 1 = saiu): a entrada ao contrário. */
export const exitStyle = (preset: Entrance, q: number, distance = 80): CSSProperties =>
  entranceStyle(preset, 1 - q, distance);

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Regra do hook (vale para TODA linguagem): o texto do hook precisa estar
 * legível até 0,5 s (frame 15 a 30 fps), qualquer que seja a personalidade.
 * A linguagem pode ser lenta no corpo, nunca no hook.
 */
export const HOOK_LEGIBLE_SECONDS = 0.5;
/** A entrada do hook termina até 0,4 s — folga para o texto já estar parado em 0,5 s. */
export const HOOK_ENTRANCE_SECONDS = 0.4;

/**
 * Tempo da entrada do hook com a personalidade da linguagem: começa no
 * frame 0 e dura no máximo 0,4 s (a curva/mola da personalidade é mantida,
 * só fica mais curta). Use em `Animate`/`RevealText` do hook:
 *
 *   <Animate preset="blurIn" personality="cinematografica" {...hookTiming('cinematografica', fps)}>
 */
export const hookTiming = (personality: Personality, fps: number): {delay: number; durationInFrames: number} => ({
  delay: 0,
  durationInFrames: Math.max(1, Math.min(personalityDuration(personality, fps), Math.round(HOOK_ENTRANCE_SECONDS * fps))),
});

/** Atraso em frames para o item `index` de uma sequência escalonada. */
export const staggerDelay = (index: number, gapFrames: number, start = 0): number => start + index * gapFrames;

// ── Transições ───────────────────────────────────────────────────

/** Duração padrão de cada transição, em frames a 30 fps. Corte e match cut não têm sobreposição. */
export const TRANSITION_FRAMES: Record<Transition, number> = {
  corte: 0,
  matchCut: 0,
  dissolve: 12,
  wipe: 10,
  whip: 8,
  zoomThrough: 10,
};

export const transitionDuration = (type: Transition, fps: number, override?: number): number =>
  TRANSITION_FRAMES[type] === 0 ? 0 : Math.max(1, Math.round(override ?? TRANSITION_FRAMES[type] * (fps / 30)));

const wipeInset = (p: number, dir: Direction) => {
  const r = (1 - p) * 100;
  switch (dir) {
    case 'esquerda':
      return `inset(0 0 0 ${r}%)`;
    case 'direita':
      return `inset(0 ${r}% 0 0)`;
    case 'cima':
      return `inset(${r}% 0 0 0)`;
    case 'baixo':
      return `inset(0 0 ${r}% 0)`;
  }
};

const axis = (dir: Direction) => (dir === 'cima' || dir === 'baixo' ? 'Y' : 'X');
const sign = (dir: Direction) => (dir === 'esquerda' || dir === 'cima' ? -1 : 1);

/**
 * Estilo de uma camada durante a transição.
 *  - `p`: progresso da transição (0 → 1), já com a personalidade aplicada.
 *  - `role`: "in" = cena que entra (fica por cima); "out" = cena que sai.
 *  - `direction`: para onde o movimento vai (wipe e whip).
 * Corte e match cut não têm estilo: a troca é exata no frame.
 */
export const transitionStyle = (type: Transition, p: number, role: 'in' | 'out', direction: Direction = 'esquerda'): CSSProperties => {
  const t = clamp01(p);
  switch (type) {
    case 'dissolve':
      return role === 'in' ? {opacity: t} : {};
    case 'wipe':
      return role === 'in' ? {clipPath: wipeInset(t, direction)} : {};
    case 'whip': {
      const a = axis(direction);
      const s = sign(direction);
      return role === 'out'
        ? {transform: `translate${a}(${s * t * 100}%)`, filter: `blur(${t * 40}px)`}
        : {transform: `translate${a}(${-s * (1 - t) * 100}%)`, filter: `blur(${(1 - t) * 40}px)`};
    }
    case 'zoomThrough':
      return role === 'out'
        ? {transform: `scale(${1 + t * 1.5})`, opacity: 1 - t}
        : {transform: `scale(${1.6 - 0.6 * t})`, opacity: t};
    default:
      return {};
  }
};
