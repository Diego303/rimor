/** Nombre de un estado en el idioma de la interfaz: los comunes, de la app; los propios, de los textos del lector. */
import { ESTADO_NUEVO, esEstadoComun } from '../../espacio/estados';
import type { Idioma } from '../../i18n/formatos';
import { traducir } from '../../i18n/i18n';
import type { Lector } from '../../lectores/contrato';

export function nombreDeEstado(estado: string, lector: Lector | null | undefined, idioma: Idioma): string {
  if (estado === ESTADO_NUEVO || esEstadoComun(estado)) return traducir(idioma, `estados.${estado}`);
  // Un estado propio que el lector nombra en sus textos (`estados.semilla`), en minúsculas como los chips de la
  // referencia; si no lo nombra, tal cual está guardado.
  const propios = (lector?.textos.es as { estados?: Record<string, unknown> } | undefined)?.estados;
  return lector && typeof propios?.[estado] === 'string'
    ? (lector.textos.t as (i: Idioma, c: string) => string)(idioma, `estados.${estado}`).toLocaleLowerCase(idioma)
    : estado;
}
