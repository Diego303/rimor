/**
 * Grupos automáticos (ORG-09, IN-052): los elementos se agrupan solos por su colección, su sesión, la huella de su
 * error, el dominio, el repositorio o el paquete de su enlace, sus etiquetas, su tipo y su mes. Y el panel común de un
 * grupo (VIS-04, la pantalla «Colección» de la referencia): qué hay, cuándo se trabajó y qué se repite. TS puro: todo
 * sale del frontmatter (la huella y la URL van en el resumen del lector).
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import { nombreComparable, paqueteDeDestino } from '../almacen/menciones';
import { clasificar, hostLegible } from '../lectores/enlace/urls';

export const CLASES_GRUPO = [
  'coleccion',
  'sesion',
  'huella',
  'dominio',
  'repositorio',
  'paquete',
  'etiqueta',
  'tipo',
  'mes',
] as const;
export type ClaseGrupo = (typeof CLASES_GRUPO)[number];

export const esClaseGrupo = (x: unknown): x is ClaseGrupo => (CLASES_GRUPO as readonly unknown[]).includes(x);

export interface ClaveGrupo {
  clase: ClaseGrupo;
  valor: string;
}

/** Días de las barras de «Cuándo». */
export const DIAS_CUANDO = 14;

const texto = (x: unknown): string | undefined => (typeof x === 'string' && x ? x : undefined);

/** El mes local (`AAAA-MM`) de una fecha ISO. */
export function mesDe(iso: string): string | undefined {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return undefined;
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
}

/** El día local (`AAAA-MM-DD`). */
const diaDe = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

/**
 * El dominio de una URL (o de un host suelto, con su puerto o sus credenciales): sin puerto ni credenciales, en
 * minúsculas, sin `www.` ni `m.` y legible (`xn--` en Unicode, como lo enseña el lector Enlace). `undefined` si no es
 * una URL.
 */
export function dominioDe(urlOHost: string): string | undefined {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(urlOHost) ? urlOHost : `http://${urlOHost}`);
    return hostLegible(url.hostname.toLowerCase().replace(/^(?:www|m)\./, '')) || undefined;
  } catch {
    return undefined;
  }
}

/** Lo que dice un enlace de su destino: dominio y, si es de un repositorio o un paquete, cuál. */
function delEnlace(url: string): ClaveGrupo[] {
  const claves: ClaveGrupo[] = [];
  const dominio = dominioDe(url);
  if (dominio) claves.push({ clase: 'dominio', valor: dominio });
  const d = clasificar(url);
  if ((d.clase === 'repositorio' || d.clase === 'issue' || d.clase === 'pr') && d.nombre)
    claves.push({ clase: 'repositorio', valor: `${d.sitio}/${nombreComparable(d.sitio, d.nombre)}` });
  const paquete = paqueteDeDestino(d);
  if (paquete) claves.push({ clase: 'paquete', valor: paquete });
  return claves;
}

