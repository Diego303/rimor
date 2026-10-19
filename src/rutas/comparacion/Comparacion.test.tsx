import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Elemento, hashOriginal, isoConZona } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { leerResultado } from '../../comparaciones/resultado';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');
const reqwest = leer('fixtures/mediciones/reqwest.txt');
const ureq = leer('fixtures/mediciones/ureq.txt');
const buena = leer('fixtures/comparaciones/buena.log');
const mala = leer('fixtures/comparaciones/mala.log');

const PREFIJO = { log: 'LOG', mediciones: 'MED' } as const;

/** Un log o unas mediciones capturados hoy, `minutos` antes de ahora. */
function capturado(n: number, tipo: 'log' | 'mediciones', original: string, titulo: string, minutos = 30): Elemento {
  const creado = isoConZona(new Date(Date.now() - minutos * 60_000));
  return {
    frontmatter: {
      id: `01JAB4C2Q2X8M5N7P0R4S6T8${String(n).padStart(2, '0')}`,
      ref: `${PREFIJO[tipo]}-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      tipo,
      titulo,
      creado,
      modificado: creado,
      origen: 'pegado',
      hash: hashOriginal(original),
      ocultados: 0,
      lector: { nombre: tipo, version: 1, resumen: {} },
    },
    notas: '',
    original,
  };
}

const sin = (s: string | null | undefined) => (s ?? '').replaceAll(' ', ' ');
/** El diálogo abierto con ese título (la pantalla tiene varios). */
const dialogoDe = (titulo: RegExp) =>
  within(screen.getByRole('heading', { name: titulo }).closest('dialog') as HTMLElement);
const tecla = (key: string, extra: Record<string, unknown> = {}) =>
  act(() => void fireEvent.keyDown(window, { key, ...extra }));

describe('Comparaciones', () => {
  beforeAll(async () => {
    await import('../inicio/Inicio');
    await import('../elemento/Elemento');
    await import('../ajustes/Ajustes');
    await import('../../lectores/log/Vista');
    await import('../../lectores/mediciones/Vista');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    useCompositor.setState({ texto: '', archivos: [], respondiendoA: null, busquedas: [] });
  });

  it('mediciones desde el elemento: «Comparar con…», el resultado de CMP-0004 e intercambiar', async () => {
    const { espacio, router } = await montarApp('/e/MED-0007', [
      capturado(7, 'mediciones', reqwest, 'reqwest 64 KB'),
      capturado(8, 'mediciones', ureq, 'ureq 64 KB'),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar con otras mediciones' }, PRIMERA_CARGA));
    const dialogo = dialogoDe(/Comparar MED-0007 con/);
    // Solo los del mismo tipo, sin él mismo; se puede filtrar.
    fireEvent.change(dialogo.getByRole('searchbox', { name: 'Filtrar por título o ref' }), {
      target: { value: 'ureq' },
    });
    expect(dialogo.queryByRole('button', { name: /reqwest 64 KB/ })).toBeNull();
    fireEvent.click(dialogo.getByRole('button', { name: /ureq 64 KB/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/CMP-0001'), ESCRITURA);

    // Como la referencia: −4,5 %, «ureq es un 4,5 % más rápido», p < 0,001 y 20 repeticiones cada uno.
    expect(sin((await screen.findByText(/más rápido/, {}, PRIMERA_CARGA)).textContent)).toBe(
      'ureq es un 4,5 % más rápido',
    );
    expect(sin(document.querySelector('.verdict .big')?.textContent)).toBe('−4,5 %');
    expect(sin(screen.getByText(/Mann-Whitney/).textContent)).toBe(
      'Diferencia significativa · Mann-Whitney, p < 0,001 · 20 repeticiones cada uno',
    );
    expect(screen.getByRole('heading', { name: 'reqwest frente a ureq' })).toBeTruthy();
    // Lo guardado se ve mientras se calcula; después, el gráfico y la tabla de dos filas.
    await waitFor(() => expect(document.querySelectorAll('.tabla-mediciones tbody tr')).toHaveLength(2), ESCRITURA);
    expect([...document.querySelectorAll('.tabla-mediciones tbody tr')].map((f) => sin(f.textContent))).toEqual([
      'reqwest38,54 ms38,11 – 39,022,3 %',
      'ureq36,80 ms36,20 – 37,292,9 %',
    ]);
    expect(screen.getByText(/Avisos de método/)).toBeTruthy();
    // Las cifras citables.
    expect(screen.getByText('cambio', { selector: '.st .mono' }).parentElement?.textContent).toMatch(/−4,5/);
    const fm = espacio.entidades.frontmatter('CMP-0001');
    expect(fm).toMatchObject({ clase: 'mediciones', fuentes: ['MED-0007', 'MED-0008'] });

    // Intercambiar: ureq pasa a ser la de referencia, y el título se da la vuelta.
    fireEvent.click(screen.getByRole('button', { name: 'Intercambiar' }));
    expect(await screen.findByText(/reqwest es un 4,7 % más lento/, {}, ESCRITURA)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ureq frente a reqwest' })).toBeTruthy();
    await waitFor(() => {
      const r = espacio.entidades.frontmatter('CMP-0001');
      expect(r?.tipo === 'comparacion' && leerResultado(r.resultado)?.clase).toBe('mediciones');
    }, ESCRITURA);
    // Al recalcular tras intercambiar no se avisa de que cambió una fuente.
    expect(screen.queryByText(/La comparación ha cambiado/)).toBeNull();
  }, 60_000);

  it('logs desde Inicio con x, x y Ctrl+Mayús+C: el resultado de CMP-0005', async () => {
    const { router } = await montarApp('/', [
      capturado(41, 'log', mala, 'Ejecución mala', 20),
      capturado(42, 'log', buena, 'Ejecución buena', 10),
    ]);
    await screen.findByRole('button', { name: 'Ejecución buena' }, PRIMERA_CARGA);
    // Con uno solo, dice qué hacer.
    await tecla('j');
    await tecla('x');
    await tecla('C', { ctrlKey: true, shiftKey: true });
    expect((await screen.findAllByText('Para comparar, selecciona dos con x.')).length).toBeGreaterThan(0);
    // La buena (la más reciente, la primera marcada) es la de referencia.
    await tecla('k');
    await tecla('x');
    expect(screen.getByRole('button', { name: 'Comparar' })).toBeTruthy();
    await tecla('C', { ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/CMP-0001'), ESCRITURA);

    expect(await screen.findByText('Aquí se separan', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(document.querySelector('.verdict .big')?.textContent).toBe('línea 4');
    expect(screen.getByText('4 mensajes nuevos en la mala · faltan 4 de la buena')).toBeTruthy();
    // Mientras se calcula se ve lo guardado; después, la línea de cada una en ese punto.
    await waitFor(() => expect(document.querySelectorAll('.tabla-divergencia tr')).toHaveLength(2), ESCRITURA);
    const filas = [...document.querySelectorAll('.tabla-divergencia tr')].map((f) => f.textContent);
    expect(filas).toEqual([
      'buena2026-10-16T16:40:03.402Z DEBUG stream: chunk 1 bytes=212',
      'mala2026-10-16T16:44:51.013Z WARN  http: response has no content-length, reading body to end',
    ]);
    const solo = screen.getByRole('heading', { name: 'Solo en la mala' }).closest('section') as HTMLElement;
    expect(solo.querySelectorAll('.plantilla-comparada')).toHaveLength(4);
    const faltan = screen.getByRole('heading', { name: 'Faltan en la mala' }).closest('section') as HTMLElement;
    expect(faltan.querySelectorAll('.plantilla-comparada')).toHaveLength(4);
    const cambian = screen.getByText('Cambian de frecuencia').closest('details') as HTMLElement;
    expect(cambian.querySelectorAll('.plantilla-comparada')).toHaveLength(2);
    expect(cambian.textContent).toContain('1 → 2 veces');
    // Meta con las fuentes pulsables.
    expect(document.querySelector('.ah .meta')?.textContent).toMatch(/LOG-0042 buena · LOG-0041 mala$/);
  }, 60_000);

  it('dos de distinto tipo: se explica por qué no', async () => {
    await montarApp('/', [
      capturado(41, 'log', buena, 'Un log', 20),
      capturado(7, 'mediciones', reqwest, 'Unas mediciones', 10),
    ]);
    await screen.findByRole('button', { name: 'Unas mediciones' }, PRIMERA_CARGA);
    await tecla('j');
    await tecla('x');
    await tecla('k');
    await tecla('x');
    await tecla('C', { ctrlKey: true, shiftKey: true });
    expect(
      (
        await screen.findAllByText(
          'No se pueden comparar. Solo se comparan dos del mismo tipo: Mediciones y Log no lo son.',
        )
      ).length,
    ).toBeGreaterThan(0);
  }, 60_000);

  it('si cambia una fuente, se recalcula y se avisa; si falta, se enseña lo guardado', async () => {
    const { espacio, router } = await montarApp('/e/MED-0007', [
      capturado(7, 'mediciones', reqwest, 'reqwest 64 KB'),
      capturado(8, 'mediciones', ureq, 'ureq 64 KB'),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar con otras mediciones' }, PRIMERA_CARGA));
    fireEvent.click(dialogoDe(/Comparar MED-0007 con/).getByRole('button', { name: /ureq/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/CMP-0001'), ESCRITURA);
    await screen.findByText(/más rápido/, {}, PRIMERA_CARGA);

    // MED-0008 cambia (ahora es igual de lenta): la comparación se recalcula, se guarda y lo dice.
    const otra = reqwest.replace('# reqwest', '# ureq');
    await act(async () => {
      const leido = await espacio.repositorio.leerElemento('MED-0008');
      if (!leido.ok) throw new Error('sin MED-0008');
      await espacio.repositorio.guardarElemento({
        ...leido.valor,
        original: otra,
        frontmatter: { ...leido.valor.frontmatter, hash: hashOriginal(otra) },
      });
    });
    expect(
      await screen.findByText(
        'La comparación ha cambiado: MED-0008 cambió desde que se hizo. Está recalculada.',
        {},
        ESCRITURA,
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Sin diferencia clara', {}, ESCRITURA)).toBeTruthy();
    await waitFor(() => {
      const fm = espacio.entidades.frontmatter('CMP-0001');
      expect(fm?.tipo === 'comparacion' && leerResultado(fm.resultado)?.fuentes_hash[1]).toBe(hashOriginal(otra));
    }, ESCRITURA);

    // Se borra MED-0008 para siempre: se enseña lo último guardado y se dice cuál falta.
    await act(async () => void (await espacio.repositorio.borrarElemento('MED-0008')));
    expect(
      await screen.findByText('Falta MED-0008: se enseña el último resultado guardado.', {}, ESCRITURA),
    ).toBeTruthy();
    expect(document.querySelector('.verdict .big')?.textContent).toBe('≈');
  }, 60_000);

  it('una comparación que no existe', async () => {
    await montarApp('/e/CMP-0099');
    expect(await screen.findByText('No encuentro esta comparación', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'CMP-0099' })).toBeTruthy();
  }, 30_000);
});
