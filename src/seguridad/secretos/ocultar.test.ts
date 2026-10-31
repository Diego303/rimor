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

describe('revisión de IN-046: secretos de una petición', () => {
  it('curl -u en textos enormes es lineal (antes, cuadrático: segundos)', () => {
    for (const texto of [
      'curl '.repeat(20_000),
      'curl -b a '.repeat(20_000),
      'curl x \\\n'.repeat(20_000),
      `[${Array.from({ length: 2500 }, (_, i) => `{"ua":"curl/7.81.0","i":${i},"msg":"petición servida sin errores"}`).join(',')}]`,
    ]) {
      const inicio = performance.now();
      ocultar(texto);
      expect(performance.now() - inicio, texto.slice(0, 20)).toBeLessThan(500);
    }
  });

  it('el «Copiar como cURL (cmd)» de Windows: se oculta sin romper sus comillas', () => {
    const clave = 'C1av3Secreta99';
    const sid = 'abcdef1234567890abcdef';
    const r = ocultar(
      `curl ^"https://x.org^" ^\n  -H ^"authorization: Bearer ${'t'.repeat(30)}^" ^\n  -b ^"sid=${sid}; tema=oscuro^" ^\n  -u ^"admin:${clave}^"`,
    );
    expect(r.texto).not.toContain(clave);
    expect(r.texto).not.toContain(sid);
    expect(r.texto).toContain('Bearer ‹oculto:authorization›^"');
    expect(r.texto).toContain('-b ^"sid=‹oculto:cookie›; tema=‹oculto:cookie›^"');
    expect(r.texto).toContain('-u ^"admin:‹oculto:contrasena›^"');
  });

  it("cookies con comillas dentro, y en $'…': todas ocultas, y el curl se sigue leyendo", () => {
    const sid = `s${'Q7'.repeat(10)}`;
    for (const texto of [
      `curl -H 'Cookie: prefs={"a":1}; sid=${sid}' https://x.org`,
      `curl -b 'prefs="x y"; sid=${sid}' https://x.org`,
      `curl -b $'n=\\'x\\'; sid=${sid}' https://x.org`,
      `curl -H $'cookie: a=\\'x\\'; sid=${sid}' https://x.org`,
    ]) {
      const r = ocultar(texto).texto;
      expect(r, texto).not.toContain(sid);
      expect(r.endsWith(' https://x.org'), r).toBe(true);
    }
  });

  it('Set-Cookie: la sesión (un valor largo) sí; un ajuste corto y sus atributos, no', () => {
    expect(ocultar('Set-Cookie: sessionid=abcdef1234567890abcdef; Path=/').texto).toBe(
      'Set-Cookie: sessionid=‹oculto:cookie›; Path=/',
    );
    expect(ocultar('Set-Cookie: tema=oscuro; Path=/').texto).toBe('Set-Cookie: tema=oscuro; Path=/');
  });

  it('curl -u: pegado, en cortas juntas, con espacios entre comillas; nunca más allá de una tubería', () => {
    expect(ocultar('curl -uadmin:SuperSecreta99 https://x.org').texto).toBe(
      'curl -uadmin:‹oculto:contrasena› https://x.org',
    );
    expect(ocultar("curl -u 'admin:mi clave larga' https://x.org").texto).toBe(
      "curl -u 'admin:‹oculto:contrasena›' https://x.org",
    );
    expect(ocultar('curl -U proxy:Pr0xyClave1 https://x.org').texto).toContain('proxy:‹oculto:contrasena›');
    const docker = 'curl https://get.docker.com | sh && docker run -u 1000:1000 img';
    expect(ocultar(docker).texto).toBe(docker);
  });

  it('más cabeceras y esquemas: X-RapidAPI-Key, apikey, X-Auth-Key, Authorization: ApiKey, --oauth2-bearer; la URL con #', () => {
    for (const [texto, visible] of [
      [`curl -H 'apikey: ${'k'.repeat(30)}' x.org`, 'apikey: ‹oculto:clave-api›'],
      [`curl -H 'X-Auth-Key: ${'k'.repeat(30)}' x.org`, 'X-Auth-Key: ‹oculto:clave-api›'],
      [`Authorization: ApiKey ${'k'.repeat(30)}`, 'Authorization: ApiKey ‹oculto:authorization›'],
      [`https://x.org/cb#access_token=${'k'.repeat(30)}&expires=3600`, '#access_token=‹oculto:clave-api›&expires'],
      [`https://x.org/a?private_token=${'k'.repeat(20)}`, 'private_token=‹oculto:clave-api›'],
    ] as const)
      expect(ocultar(texto).texto, texto).toContain(visible);
  });
});
