/**
 * Legibilidade no celular — mínimos do motor (docs/08-INSTAGRAM.md).
 *
 *  - Texto secundário: altura de caixa alta de pelo menos ~40 px num quadro
 *    de 1080 px de largura. Nas fontes sem serifa comuns a caixa alta mede
 *    ~0,7 do corpo → fontSize mínimo de 56 px. Em caixa baixa, a altura-x
 *    (~0,5 do corpo) pede ~72 px.
 *  - Pesos finos (abaixo de 400) só com corpo grande (≥ 80 px).
 *  - Contraste mínimo de 4,5:1 entre texto e fundo (WCAG AA).
 *
 * O preflight confere o que dá para ver no código (tamanhos e pares de cor
 * literais); Pill e Cutout avisam no console do Studio/render quando o
 * contraste das cores recebidas fica abaixo do mínimo.
 */
export const LEGIBILITY = {
  minCapHeightPx: 40,
  capHeightRatio: 0.7,
  minFontSize: 56,
  minFontSizeLowercase: 72,
  thinWeightBelow: 400,
  minFontSizeThin: 80,
  minContrast: 4.5,
} as const;

const parseHex = (color: string): [number, number, number] | null => {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Razão de contraste WCAG entre duas cores hex (#rgb ou #rrggbb). null se alguma não for hex. */
export const contrastRatio = (a: string, b: string): number | null => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const warned = new Set<string>();

/** Avisa uma vez no console (Studio e log do render) se o contraste ficar abaixo do mínimo. */
export const warnLowContrast = (where: string, text: string, background: string): void => {
  const r = contrastRatio(text, background);
  if (r === null || r >= LEGIBILITY.minContrast) return;
  const key = `${where}|${text}|${background}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[legibilidade] ${where}: contraste ${r.toFixed(2)}:1 entre ${text} e ${background} (mínimo ${LEGIBILITY.minContrast}:1). Escureça o fundo ou mude a cor do texto.`,
  );
};
