import type {Scene} from './engine';

/**
 * Timeline do projeto — espelha o storyboard.md.
 *
 * Enquanto estiver vazia, a duração vem só de project.json.
 * Quando houver cenas, a soma PRECISA bater com "durationSeconds"
 * (o Studio e o render acusam erro se divergir).
 *
 * Exemplo:
 *   {id: 'hook', durationInSeconds: 2, label: 'Imagem de impacto + pergunta'},
 */
export const SCENES: Scene[] = [];
