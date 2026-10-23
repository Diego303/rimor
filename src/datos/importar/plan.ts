/**
 * Qué pasará al importar (DAT-04): compara un paquete con el espacio, elemento a elemento por `id`, y prepara lo que
 * escribe «fusionar». Un elemento es nuevo, idéntico, actualizado (aquí no cambió desde la exportación: gana el del
 * paquete) o en conflicto (aquí también cambió: gana el más reciente y el otro va a `historial/`). Un nuevo cuya ref
 * ya se usa aquí recibe otra libre, con la vieja en `alias` y sus menciones reescritas en lo importado. TS puro.
 */
import {
  asignarRef,
  type Elemento,
  escribirElemento,
  leerColecciones,
  leerElemento,
  leerEntidad,
  type Manifest,
  rutaElemento,
  rutaEntidad,
  rutaHistorial,
  type TipoEntidad,
} from '@rimor/formato';
import { CARPETA_PAPELERA } from '../../almacen/repositorio';

export type Categoria = 'nuevo' | 'identico' | 'actualizado' | 'conflicto';

export interface CambioElemento {
  id: string;
  ref: string;
  titulo: string;
  categoria: Categoria;
  /** En los actualizados y en conflicto, cuál se queda. */
  ganador?: 'aqui' | 'paquete';
  modificadoAqui?: string;
  modificadoPaquete?: string;
  /** Si su ref chocaba con otra de aquí, la que recibe. */
  refNueva?: string;
}

/** Un elemento de aquí (también los de la papelera), del índice en memoria. */
export interface ElementoLocal {
  id: string;
  ref: string;
  alias: readonly string[];
  ruta: string;
  modificado: string;
}

/** Una entidad de aquí (comparaciones, hilos). */
export interface EntidadLocal {
  id: string;
  ref: string;
  ruta: string;
}

/** Lo que el plan necesita del espacio. */
export interface EspacioLocal {
  elementos: readonly ElementoLocal[];
  entidades: readonly EntidadLocal[];
  leer(ruta: string): Promise<Uint8Array | null>;
}

export interface Plan {
  elementos: CambioElemento[];
  recuentos: Record<Categoria, number>;
  reasignadas: { de: string; a: string }[];
  /** Lo que escribe «fusionar» (ruta → bytes), sin pisar nada que no deba. */
  escrituras: Map<string, Uint8Array>;
  /** Lo que «fusionar» borra (un elemento que el paquete mueve de ruta). */
  borrados: string[];
  /** Lo que no impide importar pero conviene saber (una entidad de aquí que se queda). */
  avisos: { codigo: string; ruta: string }[];
}

const texto = (d: Uint8Array) => new TextDecoder().decode(d);
const bytes = (s: string) => new TextEncoder().encode(s);
const iguales = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const instante = (iso: string | undefined) => (iso ? Date.parse(iso) : Number.NaN);

/** Reescribe las refs que cambian, como palabras enteras y de una pasada (sin encadenar un cambio en otro). */
export function reescribirRefs(contenido: string, cambios: ReadonlyMap<string, string>): string {
  if (!cambios.size) return contenido;
  const patron = new RegExp(
    `(?<![\\p{L}\\p{N}-])(${[...cambios.keys()].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}-])`,
    'gu',
  );
  return contenido.replace(patron, (r) => cambios.get(r) ?? r);
}

const enPapelera = (ruta: string) => ruta.startsWith(`${CARPETA_PAPELERA}/`);
const esElemento = (r: string) => /^(papelera\/)?elementos\/.+\.md$/.test(r);
const esEntidad = (r: string) => /^(comparaciones|hilos)\/.+\.md$/.test(r);
/** De este navegador: nunca se importa encima. */
const esLocal = (r: string) => r.startsWith('.rimor/') || r === 'manifest.json';

/** La ruta de un elemento, en `elementos/` o en la papelera. */
const rutaDe = (el: Elemento, papelera: boolean) => {
  const fm = el.frontmatter;
  const ruta = rutaElemento(fm.ref, fm.titulo, fm.creado);
  return papelera ? `${CARPETA_PAPELERA}/${ruta}` : ruta;
};

