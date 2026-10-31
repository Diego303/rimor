import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actualizar,
  CADA_MS,
  type Contenedor,
  ESTADO_INICIAL,
  registrar,
  registrarServiceWorker,
  useActualizacion,
} from './registrar';

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

function contenedor(opciones: {
  controlada: boolean;
  esperando?: ReturnType<typeof trabajador> | null;
  instalando?: ReturnType<typeof trabajador> | null;
}) {
  const alEncontrar: (() => void)[] = [];
  const alCambiar: (() => void)[] = [];
  const registro = {
    waiting: opciones.esperando ?? null,
    installing: opciones.instalando ?? null,
    addEventListener: (_t: 'updatefound', f: () => void) => void alEncontrar.push(f),
    update: vi.fn(async () => undefined),
  };
  const c: Contenedor & { register: ReturnType<typeof vi.fn> } = {
    controller: opciones.controlada ? {} : null,
    register: vi.fn(async () => registro),
    addEventListener: (_t: 'controllerchange', f: () => void) => void alCambiar.push(f),
  };
  return {
    c,
    registro,
    nuevo(t: ReturnType<typeof trabajador>) {
      registro.installing = t;
      for (const f of alEncontrar) f();
    },
    cambiarControlador: () => {
      for (const f of alCambiar) f();
    },
  };
}

beforeEach(() => useActualizacion.setState(ESTADO_INICIAL));

describe('registro del service worker', () => {
  it('registra sw.js con el alcance de la BASE; sin service workers, o si falla, nada', async () => {
    const { c } = contenedor({ controlada: false });
    expect(await registrar(c, '/rimor/')).toBe(true);
    expect(c.register).toHaveBeenCalledWith('/rimor/sw.js', { scope: '/rimor/' });
    expect(await registrar(undefined, '/')).toBe(false);
    const falla = { ...c, register: vi.fn(async () => Promise.reject(new Error('no'))) };
    expect(await registrar(falla, '/')).toBe(false);
  });

  it('en desarrollo (y en las pruebas) no se registra', () => {
    expect(registrarServiceWorker(false)).toBe(false);
    expect(registrarServiceWorker()).toBe(false);
  });

  it('avisa de una versión que ya espera, de una que se estaba instalando y de una nueva; la primera instalación no', async () => {
    const esperando = trabajador('installed');
    await registrar(contenedor({ controlada: true, esperando }).c, '/');
    expect(useActualizacion.getState().esperando).toBe(esperando);

    useActualizacion.setState(ESTADO_INICIAL);
    const instalando = trabajador('installing');
    await registrar(contenedor({ controlada: true, instalando }).c, '/');
    expect(useActualizacion.getState().esperando).toBeNull();
    instalando.pasarA('installed');
    expect(useActualizacion.getState().esperando).toBe(instalando);

    useActualizacion.setState(ESTADO_INICIAL);
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
    t2.pasarA('installed');
    expect(useActualizacion.getState().esperando).toBe(t2);
  });

  it('actualizar pide SALTAR_ESPERA y recarga cuando entra (no antes ni por otro cambio)', async () => {
    const esperando = trabajador('installed');
    const recargar = vi.fn();
    const x = contenedor({ controlada: true, esperando });
    await registrar(x.c, '/', { recargar });
    actualizar();
    expect(esperando.postMessage).toHaveBeenCalledWith({ tipo: 'SALTAR_ESPERA' });
    expect(useActualizacion.getState().esperando).toBeNull();
    expect(recargar).not.toHaveBeenCalled();
    x.cambiarControlador();
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(useActualizacion.getState()).toEqual(ESTADO_INICIAL);
  });

  it('si la pidió otra pestaña, esta lo sabe y «Actualizar» solo recarga', async () => {
    const esperando = trabajador('installed');
    const recargar = vi.fn();
    const x = contenedor({ controlada: true, esperando });
    await registrar(x.c, '/', { recargar });
    // Otra pestaña la hizo entrar.
    esperando.pasarA('activated');
    x.cambiarControlador();
    expect(useActualizacion.getState()).toMatchObject({ esperando: null, cambiada: true });
    expect(recargar).not.toHaveBeenCalled();
    actualizar();
    expect(esperando.postMessage).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('una que ya entró (activada) al pulsar «Actualizar»: recarga sin pedir nada', async () => {
    const esperando = trabajador('installed');
    const recargar = vi.fn();
    await registrar(contenedor({ controlada: true, esperando }).c, '/', { recargar });
    esperando.state = 'activated';
    actualizar();
    expect(esperando.postMessage).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('busca versiones nuevas al volver a la pestaña y cada hora', async () => {
    const x = contenedor({ controlada: true });
    const oyentes: (() => void)[] = [];
    const documento = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: (_t: string, f: () => void) => void oyentes.push(f),
    };
    let periodica: (() => void) | null = null;
    let cada = 0;
    await registrar(x.c, '/', {
      documento: documento as unknown as Pick<Document, 'addEventListener' | 'visibilityState'>,
      cada: (fn, ms) => {
        periodica = fn;
        cada = ms;
      },
    });
    for (const f of oyentes) f();
    expect(x.registro.update).not.toHaveBeenCalled();
    documento.visibilityState = 'visible';
    for (const f of oyentes) f();
    expect(x.registro.update).toHaveBeenCalledTimes(1);
    expect(cada).toBe(CADA_MS);
    (periodica as (() => void) | null)?.();
    expect(x.registro.update).toHaveBeenCalledTimes(2);
  });
});
