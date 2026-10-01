/**
 * Reels Engine IA — engine: biblioteca reutilizável.
 *
 * Este arquivo NÃO é um entry point do Remotion. Ele apenas reexporta a
 * biblioteca. Cada projeto recebe uma cópia desta pasta em
 * projects/<slug>/src/engine/ no momento em que é criado (npm run new).
 *
 * Catálogo e regras de promoção de componentes: engine/COMPONENTES.md
 */
export * from './constants/format';
export * from './constants/safeArea';
export * from './utils/timeline';
export * from './utils/fitText';
export * from './utils/fonts';
export * from './utils/legibility';
export * from './animations/presets';
export * from './animations/Animate';
export * from './animations/KenBurns';
export * from './components/SafeAreaOverlay';
export * from './components/SceneTrack';
export * from './components/ClipTrack';
export * from './components/Pill';
export * from './components/Scrim';
export * from './components/Grain';
export * from './components/Cutout';
export * from './audio/Soundtrack';
