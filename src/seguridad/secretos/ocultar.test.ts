import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LINEAS_LIMPIAS } from './corpus/logs';
import { SECRETOS } from './corpus/secretos';
import { buscarSecretos, marca, ocultar } from './ocultar';
import { REGLAS_SECRETOS } from './reglas';

describe('corpus de secretos', () => {
  it('tiene al menos 40 casos y cubre todas las reglas', () => {
    expect(SECRETOS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SECRETOS.map((c) => c.regla))).toEqual(new Set(REGLAS_SECRETOS.map((r) => r.id)));
  });

  for (const caso of SECRETOS) {
    it(`oculta ${caso.regla}: ${caso.texto.slice(0, 40).replace(/\n/g, ' ')}…`, () => {
      const r = ocultar(caso.texto);
      expect(r.texto).not.toContain(caso.secreto);
      // Ningún trozo largo del secreto queda a la vista.
      for (const linea of caso.secreto.split('\n')) if (linea.length >= 12) expect(r.texto).not.toContain(linea);
      expect(r.hallados.map((h) => h.regla)).toContain(caso.regla);
      expect(r.texto).toContain('‹oculto:');
    });
  }
});

describe('corpus de logs sin secretos', () => {
  it('menos del 2 % de líneas con falsos positivos', () => {
    expect(new Set(LINEAS_LIMPIAS).size).toBeGreaterThanOrEqual(120);
    const conHallazgo = LINEAS_LIMPIAS.filter((l) => buscarSecretos(l).length > 0);
    expect(conHallazgo.length / LINEAS_LIMPIAS.length).toBeLessThan(0.02);
  });
});

describe('ocultar', () => {
  it('oculta solo la parte secreta de cabeceras y URL', () => {
    expect(ocultar('Authorization: Bearer abcdefghijkl123').texto).toBe(
      `Authorization: Bearer ${marca('authorization')}`,
    );
    expect(ocultar('postgres://ana:clave123@db:5432/x').texto).toBe(`postgres://ana:${marca('contrasena')}@db:5432/x`);
  });

  it('no devuelve el valor en los hallazgos', () => {
    const r = ocultar(`x ghp_${'a'.repeat(36)} y`);
    expect(JSON.stringify(r.hallados)).not.toContain('aaaa');
    expect(r.hallados[0]).toMatchObject({ regla: 'github', tipo: 'github', posicion: 2, longitud: 40 });
  });

  it('respeta las reglas desactivadas para un pegado', () => {
    const texto = `token ghp_${'b'.repeat(36)}`;
    expect(ocultar(texto, { desactivadas: new Set(['github']) }).texto).toBe(texto);
  });

  it('es idempotente sobre el corpus y sobre textos arbitrarios', () => {
    for (const c of SECRETOS) {
      const una = ocultar(c.texto).texto;
      expect(ocultar(una)).toEqual({ texto: una, hallados: [] });
    }
    const trozo = fc.oneof(fc.string(), fc.constantFrom(...SECRETOS.map((c) => c.texto)));
    fc.assert(
      fc.property(fc.array(trozo, { maxLength: 5 }), (partes) => {
        const una = ocultar(partes.join('\n')).texto;
        expect(ocultar(una).texto).toBe(una);
      }),
    );
  });

  it('es idempotente con un token en el usuario de una URL', () => {
    const una = ocultar(`https://ghp_${'c'.repeat(36)}:x-oauth-basic@github.com/a/b.git`).texto;
    expect(una).toBe('https://‹oculto:github›:‹oculto:contrasena›@github.com/a/b.git');
    expect(ocultar(una)).toEqual({ texto: una, hallados: [] });
  });

  it('idempotencia con piezas que se combinan (URL, usuarios, tokens y marcas)', () => {
    const pieza = fc.oneof(
      fc.constantFrom(
        'https://',
        '://',
        ':',
        '@',
        '/',
        '‹oculto:x›',
        'Authorization: Bearer ',
        'ghp_',
        'u:p@h',
        '\n',
        ' ',
      ),
      fc.constantFrom(...SECRETOS.map((c) => c.secreto)),
      fc.string({ maxLength: 6 }),
    );
    fc.assert(
      fc.property(fc.array(pieza, { maxLength: 12 }), (piezas) => {
        const una = ocultar(piezas.join('')).texto;
        expect(ocultar(una).texto).toBe(una);
      }),
      { numRuns: 3000 },
    );
  });

  it('textos patológicos de 100 KB no provocan retroceso costoso', () => {
    const uuids = Array.from({ length: 2800 }, (_, i) => `123e4567-e89b-12d3-a456-${String(i).padStart(12, '0')}`).join(
      '-',
    );
    for (const texto of [
      'a.'.repeat(50_000),
      'sk-'.repeat(33_000),
      'docs.example.org.'.repeat(6000),
      uuids,
      'x://'.repeat(25_000),
      'eyJ'.repeat(33_000),
    ]) {
      const t0 = performance.now();
      ocultar(texto);
      expect(performance.now() - t0, texto.slice(0, 20)).toBeLessThan(300);
    }
  });

  it('no se atasca con textos grandes', () => {
    const grande = `${LINEAS_LIMPIAS.join('\n')}\n`.repeat(80);
    const t0 = performance.now();
    ocultar(grande);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(grande.length).toBeGreaterThan(500_000);
  });
});

describe('variables, no secretos (IN-046)', () => {
  it('una cabecera o una cookie que es una variable se queda como está', () => {
    for (const texto of [
      'curl -H "Authorization: Bearer $TOKEN" https://x.org',
      "curl -H 'Authorization: Bearer {{token}}' https://x.org",
      'curl -H "X-Api-Key: $API_KEY" https://x.org',
      "curl -H 'Cookie: sesion=$SESION' https://x.org",
      'curl -u admin:$CLAVE https://x.org',
      'https://x.org/a?api_key={{clave}}',
    ])
      expect(ocultar(texto).texto, texto).toBe(texto);
  });
});
