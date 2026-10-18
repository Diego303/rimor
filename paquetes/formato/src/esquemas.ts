/**
 * Esquemas Valibot de todo lo que se guarda en un espacio (plan §13 y Anexos A y B), versión de esquema 1.
 * Los objetos admiten claves desconocidas y las conservan: un archivo escrito por una versión futura se
 * puede leer y reescribir sin perder nada (compatibilidad hacia delante).
 */
import * as v from 'valibot';
import { esRef, type Ref } from './refs';
import { TIPOS_ELEMENTO } from './tipos';
import { esUlid } from './ulid';

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const ulidSchema = v.pipe(v.string(), v.check(esUlid, 'ulid'));
export const refSchema = v.pipe(
  v.string(),
  v.check(esRef, 'ref'),
  v.transform((x) => x as Ref),
);
export const isoFechaSchema = v.pipe(v.string(), v.regex(ISO_CON_ZONA, 'fecha ISO con zona'));
export const hashSchema = v.pipe(
  v.string(),
  v.regex(/^sha256:[0-9a-f]{64}$/, 'hash'),
  v.transform((x) => x as `sha256:${string}`),
);
const textos = v.array(v.string());
const refs = v.array(refSchema);

export const ORIGENES = ['pegado', 'soltado', 'compartido', 'terminal', 'importado'] as const;

export const adjuntoSchema = v.looseObject({
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  ruta: v.string(),
  nombre: v.optional(v.string()),
  mime: v.optional(v.string()),
  tam: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const lectorSchema = v.looseObject({
  nombre: v.string(),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  resumen: v.record(v.string(), v.unknown()),
});

/** Frontmatter común de un elemento (plan §13.4). */
export const frontmatterSchema = v.looseObject({
  id: ulidSchema,
  ref: refSchema,
  tipo: v.picklist(TIPOS_ELEMENTO),
  titulo: v.string(),
  creado: isoFechaSchema,
  modificado: isoFechaSchema,
  origen: v.picklist(ORIGENES),
  estado: v.optional(v.string()),
  colecciones: v.optional(textos),
  investigaciones: v.optional(refs),
  etiquetas: v.optional(textos),
  sesion: v.optional(v.string()),
  hilo: v.optional(refSchema),
  hash: hashSchema,
  ocultados: v.pipe(v.number(), v.integer(), v.minValue(0)),
  lector: lectorSchema,
  fijado: v.optional(v.boolean()),
  alias: v.optional(refs),
  version: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  adjunto: v.optional(adjuntoSchema),
});
export type FrontmatterComun = v.InferOutput<typeof frontmatterSchema>;

const entidadBase = {
  id: ulidSchema,
  ref: refSchema,
  titulo: v.string(),
  creado: isoFechaSchema,
  modificado: v.optional(isoFechaSchema),
};

/** Comparación de dos o más elementos del mismo tipo (CMP-01). */
export const comparacionSchema = v.looseObject({
  ...entidadBase,
  tipo: v.literal('comparacion'),
  clase: v.string(),
  fuentes: v.pipe(refs, v.minLength(2)),
  resultado: v.record(v.string(), v.unknown()),
  colecciones: v.optional(textos),
  investigaciones: v.optional(refs),
});
export type Comparacion = v.InferOutput<typeof comparacionSchema>;

/** Hilo: cadena ligera de elementos (ORG-15). */
export const hiloSchema = v.looseObject({
  ...entidadBase,
  tipo: v.literal('hilo'),
  estado: v.picklist(['abierto', 'resuelto']),
  nota: v.optional(v.string()),
  resuelto: v.optional(isoFechaSchema),
});
export type Hilo = v.InferOutput<typeof hiloSchema>;

/** Investigación (Anexo B). */
export const investigacionSchema = v.looseObject({
  ...entidadBase,
  tipo: v.literal('investigacion'),
  pregunta: v.string(),
  estado: v.picklist(['abierta', 'concluida', 'cancelada', 'aparcada']),
  elementos: v.optional(
    v.array(
      v.looseObject({
        ref: refSchema,
        papel: v.picklist(['apoya', 'contradice', 'contexto']),
        interpretacion: v.optional(v.string()),
      }),
    ),
  ),
  hipotesis: v.optional(
    v.array(v.looseObject({ texto: v.string(), estado: v.picklist(['pendiente', 'apoyada', 'descartada']) })),
  ),
  decision: v.optional(
    v.looseObject({
      opciones: textos,
      criterios: v.array(
        v.looseObject({
          nombre: v.string(),
          peso: v.number(),
          puntuaciones: v.array(v.number()),
          evidencia: v.optional(refs),
        }),
      ),
    }),
  ),
  conclusion: v.optional(v.string()),
});
export type Investigacion = v.InferOutput<typeof investigacionSchema>;

/** Documento: informe, ADR, postmortem o minipaper (Anexo B). */
export const documentoSchema = v.looseObject({
  ...entidadBase,
  tipo: v.literal('documento'),
  plantilla: v.optional(v.string()),
  investigacion: v.optional(refSchema),
  estado: v.optional(v.string()),
  cifras: v.optional(v.record(v.string(), v.looseObject({ valor: v.string(), fijado: isoFechaSchema }))),
});
export type Documento = v.InferOutput<typeof documentoSchema>;

/** `manifest.json` (Anexo A). */
export const manifestSchema = v.looseObject({
  formato: v.literal('rimor'),
  esquema: v.pipe(v.number(), v.integer(), v.minValue(1)),
  espacio: v.looseObject({ id: ulidSchema, nombre: v.string() }),
  creado: v.optional(isoFechaSchema),
  exportado: v.optional(isoFechaSchema),
  app: v.looseObject({ version: v.string() }),
  recuentos: v.optional(v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)))),
  adjuntos_excluidos: v.optional(textos),
  hashes: v.optional(v.looseObject({ algoritmo: v.literal('SHA-256'), archivos: v.record(v.string(), v.string()) })),
});
export type Manifest = v.InferOutput<typeof manifestSchema>;

/** `colecciones.json`. */
export const coleccionesSchema = v.looseObject({
  esquema: v.literal(1),
  colecciones: v.array(
    v.looseObject({ id: v.string(), nombre: v.string(), orden: v.number(), creado: isoFechaSchema }),
  ),
});
export type Colecciones = v.InferOutput<typeof coleccionesSchema>;

/** `vistas.json` (vistas guardadas, ORG-11). */
export const vistasSchema = v.looseObject({
  esquema: v.literal(1),
  vistas: v.array(v.looseObject({ id: v.string(), nombre: v.string(), consulta: v.string(), creado: isoFechaSchema })),
});
export type Vistas = v.InferOutput<typeof vistasSchema>;

/** `.rimor/ajustes.json` (APP-04). Todo opcional: lo que falta toma el valor por defecto. */
export const ajustesSchema = v.looseObject({
  esquema: v.literal(1),
  tema: v.optional(v.picklist(['sistema', 'claro', 'oscuro'])),
  idioma: v.optional(v.picklist(['es', 'en'])),
  deteccion: v.optional(v.looseObject({ umbral: v.optional(v.number()), duda: v.optional(v.number()) })),
  secretos: v.optional(v.looseObject({ desactivadas: v.optional(textos) })),
  respuestas: v.optional(v.looseObject({ desactivadas: v.optional(textos) })),
  copias: v.optional(v.looseObject({ cambios: v.optional(v.number()), dias: v.optional(v.number()) })),
  red: v.optional(v.looseObject({ sinRed: v.optional(v.boolean()), dominios: v.optional(textos) })),
});
export type Ajustes = v.InferOutput<typeof ajustesSchema>;
