import { type Elemento, isoConZona, PREFIJOS, type TipoElemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { olvidarElementos } from '../../lectores/useElemento';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

/** Un elemento de hace `dias` días, con sus etiquetas y, si es un error, su huella. */
function el(n: number, tipo: TipoElemento, dias: number, etiquetas: string[], huella?: string): Elemento {
  const base = elementoFalso(n, `contenido ${n}`, tipo);
  const creado = isoConZona(new Date(Date.now() - dias * 86_400_000));
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo,
      ref: `${PREFIJOS[tipo]}-${String(n).padStart(4, '0')}`,
      titulo: `${tipo} ${n}`,
      creado,
      modificado: creado,
      etiquetas,
      colecciones: ['gateway'],
      lector: { nombre: tipo, version: 1, resumen: huella ? { huella } : {} },
    },
  };
}

const ELEMENTOS = [
  el(1, 'log', 1, ['ureq']),
  el(2, 'error', 1, ['ureq'], 'h-timeout'),
  el(3, 'error', 0, ['ureq'], 'h-timeout'),
  el(4, 'enlace', 3, ['otra']),
];

describe('Grupos', () => {
  beforeAll(async () => {
    await import('./Grupo');
    await import('../coleccion/Coleccion');
    await import('../elemento/Elemento');
    await import('../ajustes/Ajustes');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    // La caché de elementos es del módulo: la de otra prueba (con los mismos ids) no vale aquí.
    olvidarElementos();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('una etiqueta con su panel: qué hay, cuándo, qué se repite y sus elementos, con dos para comparar', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'etiqueta', valor: 'ureq' } }));
    expect(await screen.findByRole('heading', { name: '#ureq' }, PRIMERA_CARGA)).toBeTruthy();
    expect(document.querySelector('.ah .lbl')?.textContent).toBe('Etiqueta');
    expect(document.querySelector('.ah .meta')?.textContent).toMatch(/^3 elementos · desde el /);
    // Qué hay: una barra por tipo, de más a menos.
    const queHay = screen.getByRole('heading', { name: 'Qué hay' }).closest('section');
    expect([...(queHay?.querySelectorAll('.hb') ?? [])].map((b) => b.textContent)).toEqual(['Error2', 'Log1']);
    // Cuándo: 14 barras y el pico.
    expect(document.querySelectorAll('.grafico-cuando rect')).toHaveLength(14);
    expect(screen.getByText(/el pico es el día/)).toBeTruthy();
    // Se repite: la huella de los dos errores.
    const repite = screen.getByRole('heading', { name: 'Se repite' }).closest('section');
    expect(repite?.textContent).toContain('error 3');
    expect(repite?.textContent).toContain('2 veces');
    // Dos marcados: «Comparar»; uno solo, no.
    expect(screen.queryByRole('button', { name: 'Comparar' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Marcar «error 3» para comparar' }));
    expect(screen.queryByRole('button', { name: 'Comparar' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Marcar «error 2» para comparar' }));
    // Dos errores no se comparan (aún): el botón, deshabilitado, y el motivo en la pista.
    expect((screen.getByRole('button', { name: 'Comparar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Este tipo aún no se compara/)).toBeTruthy();
    // Con dos marcados, el tercero espera (no se desmarca uno sin decirlo).
    expect((screen.getByRole('checkbox', { name: 'Marcar «log 1» para comparar' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Exportar ZIP' })).toBeTruthy();
    // «Ver todas» lleva al grupo de esa huella (que no se repite a sí mismo), con la selección de nuevo vacía.
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/g/huella/h-timeout'), ESCRITURA);
    expect(await screen.findByRole('heading', { name: 'error 3' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Se repite' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comparar' })).toBeNull();
    expect(
      screen
        .getAllByRole('checkbox')
        .every((c) => !(c as HTMLInputElement).checked && !(c as HTMLInputElement).disabled),
    ).toBe(true);
  }, 30_000);

  it('una clase, un tipo o un valor que no existe: vacío; la colección, en su pantalla y con su panel', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'tipo', valor: 'foo' } }));
    expect(await screen.findByText('No hay nada en este grupo', {}, PRIMERA_CARGA)).toBeTruthy();
    // `/g/coleccion/…` lleva a la pantalla de la colección (con su nombre editable).
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'coleccion', valor: 'gateway' } }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/c/gateway'), ESCRITURA);
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'inventada', valor: 'x' } }));
    expect(await screen.findByText('No hay nada en este grupo', {}, PRIMERA_CARGA)).toBeTruthy();
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'etiqueta', valor: 'nadie' } }));
    expect(await screen.findByText('No hay nada en este grupo')).toBeTruthy();
    await act(() => router.navigate({ to: '/c/$coleccion', params: { coleccion: 'gateway' } }));
    expect(await screen.findByRole('heading', { name: 'Qué hay' }, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Se repite' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exportar ZIP' })).toBeTruthy();
  }, 30_000);

  it('los detalles de un elemento enlazan a sus grupos', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    const ref = ELEMENTOS[1]?.frontmatter.ref ?? '';
    await act(() => router.navigate({ to: '/e/$ref', params: { ref } }));
    // En «Detalles» (plegado).
    fireEvent.click(await screen.findByText('Detalles', { selector: 'summary' }, PRIMERA_CARGA));
    const etiqueta = await screen.findByRole('link', { name: '#ureq' });
    expect(etiqueta.getAttribute('href')).toContain('/g/etiqueta/ureq');
    // (Al abrirlo, su lector recalcula la huella del original: la de la prueba puede cambiar.)
    expect(screen.getByRole('link', { name: 'mismo error' }).getAttribute('href')).toContain('/g/huella/');
    expect(screen.getByRole('link', { name: 'Error' }).getAttribute('href')).toContain('/g/tipo/error');
    // Su colección no: ya tiene su fila (y su pantalla, desde el raíl).
    expect(document.querySelector('.grupos-elemento')?.textContent).not.toContain('gateway');
  }, 30_000);

  it('la lista enseña los 8 más recientes y «Ver los N»', async () => {
    const muchos = Array.from({ length: 11 }, (_, i) => el(10 + i, 'log', i, ['mucho']));
    const { router } = await montarApp('/ajustes', muchos);
    await act(() => router.navigate({ to: '/g/$clase/$valor', params: { clase: 'etiqueta', valor: 'mucho' } }));
    await screen.findByRole('heading', { name: '#mucho' }, PRIMERA_CARGA);
    expect(document.querySelectorAll('.fila-marcable')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Ver los 11' }));
    expect(document.querySelectorAll('.fila-marcable')).toHaveLength(11);
    expect(screen.getByRole('button', { name: 'Ver menos' })).toBeTruthy();
  }, 30_000);
});
