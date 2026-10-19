/**
 * El hilo del mismo error (ORG-06, ORG-15): cuando un error tiene la huella de otro, entra en el hilo de esa
 * ocurrencia (el de la más reciente que lo tenga) o, si ninguna lo tiene, se crea uno con todas. Las formaciones van
 * de una en una: dos errores iguales capturados a la vez no crean dos hilos.
 */
import { Turnos } from '../almacen/turnos';
import { huellaDe } from '../respuestas/contexto';
import { anadirAHilo, crearHilo, type DependenciasHilos, hiloDe, reabrir } from './hilos';

const turnos = new Turnos();

/** Mete el error `id` (de huella `huella`) en el hilo de su error; devuelve el hilo, o `null` si es el primero. */
export function formarPorHuella(id: string, huella: string, d: DependenciasHilos): Promise<string | null> {
  return turnos.en('formar', async () => {
    const fm = d.repositorio.frontmatter(id);
    if (fm?.tipo !== 'error') return null;
    // Ya en un hilo (respondido, movido a mano): se queda donde está; si estaba resuelto, ha vuelto a pasar.
    const suyo = hiloDe(fm.hilo, d.entidades);
    if (suyo) {
      if (suyo.estado === 'resuelto') await reabrir(suyo.ref, d);
      return suyo.ref;
    }
    const otros = d.repositorio
      .elementos()
      .filter((o) => o.id !== id && o.tipo === 'error' && huellaDe(o) === huella)
      .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
    if (!otros.length) return null;
    const conHilo = otros.find((o) => hiloDe(o.hilo, d.entidades));
    if (conHilo?.hilo) {
      await anadirAHilo(conHilo.hilo, id, d);
      return conHilo.hilo;
    }
    // El título del primero (el de la ocurrencia más antigua).
    const enOrden = [...otros].reverse();
    return crearHilo(enOrden[0]?.titulo ?? fm.titulo, [...enOrden.map((o) => o.id), id], d);
  });
}

/**
 * Lo mismo para un elemento que acaba de pasar a ser un error (corregido el tipo): con la huella que dejó su
 * lector en el frontmatter.
 */
export function formarSiEsError(ref: string, d: DependenciasHilos): Promise<string | null> {
  const fm = d.repositorio.frontmatter(ref);
  const huella = fm ? huellaDe(fm) : undefined;
  return fm?.tipo === 'error' && huella ? formarPorHuella(fm.id, huella, d) : Promise.resolve(null);
}
