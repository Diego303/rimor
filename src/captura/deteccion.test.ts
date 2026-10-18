import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esTipoElemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { REGISTRO } from '../lectores/registro';
import { type Ejemplo, evaluar, formatear } from './deteccion';

/** Acierto mínimo del corpus; sube según entran lectores (IN-040 lo deja en 0,9). */
const ACIERTO_MINIMO = 0.85;
/** Ejemplos mínimos por tipo (IN-013). */
const EJEMPLOS_POR_TIPO = 25;

const RAIZ = join(process.cwd(), 'fixtures/deteccion');

function leerCorpus(): Ejemplo[] {
  return readdirSync(RAIZ, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(RAIZ, d.name))
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .map((f) => ({
          esperado: d.name,
          archivo: `${d.name}/${f}`,
          texto: readFileSync(join(RAIZ, d.name, f), 'utf8'),
        })),
    );
}

describe('corpus de detección', () => {
  const corpus = leerCorpus();
  const tipos = [...new Set(corpus.map((e) => e.esperado))];

  it('cada carpeta es un tipo y tiene al menos 25 ejemplos', () => {
    expect(tipos.length).toBeGreaterThan(0);
    for (const tipo of tipos) {
      expect(esTipoElemento(tipo), tipo).toBe(true);
      expect(corpus.filter((e) => e.esperado === tipo).length, tipo).toBeGreaterThanOrEqual(EJEMPLOS_POR_TIPO);
    }
  });

  it(`acierta al menos el ${ACIERTO_MINIMO * 100} % con los lectores registrados`, () => {
    const ev = evaluar(corpus, REGISTRO);
    // `pnpm deteccion` activa el informe: la matriz de confusión y el acierto por tipo.
    if (process.env.DETECCION_INFORME) console.log(`\nMatriz de detección\n\n${formatear(ev)}\n`);
    expect(ev.acierto, formatear(ev)).toBeGreaterThanOrEqual(ACIERTO_MINIMO);
  });
});
