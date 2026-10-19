/**
 * Hilos (ORG-15, D13): una cadena ligera de elementos. La entidad `hilos/HIL-NNNN--titulo.md` guarda lo suyo
 * (título, estado, nota de solución, fechas); qué elementos tiene lo dice cada elemento con su `hilo` (uno solo por
 * elemento), así no hay dos listas que mantener de acuerdo. Todo en turno: la ref del hilo se asigna al crearlo y
 * cada elemento se cambia en el suyo.
 */
import { type FrontmatterComun, type Hilo, isoConZona, ulid } from '@rimor/formato';
import type { RepositorioEntidades } from '../almacen/entidades';
import type { Repositorio } from '../almacen/repositorio';

export interface DependenciasHilos {
  repositorio: Repositorio;
  entidades: RepositorioEntidades;
  reloj?: () => Date;
}

const ahora = (d: DependenciasHilos) => isoConZona((d.reloj ?? (() => new Date()))());

/** El hilo de esa ref, si existe y es un hilo. */
export function hiloDe(ref: string | undefined, entidades: Pick<RepositorioEntidades, 'frontmatter'>): Hilo | null {
  const fm = ref ? entidades.frontmatter(ref) : undefined;
  return fm?.tipo === 'hilo' ? fm : null;
}

/** Los elementos de un hilo (fuera de la papelera), en el orden en que se capturaron. */
export const elementosDe = (hilo: string, repositorio: Pick<Repositorio, 'elementos'>): FrontmatterComun[] =>
  repositorio
    .elementos()
    .filter((fm) => fm.hilo === hilo)
    .sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));

/** Pone (o quita, con `undefined`) el hilo de un elemento, en su turno. */
async function ponerHilo(ref: string, hilo: string | undefined, d: DependenciasHilos): Promise<boolean> {
  const r = await d.repositorio.actualizarElemento(ref, (el) => {
    if (el.frontmatter.hilo === hilo) return null;
    const { hilo: _, ...resto } = el.frontmatter;
    return {
      ...el,
      frontmatter: { ...(hilo ? { ...resto, hilo: hilo as FrontmatterComun['ref'] } : resto), modificado: ahora(d) },
    } as typeof el;
  });
  return r.ok;
}

/** Cambia la entidad del hilo en su turno. */
async function cambiarHilo(hilo: string, cambio: (h: Hilo) => Hilo | null, d: DependenciasHilos): Promise<boolean> {
  const r = await d.entidades.actualizar(hilo, (e) => {
    if (e.frontmatter.tipo !== 'hilo') return null;
    const nuevo = cambio(e.frontmatter);
    return nuevo && { ...e, frontmatter: { ...nuevo, modificado: ahora(d) } };
  });
  return r.ok && r.valor;
}

/** Crea un hilo abierto con esos elementos (que salen del que tuvieran: uno solo por elemento). Devuelve su ref. */
export async function crearHilo(titulo: string, refs: readonly string[], d: DependenciasHilos): Promise<string> {
  const creado = ahora(d);
  const ref = await d.entidades.crear('hilo', (r) => ({
    frontmatter: {
      id: ulid(),
      ref: r as Hilo['ref'],
      tipo: 'hilo',
      titulo: titulo.trim() || r,
      creado,
      modificado: creado,
      estado: 'abierto',
    },
    cuerpo: '',
  }));
  for (const r of refs) await ponerHilo(r, ref, d);
  return ref;
}

/** Añade un elemento a un hilo; si estaba resuelto, se reabre (ha vuelto a pasar). */
export async function anadirAHilo(hilo: string, ref: string, d: DependenciasHilos): Promise<void> {
  await ponerHilo(ref, hilo, d);
  if (hiloDe(hilo, d.entidades)?.estado === 'resuelto') await reabrir(hilo, d);
}

/** Mueve un elemento a otro hilo, o lo saca del suyo con `null`. */
export async function moverAHilo(ref: string, hilo: string | null, d: DependenciasHilos): Promise<boolean> {
  if (hilo === null) return ponerHilo(ref, undefined, d);
  await anadirAHilo(hilo, ref, d);
  return true;
}

/** El hilo del elemento, o uno nuevo con él (para responder a algo que aún no tenía). */
export async function hiloPara(ref: string, d: DependenciasHilos): Promise<string | null> {
  const fm = d.repositorio.frontmatter(ref);
  if (!fm) return null;
  if (hiloDe(fm.hilo, d.entidades)) return fm.hilo ?? null;
  return crearHilo(fm.titulo, [fm.id], d);
}

/**
 * Marca resuelto un hilo con su nota. La nota pasa también al último elemento del hilo (resuelto, con la nota al
 * principio de sus notas y copia en el historial): así la siguiente vez que pase, la respuesta la cita.
 */
export async function resolver(hilo: string, nota: string, d: DependenciasHilos): Promise<boolean> {
  const texto = nota.trim();
  const hecho = await cambiarHilo(
    hilo,
    (h) => ({ ...h, estado: 'resuelto', resuelto: ahora(d), ...(texto ? { nota: texto } : {}) }),
    d,
  );
  if (!hecho) return false;
  const ultimo = elementosDe(hilo, d.repositorio).at(-1);
  if (ultimo && texto)
    await d.repositorio.guardarConHistorial(
      ultimo.id,
      (el) => ({
        ...el,
        notas: el.notas.trim() ? `${texto}\n\n${el.notas}` : texto,
        frontmatter: { ...el.frontmatter, estado: 'resuelto', modificado: ahora(d) },
      }),
      'edicion',
    );
  return true;
}

/** Vuelve a abrir un hilo resuelto (su nota se queda). */
export function reabrir(hilo: string, d: DependenciasHilos): Promise<boolean> {
  return cambiarHilo(
    hilo,
    (h) => {
      if (h.estado === 'abierto') return null;
      const { resuelto: _, ...resto } = h;
      return { ...resto, estado: 'abierto' };
    },
    d,
  );
}

/** Cambia el título de un hilo. */
export function renombrarHilo(hilo: string, titulo: string, d: DependenciasHilos): Promise<boolean> {
  return cambiarHilo(hilo, (h) => (h.titulo === titulo ? null : { ...h, titulo }), d);
}
