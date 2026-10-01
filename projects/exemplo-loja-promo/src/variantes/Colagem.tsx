import React from 'react';
import type {CSSProperties} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {
  Animate,
  FORMAT,
  Cutout,
  Grain,
  type Entrance,
  SceneTrack,
  type TrackItem,
  type TransitionSpec,
  hookTiming,
  safeBox,
  secondsToFrames,
  staggerDelay,
} from '../engine';
import {FONT} from '../styles/fonts';
import {CENAS} from './cenas';

/**
 * Colagem / recorte — ritmo médio · assimétrico · recortada · movimento "degraus".
 * Palavras em pedaços de papel, tortas, com sombra dura, entrando quadro a quadro (12 fps).
 * Fundo de papel com grão. O hook ("Chegou!") usa hookTiming(): legível até 0,5 s.
 */
const PERSONALIDADE = 'degraus' as const;
const PAPEL = '#EFE6D2';
const TINTA = '#1B1B1B';
// Pares texto/papel com contraste ≥ 4,5:1 (o Cutout avisa no console se não tiver).
const CORES = {tomate: '#C23B1E', mostarda: '#FFC914', agua: '#17BEBB', tinta: TINTA, papel: '#FFFDF6'};
const box = safeBox('critical');

type Peca = {
  texto?: string;
  forma?: 'circulo' | 'faixa' | 'seta';
  x: number; // % da caixa crítica
  y: number;
  rot: number;
  cor: keyof typeof CORES;
  corTexto?: keyof typeof CORES;
  size?: number;
  rasgada?: boolean;
  entrada?: Entrance;
};

const CENA_PECAS: Peca[][] = [
  [
    {texto: 'Chegou!', x: 0, y: 22, rot: -5, cor: 'tomate', corTexto: 'papel', size: 165, rasgada: true, entrada: 'popIn'},
    {forma: 'circulo', x: 68, y: 58, rot: 0, cor: 'mostarda'},
    {texto: 'NOVO', x: 52, y: 63, rot: 9, cor: 'tinta', corTexto: 'mostarda', size: 84, entrada: 'popIn'},
  ],
  [
    {texto: 'a coleção', x: 0, y: 18, rot: 3, cor: 'mostarda', corTexto: 'tinta', size: 120, entrada: 'slideRight'},
    {texto: 'de verão', x: 12, y: 42, rot: -4, cor: 'tinta', corTexto: 'papel', size: 132, rasgada: true, entrada: 'slideLeft'},
    {forma: 'faixa', x: 6, y: 74, rot: -2, cor: 'agua'},
  ],
  [
    {forma: 'circulo', x: -6, y: 8, rot: 0, cor: 'tomate'},
    {texto: 'cores', x: 12, y: 26, rot: -3, cor: 'agua', corTexto: 'tinta', size: 150, entrada: 'popIn'},
    {texto: 'leves', x: 28, y: 50, rot: 5, cor: 'papel', corTexto: 'tomate', size: 150, rasgada: true, entrada: 'popIn'},
  ],
  [
    {texto: 'peças', x: 2, y: 20, rot: 4, cor: 'tomate', corTexto: 'papel', size: 150, rasgada: true, entrada: 'slideRight'},
    {texto: 'novas', x: 20, y: 44, rot: -6, cor: 'mostarda', corTexto: 'tinta', size: 150, entrada: 'slideLeft'},
    {forma: 'faixa', x: 0, y: 80, rot: 4, cor: 'tinta'},
  ],
  [
    {texto: 'Loja', x: 8, y: 22, rot: -2, cor: 'tinta', corTexto: 'mostarda', size: 190, entrada: 'popIn'},
    {texto: 'Exemplo', x: 2, y: 46, rot: 3, cor: 'papel', corTexto: 'tinta', size: 130, rasgada: true, entrada: 'popIn'},
  ],
  [
    {texto: 'Visite', x: 2, y: 20, rot: 4, cor: 'agua', corTexto: 'tinta', size: 140, entrada: 'slideRight'},
    {texto: 'a loja', x: 18, y: 44, rot: -5, cor: 'tomate', corTexto: 'papel', size: 150, rasgada: true, entrada: 'popIn'},
    {forma: 'seta', x: 58, y: 70, rot: -18, cor: 'tinta'},
  ],
];

const TRANSICOES: Record<number, TransitionSpec> = {
  1: {type: 'wipe', direction: 'direita'},
  3: {type: 'wipe', direction: 'cima'},
};

const Forma: React.FC<{forma: NonNullable<Peca['forma']>; cor: string}> = ({forma, cor}) => {
  const s: Record<string, CSSProperties> = {
    circulo: {width: 260, height: 260, borderRadius: '50%', background: cor},
    faixa: {width: 520, height: 46, background: cor},
    seta: {width: 0, height: 0, borderTop: '70px solid transparent', borderBottom: '70px solid transparent', borderLeft: `150px solid ${cor}`},
  };
  return <div style={s[forma]} />;
};

const Cena: React.FC<{pecas: Peca[]; seed: string; hook?: boolean}> = ({pecas, seed, hook = false}) => (
  <AbsoluteFill style={{background: PAPEL}}>
    {/* Textura de papel: grão leve no fundo bege (também evita faixas na recompressão). */}
    <Grain opacity={0.35} frequency={0.7} blend="multiply" />
    {pecas.map((p, i) => (
      <div key={i} style={{position: 'absolute', left: box.x + (box.width * p.x) / 100, top: box.y + (box.height * p.y) / 100}}>
        <Animate
          preset={p.entrada ?? 'popIn'}
          personality={PERSONALIDADE}
          {...(hook && i === 0 ? hookTiming(PERSONALIDADE, FORMAT.fps) : {delay: staggerDelay(i, 5, hook ? 8 : 0)})}
        >
          {p.forma ? (
            <div style={{transform: `rotate(${p.rot}deg)`, filter: 'drop-shadow(8px 10px 0 rgba(0,0,0,0.25))'}}>
              <Forma forma={p.forma} cor={CORES[p.cor]} />
            </div>
          ) : (
            <Cutout paper={CORES[p.cor]} ink={CORES[p.corTexto ?? 'tinta']} rotate={p.rot} torn={p.rasgada} seed={`${seed}-${i}`} padding={22}>
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: p.size ?? 140,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.texto}
              </div>
            </Cutout>
          )}
        </Animate>
      </div>
    ))}
  </AbsoluteFill>
);

export const Colagem: React.FC = () => {
  const {fps} = useVideoConfig();
  const items: TrackItem[] = CENAS['colagem-recorte'].map((c, i) => ({
    id: c.id,
    durationInFrames: secondsToFrames(c.durationInSeconds, fps),
    transition: TRANSICOES[i],
    content: <Cena pecas={CENA_PECAS[i]} seed={c.id} hook={i === 0} />,
  }));
  return <SceneTrack items={items} personality={PERSONALIDADE} />;
};
