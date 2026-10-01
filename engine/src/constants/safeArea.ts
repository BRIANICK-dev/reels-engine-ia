/**
 * Safe area para Reels (canvas 1080×1920).
 *
 * Estratégia por ZONAS, não uma margem única — cada tipo de elemento
 * usa a zona correspondente à sua importância:
 *
 *  - bleed    → fundos, vídeo e imagens em tela cheia. Pode encostar nas bordas.
 *  - safe     → textos secundários, logos, legendas, elementos gráficos.
 *  - critical → headline, CTA, preço/data/informação essencial, logo obrigatório.
 *
 * As margens refletem a interface do Instagram: topo (cabeçalho "Reels"
 * e câmera), coluna de botões à direita (curtir, comentar, compartilhar,
 * áudio) e base (usuário, legenda do post, música).
 *
 * São valores de REFERÊNCIA, calibrados a partir da interface
 * atual do app. A interface muda com o tempo: revise estes números
 * periodicamente, conferindo um render no celular.
 * Detalhes da estratégia: docs/08-INSTAGRAM.md
 */
import type {CSSProperties} from 'react';
import {FORMAT} from './format';

export type Insets = {top: number; right: number; bottom: number; left: number};

export const SAFE_AREA: Record<'bleed' | 'safe' | 'critical', Insets> = {
  bleed: {top: 0, right: 0, bottom: 0, left: 0},
  safe: {top: 220, right: 140, bottom: 380, left: 60},
  critical: {top: 300, right: 180, bottom: 480, left: 90},
};

/**
 * Regiões ocupadas pela interface do Instagram (coordenadas absolutas).
 * Usadas pelo SafeAreaOverlay para visualização no Studio.
 */
export const INSTAGRAM_UI = {
  // Coluna de ações à direita (curtir, comentar, compartilhar, áudio)
  rightActions: {x: 1080 - 140, y: 1000, width: 140, height: 1920 - 1000 - 120},
  // Faixa inferior (usuário, legenda do post, música)
  bottomInfo: {x: 0, y: 1920 - 380, width: 1080, height: 380},
  // Cabeçalho superior
  topBar: {x: 0, y: 0, width: 1080, height: 220},
} as const;

/**
 * Recortes em que o vídeo aparece fora do player de Reels.
 * A capa e a mensagem principal do frame de capa devem caber no recorte.
 */
export const COVER_CROPS = {
  // Grade do perfil (3:4) — centralizado verticalmente
  grid3x4: {x: 0, y: (1920 - 1440) / 2, width: 1080, height: 1440},
  // Feed (4:5) — centralizado verticalmente
  feed4x5: {x: 0, y: (1920 - 1350) / 2, width: 1080, height: 1350},
} as const;

/** Faixa recomendada para legendas (base da legenda dentro da zona safe). */
export const CAPTION_BAND = {top: 1180, bottom: 1920 - SAFE_AREA.safe.bottom} as const;

/** Converte uma zona em padding CSS para um container AbsoluteFill. */
export const safePadding = (zone: keyof typeof SAFE_AREA): CSSProperties => {
  const i = SAFE_AREA[zone];
  return {
    paddingTop: i.top,
    paddingRight: i.right,
    paddingBottom: i.bottom,
    paddingLeft: i.left,
    boxSizing: 'border-box',
  };
};

export type Box = {x: number; y: number; width: number; height: number};

/**
 * Caixa útil (área de conteúdo) de uma zona, em px absolutos.
 * Use `width` como largura máxima de textos — ex.: critical = 810 × 1140.
 * Base de fitFontSize() (engine/src/utils/fitText.ts).
 */
export const safeBox = (zone: keyof typeof SAFE_AREA): Box => {
  const i = SAFE_AREA[zone];
  return {
    x: i.left,
    y: i.top,
    width: FORMAT.width - i.left - i.right,
    height: FORMAT.height - i.top - i.bottom,
  };
};
