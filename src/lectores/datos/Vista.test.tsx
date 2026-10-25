import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { elementoFalso } from '../pruebas/falsos';
import { obtenerMotor } from './motor';
import { type DatosTabla, perfilar } from './perfil';
import VistaDatos from './Vista';

const CSV = `ts,cliente,status,latencia_ms,bytes
2026-10-17T17:40:00Z,ureq,200,31,1200
2026-10-17T17:41:00Z,reqwest,504,30000,
2026-10-17T17:42:00Z,ureq,200,33,1500
2026-10-17T17:43:00Z,reqwest,200,35,1700
2026-10-17T17:44:00Z,ureq,504,30000,1900
2026-10-17T17:45:00Z,ureq,200,32,2100
2026-10-17T17:46:00Z,reqwest,200,34,2300
2026-10-17T17:47:00Z,ureq,200,36,2500
`;

function datos(n: number, texto: string) {
  const base = elementoFalso(n, texto, 'datos');
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo: 'datos' as const,
      ref: `DAT-${String(n).padStart(4, '0')}` as typeof base.frontmatter.ref,
      lector: { nombre: 'datos', version: 1, resumen: { formato: 'csv' } },
    },
  };
}

describe('vista de Datos', () => {
  let perfil: DatosTabla;
  beforeAll(async () => {
    perfil = await perfilar(await obtenerMotor(), new TextEncoder().encode(CSV), 'csv');
  }, 60_000);
  afterEach(() => cleanup());

  it('columnas como la referencia: nombre y tipo, forma y avisos en ámbar', () => {
    const { container } = render(<VistaDatos el={datos(1, CSV)} datos={perfil} />);
    const filas = [...container.querySelectorAll('.tabla-columnas tr')];
    expect(filas.map((f) => f.querySelector('b.mono')?.textContent)).toEqual([
      'ts',
      'cliente',
      'status',
      'latencia_ms',
      'bytes',
    ]);
    const latencia = filas[3] as HTMLElement;
    expect(latencia.querySelector('svg.histograma-datos rect')).toBeTruthy();
    expect(within(latencia).getByText(/^2 en el máximo \(30\.?000\)$/)).toBeTruthy();
    expect(within(filas[4] as HTMLElement).getByText('1 nulo')).toBeTruthy();
    expect(within(filas[1] as HTMLElement).getByText(/ureq/)).toBeTruthy();
    // Gráfico rápido de una columna numérica, con su descripción.
    expect(screen.getByRole('img', { name: /^Histograma de status/ })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'latencia_ms' } });
    expect(screen.getByRole('img', { name: /^Histograma de latencia_ms/ })).toBeTruthy();
    // Vista previa con sus nulos.
    expect(container.querySelectorAll('.tabla-vista-previa tbody tr')).toHaveLength(5);
    expect(container.querySelector('.tabla-vista-previa .faint')?.textContent).toBe('null');
  });

  it('el aviso de muestra por encima del límite', () => {
    render(<VistaDatos el={datos(2, CSV)} datos={{ ...perfil, muestra: { filas: 8, aproximadas: 80 } }} />);
    expect(
      screen.getByText('Perfil sobre una muestra de 8 filas de 80 aproximadas (los primeros 50 MB).'),
    ).toBeTruthy();
  });

  it('la consulta SQL sobre la tabla datos: resultado y cuánto tardó', async () => {
    const { container } = render(<VistaDatos el={datos(3, CSV)} datos={perfil} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await waitFor(() => expect(container.querySelectorAll('.tabla-resultado tbody tr')).toHaveLength(8), ESCRITURA);
    expect(screen.getByText(/^8 filas · DuckDB-WASM, en el navegador · \d+ ms$/)).toBeTruthy();
  }, 30_000);

  it('un error de la consulta se enseña sin romper nada', async () => {
    render(<VistaDatos el={datos(4, CSV)} datos={{ ...perfil, formato: 'parquet' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(await screen.findByText(/^La consulta no salió: /, {}, ESCRITURA)).toBeTruthy();
  }, 30_000);
});

describe('capturar un CSV', () => {
  beforeAll(async () => {
    await import('../../rutas/inicio/Inicio');
  }, 120_000);
  afterEach(async () => {
    cleanup();
    useCompositor.setState({ texto: '' });
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('se guarda con el lector datos y Rimor dice su forma y lo raro', async () => {
    const { espacio } = await montarApp('/');
    const caja = await screen.findByRole('textbox', { name: 'Capturar' }, PRIMERA_CARGA);
    act(() => useCompositor.getState().setTexto(CSV));
    fireEvent.keyDown(caja, { key: 'Enter' });
    await waitFor(() => expect(espacio.repositorio.elementos()[0]?.lector.nombre).toBe('datos'), ESCRITURA);
    // El nombre de la columna va en mono: el texto está repartido en varios elementos.
    await waitFor(
      () =>
        expect(document.querySelector('.rimor p')?.textContent).toBe(
          '8 filas y 5 columnas. Hay 2 latencias de 30 s y 1 nulo en bytes.',
        ),
      { timeout: 20_000 },
    );
  }, 40_000);
});
