/**
 * Los dominios que el enriquecimiento puede consultar (IN-041), agrupados por uso para Ajustes. Todos están en el
 * `connect-src` de la CSP (`scripts/csp.mjs`); cuáles se consultan lo deciden los ajustes del espacio. TS puro, sin
 * los proveedores (Ajustes no los carga).
 */
export const GRUPOS_DOMINIOS = [
  { grupo: 'repositorios', dominios: ['api.github.com', 'gitlab.com'] },
  { grupo: 'paquetes', dominios: ['api.deps.dev', 'api.osv.dev', 'registry.npmjs.org', 'crates.io', 'pypi.org'] },
  { grupo: 'papers', dominios: ['api.crossref.org', 'api.datacite.org'] },
] as const;

export type GrupoDominios = (typeof GRUPOS_DOMINIOS)[number]['grupo'];

export const DOMINIOS = GRUPOS_DOMINIOS.flatMap((g) => g.dominios) as string[];

/** El token de GitHub vive solo en este navegador: nunca en el espacio, en el ZIP ni en una ficha. */
const CLAVE_TOKEN = 'rimor:token-github';

export function leerTokenGithub(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(CLAVE_TOKEN)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Un token va en una cabecera: solo caracteres ASCII visibles (un espacio de ancho cero pegado la rompería). */
export const tokenValido = (token: string): boolean => /^[\x21-\x7e]+$/.test(token.trim());

/** Guarda el token (vacío, lo borra); `false` si no vale y no se guarda. */
export function guardarTokenGithub(token: string): boolean {
  const limpio = token.trim();
  if (limpio && !tokenValido(limpio)) return false;
  try {
    if (limpio) globalThis.localStorage?.setItem(CLAVE_TOKEN, limpio);
    else globalThis.localStorage?.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento del navegador: se consulta sin token.
  }
  return true;
}
