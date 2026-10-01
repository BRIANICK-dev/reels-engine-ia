/**
 * Configuração global do Remotion — vale para TODOS os projetos em projects/<slug>/.
 *
 * Não coloque aqui nada específico de um vídeo. Entry point, pasta de assets
 * e arquivo de saída são definidos por projeto pelos scripts em scripts/.
 *
 * Formato padrão: 1080×1920 · 9:16 · 30 fps · H.264 · MP4
 * (largura, altura e fps ficam em engine/src/constants/format.ts)
 */
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p'); // 4:2:0 — compatibilidade com Instagram e players mobile

// Espaço de cor BT.709 em faixa limitada (tv). Sem esta linha, os frames JPEG
// (faixa completa, BT.601) geram um MP4 "yuvj420p / pc / bt470bg": players e
// plataformas que ignoram a flag de faixa exibem contraste e cores deslocados.
// Com bt709: yuv420p · color_range=tv · bt709/bt709/bt709 — padrão de vídeo HD.
Config.setColorSpace('bt709');

// Proteção de versões: o Remotion NUNCA sobrescreve um arquivo existente.
// O script scripts/render.mjs também aborta antes, se o destino já existir.
Config.setOverwriteOutput(false);
