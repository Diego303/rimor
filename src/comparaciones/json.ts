/**
 * Comparación estructural de dos configuraciones (CMP-03, IN-045): las claves añadidas, quitadas y cambiadas, por
 * ruta y en el orden del documento. Sale de los dos derivados (su valor ya como JSON): un JSON se puede comparar con
 * un YAML o un TOML con las mismas claves. TS puro.
 */
import { compararValores, type DiferenciasJson, type FormatoJson } from '../lectores/json/analisis';
import type { DatosJson } from '../lectores/json/lector';

export interface ComparacionJson extends DiferenciasJson {
  formatos: [FormatoJson, FormatoJson];
}

export function compararJson(a: DatosJson, b: DatosJson): ComparacionJson {
  return { ...compararValores(a.valor, b.valor), formatos: [a.formato, b.formato] };
}
