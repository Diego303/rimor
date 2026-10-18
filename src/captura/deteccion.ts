/**
 * Arnés de detección (IN-013): pasa el detector por un corpus de ejemplos con su tipo esperado y calcula la
 * matriz de confusión, el acierto por tipo y el total. TS puro; la prueba lee el corpus de `fixtures/deteccion/`.
 */
import type { Registro } from '../lectores/registro';
import { detectar, entradaDeArchivo } from './detector';

/**
 * Un ejemplo del corpus: un `.txt` es texto pegado; cualquier otra extensión, un archivo soltado (sus bytes),
 * que pasa por el detector igual que en la captura.
 */
export type Ejemplo = { esperado: string; archivo: string } & ({ texto: string } | { bytes: Uint8Array });

export interface Evaluacion {
  /** `matriz[esperado][detectado]` = número de ejemplos. */
  matriz: Record<string, Record<string, number>>;
  aciertoPorTipo: Record<string, number>;
  acierto: number;
  total: number;
  fallos: { archivo: string; esperado: string; detectado: string }[];
}

export function evaluar(corpus: readonly Ejemplo[], registro: Registro): Evaluacion {
  const matriz: Evaluacion['matriz'] = {};
  const fallos: Evaluacion['fallos'] = [];
  for (const e of corpus) {
    const detectado =
      'texto' in e
        ? detectar({ texto: e.texto }, registro).tipo
        : (() => {
            const { entrada, cabecera } = entradaDeArchivo(e.archivo.split('/').pop() ?? e.archivo, '', e.bytes);
            return detectar(entrada, registro, { cabecera }).tipo;
          })();
    const fila = matriz[e.esperado] ?? {};
    matriz[e.esperado] = fila;
    fila[detectado] = (fila[detectado] ?? 0) + 1;
    if (detectado !== e.esperado) fallos.push({ archivo: e.archivo, esperado: e.esperado, detectado });
  }
  const aciertoPorTipo: Record<string, number> = {};
  for (const [esperado, fila] of Object.entries(matriz)) {
    const total = Object.values(fila).reduce((a, b) => a + b, 0);
    aciertoPorTipo[esperado] = (fila[esperado] ?? 0) / total;
  }
  const total = corpus.length;
  return { matriz, aciertoPorTipo, acierto: total ? (total - fallos.length) / total : 1, total, fallos };
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

/** La matriz como tabla de texto (filas: esperado; columnas: detectado), con el acierto por tipo y los fallos. */
export function formatear(ev: Evaluacion): string {
  const esperados = Object.keys(ev.matriz).sort();
  const detectados = [...new Set(esperados.flatMap((e) => Object.keys(ev.matriz[e] ?? {})))].sort();
  const columnas = ['esperado \\ detectado', ...detectados, 'acierto'];
  const filas = esperados.map((e) => [
    e,
    ...detectados.map((d) => String(ev.matriz[e]?.[d] ?? 0)),
    pct(ev.aciertoPorTipo[e] ?? 0),
  ]);
  const anchos = columnas.map((c, i) => Math.max(c.length, ...filas.map((f) => (f[i] ?? '').length)));
  const linea = (celdas: string[]) => celdas.map((c, i) => c.padStart(anchos[i] ?? 0)).join('  ');
  const partes = [
    linea(columnas),
    ...filas.map(linea),
    '',
    `Acierto total: ${pct(ev.acierto)} de ${ev.total} ejemplos`,
  ];
  if (ev.fallos.length) {
    partes.push('', 'Fallos:');
    for (const f of ev.fallos) partes.push(`  ${f.archivo}: ${f.esperado} → ${f.detectado}`);
  }
  return partes.join('\n');
}
