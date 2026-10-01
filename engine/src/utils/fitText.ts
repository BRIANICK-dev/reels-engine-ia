/**
 * Ajuste de tamanho de fonte para caber na safe area.
 *
 * Problema que resolve: com fontSize fixo + whiteSpace 'nowrap', palavras
 * longas estouram a zona critical e entram na coluna de ações do Instagram
 * (ex.: uma palavra de 10 letras em caixa alta a 144 px bold passa de 900 px
 * de largura; a zona critical tem 810).
 *
 * Mede o texto com canvas no próprio navegador do Remotion — o mesmo motor
 * que renderiza —, sem dependências extras.
 *
 * IMPORTANTE: a fonte precisa estar CARREGADA antes da medição. Com fontes
 * de arquivo (assets/fonts), chame depois de carregar a fonte (FontFace +
 * delayRender/continueRender). Fontes de sistema variam entre computadores:
 * em projetos reais, use arquivos de fonte.
 */

type FontSpec = {
  fontFamily: string;
  fontWeight?: number | string;
  /** Tracking em em (ex.: -0.014 ≈ -2 px a 144 px). */
  letterSpacingEm?: number;
};

let ctx: CanvasRenderingContext2D | null = null;
const getContext = (): CanvasRenderingContext2D | null => {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  ctx = document.createElement('canvas').getContext('2d');
  return ctx;
};

/** Largura em px de uma linha de texto (sem quebra). */
export const measureTextWidth = ({
  text,
  fontSize,
  fontFamily,
  fontWeight = 400,
  letterSpacingEm = 0,
}: FontSpec & {text: string; fontSize: number}): number => {
  const c = getContext();
  if (!c) return 0;
  c.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  // O navegador aplica letter-spacing após cada caractere, inclusive o último.
  return c.measureText(text).width + letterSpacingEm * fontSize * [...text].length;
};

/**
 * Maior tamanho de fonte (≤ maxFontSize) em que TODAS as linhas cabem em maxWidth.
 * Passe as linhas exatamente como serão exibidas (uma por item).
 * Se nem minFontSize couber, retorna minFontSize e avisa no console:
 * nesse caso o texto precisa ser reescrito ou quebrado em mais linhas.
 */
export const fitFontSize = ({
  lines,
  maxWidth,
  maxFontSize,
  minFontSize = Math.round(maxFontSize * 0.5),
  ...font
}: FontSpec & {
  lines: string[];
  maxWidth: number;
  maxFontSize: number;
  minFontSize?: number;
}): number => {
  const widest = Math.max(
    ...lines.map((text) => measureTextWidth({text, fontSize: maxFontSize, ...font})),
  );
  if (widest <= 0 || widest <= maxWidth) return maxFontSize;

  // Largura escala linearmente com o tamanho da fonte.
  const fitted = Math.floor((maxFontSize * maxWidth) / widest);
  if (fitted < minFontSize) {
    console.warn(
      `[fitFontSize] "${lines.join(' / ')}" não cabe em ${maxWidth}px nem com ${minFontSize}px. ` +
        'Reescreva o texto ou quebre em mais linhas.',
    );
    return minFontSize;
  }
  return fitted;
};
