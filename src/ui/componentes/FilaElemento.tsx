/**
 * Fila de un elemento en una lista (como `itemRow` de la referencia): icono de tipo, título en negrita, una línea
 * de resumen y el día y la hora a la derecha. Un botón que abre el elemento.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { fmtDia, fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { IconoTipo } from './Marcas';

interface Props {
  fm: Pick<FrontmatterComun, 'ref' | 'tipo' | 'titulo' | 'creado'>;
  /** La línea de debajo del título (el resumen legible del lector). */
  resumen?: string;
  alAbrir: (ref: string) => void;
}

export function FilaElemento({ fm, resumen, alAbrir }: Props) {
  const { idioma } = useT();
  const fecha = new Date(fm.creado);
  const cuando = Number.isNaN(fecha.getTime()) ? '' : `${fmtDia(fecha, new Date(), idioma)} ${fmtHora(fecha)}`;
  return (
    <button type="button" className="it" onClick={() => alAbrir(fm.ref)}>
      <span className="ic">
        <IconoTipo tipo={fm.tipo} />
      </span>
      <span className="tt">{fm.titulo}</span>
      <span className="mm">{resumen || fm.ref}</span>
      <span className="rt">{cuando}</span>
    </button>
  );
}
