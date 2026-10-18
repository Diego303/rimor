/**
 * Registro de lectores (IN-012): la lista, en el orden en que se prueban al detectar (plan, Anexo D). TS puro:
 * lo importa también el Worker de derivados.
 *
 * Añadir un lector: copiar `_plantilla/` a `src/lectores/<nombre>/`, rellenarla e importarla aquí, en su puesto
 * de `ORDEN_DETECCION` (si su nombre no está, se añade a su puesto).
 */
import type { Elemento } from '@rimor/formato';
import { lectorArchivo } from './archivo/lector';
import type { Lector } from './contrato';
import { lectorIdea } from './idea/lector';
import { lectorTexto } from './texto/lector';

/**
 * Puestos del Anexo D, del primero al último; cada puesto admite los lectores que nombra. Un lector registrado
 * tiene que estar en algún puesto, y `LECTORES` respeta este orden (lo comprueba una prueba).
 */
export const ORDEN_DETECCION: readonly (readonly string[])[] = [
  ['sobre'], // 1. sobre de terminal (CLI)
  ['imagen', 'pdf', 'archivo'], // 2. binarios por tipo MIME o firma
  ['enlace'], // 3. URL o DOI
  ['error'], // 4. traza
  ['log'], // 5. log
  ['mediciones'], // 6. mediciones
  ['json'], // 7. JSON, YAML, TOML
  ['datos'], // 8. tabulares
  ['http'], // 9. petición HTTP
  ['diff'], // 10. diff
  ['prompt'], // 11. prompt
  ['markdown'], // 12. documento Markdown
  ['comando'], // 13. comando
  ['formula', 'diagrama'], // 14. fórmula, diagrama
  ['codigo'], // 15. código
  ['idea'], // 16. idea
  ['texto'], // 17. texto: todo lo demás
];

/** Los lectores de la app, en el orden de `ORDEN_DETECCION`. */
export const LECTORES: readonly Lector[] = [
  lectorArchivo, // 2
  lectorIdea, // 16
  lectorTexto, // 17
];

export interface Registro {
  /** En orden de detección. */
  readonly lectores: readonly Lector[];
  porNombre(nombre: string): Lector | undefined;
  /** El lector que escribió el elemento; si ya no existe, el de su tipo. */
  paraElemento(el: Pick<Elemento, 'frontmatter'>): Lector | undefined;
}

const NOMBRE_VALIDO = /^[a-z][a-z0-9-]*$/;

/** Puesto de un lector en el Anexo D, o -1 si no tiene. */
export function puestoDe(nombre: string): number {
  return ORDEN_DETECCION.findIndex((p) => p.includes(nombre));
}

/** Crea un registro comprobando que los lectores son coherentes (nombres únicos y válidos, versiones ≥ 1). */
export function crearRegistro(lectores: readonly Lector[]): Registro {
  const porNombre = new Map<string, Lector>();
  for (const l of lectores) {
    if (!NOMBRE_VALIDO.test(l.nombre)) throw new Error(`Nombre de lector no válido: «${l.nombre}»`);
    if (!Number.isInteger(l.version) || l.version < 1) throw new Error(`Versión no válida en «${l.nombre}»`);
    if (porNombre.has(l.nombre)) throw new Error(`Lector repetido: «${l.nombre}»`);
    porNombre.set(l.nombre, l);
  }
  return {
    lectores,
    porNombre: (nombre) => porNombre.get(nombre),
    paraElemento: ({ frontmatter }) =>
      porNombre.get(frontmatter.lector.nombre) ?? lectores.find((l) => l.tipo === frontmatter.tipo),
  };
}

export const REGISTRO = crearRegistro(LECTORES);
