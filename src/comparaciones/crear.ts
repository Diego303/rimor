/**
 * Calcular, crear y recalcular una comparación (CMP-01): con los derivados de las dos fuentes (de la caché si
 * están, `derivar`), sin volver a analizar nada. La primera fuente es la de referencia (la buena, la base); la
 * segunda, la que se compara. TS puro con lo que necesita inyectado.
 */
import {
  type Comparacion,
  type Elemento,
  type Entidad,
  fallo,
  isoConZona,
  ok,
  type Resultado,
  ulid,
} from '@rimor/formato';
import type { RepositorioEntidades } from '../almacen/entidades';
import type { Repositorio } from '../almacen/repositorio';
import type { DatosTabla } from '../lectores/datos/perfil';
import type { DatosLog } from '../lectores/log/analisis';
import type { DatosMediciones } from '../lectores/mediciones/lector';
import { type ClaseComparacion, comparables } from './clases';
import { type ComparacionDatos, compararDatos } from './datos';
import { type ComparacionLogs, compararLogs } from './logs';
import { type ComparacionMediciones, compararMediciones } from './mediciones';
import { type ResultadoComparacion, resultadoDeDatos, resultadoDeLogs, resultadoDeMediciones } from './resultado';

/** El lector que deriva los datos de cada clase: sus datos son los que se comparan. */
const LECTOR: Record<ClaseComparacion, string> = { logs: 'log', mediciones: 'mediciones', datos: 'datos' };

export type Calculo =
  | { clase: 'logs'; logs: ComparacionLogs; datos: [DatosLog, DatosLog] }
  | { clase: 'mediciones'; mediciones: ComparacionMediciones }
  | { clase: 'datos'; datos: ComparacionDatos };

/** Los derivados de un elemento (la cola de derivados de la app, que usa su caché). */
export type Derivar = (el: Elemento) => Promise<unknown>;

/** Compara dos elementos ya leídos; si no se pueden comparar, el motivo (`comparacion.distintoTipo`…). */
export async function calcular(a: Elemento, b: Elemento, derivar: Derivar): Promise<Resultado<Calculo>> {
  const c = comparables(a.frontmatter, b.frontmatter);
  if ('motivo' in c) return fallo(`comparacion.${c.motivo}`);
  // Un log que leyó otro lector (un archivo soltado) no trae los datos de un log.
  const lector = LECTOR[c.clase];
  if (a.frontmatter.lector.nombre !== lector || b.frontmatter.lector.nombre !== lector)
    return fallo('comparacion.otroLector');
  const [da, db] = await Promise.all([derivar(a), derivar(b)]);
  if (c.clase === 'logs') {
    const datos: [DatosLog, DatosLog] = [da as DatosLog, db as DatosLog];
    return ok({ clase: 'logs', logs: compararLogs(...datos), datos });
  }
  if (c.clase === 'datos') return ok({ clase: 'datos', datos: compararDatos(da as DatosTabla, db as DatosTabla) });
  const mediciones = compararMediciones(da as DatosMediciones, db as DatosMediciones);
  return mediciones ? ok({ clase: 'mediciones', mediciones }) : fallo('comparacion.sinValores');
}

/** Lo que se guarda de un cálculo, con el hash y el nombre de cada fuente. */
export function resultadoDe(calculo: Calculo, fuentes: readonly [Elemento, Elemento]): ResultadoComparacion {
  const de = {
    hashes: fuentes.map((f) => f.frontmatter.hash),
    nombres: [nombreDe(fuentes[0], calculo, 'a'), nombreDe(fuentes[1], calculo, 'b')],
    versiones: fuentes.map((f) => f.frontmatter.lector.version),
  };
  if (calculo.clase === 'datos') return resultadoDeDatos(calculo.datos, de);
  return calculo.clase === 'logs' ? resultadoDeLogs(calculo.logs, de) : resultadoDeMediciones(calculo.mediciones, de);
}

export interface DependenciasCrear {
  repositorio: Pick<Repositorio, 'leerElemento'>;
  entidades: Pick<RepositorioEntidades, 'crear'>;
  derivar: Derivar;
  /** El título de la comparación con los nombres de las dos fuentes («reqwest frente a ureq»). */
  titular: (a: string, b: string) => string;
  reloj?: () => Date;
  nuevoId?: () => string;
}

/** Largo máximo de cada nombre en el título. */
const LARGO_NOMBRE = 60;
const recortar = (s: string) => (s.length > LARGO_NOMBRE ? `${s.slice(0, LARGO_NOMBRE - 1).trimEnd()}…` : s);

/** Cómo se llama una fuente en el título: la etiqueta de su serie (mediciones) o su título. */
export function nombreDe(el: Elemento, calculo: Calculo, cual: 'a' | 'b'): string {
  const etiqueta = calculo.clase === 'mediciones' ? calculo.mediciones[cual].etiqueta : null;
  return recortar((etiqueta ?? el.frontmatter.titulo).trim() || el.frontmatter.ref);
}

/** Crea la comparación de `refA` (la de referencia) con `refB` y devuelve su ref. */
export async function crearComparacion(refA: string, refB: string, dep: DependenciasCrear): Promise<Resultado<string>> {
  const [la, lb] = await Promise.all([dep.repositorio.leerElemento(refA), dep.repositorio.leerElemento(refB)]);
  if (!la.ok) return la;
  if (!lb.ok) return lb;
  const a = la.valor;
  const b = lb.valor;
  const calculo = await calcular(a, b, dep.derivar);
  if (!calculo.ok) return calculo;
  const creado = isoConZona((dep.reloj ?? (() => new Date()))());
  const id = (dep.nuevoId ?? ulid)();
  const fuentes = [a.frontmatter.ref, b.frontmatter.ref];
  const titulo = dep.titular(nombreDe(a, calculo.valor, 'a'), nombreDe(b, calculo.valor, 'b'));
  const resultado = resultadoDe(calculo.valor, [a, b]) as unknown as Record<string, unknown>;
  // La ref se asigna al guardar, en el turno de las creaciones: dos a la vez no se llevan la misma.
  const ref = await dep.entidades.crear(
    'comparacion',
    (r): Entidad<Comparacion> => ({
      frontmatter: {
        id,
        ref: r as Comparacion['ref'],
        tipo: 'comparacion',
        titulo,
        creado,
        modificado: creado,
        clase: calculo.valor.clase,
        fuentes,
        resultado,
      },
      cuerpo: '',
    }),
  );
  return ok(ref);
}
