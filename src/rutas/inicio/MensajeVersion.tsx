/**
 * Mensaje de una captura que se guardó como versión nueva de un elemento que ya estaba (IN-029, CMP-02): su
 * título, la respuesta «Lo he guardado como su versión 2.», «Ver cambios» (abre el elemento) y «Guardar aparte»
 * (la devuelve a la versión anterior y guarda lo pegado como elemento propio).
 */
import { useState } from 'react';
import { useCaptura } from '../../captura/Captura';
import { useCompositor, type VersionEnFeed } from '../../captura/compositor';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, IconoTipo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { SimboloRimor } from '../../ui/marca/SimboloRimor';

interface Props {
  version: VersionEnFeed;
  soloLectura: boolean;
  alAbrir: (ref: string) => void;
}

export function MensajeVersion({ version: v, soloLectura, alAbrir }: Props) {
  const { t } = useT();
  const { capturador, informar } = useCaptura();
  const avisos = useAvisosOpcional();
  const [ocupado, setOcupado] = useState(false);
  const el = v.capturado.elemento;
  const fm = el.frontmatter;
  const fecha = new Date(v.en);

  async function aparte() {
    if (!capturador) return;
    setOcupado(true);
    const deshecho = await capturador.deshacerVersion(v).catch(() => false);
    if (!deshecho) {
      setOcupado(false);
      return void avisos?.avisar(t('captura.noDeshecho'));
    }
    useCompositor.getState().quitarVersion(v.copia);
    // Lo mismo que se capturó (su tipo, colecciones, etiquetas, origen y archivo), esta vez como elemento propio.
    const r = await capturador.capturar({ ...v.entrada, aparte: true }).catch(() => null);
    informar([{ nombre: fm.titulo, r }]);
  }

  return (
    <article className="msg fresh">
      <div className="mhead">
        <IconoTipo tipo={fm.tipo} />
        <button type="button" className="tt" onClick={() => alAbrir(fm.ref)}>
          {fm.titulo}
        </button>
        <time className="time" dateTime={v.en}>
          {Number.isNaN(fecha.getTime()) ? '' : fmtHora(fecha)}
        </time>
      </div>
      <div className="rimor">
        <span className="av">
          <SimboloRimor variante="mono" tamano={13} />
        </span>
        <p>{t('pantallas.inicio.version', { n: v.version })}</p>
      </div>
      <div className="mact">
        <Boton pequeno onClick={() => alAbrir(fm.ref)}>
          {t('pantallas.inicio.verCambios')}
        </Boton>
        {!soloLectura && (
          <Boton pequeno disabled={ocupado} onClick={() => void aparte()}>
            {t('pantallas.inicio.guardarAparte')}
          </Boton>
        )}
      </div>
    </article>
  );
}
