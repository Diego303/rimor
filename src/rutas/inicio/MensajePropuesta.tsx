/**
 * Mensaje con una regla de detección que Rimor propone (IN-049, CAP-06) tras tres correcciones del tipo de contenidos
 * que empiezan igual: «Los textos que empiezan por `[app]` son de tipo Log. ¿Lo recuerdo para los siguientes?», con
 * «Sí, recuérdalo» (la regla) y «No» (no se vuelve a proponer). Las dos lo quitan del feed.
 */
import { isoConZona } from '@rimor/formato';
import { type PropuestaEnFeed, useCompositor } from '../../captura/compositor';
import { aceptarPropuesta, descartarPropuesta } from '../../captura/reglas';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import { Boton, IconoTipo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';

interface Props {
  propuesta: PropuestaEnFeed;
  soloLectura: boolean;
}

export function MensajePropuesta({ propuesta: p, soloLectura }: Props) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const fecha = new Date(p.en);

  function responder(acepta: boolean) {
    if (!espacio) return;
    useCompositor.getState().quitarPropuesta(p);
    espacio
      .guardarReglas((d) => (acepta ? aceptarPropuesta(d, p, isoConZona(new Date())) : descartarPropuesta(d, p)))
      .then(() => {
        if (acepta) avisos?.avisar(t('pantallas.inicio.reglaGuardada'));
      })
      .catch(() => avisos?.avisar(t('ajustes.noGuardado')));
  }

  return (
    <article className="msg fresh">
      <div className="mhead">
        <IconoTipo tipo={p.tipo} />
        <span className="tt">{t('pantallas.inicio.reglaTitulo')}</span>
        <time className="time" dateTime={p.en}>
          {Number.isNaN(fecha.getTime()) ? '' : fmtHora(fecha)}
        </time>
      </div>
      <RespuestaRimor
        respuesta={{
          texto: [
            { t: 'texto', v: t('pantallas.inicio.reglaAntes') },
            { t: 'mono', v: p.firma },
            { t: 'texto', v: t('pantallas.inicio.reglaDespues', { tipo: t(`tipos.${p.tipo}`) }) },
          ],
        }}
      />
      {!soloLectura && (
        <div className="mact">
          <Boton pequeno onClick={() => responder(true)}>
            {t('pantallas.inicio.reglaSi')}
          </Boton>
          <Boton pequeno onClick={() => responder(false)}>
            {t('pantallas.inicio.reglaNo')}
          </Boton>
        </div>
      )}
    </article>
  );
}
