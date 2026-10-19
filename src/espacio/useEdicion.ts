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
  return useMemo(() => ({ editar, editarFrontmatter }), [editar, editarFrontmatter]);
}
