import type { Elemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { crearHilo, hiloDe } from '../../hilos/hilos';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

/** Un texto del 2 o el 3 de octubre (los hilos no dependen del tipo). */
function nota(n: number, titulo: string): Elemento {
  const base = elementoFalso(n, `Detalle ${n} del timeout.`, 'texto');
  return { ...base, frontmatter: { ...base.frontmatter, titulo, creado: `2026-10-0${n + 1}T10:00:00+02:00` } };
}

const dialogoDe = (titulo: RegExp) =>
  within(screen.getByRole('heading', { name: titulo }).closest('dialog') as HTMLElement);

describe('Hilo', () => {
  beforeAll(async () => {
    await import('./Hilo');
    await import('../elemento/Elemento');
    await import('../ajustes/Ajustes');
    await import('../../lectores/texto/Vista');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    useCompositor.setState({ texto: '', archivos: [], respondiendoA: null });
  });

  it('cabecera, mensajes, marcar resuelto con su nota, reabrir y responder en el hilo', async () => {
    const { espacio, router } = await montarApp('/ajustes', [nota(1, 'Primer timeout'), nota(2, 'Segundo timeout')]);
    const d = { repositorio: espacio.repositorio, entidades: espacio.entidades };
    let hilo = '';
    await act(async () => {
      hilo = await crearHilo('read timeout en next_chunk', ['TXT-0001', 'TXT-0002'], d);
    });
    await act(() => router.navigate({ to: '/hilo/$ref', params: { ref: hilo } }));
    expect(await screen.findByRole('heading', { name: 'read timeout en next_chunk' }, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.getByText('Hilo', { selector: '.kchip' })).toBeTruthy();
    expect(screen.getByText('abierto', { selector: '.st' })).toBeTruthy();
    expect(document.querySelector('.ah .meta')?.textContent).toBe('2 elementos · desde el 2 oct');
    expect([...document.querySelectorAll('.feed .msg .tt')].map((e) => e.textContent)).toEqual([
      'Primer timeout',
      'Segundo timeout',
    ]);

    // Marcar resuelto con una línea de nota: se destaca en el último.
    fireEvent.click(screen.getByRole('button', { name: 'Marcar resuelto' }));
    const dialogo = dialogoDe(/Marcar resuelto/);
    fireEvent.change(dialogo.getByLabelText('Cómo se resolvió, en una línea'), {
      target: { value: 'Subí el timeout de lectura a 60 s' },
    });
    fireEvent.click(dialogo.getByRole('button', { name: 'Marcar resuelto' }));
    await waitFor(() => expect(hiloDe(hilo, espacio.entidades)?.estado).toBe('resuelto'), ESCRITURA);
    expect(await screen.findByText('Así lo resolviste', {}, ESCRITURA)).toBeTruthy();
    // Dentro de la tarjeta del mensaje que lo resolvió, como `SC.hilo`.
    expect(
      screen
        .getByText('Subí el timeout de lectura a 60 s', { selector: '.gap span' })
        .closest('article.msg')
        ?.getAttribute('data-ref'),
    ).toBe('TXT-0002');
    expect(await screen.findByText('resuelto', { selector: '.st' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(hiloDe(hilo, espacio.entidades)?.estado).toBe('abierto'), ESCRITURA);

    // El compositor responde en el hilo.
    const caja = screen.getByPlaceholderText('Responder en este hilo: una nota, un log, cómo lo resolviste…');
    act(() => useCompositor.getState().setTexto('Probado también con 1 MB y sigue bien.'));
    fireEvent.keyDown(caja, { key: 'Enter' });
    await waitFor(() => expect(document.querySelectorAll('.feed .msg')).toHaveLength(3), ESCRITURA);
    expect(espacio.repositorio.elementos().filter((fm) => fm.hilo === hilo)).toHaveLength(3);
  }, 60_000);

  it('responder a algo sin hilo crea el hilo con los dos', async () => {
    await import('../inicio/Inicio');
    const { espacio } = await montarApp('/', [nota(1, 'Primer timeout')]);
    await screen.findByRole('button', { name: 'Primer timeout' }, PRIMERA_CARGA);
    act(() => {
      useCompositor.getState().responderA('TXT-0001');
      useCompositor.getState().setTexto('Lo he vuelto a ver con otro cliente.');
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Responder en este hilo/), { key: 'Enter' });
    // El hilo se crea después de guardar (solo si la captura creó algo).
    await waitFor(
      () => expect(espacio.repositorio.elementos().map((fm) => fm.hilo)).toEqual(['HIL-0001', 'HIL-0001']),
      ESCRITURA,
    );
    expect(hiloDe('HIL-0001', espacio.entidades)?.titulo).toBe('Primer timeout');
  }, 60_000);

  it('pegar dos veces la misma traza desde el compositor forma el hilo (la captura real, con sus derivados)', async () => {
    await import('../inicio/Inicio');
    await import('../../lectores/error/Vista');
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const traza = readFileSync(join(process.cwd(), 'fixtures/trazas/rust/01.txt'), 'utf8');
    const { espacio } = await montarApp('/');
    const caja = await screen.findByRole('textbox', { name: /Capturar|Pega/ }, PRIMERA_CARGA);
    for (const texto of [traza, traza.replace('30s', '45s')]) {
      act(() => useCompositor.getState().setTexto(texto));
      fireEvent.keyDown(caja, { key: 'Enter' });
      await waitFor(() => expect(useCompositor.getState().texto).toBe(''), ESCRITURA);
    }
    await waitFor(() => {
      const errores = espacio.repositorio.elementos().filter((fm) => fm.tipo === 'error');
      expect(errores).toHaveLength(2);
      expect(new Set(errores.map((fm) => fm.hilo))).toEqual(new Set(['HIL-0001']));
    }, ESCRITURA);
  }, 60_000);

  it('en el elemento: mover a otro hilo con confirmación', async () => {
    const { espacio, router } = await montarApp('/ajustes', [nota(1, 'Primer timeout'), nota(2, 'Otro')]);
    const d = { repositorio: espacio.repositorio, entidades: espacio.entidades };
    await act(async () => {
      await crearHilo('read timeout', ['TXT-0001'], d);
      await crearHilo('conexiones', ['TXT-0002'], d);
    });
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mover a otro hilo' }, PRIMERA_CARGA));
    const dialogo = dialogoDe(/Mover TXT-0001 a otro hilo/);
    fireEvent.click(dialogo.getByRole('button', { name: /conexiones/ }));
    expect(dialogo.getByText('¿Mover TXT-0001 a conexiones?')).toBeTruthy();
    fireEvent.click(dialogo.getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0001')?.hilo).toBe('HIL-0002'), ESCRITURA);
  }, 60_000);

  it('en el elemento: la fila Hilo y sacarlo con confirmación', async () => {
    const { espacio, router } = await montarApp('/ajustes', [nota(1, 'Primer timeout')]);
    const d = { repositorio: espacio.repositorio, entidades: espacio.entidades };
    await act(async () => {
      await crearHilo('read timeout', ['TXT-0001'], d);
    });
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    expect(await screen.findByRole('button', { name: 'HIL-0001' }, PRIMERA_CARGA)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mover a otro hilo' }));
    const dialogo = dialogoDe(/Mover TXT-0001 a otro hilo/);
    expect(dialogo.getByText('No hay otros hilos abiertos.')).toBeTruthy();
    fireEvent.click(dialogo.getByRole('button', { name: 'Sacar del hilo' }));
    expect(dialogo.getByText('¿Sacar TXT-0001 de read timeout?')).toBeTruthy();
    fireEvent.click(dialogo.getByRole('button', { name: 'Sacar' }));
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0001')?.hilo).toBeUndefined(), ESCRITURA);
  }, 60_000);
});
