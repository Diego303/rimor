import type { Elemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { leerTexto } from '../../almacen/contrato';
import { useCompositor } from '../../captura/compositor';
import { RUTA_AJUSTES } from '../../espacio/ajustes';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { elementoFalso } from '../pruebas/falsos';
import { fichaAnteriorDe, fichaDe } from './enriquecer/ficha';

const URL_REPO = 'https://github.com/algesten/ureq';

function enlace(n: number, url: string): Elemento {
  const base = elementoFalso(n, url, 'enlace');
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo: 'enlace',
      ref: `URL-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      titulo: 'algesten/ureq',
      lector: { nombre: 'enlace', version: 1, resumen: { url, clase: 'repositorio', sitio: 'GitHub', huella: url } },
    },
  };
}

/** `fetch` falso para GitHub: las estrellas que diga `estrellas` (o sin red). */
function github(estado: { estrellas: number; sinRed?: boolean }) {
  const pedidas: string[] = [];
  const pedir = vi.fn(async (url: string) => {
    pedidas.push(url);
    if (estado.sinRed) throw new TypeError('Failed to fetch');
    if (url.endsWith('/releases/latest'))
      return new Response(JSON.stringify({ tag_name: '2.10.1', published_at: '2026-10-13T12:00:00Z' }));
    if (url === 'https://api.github.com/repos/algesten/ureq')
      return new Response(
        JSON.stringify({
          stargazers_count: estado.estrellas,
          license: { spdx_id: 'MIT' },
          pushed_at: new Date().toISOString(),
        }),
      );
    return new Response('no', { status: 404 });
  });
  return { pedir, pedidas };
}

const ajustesDe = async (almacen: { leer(r: string): Promise<Uint8Array | null> }) =>
  JSON.parse((await leerTexto(almacen as never, RUTA_AJUSTES)) ?? '{}');

describe('ficha de un enlace', () => {
  beforeAll(async () => {
    await import('../../rutas/elemento/Elemento');
    await import('./Vista');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('antes de la primera consulta dice qué dominio consultaría; «Activar y consultar» lo activa y guarda la ficha', async () => {
    const red = github({ estrellas: 1290 });
    vi.stubGlobal('fetch', red.pedir);
    const { espacio, almacen } = await montarApp('/e/URL-0001', [enlace(1, URL_REPO)]);
    const tarjeta = (await screen.findByRole('heading', { name: 'Ficha' }, PRIMERA_CARGA)).closest(
      'section',
    ) as HTMLElement;
    expect(within(tarjeta).getByText('Se puede completar consultando api.github.com.')).toBeTruthy();
    // Nada se ha consultado aún.
    expect(red.pedidas).toEqual([]);
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Activar y consultar' }));
    expect(await within(tarjeta).findByText('1290', {}, ESCRITURA)).toBeTruthy();
    expect(within(tarjeta).getByText(/^Consultada .* en api\.github\.com$/)).toBeTruthy();
    expect((await ajustesDe(almacen)).red.dominios).toEqual(['api.github.com']);
    // Solo el dominio activado.
    expect(red.pedidas.every((u) => u.startsWith('https://api.github.com/'))).toBe(true);
    await waitFor(() => expect(fichaDe(espacio.repositorio.frontmatter('URL-0001') ?? ({} as never))).toBeTruthy());
  }, 30_000);

  it('«Volver a consultar» guarda la anterior y enseña qué cambió', async () => {
    const estado = { estrellas: 1290 };
    vi.stubGlobal('fetch', github(estado).pedir);
    const { espacio } = await montarApp('/e/URL-0001', [enlace(1, URL_REPO)], async (almacen) => {
      await almacen.escribir(
        RUTA_AJUSTES,
        new TextEncoder().encode(JSON.stringify({ esquema: 1, red: { dominios: ['api.github.com'] } })),
      );
    });
    const tarjeta = (await screen.findByRole('heading', { name: 'Ficha' }, PRIMERA_CARGA)).closest(
      'section',
    ) as HTMLElement;
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Consultar' }));
    expect(await within(tarjeta).findByText('1290', {}, ESCRITURA)).toBeTruthy();
    estado.estrellas = 1300;
    fireEvent.click(await within(tarjeta).findByRole('button', { name: 'Volver a consultar' }, ESCRITURA));
    const cambios = (await within(tarjeta).findByText(/^Cambios desde la consulta del/, {}, ESCRITURA)).closest(
      'details',
    );
    expect(within(cambios as HTMLElement).getByText('1290 → 1300')).toBeTruthy();
    const fm = espacio.repositorio.frontmatter('URL-0001');
    expect(fm && fichaAnteriorDe(fm)?.campos.estrellas).toBe(1290);
  }, 30_000);

  it('sin red: la señal «sin-conexion», «Sin red: guardado sin enriquecer.» y «Reintentar»', async () => {
    const red = github({ estrellas: 1, sinRed: true });
    vi.stubGlobal('fetch', red.pedir);
    await montarApp('/e/URL-0001', [enlace(1, URL_REPO)], async (almacen) => {
      await almacen.escribir(
        RUTA_AJUSTES,
        new TextEncoder().encode(JSON.stringify({ esquema: 1, red: { dominios: ['api.github.com'] } })),
      );
    });
    const tarjeta = (await screen.findByRole('heading', { name: 'Ficha' }, PRIMERA_CARGA)).closest(
      'section',
    ) as HTMLElement;
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Consultar' }));
    const aviso = await within(tarjeta).findByText('Sin red: guardado sin enriquecer.', {}, ESCRITURA);
    expect(aviso.querySelector('.senal-sin-conexion')).toBeTruthy();
    // En una región viva que ya estaba, junto al botón (que no se ha ido: el foco sigue en él).
    expect(aviso.getAttribute('role')).toBe('status');
    expect(within(tarjeta).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  }, 30_000);

  it('con ficha pero su dominio apagado en Ajustes, no se vuelve a activar solo: lo dice y pide «Activar y consultar»', async () => {
    const red = github({ estrellas: 5 });
    vi.stubGlobal('fetch', red.pedir);
    const conFicha = enlace(1, URL_REPO);
    conFicha.frontmatter = {
      ...conFicha.frontmatter,
      ficha: { fuente: 'github', consultada: '2026-10-20T10:00:00+02:00', campos: { estrellas: 3 } },
    } as Elemento['frontmatter'];
    await montarApp('/e/URL-0001', [conFicha]);
    const tarjeta = (await screen.findByRole('heading', { name: 'Ficha' }, PRIMERA_CARGA)).closest(
      'section',
    ) as HTMLElement;
    expect(within(tarjeta).getByText('Se puede completar consultando api.github.com.')).toBeTruthy();
    expect(within(tarjeta).queryByRole('button', { name: 'Volver a consultar' })).toBeNull();
    expect(within(tarjeta).getByRole('button', { name: 'Activar y consultar' })).toBeTruthy();
    expect(red.pedidas).toEqual([]);
  }, 30_000);

  it('un fallo de la consulta al capturar se ve al abrir el enlace', async () => {
    vi.stubGlobal('fetch', github({ estrellas: 1, sinRed: true }).pedir);
    const { espacio } = await montarApp('/e/URL-0003', [enlace(3, URL_REPO)], async (almacen) => {
      await almacen.escribir(
        RUTA_AJUSTES,
        new TextEncoder().encode(JSON.stringify({ esquema: 1, red: { dominios: ['api.github.com'] } })),
      );
    });
    const { enriquecerElemento } = await import('./enriquecer/aplicar');
    await act(async () => void (await enriquecerElemento(espacio, 'URL-0003')));
    cleanup();
    await montarApp('/e/URL-0003', [enlace(3, URL_REPO)]);
    expect(await screen.findByText('Sin red: guardado sin enriquecer.', {}, PRIMERA_CARGA)).toBeTruthy();
  }, 30_000);

  it('un enlace sin proveedor (una web cualquiera) no tiene ficha', async () => {
    await montarApp('/e/URL-0002', [enlace(2, 'https://example.com/articulo')]);
    expect(await screen.findByText('https://example.com/articulo', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ficha' })).toBeNull();
  }, 30_000);
});

describe('ajustes de red', () => {
  beforeAll(async () => {
    await import('../../rutas/ajustes/Ajustes');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    localStorage.clear();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('los dominios se activan en el espacio; el token de GitHub, solo en este navegador', async () => {
    const { almacen } = await montarApp('/ajustes');
    fireEvent.click(await screen.findByText('Red', { selector: 'summary' }, PRIMERA_CARGA));
    fireEvent.click(screen.getByRole('checkbox', { name: 'api.crossref.org' }));
    await waitFor(
      async () => expect((await ajustesDe(almacen)).red?.dominios).toEqual(['api.crossref.org']),
      ESCRITURA,
    );
    const token = screen.getByLabelText(/^Token de GitHub \(opcional\)/);
    fireEvent.change(token, { target: { value: 'ghp_secreto' } });
    fireEvent.blur(token);
    expect(localStorage.getItem('rimor:token-github')).toBe('ghp_secreto');
    expect(JSON.stringify(await ajustesDe(almacen))).not.toContain('ghp_secreto');
    // Uno con un carácter invisible pegado no se guarda, y se dice.
    fireEvent.change(token, { target: { value: 'ghp_\u200bmalo' } });
    fireEvent.blur(token);
    expect(localStorage.getItem('rimor:token-github')).toBe('ghp_secreto');
    expect(screen.getByText(/^Ese token tiene caracteres que no valen/)).toBeTruthy();
  }, 30_000);
});

describe('consulta al capturar', () => {
  beforeAll(async () => {
    await import('../../rutas/inicio/Inicio');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    useCompositor.setState({ texto: '' });
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  const capturar = async (texto: string) => {
    const caja = await screen.findByRole('textbox', { name: 'Capturar' }, PRIMERA_CARGA);
    act(() => useCompositor.getState().setTexto(texto));
    fireEvent.keyDown(caja, { key: 'Enter' });
  };

  it('con el dominio activado, la ficha llega sola y la respuesta la usa', async () => {
    vi.stubGlobal('fetch', github({ estrellas: 10 }).pedir);
    const { espacio } = await montarApp('/', [], async (almacen) => {
      await almacen.escribir(
        RUTA_AJUSTES,
        new TextEncoder().encode(JSON.stringify({ esquema: 1, red: { dominios: ['api.github.com'] } })),
      );
    });
    await capturar(URL_REPO);
    await waitFor(() => {
      const fm = espacio.repositorio.elementos().find((e) => e.tipo === 'enlace');
      expect(fm && fichaDe(fm)?.campos.estrellas).toBe(10);
    }, ESCRITURA);
    expect(await screen.findByText(/^Repositorio activo: último lanzamiento/, {}, ESCRITURA)).toBeTruthy();
  }, 30_000);

  it('sin dominios activados, ninguna petición', async () => {
    const red = github({ estrellas: 10 });
    vi.stubGlobal('fetch', red.pedir);
    const { espacio } = await montarApp('/');
    await capturar(URL_REPO);
    await waitFor(() => expect(espacio.repositorio.elementos().some((e) => e.tipo === 'enlace')).toBe(true), ESCRITURA);
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    expect(red.pedidas).toEqual([]);
  }, 30_000);
});