/** Junta dos registros de colecciones: las del paquete que falten, al final y en su orden. */
function juntarColecciones(aqui: string | null, paquete: string): string | null {
  const local = aqui === null ? { esquema: 1 as const, colecciones: [] } : leerColecciones(aqui);
  const otro = leerColecciones(paquete);
  if (!local || !otro) return null;
  const ya = new Set(local.colecciones.map((c) => c.id));
  let orden = local.colecciones.reduce((m, c) => Math.max(m, c.orden), -1) + 1;
  const nuevas = [...otro.colecciones]
    .sort((a, b) => a.orden - b.orden)
    .filter((c) => !ya.has(c.id))
    .map((c) => ({ ...c, orden: orden++ }));
  if (!nuevas.length) return null;
  return `${JSON.stringify({ ...local, colecciones: [...local.colecciones, ...nuevas] }, null, 2)}\n`;
}

export async function planear(
  archivos: ReadonlyMap<string, Uint8Array>,
  manifest: Manifest,
  local: EspacioLocal,
): Promise<Plan> {
  const exportado = instante(manifest.exportado);
  const porId = new Map(local.elementos.map((e) => [e.id, e]));
  // Las refs ocupadas: las de aquí (con sus alias) y las de lo importado.
  const ocupadas = new Set(local.elementos.flatMap((e) => [e.ref, ...e.alias]));
  for (const e of local.entidades) ocupadas.add(e.ref);
  const plan: Plan = {
    elementos: [],
    recuentos: { nuevo: 0, identico: 0, actualizado: 0, conflicto: 0 },
    reasignadas: [],
    escrituras: new Map(),
    borrados: [],
    avisos: [],
  };
  const leidos = new Map<string, Elemento>();
  for (const [ruta, datos] of archivos)
    if (esElemento(ruta)) {
      const r = leerElemento(texto(datos));
      if (r.ok) leidos.set(ruta, r.valor);
    }
  for (const el of leidos.values()) ocupadas.add(el.frontmatter.ref);

  // Primero, las refs nuevas de los nuevos que chocan (con aquí o entre sí no: el paquete ya las tiene únicas).
  const cambios = new Map<string, string>();
  const refsAqui = new Set(local.elementos.flatMap((e) => [e.ref, ...e.alias]));
  for (const e of local.entidades) refsAqui.add(e.ref);
  for (const el of leidos.values()) {
    const fm = el.frontmatter;
    if (porId.has(fm.id) || !refsAqui.has(fm.ref)) continue;
    const nueva = asignarRef(fm.tipo, ocupadas);
    ocupadas.add(nueva);
    cambios.set(fm.ref, nueva);
  }
  // Las entidades nuevas cuya ref ya se usa aquí, igual (sin alias: su esquema no lo tiene).
  const entidadesAqui = new Map(local.entidades.map((e) => [e.id, e]));
  const entidades = new Map<string, ReturnType<typeof leerEntidad>>();
  for (const [ruta, datos] of archivos)
    if (esEntidad(ruta)) {
      const entidad = leerEntidad(texto(datos));
      entidades.set(ruta, entidad);
      if (!entidad.ok) continue;
      const fm = entidad.valor.frontmatter;
      if (entidadesAqui.has(fm.id) || !refsAqui.has(fm.ref)) continue;
      const nueva = asignarRef(fm.tipo, ocupadas);
      ocupadas.add(nueva);
      cambios.set(fm.ref, nueva);
    }
  for (const [de, a] of cambios) plan.reasignadas.push({ de, a });

  for (const [ruta, el] of leidos) {
    const fm = el.frontmatter;
    const datos = archivos.get(ruta) as Uint8Array;
    const aqui = porId.get(fm.id);
    const base = { id: fm.id, ref: fm.ref, titulo: fm.titulo };
    if (!aqui) {
      const refNueva = cambios.get(fm.ref);
      // Sus notas mencionan refs del paquete: si alguna cambió, se reescribe.
      const notas = reescribirRefs(el.notas, cambios);
      const nuevo: Elemento = refNueva
        ? {
            ...el,
            notas,
            frontmatter: {
              ...fm,
              ref: refNueva as typeof fm.ref,
              alias: [...new Set([...(fm.alias ?? []), fm.ref])] as typeof fm.alias,
            },
          }
        : { ...el, notas };
      const cambiado = refNueva || notas !== el.notas;
      plan.escrituras.set(
        cambiado ? rutaDe(nuevo, enPapelera(ruta)) : ruta,
        cambiado ? bytes(escribirElemento(nuevo, texto(datos))) : datos,
      );
      plan.elementos.push({ ...base, categoria: 'nuevo', ...(refNueva ? { refNueva } : {}) });
      plan.recuentos.nuevo++;
      continue;
    }
    const suyo = await local.leer(aqui.ruta);
    if (suyo && iguales(suyo, datos) && aqui.ruta === ruta) {
      plan.elementos.push({ ...base, categoria: 'identico' });
      plan.recuentos.identico++;
      continue;
    }
    // Aquí cambió después de exportar el paquete (o no se sabe cuándo se exportó): cambiaron los dos.
    const categoria: Categoria = !(instante(aqui.modificado) <= exportado) ? 'conflicto' : 'actualizado';
    const ganador = instante(fm.modificado) >= instante(aqui.modificado) ? 'paquete' : 'aqui';
    if (ganador === 'paquete') {
      plan.escrituras.set(ruta, datos);
      if (aqui.ruta !== ruta) plan.borrados.push(aqui.ruta);
      if (suyo) plan.escrituras.set(rutaHistorial(aqui.ref, aqui.modificado), suyo);
    } else plan.escrituras.set(rutaHistorial(aqui.ref, fm.modificado), datos);
    plan.elementos.push({
      ...base,
      categoria,
      ganador,
      modificadoAqui: aqui.modificado,
      modificadoPaquete: fm.modificado,
    });
    plan.recuentos[categoria]++;
  }

  for (const [ruta, datos] of archivos) {
    if (esElemento(ruta) || esLocal(ruta)) continue;
    // Con la ref reasignada, su historial va a su carpeta nueva.
    const destino = ruta.startsWith('historial/')
      ? ruta.replace(/^historial\/([^/]+)\//, (m, ref: string) =>
          cambios.has(ref) ? `historial/${cambios.get(ref)}/` : m,
        )
      : ruta;
    const suyo = await local.leer(destino);
    if (ruta === 'colecciones.json') {
      const juntas = juntarColecciones(suyo === null ? null : texto(suyo), texto(datos));
      if (juntas) plan.escrituras.set(ruta, bytes(juntas));
      continue;
    }
    if (esEntidad(ruta)) {
      const leida = entidades.get(ruta);
      if (!leida?.ok) continue;
      const fm = leida.valor.frontmatter;
      const aqui = entidadesAqui.get(fm.id);
      if (aqui) {
        const deAqui = await local.leer(aqui.ruta);
        if (!deAqui || !iguales(deAqui, datos)) plan.avisos.push({ codigo: 'importar.entidadSeQueda', ruta });
        continue;
      }
      // Las refs que cambian, en todo el archivo (también la suya, en su frontmatter); y su nombre, con la nueva.
      const refNueva = cambios.get(fm.ref);
      const destinoEntidad = refNueva ? rutaEntidad(fm.tipo as TipoEntidad, refNueva, fm.titulo) : ruta;
      plan.escrituras.set(destinoEntidad, bytes(reescribirRefs(texto(datos), cambios)));
      continue;
    }
    // Adjuntos (por hash), historial y lo demás: se suman sin pisar; si ya hay otro distinto, se queda el de aquí.
    if (suyo === null) plan.escrituras.set(destino, datos);
    else if (!iguales(suyo, datos) && !ruta.startsWith('historial/'))
      plan.avisos.push({ codigo: 'importar.archivoSeQueda', ruta });
  }
  return plan;
}
