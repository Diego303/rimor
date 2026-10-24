/**
 * El recorrido de v0.1 (IN-040, plan §18) con los módulos reales sobre almacenes en memoria: pegar → elemento →
 * comparar → hilo → buscar → exportar → importar, y en el espacio importado vuelve a estar todo. En los tres
 * motores de navegador (Playwright), cuando el autor lo pida.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Elemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { escribirTexto, listarTodo } from './almacen/contrato';
import { RepositorioEntidades } from './almacen/entidades';
import { AlmacenMemoria } from './almacen/memoria';
import { Repositorio } from './almacen/repositorio';
import { apiIndice } from './busqueda/indice';
import { MotorBusqueda } from './busqueda/motor';
import { capturar } from './captura/flujo';
import { crearComparacion } from './comparaciones/crear';
import { exportarZip } from './datos/exportar';
import { fusionar } from './datos/importar/aplicar';
import { leerPaquete } from './datos/importar/paquete';
import { planear } from './datos/importar/plan';
import { formarSiEsError } from './hilos/formar';
import { REGISTRO } from './lectores/registro';

const fixture = (r: string) => readFileSync(join(process.cwd(), 'fixtures', r), 'utf8');
const MANIFEST = {
  formato: 'rimor',
  esquema: 1,
  espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Trabajo' },
  app: { version: '0.1.0' },
};

/** La traza del gateway en la línea `n` (la huella no cambia con los números). */
const traza = (n: number) =>
  [
    "thread 'tokio-runtime-worker' panicked at src/gateway/stream.rs:" + n + ':17:',
    'called `Result::unwrap()` on an `Err` value: Timeout',
    'stack backtrace:',
    '   0: gateway::stream::next_chunk',
    `             at ./src/gateway/stream.rs:${n}:17`,
  ].join('\n');

async function espacio() {
  const almacen = new AlmacenMemoria();
  await escribirTexto(almacen, 'manifest.json', JSON.stringify(MANIFEST));
  const repositorio = new Repositorio(almacen);
  const entidades = new RepositorioEntidades(almacen, ['comparacion', 'hilo']);
  return { almacen, repositorio, entidades };
}

/** Lo que el lector deja en el frontmatter al derivar (la huella de un error): como hace la app al pintar. */
async function derivarYPoner(repositorio: Repositorio, ref: string) {
  const el = await repositorio.leerElemento(ref);
  if (!el.ok) throw new Error(ref);
  const lector = REGISTRO.paraElemento(el.valor);
  if (!lector) throw new Error(`sin lector: ${ref}`);
  const datos = await lector.derivar(el.valor);
  await repositorio.actualizarElemento(ref, (e) => ({
    ...e,
    frontmatter: { ...e.frontmatter, lector: { ...e.frontmatter.lector, resumen: lector.resumen(datos) } },
  }));
}

const derivar = async (el: Elemento) =>
  (REGISTRO.paraElemento(el) as NonNullable<ReturnType<typeof REGISTRO.paraElemento>>).derivar(el);

