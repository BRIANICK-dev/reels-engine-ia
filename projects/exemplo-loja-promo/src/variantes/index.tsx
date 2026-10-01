import type React from 'react';
import {Cinetica} from './Cinetica';
import {Colagem} from './Colagem';
import {Premium} from './Premium';

/** Uma implementação por linguagem do exemplo (o mesmo roteiro). */
export const VARIANTES: Record<string, React.FC> = {
  'tipografia-cinetica': Cinetica,
  'elegante-premium': Premium,
  'colagem-recorte': Colagem,
};
