import type {Scene} from '../engine';

/**
 * Cortes de cada linguagem para o MESMO roteiro (src/roteiro.ts), 10 s no total.
 * A duração de cada corte respeita a faixa da linguagem (engine/linguagens.json):
 * tipografia cinética 0,4–1,0 s · colagem 1,2–2,2 s · elegante 2,5–4,5 s.
 * Só dados: src/timeline.ts importa daqui.
 */
export const CENAS: Record<string, Scene[]> = {
  'tipografia-cinetica': [
    {id: 'c01', durationInSeconds: 1.0, label: 'CHEGOU'},
    {id: 'c02', durationInSeconds: 0.9, label: 'A\nCOLEÇÃO'},
    {id: 'c03', durationInSeconds: 0.5, label: 'DE'},
    {id: 'c04', durationInSeconds: 1.0, label: 'VERÃO'},
    {id: 'c05', durationInSeconds: 0.7, label: 'CORES'},
    {id: 'c06', durationInSeconds: 0.8, label: 'LEVES'},
    {id: 'c07', durationInSeconds: 0.7, label: 'PEÇAS'},
    {id: 'c08', durationInSeconds: 0.8, label: 'NOVAS'},
    {id: 'c09', durationInSeconds: 0.7, label: 'LOJA'},
    {id: 'c10', durationInSeconds: 1.0, label: 'EXEMPLO'},
    {id: 'c11', durationInSeconds: 0.9, label: 'VISITE'},
    {id: 'c12', durationInSeconds: 1.0, label: 'VISITE\nA LOJA'},
  ],
  'elegante-premium': [
    {id: 'p01', durationInSeconds: 2.5, label: 'Chegou'},
    {id: 'p02', durationInSeconds: 2.5, label: 'a coleção de verão / cores leves · peças novas'},
    {id: 'p03', durationInSeconds: 2.5, label: 'Loja Exemplo'},
    {id: 'p04', durationInSeconds: 2.5, label: 'Visite a loja'},
  ],
  'colagem-recorte': [
    {id: 'k01', durationInSeconds: 1.5, label: 'Chegou!'},
    {id: 'k02', durationInSeconds: 2.0, label: 'a coleção de verão'},
    {id: 'k03', durationInSeconds: 1.5, label: 'cores leves'},
    {id: 'k04', durationInSeconds: 1.5, label: 'peças novas'},
    {id: 'k05', durationInSeconds: 1.5, label: 'Loja Exemplo'},
    {id: 'k06', durationInSeconds: 2.0, label: 'Visite a loja'},
  ],
};

export const LINGUAGENS_DO_EXEMPLO = Object.keys(CENAS);
