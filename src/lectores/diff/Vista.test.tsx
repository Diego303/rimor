import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../pruebas/falsos';
import { analizarDiff } from './analisis';
import VistaDiff, { MAX_FILAS } from './Vista';

const fixture = (n: string) => readFileSync(join(process.cwd(), 'src/lectores/diff/fixtures', n), 'utf8');

describe('vista de Diff', () => {
  it('cifras, una tarjeta por archivo y sus filas lado a lado con los números de línea', () => {
    const texto = fixture('git-varios.diff');
    const { container } = render(<VistaDiff el={elementoFalso(1, texto, 'diff')} datos={analizarDiff(texto)} />);
    expect([...container.querySelectorAll('.stat .v')].map((v) => v.textContent)).toEqual(['5', '+5', '−4']);
    const archivos = [...container.querySelectorAll('.diff-archivo')];
    expect(archivos.map((a) => a.querySelector('.diff-ruta')?.textContent)).toEqual([
      'src/cliente.rs',
      'src/nuevo.rs',
      'src/viejo.rs',
      'docs/b.md',
      'logo.png',
    ]);
    const cliente = archivos[0] as HTMLElement;
    expect(within(cliente).getByText('modificado')).toBeTruthy();
    // La fila de la línea 12: la quitada a la izquierda y la añadida a la derecha.
    const fila = [...cliente.querySelectorAll('.diff-fila')].find((f) => f.querySelector('.r'));
    expect(fila?.querySelector('.r .ln')?.textContent).toBe('12');
    expect(fila?.querySelector('.a .ln')?.textContent).toBe('12');
    expect(fila?.querySelector('.r')?.textContent).toContain('from_secs(30)');
    // La añadida sin pareja deja la izquierda vacía.
    expect(cliente.querySelector('.diff-fila .vacia')).toBeTruthy();
    expect(within(archivos[3] as HTMLElement).getByText('antes docs/a.md')).toBeTruthy();
    expect(within(archivos[4] as HTMLElement).getByText('Sin líneas que enseñar.')).toBeTruthy();
  });

  it('un archivo enorme enseña sus primeras filas y «Ver todo»', () => {
    const n = MAX_FILAS + 50;
    const texto = `--- a/x.txt\n+++ b/x.txt\n@@ -0,0 +1,${n} @@\n${Array.from({ length: n }, (_, i) => `+l${i}`).join('\n')}\n`;
    const { container } = render(<VistaDiff el={elementoFalso(2, texto, 'diff')} datos={analizarDiff(texto)} />);
    // La cabecera del trozo cuenta como fila.
    expect(container.querySelectorAll('.diff-fila:not(.diff-titulos)')).toHaveLength(MAX_FILAS - 1);
    fireEvent.click(screen.getByRole('button', { name: `Ver todo (${n} líneas)` }));
    expect(container.querySelectorAll('.diff-fila:not(.diff-titulos)')).toHaveLength(n);
  });
});
