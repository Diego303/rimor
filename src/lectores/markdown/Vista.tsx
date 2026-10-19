/**
 * Vista del lector Documento Markdown, como la pantalla de referencia: «7 de 18 tareas» con su porcentaje y el
 * medidor, el índice con `hechas/total` por sección (cada entrada lleva a su encabezado; las marcas de cambio
 * llegan con IN-029), el documento pintado y saneado, y los detalles con enlaces, bloques de código y cifras.
 */
import { useContext, useMemo } from 'react';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { idDeAncla } from '../../ui/anclas';
import { Medidor, Tarjeta } from '../../ui/componentes';
import MarkdownSeguro from '../../ui/componentes/MarkdownSeguro';
import { claveSeccion, type DiffSecciones, diffSecciones } from '../../versiones/secciones';
import { ContextoVersion } from '../ContextoVersion';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { cuerpoDe } from './deteccion';
import { type DatosMarkdown, indiceDe } from './indice';
import { lectorMarkdown } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Enlaces que se enseñan en «Detalles»; el resto, «y N más». */
const ENLACES_VISIBLES = 10;

/** Lleva al encabezado sin tocar la ruta (que va en el hash). */
function irA(ancla: string) {
  document.getElementById(idDeAncla(ancla))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** «Desde la versión 2: 1 sección añadida, 1 modificada, 1 eliminada y 2 tareas marcadas.» */
function textoCambios(version: number, c: DiffSecciones, idioma: Idioma, t: T): string {
  const partes = [
    c.anadidas.length && t('cambios.anadidas', { n: c.anadidas.length }),
    c.modificadas.length && t('cambios.modificadas', { n: c.modificadas.length }),
    c.eliminadas.length && t('cambios.eliminadas', { n: c.eliminadas.length }),
    c.tareasMarcadas.length && t('cambios.tareas', { n: c.tareasMarcadas.length }),
  ].filter((x): x is string => Boolean(x));
  if (!partes.length) return t('desdeSinCambios', { version });
  const lista = new Intl.ListFormat(idioma, { type: 'conjunction' }).format(partes);
  return t('desde', { version, cambios: lista });
}

export default function VistaMarkdown({ el, datos }: PropsVista<DatosMarkdown>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const indice = indiceDe(datos);
  // El mismo cuerpo que analizó el lector (sin frontmatter, con saltos normalizados): así las anclas coinciden.
  const { cuerpo, frontmatter } = cuerpoDe(el.original ?? '');
  const { hechas, total } = datos.tareas;
  const cifras = cifrasDe(lectorMarkdown, datos);
  const lenguajes = Object.entries(datos.bloques.lenguajes).sort((a, b) => b[1] - a[1]);

  // Lo que cambió desde la versión anterior (IN-029), si la pantalla la da: marcado en el propio índice.
  const anterior = useContext(ContextoVersion);
  const original = el.original ?? '';
  const cambios = useMemo(() => (anterior ? diffSecciones(anterior.original, original) : null), [anterior, original]);
  const marca = (titulo: string) => {
    const clave = claveSeccion(titulo);
    if (cambios?.anadidas.some((x) => claveSeccion(x) === clave)) return 'anadida' as const;
    if (cambios?.modificadas.some((x) => claveSeccion(x) === clave)) return 'modificada' as const;
    return null;
  };
  const resumenCambios = anterior && cambios ? textoCambios(anterior.version, cambios, idioma, t) : null;

  const lista = (indice.length > 0 || (cambios?.eliminadas.length ?? 0) > 0) && (
    <div className="list lista-secciones">
      {indice.map((s) => {
        const m = marca(s.titulo);
        return (
          <button
            key={s.ancla}
            type="button"
            className="row seccion-indice"
            onClick={() => irA(s.ancla)}
            title={t('irA', { titulo: s.titulo || t('sinTitulo') })}
          >
            <span className="sm">
              {s.titulo || t('sinTitulo')}
              {m && (
                <>
                  {' '}
                  <span className={m === 'anadida' ? 'st ok' : 'st warn'}>{t(`cambio.${m}`)}</span>
                </>
              )}
            </span>
            <span className="mono xs muted">{s.tareas.total ? `${s.tareas.hechas}/${s.tareas.total}` : ''}</span>
          </button>
        );
      })}
      {cambios?.eliminadas.map((titulo) => (
        <div key={`eliminada:${titulo}`} className="row seccion-indice">
          <span className="sm muted seccion-eliminada">{titulo || t('sinTitulo')}</span>
          <span className="st bad">{t('cambio.eliminada')}</span>
        </div>
      ))}
    </div>
  );
  const resumen = resumenCambios && <p className="xs muted">{resumenCambios}</p>;

  return (
    <>
      {total > 0 ? (
        <Tarjeta>
          <div className="row progreso-tareas">
            <b>{t('deTareas', { hechas: fmtNumero(hechas, idioma), total: fmtNumero(total, idioma) })}</b>
            <span className="mono xs muted">{fmtNumero(Math.round((hechas / total) * 100), idioma)} %</span>
          </div>
          <Medidor fraccion={hechas / total} etiqueta={t('progreso')} />
          {lista}
          {resumen}
        </Tarjeta>
      ) : (
        (lista || resumen) && (
          <Tarjeta titulo={t('indice')}>
            {lista}
            {resumen}
          </Tarjeta>
        )
      )}

      <Tarjeta>
        <MarkdownSeguro texto={cuerpo} anclas />
      </Tarjeta>

      <DetallesElemento
        refe={el.frontmatter.ref}
        cifras={cifras}
        anexo={
          <>
            {frontmatter !== null && (
              <>
                <p className="xs muted">{t('frontmatter')}</p>
                <pre className="code">{frontmatter}</pre>
              </>
            )}
          </>
        }
      >
        <dt>{t('etiquetaSecciones')}</dt>
        <dd className="mono">{fmtNumero(indice.length, idioma)}</dd>
        <dt>{t('etiquetaPalabras')}</dt>
        <dd className="mono">{fmtNumero(datos.palabras, idioma)}</dd>
        <dt>{t('enlaces')}</dt>
        <dd>
          {datos.enlaces.length ? (
            <span className="lista-enlaces">
              {datos.enlaces.slice(0, ENLACES_VISIBLES).map((u) => (
                <span key={u} className="mono xs">
                  {u}
                </span>
              ))}
              {datos.enlaces.length > ENLACES_VISIBLES && (
                <span className="xs muted">{t('masEnlaces', { n: datos.enlaces.length - ENLACES_VISIBLES })}</span>
              )}
            </span>
          ) : (
            t('ninguno')
          )}
        </dd>
        <dt>{t('bloques')}</dt>
        <dd>{lenguajes.length ? lenguajes.map(([l, n]) => `${l} (${n})`).join(' · ') : t('ninguno')}</dd>
        {datos.menciones.length > 0 && (
          <>
            <dt>{t('menciones')}</dt>
            <dd className="mono">{datos.menciones.join(' · ')}</dd>
          </>
        )}
      </DetallesElemento>
    </>
  );
}
