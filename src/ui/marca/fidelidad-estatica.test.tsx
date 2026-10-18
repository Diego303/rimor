import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ESTADOS_SENAL, type EstadoSenal } from './estadosSenal';
import { GUION, ONDA } from './geometria';
import { Senal } from './Senal';

/**
 * Lo estático de cada SVG de rimor-animaciones (complementa fidelidad.test.ts, que mira lo animado): los
 * elementos que dibuja cada estado son los mismos que dibuja `Senal`.
 */
// happy-dom sustituye la clase URL: rutas de texto desde la raíz del repositorio.
const carpeta = join(process.cwd(), 'src/ui/marca/referencia');
const svgs = readdirSync(carpeta);

function papeles(svg: string): string[] {
  const salida: string[] = [];
  for (const m of svg.matchAll(/<(path|circle|text)\b([^>]*)>/g)) {
    const [, etiqueta, attrs = ''] = m;
    if (etiqueta === 'text') salida.push(attrs.includes('Roboto Mono') ? 'frase' : 'nombre');
    else if (etiqueta === 'circle') salida.push(attrs.includes('fill="none"') ? 'anillo' : 'punto');
    else if (attrs.includes(`d="${GUION}"`)) salida.push('guion');
    else if (/stroke="#(A8A49B|5E5B55)"/i.test(attrs)) salida.push('referencia');
    else if (attrs.includes('stroke-dasharray="26 74"')) salida.push('tramo');
    else if (attrs.includes(`d="${ONDA}"`) && /opacity="0\.\d+"/.test(attrs)) salida.push('tenue');
    else if (attrs.includes(`d="${ONDA}"`)) salida.push('onda');
  }
  return salida.sort();
}

describe('elementos de cada estado frente a su SVG', () => {
  for (const [estado, def] of Object.entries(ESTADOS_SENAL) as [EstadoSenal, (typeof ESTADOS_SENAL)[EstadoSenal]][]) {
    it(estado, () => {
      const svg = readFileSync(join(carpeta, svgs.find((n) => n === `${def.svg}-claro.svg`) as string), 'utf8');
      const { container } = render(<Senal estado={estado} etiqueta="x" frase="del rumor a la conclusión" />);
      const pintados = [...(container.querySelector('svg')?.querySelectorAll('path, circle, text') ?? [])]
        .map((el) => [...el.classList].find((c) => c !== 'anima') ?? '')
        .sort();
      expect(pintados).toEqual(papeles(svg));
    });
  }
});
