import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { compararLogs } from '../../comparaciones/logs';
import { analizar } from '../../lectores/log/analisis';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { VistaComparacionLogs } from './VistaLogs';

describe('vista de la comparación de logs', () => {
  it('donde una se acaba (aunque tenga líneas vacías al final), lo dice en vez de una celda vacía', () => {
    const buena = 'INFO a\nINFO b\n\n';
    const mala = 'INFO a\nINFO b\nERROR c';
    const c = compararLogs(analizar(buena), analizar(mala));
    expect(c.divergencia).toBe(2);
    render(<VistaComparacionLogs c={c} buena={elementoFalso(1, buena, 'log')} mala={elementoFalso(2, mala, 'log')} />);
    const filas = [...document.querySelectorAll('.tabla-divergencia tr')].map((f) => f.textContent);
    expect(filas).toEqual(['buena(se acaba aquí)', 'malaERROR c']);
    expect(screen.getByText('Solo en la mala')).toBeTruthy();
  });
});
