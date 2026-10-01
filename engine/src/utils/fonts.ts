/**
 * Fontes de arquivo (assets/fonts/) — carregamento e nome seguro para CSS.
 *
 * Duas armadilhas conhecidas (docs/13-ARMADILHAS-REMOTION.md):
 *  - nome de família com número SEM aspas é CSS inválido e o navegador ignora
 *    (o texto sai na fonte padrão). Use sempre fontCss().
 *  - não troque a raiz da composição enquanto a fonte carrega. loadFonts()
 *    segura o render com delayRender(): chame-o no nível do módulo.
 *
 *   // src/styles/fonts.ts
 *   import {staticFile} from 'remotion';
 *   import {fontCss, type FontSpec} from '../engine';
 *   export const FONTS: FontSpec[] = [{family: 'Fonte Exemplo', src: staticFile('fonts/fonte-exemplo.woff2'), weight: '100 900'}];
 *   export const FONT = fontCss('Fonte Exemplo');
 *
 *   // na composição (raiz estável; só o conteúdo interno depende da fonte):
 *   const ready = useFonts(FONTS);
 *   return <AbsoluteFill style={fundo}>{ready ? <Cenas /> : null}</AbsoluteFill>;
 *
 * useFonts() é o caminho recomendado quando o layout MEDE o texto
 * (fitFontSize): a medição só acontece depois que a fonte carregou, e o
 * render só continua depois disso.
 */
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';

export type FontSpec = {
  family: string;
  /** Caminho já resolvido: staticFile('fonts/arquivo.woff2'). */
  src: string;
  /** Peso único ("700") ou faixa de uma fonte variável ("100 900"). */
  weight?: string;
  style?: 'normal' | 'italic';
};

/** Valor pronto para `fontFamily`, com o nome entre aspas e um fallback. */
export const fontCss = (family: string, fallback = 'sans-serif'): string =>
  `'${family.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${fallback}`;

const formatOf = (src: string) => {
  const ext = src.split('?')[0].split('.').pop()?.toLowerCase();
  return ({woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype'} as Record<string, string>)[ext ?? ''] ?? 'woff2';
};

const loaded = new Map<string, Promise<void>>();

/**
 * Carrega as fontes com FontFace e segura o render (delayRender) até terminar.
 * Idempotente: chamar de novo com as mesmas fontes não recarrega.
 */
export const loadFonts = (fonts: FontSpec[]): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve();
  const key = fonts.map((f) => `${f.family}|${f.src}|${f.weight ?? ''}|${f.style ?? ''}`).join(';');
  const existing = loaded.get(key);
  if (existing) return existing;
  const handle = delayRender(`Carregando fontes: ${fonts.map((f) => f.family).join(', ')}`);
  const job = Promise.all(
    fonts.map(async (f) => {
      const face = new FontFace(f.family, `url('${f.src}') format('${formatOf(f.src)}')`, {
        weight: f.weight ?? 'normal',
        style: f.style ?? 'normal',
      });
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
  loaded.set(key, job);
  return job;
};

/**
 * Hook: carrega as fontes e devolve `true` quando estão prontas. Segura o
 * render (delayRender) até o componente redesenhar COM a fonte — assim medições
 * como fitFontSize() usam a fonte certa. Chame uma vez, na raiz da composição.
 */
export const useFonts = (fonts: FontSpec[]): boolean => {
  const [handle] = useState(() => delayRender(`Aguardando fontes: ${fonts.map((f) => f.family).join(', ')}`));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFonts(fonts)
      .then(() => alive && setReady(true))
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
    // As fontes de um projeto são fixas: carrega uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
