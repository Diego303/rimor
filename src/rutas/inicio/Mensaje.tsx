/**
 * Un mensaje del feed (como `msgHTML` de la referencia): icono de tipo, título (abre el elemento), hora, una línea
 * de vista previa, la respuesta de Rimor, las acciones del lector y, tras un hueco, «Responder» y «Archivar». Borde
 * naranja mientras está fresco; anillo de foco si es el seleccionado con el teclado.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import { memo } from 'react';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import type { Accion as AccionRespuesta } from '../../respuestas/tipos';
import { useRespuesta } from '../../respuestas/useRespuesta';
import { clases } from '../../ui/clases';
import { Boton, IconoTipo } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';
import { useElemento } from './useElemento';

/** Largo de la vista previa (la línea se corta con puntos suspensivos por CSS). */
const LARGO_PREVIA = 160;

/** La primera línea con contenido del original, para la vista previa en mono. */
export function vistaPrevia(el: Pick<Elemento, 'original'> | null, titulo: string): string | null {
  if (!el?.original) return null;
  const linea = el.original
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && l !== titulo.trim());
  return linea ? linea.slice(0, LARGO_PREVIA) : null;
}

/** Las acciones de una respuesta que el feed sabe hacer (las de hilos llegan con IN-030). */
export const accionSoportada = (id: string) => id === 'no' || id.startsWith('coleccion:');

export interface PropsMensaje {
  fm: FrontmatterComun;
  seleccionado: boolean;
  marcado: boolean;
  fresco: boolean;
  /** La respuesta ya resuelta con «No»: no se vuelven a ofrecer sus acciones. */
  sinAcciones: boolean;
  alAbrir: (ref: string) => void;
  alResponder: (ref: string) => void;
  alArchivar: (fm: FrontmatterComun) => void;
  alAccion: (fm: FrontmatterComun, accion: AccionRespuesta) => void;
}

function Respuesta({
  el,
  alAbrir,
  alAccion,
  sinAcciones,
}: { el: Elemento } & Pick<PropsMensaje, 'alAbrir' | 'alAccion' | 'sinAcciones'>) {
  const respuesta = useRespuesta(el);
  if (respuesta === 'desactivada') return null;
  const lista: (AccionRespuesta | undefined)[] = [...(respuesta?.acciones ?? [])];
  const ofrecidas = lista.filter((a): a is AccionRespuesta => !!a);
  const acciones = sinAcciones ? [] : ofrecidas.filter((a) => accionSoportada(a.id));
  return (
    <>
      <RespuestaRimor respuesta={respuesta} alAbrir={alAbrir} />
      {acciones.length > 0 && (
        <div className="mact acciones-lector">
          {acciones.map((a) => (
            <Boton
              key={a.id}
              pequeno
              {...(a.principal ? { variante: 'primario' as const } : {})}
              onClick={() => alAccion(el.frontmatter, a)}
            >
              {a.etiqueta}
            </Boton>
          ))}
        </div>
      )}
    </>
  );
}

export const Mensaje = memo(function Mensaje(p: PropsMensaje) {
  const { t } = useT();
  const el = useElemento(p.fm);
  const previa = vistaPrevia(el, p.fm.titulo);
  const fecha = new Date(p.fm.creado);
  return (
    <article
      className={clases('msg', p.fresco && 'fresh', p.seleccionado && 'sel', p.marcado && 'marcado')}
      aria-current={p.seleccionado ? true : undefined}
      data-ref={p.fm.ref}
    >
      <div className="mhead">
        <IconoTipo tipo={p.fm.tipo} />
        <button type="button" className="tt" onClick={() => p.alAbrir(p.fm.ref)}>
          {p.fm.titulo}
        </button>
        {p.fm.fijado && (
          <span className="fijado" title={t('pantallas.inicio.fijado', { ref: p.fm.ref })}>
            <Icono nombre="fijar" tamano={13} />
          </span>
        )}
        <time className="time" dateTime={p.fm.creado}>
          {Number.isNaN(fecha.getTime()) ? '' : fmtHora(fecha)}
        </time>
      </div>
      {previa && <div className="mprev">{previa}</div>}
      {el ? (
        <Respuesta el={el} alAbrir={p.alAbrir} alAccion={p.alAccion} sinAcciones={p.sinAcciones} />
      ) : (
        <RespuestaRimor respuesta={null} />
      )}
      <div className="mact">
        <span className="sp" />
        <button type="button" className="ibtn" onClick={() => p.alResponder(p.fm.ref)}>
          <Icono nombre="responder" tamano={14} />
          {t('pantallas.inicio.responder')}
        </button>
        <button type="button" className="ibtn" onClick={() => p.alArchivar(p.fm)}>
          <Icono nombre="archivar" tamano={14} />
          {t('pantallas.inicio.archivar')}
        </button>
      </div>
    </article>
  );
});
