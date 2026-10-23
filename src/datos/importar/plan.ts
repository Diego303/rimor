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
import { ErrorImportar } from './paquete';

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
  /** Todas las rutas de aquí, para no escribir donde hay una carpeta o dentro de un archivo. */
  rutas?: ReadonlySet<string>;
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

  const cambios = new Map<string, string>();
  const refsAqui = new Set(local.elementos.flatMap((e) => [e.ref, ...e.alias]));
  for (const e of local.entidades) refsAqui.add(e.ref);
  const entidadesAqui = new Map(local.entidades.map((e) => [e.id, e]));
  const entidades = new Map<string, ReturnType<typeof leerEntidad>>();
  for (const [ruta, datos] of archivos) if (esEntidad(ruta)) entidades.set(ruta, leerEntidad(texto(datos)));
  const deEntidades = [...entidades.values()].flatMap((e) => (e.ok ? [e.valor.frontmatter] : []));

  // Lo que ya está aquí (el mismo id) con otra ref (se reasignó al importarlo antes, o cambió de tipo allí): en lo
  // importado, su ref es la de aquí.
  for (const el of leidos.values()) {
    const aqui = porId.get(el.frontmatter.id);
    if (aqui && aqui.ref !== el.frontmatter.ref) cambios.set(el.frontmatter.ref, aqui.ref);
  }
  for (const fm of deEntidades) {
    const aqui = entidadesAqui.get(fm.id);
    if (aqui && aqui.ref !== fm.ref) cambios.set(fm.ref, aqui.ref);
  }
  // Lo nuevo cuya ref ya se usa aquí recibe otra libre (las entidades, sin alias: su esquema no lo tiene).
  const reasignar = (tipo: Parameters<typeof asignarRef>[0], ref: string) => {
    const nueva = asignarRef(tipo, ocupadas);
    ocupadas.add(nueva);
    cambios.set(ref, nueva);
    plan.reasignadas.push({ de: ref, a: nueva });
  };
  for (const el of leidos.values()) {
    const fm = el.frontmatter;
    if (!porId.has(fm.id) && refsAqui.has(fm.ref)) reasignar(fm.tipo, fm.ref);
  }
  for (const fm of deEntidades) if (!entidadesAqui.has(fm.id) && refsAqui.has(fm.ref)) reasignar(fm.tipo, fm.ref);

  const mapa = (r: string) => cambios.get(r) ?? r;
  const porRutaAqui = new Map(local.elementos.map((e) => [e.ruta, e.id]));

  /**
   * El elemento del paquete con las refs de aquí: la suya, la de su hilo y sus investigaciones, y las menciones de
   * sus notas (el original no se toca: es lo capturado). Un nuevo reasignado guarda la vieja en `alias`; uno que ya
   * está aquí suma sus alias de aquí.
   */
  const normalizar = (el: Elemento): Elemento => {
    const fm = el.frontmatter;
    const aqui = porId.get(fm.id);
    const ref = mapa(fm.ref);
    const alias = [
      ...new Set([...(fm.alias ?? []), ...(aqui?.alias ?? []), ...(!aqui && ref !== fm.ref ? [fm.ref] : [])]),
    ].filter((a) => a !== ref);
    const { alias: _a, hilo: _h, investigaciones: _i, ...resto } = fm;
    return {
      ...el,
      notas: reescribirRefs(el.notas, cambios),
      frontmatter: {
        ...resto,
        ref: ref as typeof fm.ref,
        ...(alias.length ? { alias: alias as typeof fm.alias } : {}),
        ...(fm.hilo ? { hilo: mapa(fm.hilo) as typeof fm.hilo } : {}),
        ...(fm.investigaciones ? { investigaciones: fm.investigaciones.map(mapa) as typeof fm.investigaciones } : {}),
      },
    };
  };
  const igualQue = (a: Elemento, b: Elemento) =>
    a.notas === b.notas && JSON.stringify(a.frontmatter) === JSON.stringify(b.frontmatter);

  for (const [ruta, el] of leidos) {
    const fm = el.frontmatter;
    const original = archivos.get(ruta) as Uint8Array;
    const normal = normalizar(el);
    const datos = igualQue(normal, el) ? original : bytes(escribirElemento(normal, texto(original)));
    // Siempre en la ruta de su ref y su título (la del paquete podría ser la de otro elemento de aquí).
    const destino = rutaDe(normal, enPapelera(ruta));
    const ocupa = porRutaAqui.get(destino);
    if (ocupa && ocupa !== fm.id) throw new ErrorImportar('importar.rutaOcupada', ruta);
    const aqui = porId.get(fm.id);
    const refNueva = !aqui && normal.frontmatter.ref !== fm.ref ? normal.frontmatter.ref : undefined;
    const base = { id: fm.id, ref: normal.frontmatter.ref, titulo: fm.titulo };
    if (!aqui) {
      plan.escrituras.set(destino, datos);
      plan.elementos.push({ ...base, categoria: 'nuevo', ...(refNueva ? { refNueva } : {}) });
      plan.recuentos.nuevo++;
      continue;
    }
    const suyo = await local.leer(aqui.ruta);
    const mismos = suyo !== null && iguales(suyo, datos);
    if (mismos && aqui.ruta === destino) {
      plan.elementos.push({ ...base, categoria: 'identico' });
      plan.recuentos.identico++;
      continue;
    }
    const ganador = instante(fm.modificado) >= instante(aqui.modificado) ? 'paquete' : 'aqui';
    // Actualizado: gana el del paquete y aquí no cambió desde que se exportó. Si no, cambiaron los dos.
    const categoria: Categoria =
      ganador === 'paquete' && instante(aqui.modificado) <= exportado ? 'actualizado' : 'conflicto';
    if (ganador === 'paquete') {
      plan.escrituras.set(destino, datos);
      if (aqui.ruta !== destino) plan.borrados.push(aqui.ruta);
      if (suyo && !mismos) plan.escrituras.set(rutaHistorial(aqui.ref, aqui.modificado), suyo);
    } else if (!mismos) plan.escrituras.set(rutaHistorial(aqui.ref, fm.modificado), datos);
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
  comprobarCarpetasAqui(plan, local.rutas);
  return plan;
}

/** Nada de lo que se escribe está donde aquí hay una carpeta, ni dentro de un archivo de aquí (`a` y `a/b`). */
function comprobarCarpetasAqui(plan: Plan, rutas: ReadonlySet<string> | undefined): void {
  if (!rutas) return;
  const borrados = new Set(plan.borrados);
  const carpetas = new Set<string>();
  for (const r of rutas) {
    if (borrados.has(r)) continue;
    const partes = r.split('/');
    for (let i = 1; i < partes.length; i++) carpetas.add(partes.slice(0, i).join('/'));
  }
  for (const destino of plan.escrituras.keys()) {
    if (carpetas.has(destino)) throw new ErrorImportar('importar.rutaChoca', destino);
    const partes = destino.split('/');
    for (let i = 1; i < partes.length; i++) {
      const carpeta = partes.slice(0, i).join('/');
      if (rutas.has(carpeta) && !borrados.has(carpeta)) throw new ErrorImportar('importar.rutaChoca', destino);
    }
  }
}
