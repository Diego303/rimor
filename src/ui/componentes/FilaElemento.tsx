/**
 * Fila de un elemento en una lista (como `itemRow` de la referencia): icono de tipo, título en negrita, una línea
 * de resumen y el día («hoy», «ayer», «2 oct») y la hora a la derecha; en Buscar, solo el día. Un botón que abre el
 * elemento.
 */
import type { FrontmatterComun } from '@rimor/formato';
import type { ReactNode } from 'react';
import { fmtDiaRelativo, fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { IconoTipo } from './Marcas';

interface Props {
  fm: Pick<FrontmatterComun, 'ref' | 'tipo' | 'titulo' | 'creado'>;
  /** El título como se pinta (con lo que casa resaltado, en Buscar); si no, el del elemento. */
  titulo?: ReactNode;
  /** La línea de debajo del título (el resumen legible del lector). */
  resumen?: ReactNode;
  alAbrir: (ref: string) => void;
  /** Solo el día, sin la hora (los resultados de Buscar). */
  sinHora?: boolean;
}

export function FilaElemento({ fm, titulo, resumen, alAbrir, sinHora = false }: Props) {
  const { idioma } = useT();
  const fecha = new Date(fm.creado);
  const dia = Number.isNaN(fecha.getTime()) ? '' : fmtDiaRelativo(fecha, new Date(), idioma);
  const cuando = !dia || sinHora ? dia : `${dia} ${fmtHora(fecha)}`;
  return (
    <button type="button" className="it" onClick={() => alAbrir(fm.ref)}>
      <span className="ic">
        <IconoTipo tipo={fm.tipo} />
      </span>
      <span className="tt">{titulo ?? fm.titulo}</span>
      <span className="mm">{resumen || fm.ref}</span>
      <span className="rt">{cuando}</span>
    </button>
  );
}
