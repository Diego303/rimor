import { describe, expect, it } from 'vitest';
import { CLAVE_TEMA, leerPreferencia } from './tema';

const almacen = (v: string | null) => ({ getItem: (k: string) => (k === CLAVE_TEMA ? v : null) });

describe('leerPreferencia', () => {
  it('sigue al sistema por defecto o con valores no válidos', () => {
    expect(leerPreferencia(almacen(null))).toBe('sistema');
    expect(leerPreferencia(almacen('azul'))).toBe('sistema');
    expect(leerPreferencia(undefined)).toBe('sistema');
  });

  it('lee claro y oscuro', () => {
    expect(leerPreferencia(almacen('claro'))).toBe('claro');
    expect(leerPreferencia(almacen('oscuro'))).toBe('oscuro');
  });

  it('no falla si el almacenamiento lanza', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerPreferencia(roto)).toBe('sistema');
  });
});

describe('leerPreferencia sin localStorage accesible', () => {
  it('no falla si tocar localStorage lanza (datos del sitio bloqueados)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(leerPreferencia()).toBe('sistema');
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
