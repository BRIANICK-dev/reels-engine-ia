import project from '../project.json';
import type {Scene} from './engine';
import {CENAS} from './variantes/cenas';

/**
 * Timeline do projeto — espelha o storyboard.md.
 * O exemplo tem o mesmo roteiro em três linguagens; a composição "Main"
 * usa a linguagem declarada em project.json → "linguagem".
 * A soma das cenas PRECISA bater com "durationSeconds".
 */
export const SCENES: Scene[] = CENAS[project.linguagem as string] ?? [];
