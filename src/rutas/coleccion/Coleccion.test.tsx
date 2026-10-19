import type { Elemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

function conColecciones(n: number, titulo: string, colecciones: string[]): Elemento {
  const base = elementoFalso(n, `texto ${n}`, 'texto');
  return {
    ...base,
    frontmatter: { ...base.frontmatter, titulo, colecciones, creado: `2026-10-1${n}T10:00:00+02:00` },
  };
}

const enRail = () =>
  [...document.querySelectorAll('.rail .rb.sub')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());

describe('Colección', () => {
  beforeAll(async () => {
    await import('./Coleccion');
    await import('../ajustes/Ajustes');
    await import('../inicio/Inicio');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('raíl en el orden del registro; lista; renombrar en el sitio, subir y borrar con confirmación', async () => {
    const { espacio, router } = await montarApp('/ajustes', [
      conColecciones(1, 'Timeout en streaming', ['gateway']),
      conColecciones(2, 'Probar ureq', ['gateway', 'prompts']),
    ]);
    await waitFor(() => expect(enRail()).toEqual(['gateway2', 'prompts1']), ESCRITURA);
    await act(() => router.navigate({ to: '/c/$coleccion', params: { coleccion: 'gateway' } }));
    expect(await screen.findByRole('button', { name: 'gateway' }, PRIMERA_CARGA)).toBeTruthy();
    expect(document.querySelector('.ah .meta')?.textContent).toBe('2 elementos');
    expect([...document.querySelectorAll('.list .it .tt')].map((e) => e.textContent)).toEqual([
      'Probar ureq',
      'Timeout en streaming',
    ]);
    expect((screen.getByRole('button', { name: 'Subir' }) as HTMLButtonElement).disabled).toBe(true);

    // Renombrar en el sitio: sus elementos cambian y se va a la colección con su nombre nuevo.
    fireEvent.click(screen.getByRole('button', { name: 'gateway' }));
    const campo = screen.getByRole('textbox', { name: 'Título' });
    fireEvent.change(campo, { target: { value: 'Pasarela' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/c/pasarela'), ESCRITURA);
    await waitFor(
      () => expect(espacio.repositorio.frontmatter('TXT-0001')?.colecciones).toEqual(['pasarela']),
      ESCRITURA,
    );

    // Bajarla: el raíl cambia de orden.
    fireEvent.click(await screen.findByRole('button', { name: 'Bajar' }, ESCRITURA));
    await waitFor(() => expect(enRail()).toEqual(['prompts1', 'pasarela2']), ESCRITURA);

    // Borrarla: con confirmación; los elementos se quedan, sin ella.
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la colección' }));
    const dialogo = within(
      screen.getByRole('heading', { name: '¿Borrar la colección pasarela?' }).closest('dialog') as HTMLElement,
    );
    expect(dialogo.getByText('Sus 2 elementos se quedan, sin esta colección.')).toBeTruthy();
    fireEvent.click(dialogo.getByRole('button', { name: 'Borrar la colección' }));
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0001')?.colecciones).toBeUndefined(), ESCRITURA);
    expect(espacio.repositorio.elementos()).toHaveLength(2);
    await waitFor(() => expect(enRail()).toEqual(['prompts1']), ESCRITURA);
  }, 60_000);

  it('una colección que no existe', async () => {
    await montarApp('/c/nada');
    expect(await screen.findByText('No encuentro esta colección', {}, PRIMERA_CARGA)).toBeTruthy();
  }, 30_000);
});
