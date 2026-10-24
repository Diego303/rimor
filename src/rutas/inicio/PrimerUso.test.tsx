import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { listarTodo } from '../../almacen/contrato';
import type { AlmacenMemoria } from '../../almacen/memoria';
import { useCompositor } from '../../captura/compositor';
import { espaciosConocidos } from '../../espacio/Espacio';
import { useInstalacion } from '../../espacio/instalar';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

/** Los espacios nuevos, en memoria (en el navegador, en OPFS). */
const creados = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../almacen/opfs/cliente', async () => {
  const { AlmacenMemoria: Memoria } = await import('../../almacen/memoria');
  return {
    crearAlmacenOpfs: async (id: string) => {
      const a = new Memoria();
      creados.set(id, a);
      return Object.assign(a, { cerrar: () => undefined });
    },
  };
});

describe('Bienvenida del primer uso', () => {
  beforeAll(async () => {
    await import('./Inicio');
  }, 120_000);

  afterEach(async () => {
    useInstalacion.setState({ aviso: null });
    useCompositor.setState({ texto: '' });
    localStorage.clear();
    creados.clear();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('la señal de primer uso, y los tres ejemplos llenan el compositor', async () => {
    await montarApp('/');
    await screen.findByRole('button', { name: /Pega este log/ }, PRIMERA_CARGA);
    expect(document.querySelector('.primer-uso .senal-primer-uso')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Esta traza/ }));
    expect(useCompositor.getState().texto).toContain('panicked at src/gateway/stream.rs');
    fireEvent.click(screen.getByRole('button', { name: /Estas mediciones/ }));
    expect(useCompositor.getState().texto).toContain('38.41 ms');
  }, 30_000);

  it('«Abrir un espacio de ejemplo» crea el espacio «Ejemplo · gateway» y lo apunta para abrirlo', async () => {
    await montarApp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir un espacio de ejemplo' }, PRIMERA_CARGA));
    expect(await screen.findByRole('button', { name: 'Abrir «Ejemplo · gateway»' }, PRIMERA_CARGA)).toBeTruthy();
    expect(espaciosConocidos().map((e) => e.nombre)).toContain('Ejemplo · gateway');
    const [almacen] = [...creados.values()] as AlmacenMemoria[];
    const rutas = (await listarTodo(almacen as AlmacenMemoria, '')).map((e) => e.ruta);
    expect(rutas.filter((r) => r.startsWith('elementos/'))).toHaveLength(8);
    expect(rutas).toContain('colecciones.json');
  }, 60_000);

  it('si el ejemplo ya se creó, se ofrece abrir ese en vez de crear otro', async () => {
    localStorage.setItem('rimor:espacios', JSON.stringify([{ id: 'ejemplo-1', nombre: 'Ejemplo · gateway' }]));
    await montarApp('/');
    expect(await screen.findByRole('button', { name: 'Abrir «Ejemplo · gateway»' }, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir un espacio de ejemplo' })).toBeNull();
  }, 30_000);

  it('«Instalar Rimor» solo si el navegador lo ofrece', async () => {
    await montarApp('/');
    await screen.findByRole('button', { name: /Pega este log/ }, PRIMERA_CARGA);
    expect(screen.queryByRole('button', { name: 'Instalar Rimor' })).toBeNull();
    const prompt = vi.fn(async () => undefined);
    act(
      () =>
        void window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar Rimor' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Instalar Rimor' })).toBeNull();
  }, 30_000);
});