/** Los grupos de un elemento, en el orden de `CLASES_GRUPO` (sin repetir). */
export function clavesDe(fm: FrontmatterComun): ClaveGrupo[] {
  const r = fm.lector.resumen;
  const claves: ClaveGrupo[] = [
    ...(fm.colecciones ?? []).map((valor) => ({ clase: 'coleccion' as const, valor })),
    ...(fm.sesion ? [{ clase: 'sesion' as const, valor: fm.sesion }] : []),
  ];
  const huella = fm.tipo === 'error' ? texto(r.huella) : undefined;
  if (huella) claves.push({ clase: 'huella', valor: huella });
  const url = fm.tipo === 'enlace' ? texto(r.url) : undefined;
  if (url) claves.push(...delEnlace(url));
  const host = fm.tipo === 'http' ? texto(r.host) : undefined;
  const dominio = host ? dominioDe(host) : undefined;
  if (dominio) claves.push({ clase: 'dominio', valor: dominio });
  claves.push(...(fm.etiquetas ?? []).map((valor) => ({ clase: 'etiqueta' as const, valor })));
  claves.push({ clase: 'tipo', valor: fm.tipo });
  const mes = mesDe(fm.creado);
  if (mes) claves.push({ clase: 'mes', valor: mes });
  const vistas = new Set<string>();
  return claves.filter((c) => {
    // Las etiquetas, sin distinguir mayúsculas (`Ureq` y `ureq` son el mismo grupo).
    const k = `${c.clase}\u0000${c.clase === 'etiqueta' ? c.valor.toLocaleLowerCase() : c.valor}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

/** ¿Es del grupo? (Una etiqueta, sin distinguir mayúsculas, como en el resto de la app.) */
export function enGrupo(fm: FrontmatterComun, clase: ClaseGrupo, valor: string): boolean {
  if (clase === 'etiqueta')
    return (fm.etiquetas ?? []).some((e) => e.toLocaleLowerCase() === valor.toLocaleLowerCase());
  if (clase === 'coleccion') return (fm.colecciones ?? []).includes(valor);
  if (clase === 'tipo') return fm.tipo === valor;
  if (clase === 'sesion') return fm.sesion === valor;
  if (clase === 'mes') return mesDe(fm.creado) === valor;
  if (clase === 'huella') return fm.tipo === 'error' && fm.lector.resumen.huella === valor;
  // Dominio, repositorio y paquete: solo los enlaces y las peticiones tienen (no se analiza la URL de los demás).
  if (fm.tipo !== 'enlace' && fm.tipo !== 'http') return false;
  return clavesDe(fm).some((c) => c.clase === clase && c.valor === valor);
}

/** Instante de un elemento (las fechas pueden llevar desfases distintos: no se comparan como texto). */
const ms = (fm: FrontmatterComun) => {
  const t = Date.parse(fm.creado);
  return Number.isNaN(t) ? 0 : t;
};
const masReciente = (a: FrontmatterComun, b: FrontmatterComun) => ms(b) - ms(a);

/** Los elementos de un grupo, de lo más reciente a lo más antiguo. */
export const elementosDe = (
  clase: ClaseGrupo,
  valor: string,
  elementos: readonly FrontmatterComun[],
): FrontmatterComun[] => elementos.filter((fm) => enGrupo(fm, clase, valor)).sort(masReciente);

export interface Repetido {
  huella: string;
  veces: number;
  /** El más reciente con esa huella (su título y su fecha). */
  ultimo: FrontmatterComun;
  /** Los que la tienen, de lo más reciente a lo más antiguo. */
  elementos: FrontmatterComun[];
}

export interface Panel {
  total: number;
  /** El más antiguo (para «desde el 2 oct»). */
  desde: string | null;
  /** Por tipo, de más a menos (a igualdad, en el orden de los tipos). */
  tipos: { tipo: TipoElemento; n: number }[];
  /** Los últimos {@link DIAS_CUANDO} días hasta hoy, del más antiguo al de hoy. */
  dias: { dia: string; n: number }[];
  /** El día con más elementos de esos (el último, si empatan); `null` si no hay ninguno. */
  pico: string | null;
  /** La huella de error que más se repite (al menos dos veces). */
  repetido: Repetido | null;
}

/** El panel de un grupo: qué hay, cuándo y qué se repite. */
export function panelDe(elementos: readonly FrontmatterComun[], ahora: Date): Panel {
  const tipos = new Map<TipoElemento, number>();
  const porDia = new Map<string, number>();
  const porHuella = new Map<string, FrontmatterComun[]>();
  let desde: FrontmatterComun | null = null;
  for (const fm of elementos) {
    tipos.set(fm.tipo, (tipos.get(fm.tipo) ?? 0) + 1);
    if (!desde || ms(fm) < ms(desde)) desde = fm;
    const f = new Date(fm.creado);
    if (!Number.isNaN(f.getTime())) porDia.set(diaDe(f), (porDia.get(diaDe(f)) ?? 0) + 1);
    const huella = fm.tipo === 'error' ? texto(fm.lector.resumen.huella) : undefined;
    if (huella) {
      const lista = porHuella.get(huella);
      if (lista) lista.push(fm);
      else porHuella.set(huella, [fm]);
    }
  }
  const dias: { dia: string; n: number }[] = [];
  for (let k = DIAS_CUANDO - 1; k >= 0; k--) {
    const f = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - k, 12);
    dias.push({ dia: diaDe(f), n: porDia.get(diaDe(f)) ?? 0 });
  }
  let pico: { dia: string; n: number } | null = null;
  for (const d of dias) if (d.n > 0 && (!pico || d.n >= pico.n)) pico = d;
  let repetido: Repetido | null = null;
  for (const [huella, lista] of porHuella) {
    if (lista.length < 2) continue;
    const ordenados = [...lista].sort(masReciente);
    const ultimo = ordenados[0];
    if (!ultimo) continue;
    if (
      !repetido ||
      lista.length > repetido.veces ||
      (lista.length === repetido.veces && ms(ultimo) > ms(repetido.ultimo))
    )
      repetido = { huella, veces: lista.length, ultimo, elementos: ordenados };
  }
  return {
    total: elementos.length,
    desde: desde?.creado ?? null,
    tipos: [...tipos].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    dias,
    pico: pico?.dia ?? null,
    repetido,
  };
}

/**
 * Lo que exporta un grupo (IN-052): el `.md` de cada elemento, su adjunto, su historial (la carpeta de su ref y la de
 * cada alias: sus versiones de antes de cambiar de tipo), las entidades que citan (sus hilos: sin ellas, al importar
 * su `hilo` apuntaría a otro con la misma ref) y los registros del espacio (`colecciones.json`, `sesiones.json`), que
 * al importar se juntan. Con `rutaDe`, la del repositorio; con `rutaEntidad`, la de un hilo por su ref.
 */
export function rutasDeGrupo(
  elementos: readonly FrontmatterComun[],
  rutaDe: (id: string) => string | undefined,
  rutaEntidad: (ref: string) => string | undefined = () => undefined,
): { rutas: string[]; prefijos: string[] } {
  const rutas = new Set<string>(['colecciones.json', 'sesiones.json']);
  const prefijos = new Set<string>();
  for (const fm of elementos) {
    const ruta = rutaDe(fm.id);
    if (!ruta) continue;
    rutas.add(ruta);
    if (fm.adjunto?.ruta) rutas.add(fm.adjunto.ruta);
    for (const ref of [fm.ref, ...(fm.alias ?? [])]) prefijos.add(`historial/${ref}/`);
    const hilo = fm.hilo ? rutaEntidad(fm.hilo) : undefined;
    if (hilo) rutas.add(hilo);
  }
  return { rutas: [...rutas], prefijos: [...prefijos] };
}
