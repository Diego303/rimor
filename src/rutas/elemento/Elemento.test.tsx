import 'fake-indexeddb/auto';
import { type Elemento, hashOriginal, isoConZona, PREFIJOS } from '@rimor/formato';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import type { Cerrojos } from '../../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { ejecutorEnHilo } from '../../lectores/ejecutor';
import { ProveedorLectores } from '../../lectores/Lectores';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { REGISTRO } from '../../lectores/registro';
import { crearRouter } from '../rutas';

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
/** La primera pantalla carga en frío sus módulos y la vista del lector: se mira lo que pinta, no cuánto tarda. */
const PRIMERA_CARGA = { timeout: 15_000 };
/** Las escrituras van en turno por elemento: bajo carga, alguna tarda más de lo que `waitFor` espera por defecto. */
const ESCRITURA = { timeout: 5000 };

/** Un texto o una idea capturados hoy, hace media hora. */
function capturado(i: number, original: string, tipo: 'texto' | 'idea' = 'texto', titulo = original): Elemento {
  const base = elementoFalso(i, original, tipo);
  const creado = isoConZona(new Date(Date.now() - 30 * 60_000));
  const ref = `${PREFIJOS[tipo]}-${String(i).padStart(4, '0')}` as Elemento['frontmatter']['ref'];
  return {
    ...base,
    frontmatter: { ...base.frontmatter, ref, tipo, titulo, creado, modificado: creado, hash: hashOriginal(original) },
  };
}

/** Otra pestaña tiene el cerrojo: esta abre el espacio para leer (y espera a que lo suelte). */
const cerrojosOcupados: Cerrojos = {
  request: (_n, o, fn) => (o.ifAvailable ? fn(null) : new Promise(() => undefined)),
};

async function montar(
  ruta: string,
  elementos: Elemento[],
  { almacen = new AlmacenMemoria(), soloLectura = false } = {},
) {
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: `elemento-${Math.random()}`,
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos: soloLectura ? cerrojosOcupados : cerrojos,
    canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
    enMemoria: false,
  });
  const abierto: { e: ReturnType<typeof useEspacioOpcional> } = { e: null };
  function Espia() {
    abierto.e = useEspacioOpcional();
    return null;
  }
  const router = crearRouter(createMemoryHistory({ initialEntries: ['/datos'] }));
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={REGISTRO} ejecutar={ejecutorEnHilo(REGISTRO)}>
        <Espia />
        <RouterProvider router={router} />
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  await waitFor(() => expect(abierto.e).toBeTruthy(), PRIMERA_CARGA);
  const repo = abierto.e?.repositorio;
  if (!repo) throw new Error('sin repositorio');
  await act(async () => {
    for (const el of elementos) await repo.guardarElemento(el);
  });
  await act(() => router.navigate({ to: ruta }));
  return { abierto, router, repo, almacen };
}

const tecla = (key: string, extra: Record<string, unknown> = {}) =>
  act(() => void fireEvent.keyDown(window, { key, ...extra }));
const leer = async (repo: { leerElemento: (r: string) => Promise<{ ok: boolean; valor?: Elemento }> }, r: string) => {
  const leido = await repo.leerElemento(r);
  if (!leido.ok || !leido.valor) throw new Error(`no se lee ${r}`);
  return leido.valor;
};

