import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { escribirTexto, leerTexto } from '../../almacen/contrato';
import { previsualizar } from '../../captura/previa';
import { opcionesCaptura } from '../../espacio/ajustes';
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
