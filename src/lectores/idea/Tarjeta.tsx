/** Tarjeta del lector Idea: el texto y su estado. */
import { useT } from '../../i18n/useT';
import { Estado } from '../../ui/componentes';
import type { PropsTarjeta } from '../contrato';
import { ESTADOS_IDEA, type EstadoIdea } from './lector';
import { textos } from './textos';

export default function TarjetaIdea({ el }: PropsTarjeta) {
  const { idioma } = useT();
  const estado = el.frontmatter.estado as EstadoIdea | undefined;
  return (
    <>
      <p className="sm muted">{el.original}</p>
      {estado && ESTADOS_IDEA.includes(estado) && (
        <Estado tono={estado === 'semilla' ? 'warn' : 'neutro'}>{textos.t(idioma, `estados.${estado}`)}</Estado>
      )}
    </>
  );
}
