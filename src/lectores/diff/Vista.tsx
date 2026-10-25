/**
 * Vista del lector Diff (IN-042): arriba, cuántos archivos y cuánto se añade y se quita; después, una tarjeta por
 * archivo con sus trozos lado a lado (antes a la izquierda, después a la derecha, con los números de línea y el
 * estilo `.diff` de la referencia: añadido, quitado e igual). Por debajo de 720 px, el diff unificado (una columna,
 * en su orden). Lo añadido y lo quitado se dice también al lector de pantalla, no solo con el color.
 */
import { useState } from 'react';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Tarjeta } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { type ArchivoDiff, filasLadoALado, type LineaDiff } from './analisis';
import { type DatosDiff, lectorDiff } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Las filas que se pintan de un archivo antes de «Ver todo». */
export const MAX_FILAS = 400;
/** Los archivos que se enseñan abiertos; los demás, plegados. */
export const MAX_ARCHIVOS = 20;

const CLASE: Record<LineaDiff['t'], string> = { anadida: 'a', quitada: 'r', igual: 's' };

/** El número (que no se lee ni se copia), si es añadida o quitada (para el lector de pantalla) y el texto. */
function Contenido({ linea, lado, t }: { linea: LineaDiff; lado: 'a' | 'b'; t: T }) {
  return (
    <>
      <span className="ln" aria-hidden="true">
        {linea[lado]}
      </span>
      {linea.t !== 'igual' && <span className="solo-lector">{t(`linea.${linea.t}`)}</span>}
      {linea.v}
    </>
  );
}

function Celda({ linea, lado, t }: { linea: LineaDiff | undefined; lado: 'a' | 'b'; t: T }) {
  if (!linea) return <td className="diff-celda vacia" />;
  return (
    <td className={`diff-celda ${CLASE[linea.t]}`}>
      <Contenido linea={linea} lado={lado} t={t} />
    </td>
  );
}

function ArchivoLadoALado({ archivo, t, idioma }: { archivo: ArchivoDiff; t: T; idioma: Idioma }) {
  const [todo, setTodo] = useState(false);
  const filas = archivo.trozos.flatMap((trozo) => [
    { cabecera: `${trozo.cabecera}${trozo.contexto ? ` ${trozo.contexto}` : ''}` },
    ...filasLadoALado(trozo),
  ]);
  const visibles = todo ? filas : filas.slice(0, MAX_FILAS);
  // El unificado (pantallas estrechas): cabeceras y líneas en su orden, con el mismo tope.
  const unificado = archivo.trozos.flatMap((trozo) => [
    { cabecera: `${trozo.cabecera}${trozo.contexto ? ` ${trozo.contexto}` : ''}` },
    ...trozo.lineas,
  ]);
  const unificadoVisible = todo ? unificado : unificado.slice(0, MAX_FILAS);
  return (
    <section className="card diff-archivo" aria-label={archivo.ruta}>
      <div className="row">
        <span className="mono sm diff-ruta">{archivo.ruta}</span>
        <span className="st">{t(`estados.${archivo.estado}`)}</span>
        {archivo.antes && <span className="xs muted mono">{t('renombradoDe', { ruta: archivo.antes })}</span>}
        {archivo.modo && <span className="xs muted mono">{t('modo', archivo.modo)}</span>}
        <span className="sp" />
        <span className="mono xs">
          <span className="diff-mas">+{fmtNumero(archivo.anadidas, idioma)}</span>{' '}
          <span className="diff-menos">−{fmtNumero(archivo.quitadas, idioma)}</span>
        </span>
      </div>
      {filas.length ? (
        <table className="diff diff-lado" aria-label={archivo.ruta}>
          <thead>
            <tr>
              <th scope="col" className="diff-celda diff-titulo">
                {t('antes')}
              </th>
              <th scope="col" className="diff-celda diff-titulo">
                {t('despues')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) =>
              'cabecera' in f ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: las filas de un diff son fijas y en su orden.
                <tr key={i}>
                  <td colSpan={2} className="diff-celda diff-cabecera">
                    {f.cabecera}
                  </td>
                </tr>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: las filas de un diff son fijas y en su orden.
                <tr key={i}>
                  <Celda linea={f.izquierda} lado="a" t={t} />
                  <Celda linea={f.derecha} lado="b" t={t} />
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : null}
      {filas.length ? (
        <div className="diff diff-unificado">
          {unificadoVisible.map((l, i) =>
            'cabecera' in l ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: las líneas de un diff son fijas y en su orden.
              <div key={i} className="diff-celda diff-cabecera">
                {l.cabecera}
              </div>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: las líneas de un diff son fijas y en su orden.
              <div key={i} className={`diff-celda ${CLASE[l.t]}`}>
                <Contenido linea={l} lado={l.t === 'anadida' ? 'b' : 'a'} t={t} />
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="sm muted">{t('sinCambios')}</p>
      )}
      {!todo && filas.length > MAX_FILAS && (
        <Boton variante="fantasma" pequeno onClick={() => setTodo(true)}>
          {t('verTodo', { n: filas.filter((f) => !('cabecera' in f)).length })}
        </Boton>
      )}
    </section>
  );
}

export default function VistaDiff({ el, datos }: PropsVista<DatosDiff>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const cifras = cifrasDe(lectorDiff, datos);
  const abiertos = datos.archivos.slice(0, MAX_ARCHIVOS);
  const resto = datos.archivos.slice(MAX_ARCHIVOS);
  // Los plegados no se pintan hasta abrirlos (un parche con cientos de archivos de un lockfile o de vendor).
  const [restoAbierto, setRestoAbierto] = useState(false);
  return (
    <>
      <Tarjeta>
        <div className="stats">
          <div className="stat">
            <span className="v">{fmtNumero(datos.archivos.length, idioma)}</span>
            <span className="xs muted">{t('cifras.archivos')}</span>
          </div>
          <div className="stat">
            <span className="v ok">+{fmtNumero(datos.anadidas, idioma)}</span>
            <span className="xs muted">{t('cifras.anadidas')}</span>
          </div>
          <div className="stat">
            <span className="v bad">−{fmtNumero(datos.quitadas, idioma)}</span>
            <span className="xs muted">{t('cifras.quitadas')}</span>
          </div>
        </div>
      </Tarjeta>
      {abiertos.map((a, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: dos archivos pueden tener la misma ruta en un parche raro.
        <ArchivoLadoALado key={`${a.ruta}|${i}`} archivo={a} t={t} idioma={idioma} />
      ))}
      {resto.length > 0 && (
        <Detalles resumen={t('masArchivos', { n: resto.length })} alAlternar={setRestoAbierto}>
          {restoAbierto &&
            resto.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: dos archivos pueden tener la misma ruta en un parche raro.
              <ArchivoLadoALado key={`${a.ruta}|${i}`} archivo={a} t={t} idioma={idioma} />
            ))}
        </Detalles>
      )}
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras}>
        {datos.asunto && (
          <>
            <dt>{t('asunto')}</dt>
            <dd>{datos.asunto}</dd>
          </>
        )}
      </DetallesElemento>
    </>
  );
}
