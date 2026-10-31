import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { escribirTexto, leerTexto } from '../../almacen/contrato';
import { previsualizar } from '../../captura/previa';
import { opcionesCaptura } from '../../espacio/ajustes';
import { useEspacio } from '../../estado/espacio';
import { elegirIdioma } from '../../i18n/iniciar';
import { REGISTRO } from '../../lectores/registro';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

const ajustesGuardados = async (almacen: Parameters<typeof leerTexto>[0]) =>
  JSON.parse((await leerTexto(almacen, '.rimor/ajustes.json')) ?? '{}');

describe('Ajustes', () => {
  beforeAll(async () => {
    await import('./Ajustes');
  }, 120_000);

  afterEach(async () => {
    act(() => elegirIdioma('es'));
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('tema e idioma se aplican y se guardan en el espacio', async () => {
    const { almacen } = await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    // Tres tarjetas abiertas y lo demás plegado (guía §8.3), como Datos y copias.
    expect([...document.querySelectorAll('.card.ajustes > h3')].map((h) => h.textContent)).toEqual([
      'Apariencia',
      'Detección',
      'Respuestas de Rimor',
    ]);
    expect(document.querySelectorAll('details.more:not([open])')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    await waitFor(
      async () => expect(await ajustesGuardados(almacen)).toMatchObject({ tema: 'oscuro', idioma: 'en' }),
      ESCRITURA,
    );
  }, 30_000);

  it('una regla de secretos desactivada no se oculta (en la vista previa y en la captura)', async () => {
    const { espacio, almacen } = await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    const github = screen.getByRole('checkbox', { name: 'Tokens de GitHub' }) as HTMLInputElement;
    expect(github.checked).toBe(true);
    fireEvent.click(github);
    expect(screen.getByText('Lo que case con una regla desactivada se guardará tal cual.')).toBeTruthy();
    await waitFor(
      async () => expect((await ajustesGuardados(almacen)).secretos.desactivadas).toEqual(['github']),
      ESCRITURA,
    );
    const token = `ghp_${'a'.repeat(36)}`;
    expect(previsualizar(`token ${token}`, REGISTRO, opcionesCaptura(espacio.ajustes())).secretos).toBe(0);
    expect(previsualizar(`token ${token}`, REGISTRO).secretos).toBe(1);
  }, 30_000);

  it('el margen de duda y las respuestas por tipo se guardan', async () => {
    const { espacio, almacen } = await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    const rango = screen.getByRole('slider', { name: 'Margen de duda' });
    fireEvent.change(rango, { target: { value: '30' } });
    fireEvent.pointerUp(rango);
    expect(screen.getByText('Dudar entre dos tipos cuando están a menos de 30 puntos')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Log' }));
    await waitFor(async () => {
      const a = await ajustesGuardados(almacen);
      expect(a.deteccion.duda).toBe(0.3);
      expect(a.respuestas.desactivadas).toEqual(['log']);
    }, ESCRITURA);
    expect(opcionesCaptura(espacio.ajustes()).margen).toBe(0.3);
  }, 30_000);

  it('abrir un espacio con su tema y su idioma en los ajustes los aplica', async () => {
    localStorage.setItem('rimor:tema', 'claro');
    await montarApp('/ajustes', [], (almacen) =>
      escribirTexto(almacen, '.rimor/ajustes.json', JSON.stringify({ esquema: 1, tema: 'oscuro', idioma: 'en' })),
    );
    expect(await screen.findByRole('heading', { name: 'Settings' }, PRIMERA_CARGA)).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('rimor:tema')).toBe('oscuro');
  }, 30_000);
});

describe('Ajustes: casos de la revisión', () => {
  beforeAll(async () => {
    await import('./Ajustes');
  }, 120_000);
  afterEach(async () => {
    vi.restoreAllMocks();
    act(() => useEspacio.setState({ soloLectura: false }));
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('en la pestaña que solo lee, tema e idioma también están deshabilitados', async () => {
    await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    act(() => useEspacio.setState({ soloLectura: true }));
    expect((screen.getByRole('button', { name: 'Oscuro' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'English' }) as HTMLButtonElement).disabled).toBe(true);
  }, 30_000);

  it('el margen se guarda al poco de moverlo, sin soltar ni salir; el tema sigue a los ajustes de la otra pestaña', async () => {
    const { almacen, espacio } = await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    fireEvent.change(screen.getByRole('slider', { name: 'Margen de duda' }), { target: { value: '25' } });
    await waitFor(async () => expect((await ajustesGuardados(almacen)).deteccion?.duda).toBe(0.25), ESCRITURA);
    // La otra pestaña cambia el tema: llega con la relectura de los ajustes.
    await act(() => espacio.guardarAjustes((a) => ({ ...a, tema: 'oscuro' })));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');
  }, 30_000);

  it('todos los tipos en las respuestas; el aviso de secretos en una región viva; un fallo al guardar se dice', async () => {
    const { almacen } = await montarApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    expect(screen.getByRole('checkbox', { name: 'JSON / TOML' })).toBeTruthy();
    const region = screen.getAllByRole('status').find((r) => r.classList.contains('warn-texto'));
    expect(region?.textContent).toBe('');
    const escribir = almacen.escribir.bind(almacen);
    vi.spyOn(almacen, 'escribir').mockImplementation(async (ruta, datos) => {
      if (ruta === '.rimor/ajustes.json') throw new Error('disco lleno');
      return escribir(ruta, datos);
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tokens de GitHub' }));
    expect(region?.textContent).toBe('Lo que case con una regla desactivada se guardará tal cual.');
    expect(
      (await screen.findAllByText('No se pudo guardar el ajuste: vale ahora, pero no al volver a abrir.')).length,
    ).toBeGreaterThan(0);
  }, 30_000);

  it('las reglas aprendidas: editar el prefijo y el tipo, un prefijo que no vale, borrar y vacío (IN-049)', async () => {
    const reglas = {
      esquema: 1,
      reglas: [
        { prefijo: '[app]', tipo: 'log', creada: '2026-10-31T18:00:00+01:00' },
        { prefijo: 'svc:', tipo: 'error', creada: '2026-10-31T18:00:00+01:00' },
      ],
      correcciones: [],
      descartadas: [],
    };
    const { almacen } = await montarApp('/ajustes', [], (a) =>
      escribirTexto(a, '.rimor/reglas-deteccion.json', JSON.stringify(reglas)),
    );
    await screen.findByRole('heading', { name: 'Reglas aprendidas' }, PRIMERA_CARGA);
    const guardadas = async () =>
      JSON.parse((await leerTexto(almacen, '.rimor/reglas-deteccion.json')) ?? '{}').reglas as { prefijo: string }[];
    const prefijos = () => screen.getAllByRole('textbox', { name: /^Prefijo de la regla \d$/ }) as HTMLInputElement[];
    expect(prefijos().map((c) => c.value)).toEqual(['[app]', 'svc:']);

    // El prefijo se guarda al salir del campo.
    fireEvent.change(prefijos()[0] as HTMLInputElement, { target: { value: 'app:' } });
    fireEvent.blur(prefijos()[0] as HTMLInputElement);
    await waitFor(async () => expect((await guardadas()).map((r) => r.prefijo)).toEqual(['app:', 'svc:']), ESCRITURA);
    // Uno repetido (o vacío) no vale: se dice y no se guarda.
    fireEvent.change(prefijos()[0] as HTMLInputElement, { target: { value: 'svc:' } });
    fireEvent.blur(prefijos()[0] as HTMLInputElement);
    expect(screen.getByText(/Ese prefijo no vale/)).toBeTruthy();
    expect(prefijos()[0]?.getAttribute('aria-invalid')).toBe('true');
    expect(prefijos()[0]?.value).toBe('app:');
    // El tipo, con los que tienen lector (sin los binarios).
    const tipo = screen.getByRole('combobox', { name: 'Tipo de la regla 2' }) as HTMLSelectElement;
    expect([...tipo.options].map((o) => o.value)).not.toContain('imagen');
    fireEvent.change(tipo, { target: { value: 'json' } });
    await waitFor(
      async () => expect((await guardadas())[1]).toMatchObject({ prefijo: 'svc:', tipo: 'json' }),
      ESCRITURA,
    );
    // Borrar las dos: queda el texto de vacío.
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la regla app:' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la regla svc:' }));
    await waitFor(async () => expect(await guardadas()).toEqual([]), ESCRITURA);
    expect(screen.getByText(/Ninguna todavía/)).toBeTruthy();
    // El botón se fue: el foco, al título de la lista.
    expect(document.activeElement?.textContent).toBe('Reglas aprendidas');
  }, 30_000);

  it('un archivo de reglas que no se entiende se dice (y no se toca)', async () => {
    const roto = '{"esquema": 1, "reglas": [roto';
    const { almacen } = await montarApp('/ajustes', [], (a) => escribirTexto(a, '.rimor/reglas-deteccion.json', roto));
    expect(await screen.findByText(/no se entiende/, {}, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.queryByText(/Ninguna todavía/)).toBeNull();
    expect(await leerTexto(almacen, '.rimor/reglas-deteccion.json')).toBe(roto);
  }, 30_000);
});
