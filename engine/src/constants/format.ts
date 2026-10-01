/**
 * Formato padrão do Reels Engine IA para Instagram Reels.
 * Se o briefing exigir outro formato, o projeto pode sobrescrever
 * estes valores no próprio Root.tsx — nunca edite a cópia do engine
 * dentro de um projeto para isso.
 */
export const FORMAT = {
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: '9:16',
  codec: 'h264',
  container: 'mp4',
} as const;
