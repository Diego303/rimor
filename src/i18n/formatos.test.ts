import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  fmtBytes,
  fmtCifra,
  fmtDia,
  fmtDuracion,
  fmtFecha,
  fmtFechaRelativa,
  fmtHora,
  fmtNumero,
  fmtOrdinal,
  fmtP,
  MENOS,
  NBSP,
} from './formatos';

const n = (s: string) => s.replaceAll(NBSP, ' ').replaceAll(MENOS, '-');

describe('fmtNumero', () => {
  it('separa miles como es-ES (desde 10.000) y como en-GB', () => {
    expect(fmtNumero(2400, 'es')).toBe('2400');
    expect(fmtNumero(10000, 'es')).toBe('10.000');
    expect(fmtNumero(2400, 'en')).toBe('2,400');
    expect(fmtNumero(38.535, 'es', 2)).toBe('38,54');
    expect(fmtNumero(38.5, 'en', 2)).toBe('38.50');
  });

  it('usa el menos tipográfico y nunca pinta −0', () => {
    expect(fmtNumero(-3, 'es')).toBe(`${MENOS}3`);
    expect(fmtNumero(-0, 'es')).toBe('0');
    expect(fmtNumero(-0.004, 'es', 2)).toBe('0,00');
    expect(fmtNumero(-0.004, 'en', 1)).toBe('0.0');
  });

  it('sin decimales fijos deja hasta dos y quita los ceros', () => {
    expect(fmtNumero(1.5, 'es')).toBe('1,5');
    expect(fmtNumero(1.256, 'es')).toBe('1,26');
    expect(fmtNumero(3, 'en')).toBe('3');
  });

  it('pinta «—» si no es un número finito', () => {
    expect(fmtNumero(Number.NaN, 'es')).toBe('—');
    expect(fmtNumero(Number.POSITIVE_INFINITY, 'en')).toBe('—');
  });

  it('propiedad: nunca un guion ni «NaN» a la vista', () => {
    fc.assert(
      fc.property(fc.double(), fc.constantFrom('es', 'en' as const), fc.integer({ min: 0, max: 4 }), (x, i, d) => {
        const s = fmtNumero(x, i, d);
        expect(s.includes('-')).toBe(false);
        expect(s.includes('NaN')).toBe(false);
      }),
    );
  });
});

describe('fmtCifra', () => {
  it('fmtCifra(-4.515, 1, "%") da «−4,5 %» con espacio de no separación', () => {
    expect(fmtCifra(-4.515, 1, '%', 'es')).toBe('−4,5 %');
  });

  it('une la unidad con espacio de no separación en los dos idiomas', () => {
    expect(fmtCifra(38.535, 2, 'ms', 'es')).toBe(`38,54${NBSP}ms`);
    expect(fmtCifra(38.535, 2, 'ms', 'en')).toBe(`38.54${NBSP}ms`);
    expect(fmtCifra(5, 0, undefined, 'es')).toBe('5');
    expect(fmtCifra(Number.NaN, 1, '%', 'es')).toBe('—');
  });
});

describe('fmtP', () => {
  it('p < 0,001 o tres decimales', () => {
    expect(n(fmtP(0.0002, 'es'))).toBe('p < 0,001');
    expect(n(fmtP(0.0312, 'es'))).toBe('p = 0,031');
    expect(n(fmtP(0.0312, 'en'))).toBe('p = 0.031');
    expect(n(fmtP(1, 'es'))).toBe('p = 1,000');
    expect(fmtP(Number.NaN, 'es')).toBe('—');
  });
});

describe('fmtDuracion', () => {
  it('elige la unidad', () => {
    expect(n(fmtDuracion(850, 'es'))).toBe('850 ms');
    expect(n(fmtDuracion(1600, 'es'))).toBe('1,6 s');
    expect(n(fmtDuracion(30000, 'es'))).toBe('30 s');
    expect(n(fmtDuracion(12 * 60_000, 'es'))).toBe('12 min');
    expect(n(fmtDuracion(3.5 * 3_600_000, 'es'))).toBe('3,5 h');
    expect(n(fmtDuracion(1.6 * 86_400_000, 'es'))).toBe('1,6 días');
    expect(n(fmtDuracion(86_400_000, 'es'))).toBe('1 día');
    expect(n(fmtDuracion(1.6 * 86_400_000, 'en'))).toBe('1.6 days');
    expect(n(fmtDuracion(-1600, 'es'))).toBe('-1,6 s');
    expect(fmtDuracion(Number.NaN, 'es')).toBe('—');
    expect(n(fmtDuracion(-0.4, 'es'))).toBe('0 ms');
  });

  it('sube de unidad cuando el redondeo llega al límite', () => {
    expect(n(fmtDuracion(999.6, 'es'))).toBe('1 s');
    expect(n(fmtDuracion(59_960, 'es'))).toBe('1 min');
    expect(n(fmtDuracion(3_570_000, 'es'))).toBe('1 h');
    expect(n(fmtDuracion(86_390_000, 'es'))).toBe('1 día');
  });
});

