import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actualizar, type Contenedor, registrar, useActualizacion } from './registrar';

function trabajador(state = 'installing') {
  const oyentes: (() => void)[] = [];
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: (_t: 'statechange', f: () => void) => void oyentes.push(f),
    pasarA(estado: string) {
      this.state = estado;
      for (const f of oyentes) f();
    },
  };
}

function contenedor(opciones: { controlada: boolean; esperando?: ReturnType<typeof trabajador> | null }) {
  const alEncontrar: (() => void)[] = [];
  const alCambiar: (() => void)[] = [];
  const registro = {
    waiting: opciones.esperando ?? null,
    installing: null as ReturnType<typeof trabajador> | null,
    addEventListener: (_t: 'updatefound', f: () => void) => void alEncontrar.push(f),
  };
  const c = {
    controller: opciones.controlada ? {} : null,
    register: vi.fn(async () => registro),
    addEventListener: (_t: 'controllerchange', f: () => void) => void alCambiar.push(f),
  } satisfies Contenedor;
  return {
    c,
    nuevo(t: ReturnType<typeof trabajador>) {
      registro.installing = t;
      for (const f of alEncontrar) f();
    },
    cambiarControlador: () => {
      for (const f of alCambiar) f();
    },
  };
}

beforeEach(() => useActualizacion.setState({ esperando: null }));

describe('registro del service worker', () => {
  it('registra sw.js con el alcance de la BASE; sin service workers, nada', async () => {
    const { c } = contenedor({ controlada: false });
    expect(await registrar(c, '/rimor/')).toBe(true);
    expect(c.register).toHaveBeenCalledWith('/rimor/sw.js', { scope: '/rimor/' });
    expect(await registrar(undefined, '/')).toBe(false);
    const falla = { ...c, register: vi.fn(async () => Promise.reject(new Error('no'))) };
    expect(await registrar(falla, '/')).toBe(false);
  });

  it('una versión que ya espera, o una nueva que termina de instalarse, avisan; la primera instalación no', async () => {
    const esperando = trabajador('installed');
    await registrar(contenedor({ controlada: true, esperando }).c, '/');
    expect(useActualizacion.getState().esperando).toBe(esperando);

    useActualizacion.setState({ esperando: null });
    const primera = contenedor({ controlada: false });
    await registrar(primera.c, '/');
    const t1 = trabajador();
    primera.nuevo(t1);
    t1.pasarA('installed');
    expect(useActualizacion.getState().esperando).toBeNull();

    const otra = contenedor({ controlada: true });
    await registrar(otra.c, '/');
    const t2 = trabajador();
    otra.nuevo(t2);
    t2.pasarA('installing');
    expect(useActualizacion.getState().esperando).toBeNull();
    t2.pasarA('installed');
    expect(useActualizacion.getState().esperando).toBe(t2);
  });

  it('actualizar pide SALTAR_ESPERA y recarga cuando entra (no antes ni por otro cambio)', async () => {
    const esperando = trabajador('installed');
    const recargar = vi.fn();
    const x = contenedor({ controlada: true, esperando });
    await registrar(x.c, '/', recargar);
    x.cambiarControlador();
    expect(recargar).not.toHaveBeenCalled();
    actualizar();
    expect(esperando.postMessage).toHaveBeenCalledWith({ tipo: 'SALTAR_ESPERA' });
    expect(useActualizacion.getState().esperando).toBeNull();
    x.cambiarControlador();
    expect(recargar).toHaveBeenCalledTimes(1);
    x.cambiarControlador();
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
