/**
 * Huella de un error (ORG-06): el mismo error, aunque cambien rutas, números o direcciones, da la misma huella;
 * dos errores con el mismo mensaje y distintos marcos propios, no. Versionada. TS puro.
 */
import { sha256Hex } from '@rimor/formato';
import type { Traza } from './trazas';

/** Si cambia el algoritmo, sube: los derivados se recalculan (con la versión del lector) y las huellas también. */
export const VERSION_HUELLA = 1;

/** El mensaje sin lo que cambia de una vez a otra: números, hexadecimales, UUID, IP, rutas y direcciones. */
export function mensajeNormalizado(mensaje: string): string {
  return mensaje
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<ID>')
    .replace(/(?:[A-Za-z]:\\|\/)(?:[\w.@-]+[\\/])+[\w.@-]+/g, '<RUTA>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<IP>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{12,}\b/gi, '<HEX>')
    .replace(/\d+(?:\.\d+)?/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Un marco por su función, sin lo que cambia entre compilaciones (hash de Rust, número de cierre, lambda). */
export function marcoNormalizado(funcion: string): string {
  return funcion
    .replace(/::h[0-9a-f]{16}$/, '')
    .replace(/\{\{closure\}\}(?:#\d+)?/g, '{{closure}}')
    .replace(/lambda\$[\w$]+\$\d+/g, 'lambda')
    .replace(/\$\d+/g, '')
    .trim();
}

/** El archivo de una ruta, sin carpetas (que cambian de una máquina a otra). */
const archivoDe = (ruta: string) => ruta.split(/[\\/]/).at(-1) ?? '';

/**
 * Los dos marcos propios más internos (donde pasó el error). Python los escribe del más externo al más interno;
 * los demás lenguajes, al revés. Cada uno, por su archivo y su función: así no chocan dos funciones anónimas
 * (o dos `<module>`) de archivos distintos.
 */
export function marcosDeHuella(t: Pick<Traza, 'marcos'> & { lenguaje: string }): string[] {
  const propios = t.marcos.filter((m) => m.propio);
  const deDentroAFuera = t.lenguaje === 'python' ? propios.reverse() : propios;
  // Una celda de Jupyter cambia de número en cada ejecución (`In[3]`, `In[7]`).
  const archivo = (ruta: string) => archivoDe(ruta).replace(/^In\[\d+\]$/, 'In[]');
  return deDentroAFuera.slice(0, 2).map((m) => `${archivo(m.ruta)}:${marcoNormalizado(m.funcion)}`);
}

export function huellaDe(t: Pick<Traza, 'tipo' | 'mensaje' | 'marcos'> & { lenguaje: string }): string {
  const propios = marcosDeHuella(t);
  const base = [`v${VERSION_HUELLA}`, t.lenguaje, t.tipo, mensajeNormalizado(t.mensaje), ...propios].join('|');
  return sha256Hex(base).slice(0, 16);
}
