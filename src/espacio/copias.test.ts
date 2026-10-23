import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPIAS_INICIALES, copiasDe, leerAjustes } from './ajustes';
import { ESTADO_INICIAL, leerEstado } from './estado';
import { copiaAlDia, debeRecordarCopia } from './resumen';

const AHORA = new Date('2026-10-22T12:00:00+02:00');
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000).toISOString();

describe('ajustes de copia', () => {
  it('por defecto 50 cambios, 7 días, avisar y ZIP previo; los números dentro de sus límites', () => {
    expect(copiasDe(undefined)).toEqual(COPIAS_INICIALES);
    expect(copiasDe({ cambios: 2, dias: 400, avisar: false, zipPrevio: 'no' })).toEqual({
      cambios: 5,
      dias: 90,
      avisar: false,
      zipPrevio: true,
    });
    expect(copiasDe({ cambios: 12.6, dias: Number.NaN })).toMatchObject({ cambios: 13, dias: 7 });
  });

  it('leer los ajustes conserva lo que no se conoce', () => {
    const a = leerAjustes(JSON.stringify({ esquema: 1, tema: 'oscuro', copias: { cambios: 20, otro: 1 } }));
    expect(a.copias).toMatchObject({ cambios: 20, dias: 7, otro: 1 });
    expect(a.tema).toBe('oscuro');
    expect(leerAjustes(null).copias).toEqual(COPIAS_INICIALES);
  });
});

describe('recordatorio de copia', () => {
  const copias = { ...COPIAS_INICIALES, cambios: 10, dias: 3 };
  const con = (cambio: Partial<typeof ESTADO_INICIAL>) => ({ ...ESTADO_INICIAL, ...cambio });

  it('con los umbrales configurados', () => {
    expect(copiaAlDia(con({ ultimaCopia: dias(2), cambiosDesdeCopia: 9 }), AHORA, copias)).toBe(true);
    expect(copiaAlDia(con({ ultimaCopia: dias(4), cambiosDesdeCopia: 0 }), AHORA, copias)).toBe(false);
    expect(copiaAlDia(con({ ultimaCopia: dias(1), cambiosDesdeCopia: 10 }), AHORA, copias)).toBe(false);
  });

  it('se recuerda sin copia al día, con algo guardado, si está activo y no se pospuso', () => {
    const vieja = con({ ultimaCopia: dias(5) });
    expect(debeRecordarCopia(vieja, copias, AHORA, true)).toBe(true);
    expect(debeRecordarCopia(con({}), copias, AHORA, true)).toBe(true);
    expect(debeRecordarCopia(vieja, copias, AHORA, false)).toBe(false);
    expect(debeRecordarCopia(vieja, { ...copias, avisar: false }, AHORA, true)).toBe(false);
    expect(debeRecordarCopia(con({ ultimaCopia: dias(1) }), copias, AHORA, true)).toBe(false);
    const pospuesta = con({
      ultimaCopia: dias(5),
      recordatorioHasta: new Date(AHORA.getTime() + 3_600_000).toISOString(),
    });
    expect(debeRecordarCopia(pospuesta, copias, AHORA, true)).toBe(false);
    expect(debeRecordarCopia({ ...pospuesta, recordatorioHasta: dias(1) }, copias, AHORA, true)).toBe(true);
  });

  it('el aplazamiento se guarda en el estado de cuidado', () => {
    expect(leerEstado(JSON.stringify({ recordatorioHasta: '2026-10-23T12:00:00+02:00' })).recordatorioHasta).toBe(
      '2026-10-23T12:00:00+02:00',
    );
    expect(leerEstado('{}').recordatorioHasta).toBeNull();
  });
});

describe('el botón naranja', () => {
  it('«Exportar ZIP» es el único de la app (fuera de la página de muestras)', () => {
    const raiz = new URL('..', import.meta.url).pathname;
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const r = join(dir, n);
        if (statSync(r).isDirectory()) recorrer(r);
        else if (r.endsWith('.tsx') && !r.endsWith('.test.tsx') && !r.includes('/muestras/')) archivos.push(r);
      }
    };
    recorrer(raiz);
    const usos = archivos.flatMap((a) =>
      [...readFileSync(a, 'utf8').matchAll(/variante=\{?['"]senal['"]|'senal' : /g)].map(() => a.replace(raiz, '')),
    );
    expect(usos).toEqual(['rutas/datos/Datos.tsx']);
  });
});
