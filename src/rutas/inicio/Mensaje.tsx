/**
 * Un mensaje del feed (como `msgHTML` de la referencia): icono de tipo, título (abre el elemento), hora, una línea
 * de vista previa, la respuesta de Rimor, las acciones del lector y, tras un hueco, «Responder» y «Archivar». Borde
 * naranja mientras está fresco; anillo de foco si es el seleccionado con el teclado.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import { memo, type ReactNode, useEffect, useRef } from 'react';
import { diasDesde, fmtDia, fmtFechaRelativa, fmtHora, type Idioma } from '../../i18n/formatos';

/** «hoy, 17:49», «ayer, 18:21» o «15 oct, 19:12». */
function horaConDia(fecha: Date, idioma: Idioma): string {
  const ahora = new Date();
  return diasDesde(fecha, ahora) <= 1
    ? fmtFechaRelativa(fecha, ahora, idioma)
    : `${fmtDia(fecha, ahora, idioma)}, ${fmtHora(fecha)}`;
}

import { useT } from '../../i18n/useT';
import { useElemento } from '../../lectores/useElemento';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import type { Accion as AccionRespuesta } from '../../respuestas/tipos';
import { useRespuesta } from '../../respuestas/useRespuesta';
import { clases } from '../../ui/clases';
import { Boton, IconoTipo } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';

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

/** Las acciones de una respuesta que el feed sabe hacer: «No», añadir a una colección y llevar a un hilo. */
/** Las acciones de una respuesta que el feed sabe hacer: «No», añadir a una colección o a un hilo, y abrir el elemento. */
export const accionSoportada = (id: string) =>
  id === 'no' || id === 'abrir' || id.startsWith('coleccion:') || id.startsWith('hilo:');

export interface PropsMensaje {
  fm: FrontmatterComun;
  seleccionado: boolean;
  marcado: boolean;
  fresco: boolean;
  /** La respuesta ya resuelta con «No»: no se vuelven a ofrecer sus acciones. */
  sinAcciones: boolean;
  /** En una pestaña que solo lee no se ofrece nada que escriba. */
  soloLectura: boolean;
  /** Si no hay original que enseñar (un adjunto), la vista previa es el resumen legible del lector. */
  resumen: string;
  /** Posición del mensaje entre los del feed (1…) y cuántos hay, para los lectores de pantalla. */
  posicion: number;
  total: number;
  alAbrir: (ref: string) => void;
  alResponder: (ref: string) => void;
  alArchivar: (fm: FrontmatterComun) => void;
  alAccion: (fm: FrontmatterComun, accion: AccionRespuesta) => void;
  /** En un hilo, de varios días: la hora con su día («15 oct, 19:12»; «hoy, 17:49»), como `SC.hilo`. */
  conDia?: boolean;
  /** Sin «Archivar» (en un hilo, archivar el que guarda la solución haría que no se citara). */
  sinArchivar?: boolean;
  /** Lo que va dentro de la tarjeta tras la respuesta (en un hilo, «Así lo resolviste», como `SC.hilo`). */
  pie?: ReactNode;
}

/** La fila de acciones: las del lector, un hueco, «Responder» y «Archivar» (como `msgHTML`). */
function Acciones({ p, acciones }: { p: PropsMensaje; acciones: readonly AccionRespuesta[] }) {
  const { t } = useT();
  return (
    <div className="mact">
      {acciones.map((a) => (
        <Boton key={a.id} pequeno onClick={() => p.alAccion(p.fm, a)}>
          {a.etiqueta}
        </Boton>
      ))}
      <span className="sp" />
      {!p.soloLectura && (
        <>
          <button type="button" className="ibtn" onClick={() => p.alResponder(p.fm.ref)}>
            <Icono nombre="responder" tamano={14} />
            {t('pantallas.inicio.responder')}
          </button>
          {!p.sinArchivar && (
            <button type="button" className="ibtn" onClick={() => p.alArchivar(p.fm)}>
              <Icono nombre="archivar" tamano={14} />
              {t('pantallas.inicio.archivar')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** La respuesta (se pide con prioridad: está en pantalla) y las acciones que trae. */
function ConRespuesta({ el, p }: { el: Elemento; p: PropsMensaje }) {
  const respuesta = useRespuesta(el, { prioridad: 'visible' });
  const lista: (AccionRespuesta | undefined)[] =
    respuesta && respuesta !== 'desactivada' ? [...(respuesta.acciones ?? [])] : [];
  const acciones =
    p.sinAcciones || p.soloLectura ? [] : lista.filter((a): a is AccionRespuesta => !!a && accionSoportada(a.id));
  return (
    <>
      {respuesta !== 'desactivada' && <RespuestaRimor respuesta={respuesta} alAbrir={p.alAbrir} anunciar={p.fresco} />}
      {p.pie}
      <Acciones p={p} acciones={acciones} />
    </>
  );
}

export const Mensaje = memo(function Mensaje(p: PropsMensaje) {
  const { t, idioma } = useT();
  const el = useElemento(p.fm);
  const previa = vistaPrevia(el, p.fm.titulo) ?? (el && el.original === null ? p.resumen || null : null);
  const fecha = new Date(p.fm.creado);
  // El seleccionado con el teclado recibe el foco: un lector de pantalla lo anuncia y Enter actúa sobre él.
  const articulo = useRef<HTMLElement>(null);
  useEffect(() => {
    if (p.seleccionado) articulo.current?.focus({ preventScroll: true });
  }, [p.seleccionado]);
  return (
    <article
      ref={articulo}
      tabIndex={-1}
      className={clases('msg', p.fresco && 'fresh', p.seleccionado && 'sel', p.marcado && 'marcado')}
      aria-current={p.seleccionado ? true : undefined}
      aria-posinset={p.posicion}
      aria-setsize={p.total}
      aria-labelledby={`titulo-${p.fm.id}`}
      data-ref={p.fm.ref}
    >
      <div className="mhead">
        <IconoTipo tipo={p.fm.tipo} />
        <button type="button" className="tt" id={`titulo-${p.fm.id}`} onClick={() => p.alAbrir(p.fm.ref)}>
          {p.fm.titulo}
        </button>
        {p.fm.fijado && (
          <span className="fijado" title={t('pantallas.inicio.fijado', { ref: p.fm.ref })}>
            <Icono nombre="fijar" tamano={13} />
          </span>
        )}
        <time className="time" dateTime={p.fm.creado}>
          {Number.isNaN(fecha.getTime()) ? '' : p.conDia ? horaConDia(fecha, idioma) : fmtHora(fecha)}
        </time>
      </div>
      {previa && <div className="mprev">{previa}</div>}
      {el ? (
        <ConRespuesta el={el} p={p} />
      ) : (
        <>
          <RespuestaRimor respuesta={null} anunciar={false} />
          {p.pie}
          <Acciones p={p} acciones={[]} />
        </>
      )}
    </article>
  );
});