describe('recorrido de v0.1', () => {
  it('pegar → elemento → comparar → hilo → buscar → exportar → importar', { timeout: 120_000 }, async () => {
    const { almacen, repositorio, entidades } = await espacio();
    let minuto = 0;
    const pegar = async (texto: string, colecciones: string[] = ['gateway']) => {
      const cuando = new Date(Date.UTC(2026, 9, 17, 10, minuto++));
      const r = await capturar(
        { texto, origen: 'pegado', colecciones },
        { repositorio, registro: REGISTRO, reloj: () => cuando },
      );
      if (!r.ok || r.valor.tipo !== 'creado') throw new Error(`no se guardó: ${JSON.stringify(r)}`);
      return r.valor.capturado.elemento.frontmatter;
    };

    // Pegar: cada cosa con su lector.
    const logBueno = await pegar(fixture('comparaciones/buena.log'));
    const logMalo = await pegar(fixture('comparaciones/mala.log'));
    const reqwest = await pegar(fixture('mediciones/reqwest.txt'));
    const ureq = await pegar(fixture('mediciones/ureq.txt'));
    const errores = [await pegar(traza(142)), await pegar(traza(150)), await pegar(traza(160))];
    expect([logBueno, logMalo, reqwest, ureq, ...errores].map((fm) => fm.tipo)).toEqual([
      'log',
      'log',
      'mediciones',
      'mediciones',
      'error',
      'error',
      'error',
    ]);

    // Elemento: se lee del espacio tal cual se guardó.
    const leido = await repositorio.leerElemento(reqwest.ref);
    expect(leido.ok && leido.valor.original).toBe(fixture('mediciones/reqwest.txt'));

    // Comparar: las dos mediciones y los dos logs.
    const titular = (a: string, b: string) => `${a} frente a ${b}`;
    const med = await crearComparacion(reqwest.ref, ureq.ref, { repositorio, entidades, derivar, titular });
    const logs = await crearComparacion(logBueno.ref, logMalo.ref, { repositorio, entidades, derivar, titular });
    expect(med.ok && logs.ok).toBe(true);

    // Hilo: las tres trazas con la misma huella forman uno.
    for (const e of errores) await derivarYPoner(repositorio, e.ref);
    let hilo: string | null = null;
    for (const e of errores) hilo = (await formarSiEsError(e.ref, { repositorio, entidades })) ?? hilo;
    expect(hilo).toBeTruthy();
    expect(errores.map((e) => repositorio.frontmatter(e.ref)?.hilo)).toEqual([hilo, hilo, hilo]);

    // Buscar.
    const buscarEn = async (r: Repositorio, q: string) => {
      const motor = new MotorBusqueda({ repositorio: r, api: apiIndice() });
      await motor.sincronizar();
      return (await motor.buscar(q)).resultados.map((x) => x.fm.ref).sort();
    };
    expect(await buscarEn(repositorio, 'gateway tipo:log')).toEqual([logBueno.ref, logMalo.ref].sort());
    expect(await buscarEn(repositorio, 'ureq en:gateway')).toContain(ureq.ref);
    expect(await buscarEn(repositorio, 'timeout tipo:log')).toEqual([logMalo.ref]);

    // Exportar e importar en un espacio vacío.
    const { trozos } = await exportarZip(almacen, {
      ahora: new Date('2026-10-17T12:00:00Z'),
      version: '0.1.0',
      ceder: async () => undefined,
    });
    const zip = new Uint8Array(trozos.reduce((s, t) => s + t.length, 0));
    let i = 0;
    for (const t of trozos) {
      zip.set(t, i);
      i += t.length;
    }
    const paquete = await leerPaquete(zip, 'rimor-trabajo.zip');
    const otro = await espacio();
    const plan = await planear(paquete.archivos, paquete.manifest, {
      elementos: [],
      entidades: [],
      leer: (r) => otro.almacen.leer(r),
    });
    expect(plan.recuentos.nuevo).toBe(7);
    await fusionar(otro.almacen, plan);

    // En el importado: los mismos archivos (menos el manifest, que es de este espacio), y todo se encuentra.
    const rutas = async (a: AlmacenMemoria) =>
      (await listarTodo(a, ''))
        .map((e) => e.ruta)
        .filter((r) => r !== 'manifest.json')
        .sort();
    expect(await rutas(otro.almacen)).toEqual(await rutas(almacen));
    await otro.repositorio.cargar();
    await otro.entidades.cargar();
    expect(otro.repositorio.elementos()).toHaveLength(7);
    expect(otro.entidades.lista('comparacion')).toHaveLength(2);
    expect(otro.entidades.lista('hilo')).toHaveLength(1);
    expect(await buscarEn(otro.repositorio, 'gateway tipo:log')).toEqual([logBueno.ref, logMalo.ref].sort());
  });
});