describe('Elemento', () => {
  beforeAll(async () => {
    // También las pantallas a las que lleva (Inicio al mover a la papelera, Datos al montar): que su carga en
    // diferido no termine después de la prueba.
    await import('../inicio/Inicio');
    await import('../datos/Datos');
    await import('./Elemento');
    await import('../../lectores/texto/Vista');
    await import('../../lectores/idea/Vista');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    useEspacio.setState({ soloLectura: false });
  });

  it('cabecera: chips, meta, título en el sitio (Enter, Esc, vacío), estado y fijar con teclado', async () => {
    const { repo } = await montar('/e/TXT-0001', [capturado(1, 'Revisar el timeout del gateway')]);
    const titulo = await screen.findByRole('button', { name: 'Revisar el timeout del gateway' }, PRIMERA_CARGA);
    expect(titulo.closest('h2')).toBeTruthy();
    expect(screen.getByText('Texto', { selector: '.kchip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estado: nuevo. Cambiar' }).className).toContain('acc');
    expect(document.querySelector('.ah .meta')?.textContent).toMatch(/^Pegado hoy a las \d\d:\d\d/);

    // e: el título pasa a ser un campo; Enter guarda y el archivo se renombra (la ref y el id no cambian).
    await tecla('e');
    const campo = screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement;
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: '  Timeout del gateway   en staging ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.titulo).toBe('Timeout del gateway en staging'), ESCRITURA);
    expect(repo.buscar('TXT-0001')?.ruta).toMatch(/TXT-0001--timeout-del-gateway-en-staging\.md$/);
    await screen.findByRole('button', { name: 'Timeout del gateway en staging' });

    // Esc deja el título como estaba; vacío no se guarda.
    const modificado = repo.frontmatter('TXT-0001')?.modificado;
    fireEvent.click(screen.getByRole('button', { name: 'Timeout del gateway en staging' }));
    const otra = screen.getByRole('textbox', { name: 'Título' });
    fireEvent.change(otra, { target: { value: 'Esto no' } });
    fireEvent.keyDown(otra, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Timeout del gateway en staging' }));
    const vacia = screen.getByRole('textbox', { name: 'Título' });
    fireEvent.change(vacia, { target: { value: '   ' } });
    fireEvent.keyDown(vacia, { key: 'Enter' });
    await act(async () => new Promise((r) => setTimeout(r, 100)));
    expect(repo.frontmatter('TXT-0001')?.titulo).toBe('Timeout del gateway en staging');
    expect(repo.frontmatter('TXT-0001')?.modificado).toBe(modificado);

    // s: la lista de estados; uno se elige con un clic.
    await tecla('s');
    fireEvent.click(await screen.findByRole('button', { name: 'resuelto' }));
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.estado).toBe('resuelto'), ESCRITURA);
    await screen.findByRole('button', { name: 'Estado: resuelto. Cambiar' });
    // «nuevo» es no tener estado.
    fireEvent.click(screen.getByRole('button', { name: 'Estado: resuelto. Cambiar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'nuevo' }));
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.estado).toBeUndefined(), ESCRITURA);

    // f: fijar (el botón de la cabecera lo dice).
    await tecla('f');
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.fijado).toBe(true), ESCRITURA);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Fijar' }).getAttribute('aria-pressed')).toBe('true'),
    );
    // Dos seguidos, antes de que se relea: sueltan y vuelven a fijar (cada uno alterna lo que hay al escribir).
    await tecla('f');
    await tecla('f');
    await waitFor(() => expect(screen.getAllByText('Fijado TXT-0001').length).toBeGreaterThan(1), ESCRITURA);
    expect(repo.frontmatter('TXT-0001')?.fijado).toBe(true);
  }, 40_000);

  it('Detalles: colecciones y etiquetas en el sitio, el original y cambiar el tipo (con su alias)', async () => {
    const { repo, router, abierto } = await montar('/e/TXT-0001', [
      capturado(1, 'Probar ureq con respuestas de 64 KB en el gateway', 'texto', 'Probar ureq'),
      {
        ...capturado(2, 'Otro', 'texto'),
        frontmatter: { ...capturado(2, 'Otro').frontmatter, colecciones: ['gestion'] },
      },
    ]);
    await screen.findByRole('button', { name: 'Probar ureq' }, PRIMERA_CARGA);
    const detalles = await screen.findByText('Detalles', { selector: 'summary' }, PRIMERA_CARGA);
    const plegado = within(detalles.closest('details') as HTMLElement);
    expect(plegado.getByText('Secretos ocultados')).toBeTruthy();
    expect(plegado.getByText('TXT-0001', { selector: '.mono' })).toBeTruthy();

    // Colecciones: se escriben en el sitio, con las existentes sugeridas.
    const [colecciones, etiquetas] = plegado.getAllByRole('button', { name: 'Ninguna' });
    fireEvent.click(colecciones as HTMLElement);
    const campo = plegado.getByRole('textbox', { name: 'Colecciones, separadas por espacios' });
    fireEvent.change(campo, { target: { value: '@Gateway ges' } });
    fireEvent.click(plegado.getByRole('button', { name: 'gestion' }));
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.colecciones).toEqual(['gateway', 'gestion']), ESCRITURA);
    await screen.findByRole('button', { name: 'gateway · gestion' });

    fireEvent.click(etiquetas as HTMLElement);
    const campoEtiquetas = plegado.getByRole('textbox', { name: 'Etiquetas, separadas por espacios' });
    fireEvent.change(campoEtiquetas, { target: { value: '#ureq #staging' } });
    fireEvent.keyDown(campoEtiquetas, { key: 'Enter' });
    await waitFor(() => expect(repo.frontmatter('TXT-0001')?.etiquetas).toEqual(['ureq', 'staging']), ESCRITURA);
    await screen.findByRole('button', { name: '#ureq #staging' });

    // Ver original: el texto tal cual.
    fireEvent.click(plegado.getByRole('button', { name: 'Ver original' }));
    expect((await screen.findByText(/respuestas de 64 KB/, { selector: 'pre' })).textContent).toBe(
      'Probar ureq con respuestas de 64 KB en el gateway',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    // Cambiar tipo: reprocesa, lleva a la ref nueva y suma una corrección; la vieja queda como alias.
    fireEvent.click(plegado.getByRole('button', { name: 'Cambiar tipo' }));
    fireEvent.click(await screen.findByRole('button', { name: /Idea/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/IDE-0001'), ESCRITURA);
    await waitFor(() => expect(abierto.e?.contadores.total('correccionesDeTipo')).toBe(1), ESCRITURA);
    expect(repo.frontmatter('IDE-0001')?.alias).toEqual(['TXT-0001']);
    expect(await screen.findByText(/antes TXT-0001/, {}, PRIMERA_CARGA)).toBeTruthy();

    // La ref antigua sigue llevando a él.
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/IDE-0001'), ESCRITURA);
  }, 40_000);

  it('notas: añadir con Ctrl+Intro, Esc deja la nota y salir del campo guarda', async () => {
    const { repo } = await montar('/e/TXT-0001', [capturado(1, 'Medir con 1 MB')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir una nota' }, PRIMERA_CARGA));
    const campo = screen.getByRole('textbox', { name: 'Tus notas' });
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: 'Pasa sin **content-length**.\n' } });
    fireEvent.keyDown(campo, { key: 'Enter', ctrlKey: true });
    await waitFor(
      async () => expect((await leer(repo, 'TXT-0001')).notas).toBe('Pasa sin **content-length**.'),
      ESCRITURA,
    );
    expect((await screen.findByText('content-length', { selector: 'strong' })).textContent).toBe('content-length');

    // n: editar; Esc no cambia nada.
    await tecla('n');
    const otra = screen.getByRole('textbox', { name: 'Tus notas' });
    fireEvent.change(otra, { target: { value: 'No' } });
    fireEvent.keyDown(otra, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Tus notas' })).toBeNull();

    // Salir del campo guarda.
    fireEvent.click(screen.getByRole('button', { name: 'Editar la nota' }));
    const tercera = screen.getByRole('textbox', { name: 'Tus notas' });
    fireEvent.change(tercera, { target: { value: 'Resuelto con into_reader.' } });
    fireEvent.blur(tercera);
    await waitFor(
      async () => expect((await leer(repo, 'TXT-0001')).notas).toBe('Resuelto con into_reader.'),
      ESCRITURA,
    );
  }, 40_000);

  it('estados propios del tipo: los de una idea (sin los que no se eligen a mano) y los comunes', async () => {
    const { repo } = await montar('/e/IDE-0001', [capturado(1, 'Exportar minipapers con Typst', 'idea')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Estado: semilla. Cambiar' }, PRIMERA_CARGA));
    const opciones = (await screen.findAllByRole('button')).filter((b) => b.closest('.lista-estados'));
    expect(opciones.map((b) => b.textContent)).toEqual([
      'semilla',
      'explorando',
      'aparcada',
      'descartada',
      'en uso',
      'resuelto',
      'archivado',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'explorando' }));
    await waitFor(() => expect(repo.frontmatter('IDE-0001')?.estado).toBe('explorando'), ESCRITURA);

    // Un estado común en una idea: su vista lo nombra (no la clave) y su segmentado queda sin marcar.
    const segmentado = await screen.findByRole('group', { name: 'Estado de la idea' }, PRIMERA_CARGA);
    await tecla('s');
    fireEvent.click(await screen.findByRole('button', { name: 'resuelto' }));
    await waitFor(() => expect(repo.frontmatter('IDE-0001')?.estado).toBe('resuelto'), ESCRITURA);
    await waitFor(() =>
      expect([...segmentado.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent)).toEqual([]),
    );
    expect(document.body.textContent).not.toContain('estados.');

    // En la papelera, su vista tampoco deja cambiarlo.
    await act(async () => void (await repo.moverAPapelera('IDE-0001')));
    expect(await screen.findByText(/Está en la papelera/, {}, PRIMERA_CARGA)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Estado de la idea' })).toBeNull());
    expect(screen.getByText('resuelto', { selector: '.card p' })).toBeTruthy();
  }, 40_000);

  it('papelera: Supr la mueve y vuelve a Inicio con deshacer; dentro, solo se lee y se restaura', async () => {
    const { repo, router } = await montar('/e/TXT-0001', [capturado(1, 'Algo que sobra')]);
    await screen.findByRole('button', { name: 'Algo que sobra' }, PRIMERA_CARGA);
    await tecla('Delete');
    await waitFor(() => expect(repo.buscar('TXT-0001')?.enPapelera).toBe(true), ESCRITURA);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.getAllByText('TXT-0001 está en la papelera').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(repo.buscar('TXT-0001')?.enPapelera).toBe(false), ESCRITURA);

    await act(async () => void (await repo.moverAPapelera('TXT-0001')));
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    expect(await screen.findByText(/Está en la papelera/, {}, PRIMERA_CARGA)).toBeTruthy();
    // En la papelera no se edita: el título es texto y no hay atajos de edición.
    expect(screen.queryByRole('button', { name: 'Algo que sobra' })).toBeNull();
    await tecla('f');
    await act(async () => new Promise((r) => setTimeout(r, 100)));
    expect(repo.frontmatter('TXT-0001')?.fijado).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(repo.buscar('TXT-0001')?.enPapelera).toBe(false), ESCRITURA);
    await screen.findByRole('button', { name: 'Algo que sobra' });
  }, 40_000);

  it('pestaña de solo lectura: se ve todo y no se edita nada', async () => {
    // Lo guarda la pestaña que escribe; después se abre en otra mientras aquella sigue con el cerrojo.
    const { almacen } = await montar('/e/TXT-0001', [capturado(1, 'Solo para leer')]);
    await screen.findByRole('button', { name: 'Solo para leer' }, PRIMERA_CARGA);
    cleanup();
    await montar('/e/TXT-0001', [], { almacen, soloLectura: true });
    expect(await screen.findByRole('heading', { name: 'Solo para leer' }, PRIMERA_CARGA)).toBeTruthy();
    expect(useEspacio.getState().soloLectura).toBe(true);
    expect(screen.queryByRole('button', { name: 'Solo para leer' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Estado:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fijar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cambiar tipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Añadir una nota' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Ver original' }, PRIMERA_CARGA)).toBeTruthy();
  }, 40_000);

  it('una ref que no existe: la cabecera con la ref y cómo volver', async () => {
    const { router } = await montar('/e/TXT-0099', []);
    expect(await screen.findByText('No encuentro este elemento', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'TXT-0099' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Inicio' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  }, 40_000);
});
