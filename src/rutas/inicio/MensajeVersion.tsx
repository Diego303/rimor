/**
 * Mensaje de una captura que se guardó como versión nueva de un elemento que ya estaba (IN-029, CMP-02): su
 * título, la respuesta «Lo he guardado como su versión 2.» (o la de su lector, si sabe decir qué cambió: «TOML con 34
 * claves. Frente a la versión del 9 oct cambian 2: …»), «Ver cambios» (abre el elemento) y «Guardar aparte» (la
 * devuelve a la versión anterior y guarda lo pegado como elemento propio).
 */
import { useEffect, useState } from 'react';
import { useCaptura } from '../../captura/Captura';
import { useCompositor, type VersionEnFeed } from '../../captura/compositor';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import type { Respuesta } from '../../respuestas/tipos';
import { Boton, IconoTipo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { SimboloRimor } from '../../ui/marca/SimboloRimor';

interface Props {
  version: VersionEnFeed;
  soloLectura: boolean;
  alAbrir: (ref: string) => void;
}

export function MensajeVersion({ version: v, soloLectura, alAbrir }: Props) {
  const { t, idioma } = useT();
  const { capturador, informar } = useCaptura();
  const avisos = useAvisosOpcional();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const [ocupado, setOcupado] = useState(false);
  const [propia, setPropia] = useState<Respuesta | null>(null);
  const el = v.capturado.elemento;
  const fm = el.frontmatter;
  const fecha = new Date(v.en);

  // Si su lector sabe decir qué cambió («Frente a la versión del 9 oct cambian 2: …»), con la copia del historial.
  useEffect(() => {
    const lector = lectores?.registro.paraElemento(el);
    if (!lector?.respuestaVersion || !espacio) return undefined;
    let vigente = true;
    espacio.repositorio
      .versiones(el.frontmatter.id)
      .then(async (versiones) => {
        const anterior = versiones.find((x) => x.ruta === v.copia)?.elemento;
        const r = anterior ? await lector.respuestaVersion?.(el, anterior, idioma) : null;
        if (vigente && r) setPropia(r);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [lectores, espacio, el, v.copia, idioma]);

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
      {propia ? (
        <RespuestaRimor respuesta={propia} anunciar={false} />
      ) : (
        <div className="rimor">
          <span className="av">
            <SimboloRimor variante="mono" tamano={13} />
          </span>
          <p>{t('pantallas.inicio.version', { n: v.version })}</p>
        </div>
      )}
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