describe('fmtBytes', () => {
  it('en unidades de 1024', () => {
    expect(n(fmtBytes(512, 'es'))).toBe('512 B');
    expect(n(fmtBytes(2.4 * 1024 * 1024, 'es'))).toBe('2,4 MB');
    expect(n(fmtBytes(2048, 'en'))).toBe('2 KB');
    expect(fmtBytes(-1, 'es')).toBe('—');
    expect(n(fmtBytes(1024 * 1023.97, 'es'))).toBe('1 MB');
    expect(n(fmtBytes(1023.6, 'es'))).toBe('1 KB');
  });
});

describe('fechas', () => {
  const ahora = new Date('2026-10-17T19:00:00+02:00');

  it('relativa: hoy, ayer, día y mes, y año si no es el actual', () => {
    expect(fmtFechaRelativa(new Date('2026-10-17T17:49:00+02:00'), ahora, 'es', 'Europe/Madrid')).toBe('hoy, 17:49');
    expect(fmtFechaRelativa(new Date('2026-10-16T18:21:00+02:00'), ahora, 'es', 'Europe/Madrid')).toBe('ayer, 18:21');
    expect(fmtFechaRelativa(new Date('2026-10-02T10:00:00+02:00'), ahora, 'es', 'Europe/Madrid')).toBe('2 oct');
    expect(fmtFechaRelativa(new Date('2025-10-02T10:00:00+02:00'), ahora, 'es', 'Europe/Madrid')).toBe('2 oct 2025');
    expect(fmtFechaRelativa(new Date('2026-10-17T17:49:00+02:00'), ahora, 'en', 'Europe/Madrid')).toBe('today, 17:49');
    expect(fmtFechaRelativa(new Date('2026-10-02T10:00:00+02:00'), ahora, 'en', 'Europe/Madrid')).toBe('Oct 2');
    expect(fmtFechaRelativa(new Date('2025-10-02T10:00:00+02:00'), ahora, 'en', 'Europe/Madrid')).toBe('Oct 2, 2025');
  });

  it('«hoy» y «ayer» dependen de la zona horaria, no de UTC', () => {
    // 00:30 en Madrid del 17 es 18:30 del 16 en Nueva York.
    const fecha = new Date('2026-10-16T22:30:00Z');
    const despues = new Date('2026-10-17T08:00:00Z');
    expect(fmtFechaRelativa(fecha, despues, 'es', 'Europe/Madrid')).toBe('hoy, 00:30');
    expect(fmtFechaRelativa(fecha, despues, 'es', 'America/New_York')).toBe('ayer, 18:30');
    expect(fmtHora(fecha, 'UTC')).toBe('22:30');
  });

  it('fecha completa y día para separadores', () => {
    expect(fmtFecha(new Date('2026-10-17T17:49:00+02:00'), 'es', 'Europe/Madrid')).toBe('17 oct 2026, 17:49');
    expect(fmtFecha(new Date('2026-10-17T17:49:00+02:00'), 'en', 'Europe/Madrid')).toBe('Oct 17, 2026, 17:49');
    expect(fmtDia(new Date('2026-10-02T10:00:00+02:00'), ahora, 'es', 'Europe/Madrid')).toBe('2 oct');
    expect(fmtFecha(new Date('no es fecha'), 'es')).toBe('—');
  });
});

describe('fmtOrdinal', () => {
  it('español con género y inglés con sufijo', () => {
    expect(fmtOrdinal(3, 'es')).toBe('3.ª');
    expect(fmtOrdinal(3, 'es', 'm')).toBe('3.º');
    expect(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'].join()).toBe(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map((x) => fmtOrdinal(x, 'en')).join(),
    );
  });
});
