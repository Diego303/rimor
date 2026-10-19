/**
 * Escribir un cambio en un elemento desde una pantalla: en turno con las demás escrituras del elemento
 * (`actualizarElemento`), con su fecha de modificación y sin lanzar (devuelve si se guardó).
 */
import { type Elemento, type FrontmatterComun, isoConZona } from '@rimor/formato';
import { useCallback, useMemo } from 'react';
import { useEspacioOpcional } from './Espacio';

export interface Edicion {
  /** Cambia el elemento (frontmatter, notas); `cambio` devuelve `null` para no escribir. */
  editar(refOId: string, cambio: (el: Elemento) => Elemento | null): Promise<boolean>;
  /** Cambia solo el frontmatter. */
  editarFrontmatter(refOId: string, cambio: (fm: FrontmatterComun) => FrontmatterComun): Promise<boolean>;
  /**
   * Una edición del usuario (título, notas): deja antes una copia del elemento en su historial (IN-029). Si
   * `cambio` devuelve el mismo elemento, no hay nada que cambiar (y cuenta como hecho).
   */
  editarConHistorial(refOId: string, cambio: (el: Elemento) => Elemento): Promise<boolean>;
}

export function useEdicion(): Edicion {
  const espacio = useEspacioOpcional();
  const editar = useCallback<Edicion['editar']>(
    async (refOId, cambio) => {
      if (!espacio) return false;
      const r = await espacio.repositorio
        .actualizarElemento(refOId, (el) => {
          const nuevo = cambio(el);
          return nuevo && { ...nuevo, frontmatter: { ...nuevo.frontmatter, modificado: isoConZona(new Date()) } };
        })
        .catch(() => null);
      return r?.ok ? r.valor : false;
    },
    [espacio],
  );
  const editarFrontmatter = useCallback<Edicion['editarFrontmatter']>(
    (refOId, cambio) => editar(refOId, (el) => ({ ...el, frontmatter: cambio(el.frontmatter) })),
    [editar],
  );
  const editarConHistorial = useCallback<Edicion['editarConHistorial']>(
    async (refOId, cambio) => {
      if (!espacio) return false;
      const r = await espacio.repositorio
        .guardarConHistorial(
          refOId,
          (el) => {
            const nuevo = cambio(el);
            // El mismo objeto es que no hay nada que cambiar.
            return nuevo === el
              ? null
              : { ...nuevo, frontmatter: { ...nuevo.frontmatter, modificado: isoConZona(new Date()) } };
          },
          'edicion',
        )
        .catch(() => null);
      return Boolean(r?.ok);
    },
    [espacio],
  );
  return useMemo(
    () => ({ editar, editarFrontmatter, editarConHistorial }),
    [editar, editarFrontmatter, editarConHistorial],
  );
}
