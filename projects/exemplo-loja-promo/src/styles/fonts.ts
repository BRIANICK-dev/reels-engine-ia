import {staticFile} from 'remotion';
import {fontCss, type FontSpec} from '../engine';

/**
 * Única mídia versionada do exemplo: Inter (fonte variável, pesos 100–900),
 * licença SIL Open Font License 1.1 — ver assets/fonts/OFL.txt.
 */
export const FONTS: FontSpec[] = [
  {family: 'Inter', src: staticFile('fonts/inter-latin-wght-normal.woff2'), weight: '100 900'},
];

/** Nome da família já entre aspas (docs/13-ARMADILHAS-REMOTION.md, item 3). */
export const FONT = fontCss('Inter');
