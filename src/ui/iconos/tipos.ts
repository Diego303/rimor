/**
 * Aspecto de cada tipo de elemento (rimor-diseno.md §3.2 y §6.1): icono y clase de color.
 * Todos los tipos son neutros salvo Error (E7); las clases `k-*` apuntan a los tokens `--k-*`.
 */
import type { NombreIcono } from './Icono';

export const ASPECTO_TIPO = {
  texto: { icono: 'texto', clase: 'k-cod' },
  idea: { icono: 'idea', clase: 'k-idea' },
  enlace: { icono: 'enlace', clase: 'k-url' },
  log: { icono: 'log', clase: 'k-log' },
  error: { icono: 'error', clase: 'k-err' },
  mediciones: { icono: 'mediciones', clase: 'k-med' },
  prompt: { icono: 'prompt', clase: 'k-prm' },
  markdown: { icono: 'markdown', clase: 'k-md' },
  codigo: { icono: 'codigo', clase: 'k-cod' },
  comando: { icono: 'comando', clase: 'k-cod' },
  datos: { icono: 'datos', clase: 'k-dat' },
  json: { icono: 'json', clase: 'k-cod' },
  http: { icono: 'http', clase: 'k-url' },
  imagen: { icono: 'imagen', clase: 'k-cod' },
  pdf: { icono: 'pdf', clase: 'k-doc' },
  formula: { icono: 'formula', clase: 'k-cod' },
  diagrama: { icono: 'diagrama', clase: 'k-cod' },
  calculo: { icono: 'calculo', clase: 'k-cod' },
  archivo: { icono: 'documento', clase: 'k-doc' },
  comparacion: { icono: 'comparacion', clase: 'k-cmp' },
  investigacion: { icono: 'investigacion', clase: 'k-inv' },
  documento: { icono: 'documento', clase: 'k-doc' },
  hilo: { icono: 'hilo', clase: 'k-cod' },
} as const satisfies Record<string, { icono: NombreIcono; clase: string }>;

export type TipoVisual = keyof typeof ASPECTO_TIPO;
