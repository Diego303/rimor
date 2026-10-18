import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashOriginal, LIMITE_ORIGINAL_EN_MD, normalizarOriginal, sha256Hex } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { leerTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import type { Entrada } from '../lectores/contrato';
import { ColaDerivados } from '../lectores/derivados';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { lectorFalso } from '../lectores/pruebas/falsos';
import { crearRegistro } from '../lectores/registro';
import { capturar, crearCapturador, type EfectosCaptura, LIMITE_ARCHIVO, type ResultadoCaptura } from './flujo';

const CLAVE_AWS = `AKIA${'IOSFODNN7'}EXAMPLE`;

/** Lectores de prueba: Texto (siempre por defecto), Log (si hay «ERROR») y Archivo (binarios). */
function registroDePrueba(vistos: Entrada[] = []) {
  return crearRegistro([
    lectorFalso({
      nombre: 'archivo',
      tipo: 'archivo',
      detectar: () => 0,
      leer: async (e) => ({ titulo: '', original: null, resumen: { tam: e.archivos?.[0]?.size ?? 0 } }),
    }),
    lectorFalso({
      nombre: 'log',
      tipo: 'log',
      detectar: (e) => (e.texto?.includes('ERROR') ? 0.9 : 0),
      leer: async (e) => {
        vistos.push(e);
        return { titulo: 'Log pegado', original: e.texto ?? '', resumen: { lineas: 1 } };
      },
    }),
    lectorFalso({
      nombre: 'texto',
      tipo: 'texto',
      detectar: () => 0.1,
      leer: async (e) => {
        vistos.push(e);
        return { titulo: '', original: e.texto ?? '', metadatos: { id: 'no-puede-pisar', extra: 1 } };
      },
    }),
  ]);
}

function efectos(cambios: Partial<EfectosCaptura> = {}) {
  const almacen = new AlmacenMemoria();
  const repositorio = new Repositorio(almacen);
  return { almacen, repositorio, efectos: { repositorio, registro: registroDePrueba(), ...cambios } };
}

function creado(r: Awaited<ReturnType<typeof capturar>>) {
  if (!r.ok || r.valor.tipo !== 'creado') throw new Error(`no creado: ${JSON.stringify(r)}`);
  return r.valor.capturado;
}

describe('capturar', () => {
  it('oculta los secretos antes de detectar y leer; el hash es del texto ocultado', async () => {
    const vistos: Entrada[] = [];
    const { repositorio } = efectos();
    const c = creado(
      await capturar(
        { texto: `17:40 ERROR fallo\nAWS_ACCESS_KEY_ID=${CLAVE_AWS}`, origen: 'pegado' },
        { repositorio, registro: registroDePrueba(vistos) },
      ),
    );
    expect(vistos[0]?.texto).not.toContain(CLAVE_AWS);
    expect(c.elemento.original).not.toContain(CLAVE_AWS);
    expect(c.elemento.frontmatter).toMatchObject({ tipo: 'log', ref: 'LOG-0001', ocultados: 1, origen: 'pegado' });
    expect(c.elemento.frontmatter.hash).toBe(hashOriginal(c.elemento.original ?? ''));
    expect(c.elemento.frontmatter.lector).toEqual({ nombre: 'log', version: 1, resumen: { lineas: 1 } });
  });

  it('título de la primera línea si el lector no da uno; lo del lector no pisa los campos comunes', async () => {
    const { repositorio, efectos: ef } = efectos();
    const c = creado(await capturar({ texto: '\n  Una idea suelta  \nsegunda', origen: 'pegado' }, ef));
    expect(c.elemento.frontmatter).toMatchObject({
      titulo: 'Una idea suelta',
      tipo: 'texto',
      ref: 'TXT-0001',
      extra: 1,
    });
    expect(c.elemento.frontmatter.id).not.toBe('no-puede-pisar');
    expect(repositorio.buscar('TXT-0001')).toBeTruthy();
  });

  it('respeta el tipo forzado y usa el lector de reserva si ese tipo no tiene lector', async () => {
    const { efectos: ef } = efectos();
    expect(
      creado(await capturar({ texto: '17:40 ERROR', origen: 'pegado', tipo: 'texto' }, ef)).elemento.frontmatter.tipo,
    ).toBe('texto');
    const c = creado(await capturar({ texto: 'otra cosa', origen: 'pegado', tipo: 'mediciones' }, ef));
    expect(c.elemento.frontmatter).toMatchObject({ tipo: 'mediciones', ref: 'MED-0001', lector: { nombre: 'texto' } });
  });

  it('sin ningún lector, falla con captura.sinLector; vacío, con captura.vacia', async () => {
    const { repositorio } = efectos();
    const vacio = crearRegistro([]);
    const r = await capturar({ texto: 'hola', origen: 'pegado' }, { repositorio, registro: vacio });
    expect(!r.ok && r.error.codigo).toBe('captura.sinLector');
    const v = await capturar({ texto: '  \n ', origen: 'pegado' }, { repositorio, registro: vacio });
    expect(!v.ok && v.error.codigo).toBe('captura.vacia');
  });

  it('devuelve la duda del detector', async () => {
    const { repositorio } = efectos();
    const registro = crearRegistro([
      lectorFalso({ nombre: 'log', tipo: 'log', detectar: () => 0.8 }),
      lectorFalso({ nombre: 'error', tipo: 'error', detectar: () => 0.7 }),
    ]);
    const c = creado(await capturar({ texto: 'algo', origen: 'pegado' }, { repositorio, registro }));
    expect(c.alternativa).toMatchObject({ tipo: 'error', lector: 'error' });
  });

  it('un duplicado exacto no se crea: devuelve la ref del existente (no cuenta lo de la papelera)', async () => {
    const { repositorio, efectos: ef } = efectos();
    creado(await capturar({ texto: 'mismo texto', origen: 'pegado' }, ef));
    // Mismo original normalizado: espacios al final y finales de línea distintos.
    const r = await capturar({ texto: 'mismo texto  \r\n', origen: 'pegado' }, ef);
    expect(r.ok && r.valor).toEqual({ tipo: 'duplicado', ref: 'TXT-0001' } satisfies ResultadoCaptura);
    await repositorio.moverAPapelera('TXT-0001');
    expect(creado(await capturar({ texto: 'mismo texto', origen: 'pegado' }, ef)).elemento.frontmatter.ref).toBe(
      'TXT-0002',
    );
  });

  it('aplica colecciones, etiquetas (sin repetir) y el hilo', async () => {
    const { efectos: ef } = efectos();
    const c = creado(
      await capturar(
        {
          texto: 'nota',
          origen: 'pegado',
          colecciones: ['gateway', ' gateway', ''],
          etiquetas: ['rust', 'http', 'rust'],
          hilo: 'HIL-0003',
        },
        ef,
      ),
    );
    expect(c.elemento.frontmatter).toMatchObject({
      colecciones: ['gateway'],
      etiquetas: ['rust', 'http'],
      hilo: 'HIL-0003',
    });
  });

  it('un original de más de 2 MB va como adjunto', async () => {
    const { almacen, efectos: ef } = efectos();
    const grande = 'x'.repeat(LIMITE_ORIGINAL_EN_MD + 10);
    const c = creado(await capturar({ texto: grande, origen: 'pegado' }, ef));
    expect(c.elemento.original).toBeNull();
    expect(c.elemento.frontmatter.adjunto).toMatchObject({ mime: 'text/plain', tam: grande.length });
    expect(c.adjuntoNuevo).toBe(c.elemento.frontmatter.adjunto?.ruta);
    expect(await leerTexto(almacen, c.adjuntoNuevo ?? '')).toBe(grande);
  });

  it('un binario soltado va al lector genérico como adjunto, con su hash y su extensión', async () => {
    const { efectos: ef } = efectos();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const c = creado(
      await capturar({ archivo: new File([bytes], 'Captura.PNG', { type: 'image/png' }), origen: 'soltado' }, ef),
    );
    expect(c.elemento.frontmatter).toMatchObject({
      tipo: 'archivo',
      titulo: 'Captura.PNG',
      origen: 'soltado',
      hash: `sha256:${sha256Hex(bytes)}`,
      adjunto: { nombre: 'Captura.PNG', mime: 'image/png', tam: bytes.length },
    });
    expect(c.elemento.frontmatter.adjunto?.ruta).toMatch(/\.png$/);
    expect(c.elemento.original).toBeNull();
  });

  it('un archivo de texto se lee como texto, con los secretos ocultados también en el archivo', async () => {
    const vistos: Entrada[] = [];
    const { repositorio } = efectos();
    const archivo = new File([`17:40 ERROR\nclave=${CLAVE_AWS}\n`], 'app.log', { type: '' });
    const c = creado(
      await capturar({ archivo, origen: 'soltado' }, { repositorio, registro: registroDePrueba(vistos) }),
    );
    expect(c.elemento.frontmatter.tipo).toBe('log');
    expect(c.elemento.original).not.toContain(CLAVE_AWS);
    expect(await vistos[0]?.archivos?.[0]?.text()).not.toContain(CLAVE_AWS);
  });

  it('rechaza un archivo de más de 50 MB sin leerlo', async () => {
    const { efectos: ef } = efectos();
    const enorme = {
      name: 'enorme.bin',
      type: '',
      size: LIMITE_ARCHIVO + 1,
      arrayBuffer: () => Promise.reject(new Error('no se lee')),
    };
    const r = await capturar({ archivo: enorme as unknown as File, origen: 'soltado' }, ef);
    expect(!r.ok && r.error).toMatchObject({
      codigo: 'captura.demasiadoGrande',
      datos: { nombre: 'enorme.bin', limite: LIMITE_ARCHIVO },
    });
  });

  it('en una pestaña de solo lectura falla con almacen.soloLectura', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria(), undefined, { puedeEscribir: () => false });
    const r = await capturar({ texto: 'hola', origen: 'pegado' }, { repositorio, registro: registroDePrueba() });
    expect(!r.ok && r.error.codigo).toBe('almacen.soloLectura');
  });

  it('pide los derivados en segundo plano', async () => {
    const registro = registroDePrueba();
    const { repositorio } = efectos();
    const cola = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro) });
    const c = creado(await capturar({ texto: 'abc', origen: 'pegado' }, { repositorio, registro, cola }));
    expect(await c.derivados).toEqual({ largo: 3 });
  });

  it('deshacer borra el elemento y el adjunto que creó', async () => {
    const { almacen, repositorio, efectos: ef } = efectos();
    const capturador = crearCapturador(ef);
    const r = await capturador.capturar({ archivo: new File([new Uint8Array([0, 1, 2])], 'a.bin'), origen: 'soltado' });
    if (!r.ok || r.valor.tipo !== 'creado') throw new Error('no creado');
    const c = r.valor.capturado;
    await capturador.deshacer(c);
    expect(repositorio.buscar(c.elemento.frontmatter.ref)).toBeUndefined();
    expect(await almacen.existe(c.adjuntoNuevo ?? '')).toBe(false);
    // Deshacer otra vez no hace nada.
    await capturador.deshacer(c);
  });

  it('20 pegados seguidos, sin esperar, dan 20 elementos con refs distintas', async () => {
    const { repositorio, efectos: ef } = efectos();
    const capturador = crearCapturador(ef);
    const rs = await Promise.all(
      Array.from({ length: 20 }, (_, i) => capturador.capturar({ texto: `pegado ${i}`, origen: 'pegado' })),
    );
    const refs = rs.map((r) => creado(r).elemento.frontmatter.ref);
    expect(new Set(refs).size).toBe(20);
    expect(repositorio.elementos()).toHaveLength(20);
  });

  it('pegar 100 KB se guarda y publica en menos de 300 ms (p95 de 20)', async () => {
    const linea = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.\n';
    const tiempos: number[] = [];
    for (let i = 0; i < 20; i++) {
      const { efectos: ef } = efectos();
      const texto = `${i}\n${linea.repeat(Math.ceil(100_000 / linea.length))}`;
      const t0 = performance.now();
      creado(await capturar({ texto, origen: 'pegado' }, ef));
      tiempos.push(performance.now() - t0);
    }
    tiempos.sort((a, b) => a - b);
    expect(tiempos[18]).toBeLessThan(300);
  });
});

describe('capturar el corpus de detección', () => {
  it('cada ejemplo se guarda con su tipo y se relee igual', async () => {
    const raiz = join(process.cwd(), 'fixtures/deteccion');
    const { repositorio, efectos: ef } = efectos();
    const capturador = crearCapturador(ef);
    for (const tipo of readdirSync(raiz)) {
      for (const f of readdirSync(join(raiz, tipo)).filter((x) => x.endsWith('.txt'))) {
        const texto = readFileSync(join(raiz, tipo, f), 'utf8');
        const c = creado(await capturador.capturar({ texto, origen: 'pegado' }));
        expect(c.elemento.frontmatter.tipo, `${tipo}/${f}`).toBe(tipo);
        const leido = await repositorio.leerElemento(c.elemento.frontmatter.ref);
        expect(leido.ok && normalizarOriginal(leido.valor.original ?? '')).toBe(normalizarOriginal(texto));
      }
    }
  });
});
