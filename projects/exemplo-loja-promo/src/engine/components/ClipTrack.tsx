import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, useVideoConfig} from 'remotion';
import type {Personality} from '../animations/presets';
import {SceneTrack, type TrackItem, type TransitionSpec} from './SceneTrack';

export type Clip = {
  /** Arquivo já resolvido: staticFile('video/cena-01.mp4'). Vídeo ou imagem. */
  src: string;
  /** Início do trecho na mídia de origem, em segundos. Padrão: 0. */
  srcFrom?: number;
  /** Fim do trecho na mídia de origem, em segundos (exclusivo). */
  srcTo: number;
  /** Velocidade (1 = normal). A duração na linha do tempo = (srcTo − srcFrom) / playbackRate. */
  playbackRate?: number;
  /** Transição para o próximo clipe. */
  transition?: TransitionSpec;
  /** Silencia o áudio do clipe. Padrão: true (a trilha costuma vir do Soundtrack). */
  muted?: boolean;
  fit?: 'cover' | 'contain';
  /** Conteúdo extra por cima do clipe (texto, Scrim...). */
  overlay?: React.ReactNode;
};

const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i;

/** Duração de um clipe na linha do tempo, em frames. */
export const clipFrames = (clip: Clip, fps: number): number => {
  const from = clip.srcFrom ?? 0;
  if (!(clip.srcTo > from)) throw new Error(`Clipe "${clip.src}": srcTo (${clip.srcTo}) precisa ser maior que srcFrom (${from}).`);
  return Math.max(1, Math.round(((clip.srcTo - from) / (clip.playbackRate ?? 1)) * fps));
};

/**
 * Ajusta os clipes para que cada corte caia numa batida.
 * `beats` são os instantes dos cortes na linha do tempo, em segundos, a partir
 * do início da trilha (o primeiro costuma ser 0). O clipe i dura de beats[i]
 * até beats[i+1]; o `srcTo` é recalculado a partir do `srcFrom`.
 * Precisa de clips.length + 1 batidas.
 */
export const alignToBeats = (clips: Omit<Clip, 'srcTo'>[], beats: number[]): Clip[] => {
  if (beats.length < clips.length + 1) {
    throw new Error(`alignToBeats: ${clips.length} clipes precisam de ${clips.length + 1} batidas (recebeu ${beats.length}).`);
  }
  return clips.map((c, i) => {
    const interval = beats[i + 1] - beats[i];
    if (!(interval > 0)) throw new Error(`alignToBeats: batidas fora de ordem entre ${beats[i]}s e ${beats[i + 1]}s.`);
    const from = c.srcFrom ?? 0;
    return {...c, srcFrom: from, srcTo: from + interval * (c.playbackRate ?? 1)};
  });
};

export type ClipTrackProps = {
  clips: Clip[];
  personality: Personality;
  defaultTransition?: TransitionSpec;
};

/**
 * Trilha de cortes (shot track): toca trechos de vídeos/imagens em sequência,
 * cada um de `srcFrom` a `srcTo` da mídia de origem. Pensada para cortes na
 * batida (ver alignToBeats e docs/06-AUDIO-E-NARRACAO.md).
 */
export const ClipTrack: React.FC<ClipTrackProps> = ({clips, personality, defaultTransition}) => {
  const {fps} = useVideoConfig();
  const items: TrackItem[] = clips.map((c, i) => {
    const media = IMAGE_RE.test(c.src) ? (
      <Img src={c.src} style={{width: '100%', height: '100%', objectFit: c.fit ?? 'cover'}} />
    ) : (
      <OffthreadVideo
        src={c.src}
        trimBefore={Math.round((c.srcFrom ?? 0) * fps)}
        playbackRate={c.playbackRate ?? 1}
        muted={c.muted ?? true}
        style={{width: '100%', height: '100%', objectFit: c.fit ?? 'cover'}}
      />
    );
    return {
      id: `clipe-${String(i + 1).padStart(2, '0')}`,
      durationInFrames: clipFrames(c, fps),
      transition: c.transition,
      content: (
        <AbsoluteFill>
          {media}
          {c.overlay ? <AbsoluteFill>{c.overlay}</AbsoluteFill> : null}
        </AbsoluteFill>
      ),
    };
  });
  return <SceneTrack items={items} personality={personality} defaultTransition={defaultTransition} />;
};
