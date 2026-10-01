# Reels Engine IA — engine

Biblioteca reutilizável de componentes, animações e utilitários usada por todos os vídeos criados com o Reels Engine IA.

## O que o engine É e o que NÃO É

| É | Não é |
|---|---|
| Biblioteca de código (`src/`) | Um projeto Remotion renderizável |
| Fonte da cópia que cada projeto recebe | Lugar de assets de clientes |
| Versionado junto com o motor (`VERSION` na raiz) | Lugar para ajustes de um vídeo específico |

O engine não tem `package.json`, `tsconfig.json`, `remotion.config.ts`, entry point, `Root.tsx`, composições, cenas, `public/` nem `renders/`. O `npm run new` se recusa a criar projetos se encontrar `Root.tsx`, `compositions/` ou `scenes/` em `engine/src/`. O ambiente de execução (Remotion, React, TypeScript) fica na **raiz** do repositório.

## Como é usado

`npm run new -- <slug> ...` copia `engine/src/` para `projects/<slug>/src/engine/` e registra a versão do motor (arquivo `VERSION` da raiz) como `engineVersion` no `project.json`.

A cópia é **congelada**: mudanças futuras no engine não alteram projetos existentes, então um vídeo aprovado continua renderizando igual.

```ts
// dentro de projects/<slug>/src/...
import {FORMAT, safePadding, safeBox, fitFontSize, SafeAreaOverlay, getSceneTimings, Animate, SceneTrack} from './engine';
```

## Estrutura

```
src/
├── index.ts         ← reexporta a biblioteca
├── constants/       ← format.ts (1080×1920, 30 fps), safeArea.ts (zonas)
├── utils/           ← timeline.ts (duração, cenas, frames), fitText.ts (títulos na safe area)
├── components/      ← SafeAreaOverlay, SceneTrack, ClipTrack, Pill, Scrim, Grain, Cutout
├── animations/      ← presets.ts (personalidades, entradas, transições), Animate, RevealText, KenBurns
└── audio/           ← Soundtrack
```

Fora de `src/`: `linguagens.json`, o catálogo de linguagens visuais (`docs/14-LINGUAGENS-VISUAIS.md`), lido pelos scripts e não copiado para os projetos.

## Evolução

Veja `COMPONENTES.md` para o catálogo e as regras de promoção.
