import { EditorView } from '@codemirror/view';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { VeredictoDatos } from '../../rutas/comparacion/VistaDatos';
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
    render(<VistaDatos el={datos(2, CSV)} datos={{ ...perfil, muestra: { filas: 8, total: 80, exacto: false } }} />);
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

/** Abre la consulta, espera al editor y escribe en él esta consulta. */
async function escribirConsulta(contenedor: HTMLElement, sql: string) {
  const resumen = within(contenedor).getByText('Consulta SQL');
  if (!resumen.closest('details')?.open) fireEvent.click(resumen);
  const editor = await waitFor(() => {
    const dom = contenedor.querySelector('.cm-editor');
    if (!dom) throw new Error('sin editor');
    return dom as HTMLElement;
  }, ESCRITURA);
  const vista = EditorView.findFromDOM(editor);
  act(() => vista?.dispatch({ changes: { from: 0, to: vista.state.doc.length, insert: sql } }));
}

describe('revisión de IN-044: la consulta', () => {
  let perfil: DatosTabla;
  beforeAll(async () => {
    perfil = await perfilar(await obtenerMotor(), new TextEncoder().encode(CSV), 'csv');
  }, 60_000);
  afterEach(() => cleanup());

  it('el resultado se recorta antes de convertirlo y se anuncia en la región viva', async () => {
    const { container } = render(<VistaDatos el={datos(10, CSV)} datos={perfil} />);
    await escribirConsulta(container, 'SELECT * FROM range(1000)');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await waitFor(() => expect(container.querySelectorAll('.tabla-resultado tbody tr')).toHaveLength(200), ESCRITURA);
    expect(
      screen.getByText(/^1000 filas · DuckDB-WASM, en el navegador · \d+ ms · Se enseñan las primeras 200 filas\.$/),
    ).toBeTruthy();
    expect(screen.getAllByRole('status').some((r) => r.textContent === 'Consulta hecha: 1000 filas.')).toBe(true);
  }, 30_000);

  it('cada ejecución en su conexión: lo que crea una consulta no se queda para la siguiente', async () => {
    const { container } = render(<VistaDatos el={datos(11, CSV)} datos={perfil} />);
    await escribirConsulta(container, 'CREATE TEMP TABLE resto AS SELECT 1 AS x; SELECT * FROM resto');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await waitFor(() => expect(container.querySelectorAll('.tabla-resultado tbody tr')).toHaveLength(1), ESCRITURA);
    await escribirConsulta(container, 'SELECT * FROM resto');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(await screen.findByText(/^La consulta no salió: .*resto/, {}, ESCRITURA)).toBeTruthy();
    // Y la tabla `datos` se vuelve a crear en cada una.
    await escribirConsulta(container, 'SELECT count(*) AS n FROM datos');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await waitFor(() => expect(container.querySelector('.tabla-resultado td')?.textContent).toBe('8'), ESCRITURA);
  }, 30_000);

  it('dos elementos a la vez: cada consulta ve sus datos', async () => {
    const otro = 'a,b\n1,2\n3,4\n5,6\n';
    const otroPerfil = await perfilar(await obtenerMotor(), new TextEncoder().encode(otro), 'csv');
    const uno = render(<VistaDatos el={datos(12, CSV)} datos={perfil} />);
    const dos = render(<VistaDatos el={datos(13, otro)} datos={otroPerfil} />);
    await escribirConsulta(uno.container, 'SELECT count(*) FROM datos');
    await escribirConsulta(dos.container, 'SELECT count(*) FROM datos');
    fireEvent.click(within(uno.container).getByRole('button', { name: 'Ejecutar' }));
    fireEvent.click(within(dos.container).getByRole('button', { name: 'Ejecutar' }));
    await waitFor(() => expect(uno.container.querySelector('.tabla-resultado td')?.textContent).toBe('8'), ESCRITURA);
    await waitFor(() => expect(dos.container.querySelector('.tabla-resultado td')?.textContent).toBe('3'), ESCRITURA);
  }, 30_000);

  it('al salir, el archivo se suelta del motor', async () => {
    const motor = await obtenerMotor();
    const quitar = vi.spyOn(motor, 'quitar');
    const { unmount } = render(<VistaDatos el={datos(14, CSV)} datos={perfil} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(await screen.findByText(/^8 filas · /, {}, ESCRITURA)).toBeTruthy();
    unmount();
    expect(quitar).toHaveBeenCalledWith(expect.stringMatching(/^rimor_consulta_\d+\.csv$/));
    quitar.mockRestore();
  }, 30_000);

  it('sin original ni adjunto, lo dice con palabras (no con un código)', async () => {
    const base = datos(15, CSV);
    render(<VistaDatos el={{ ...base, original: null }} datos={perfil} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(
      await screen.findByText(
        'La consulta no salió: No se encuentra el archivo de estos datos en el espacio.',
        {},
        ESCRITURA,
      ),
    ).toBeTruthy();
  }, 30_000);

  it('la ayuda dice ⌘ en Mac; los nombres de columna son cabeceras de fila; el aviso de las primeras filas', () => {
    const plataforma = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = render(
      <VistaDatos el={datos(16, CSV)} datos={{ ...perfil, muestra: { filas: 100, total: 200, exacto: true } }} />,
    );
    expect(screen.getByText('La tabla se llama «datos». ⌘+Intro para ejecutar.')).toBeTruthy();
    expect(container.querySelectorAll('.tabla-columnas th[scope="row"]')).toHaveLength(5);
    expect(screen.getByText('Perfil sobre las primeras 100 filas de 200.')).toBeTruthy();
    plataforma.mockRestore();
  });

  it('el veredicto avisa si solo cambia el tipo de una columna', () => {
    const { container } = render(
      <VeredictoDatos
        r={{ filas_a: 3, filas_b: 3, cambian: 0, columnas_anadidas: 0, columnas_quitadas: 0, columnas_tipo: 1 }}
      />,
    );
    expect(container.querySelector('.verdict')?.className).toContain('warn');
    expect(container.textContent).toContain('1 columna cambia de tipo');
  });
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
