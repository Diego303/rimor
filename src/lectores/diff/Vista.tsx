/**
 * Vista del lector Diff (IN-042): arriba, cuántos archivos y cuánto se añade y se quita; después, una tarjeta por
 * archivo con sus trozos lado a lado (antes a la izquierda, después a la derecha, con los números de línea y el
 * estilo `.diff` de la referencia: añadido, quitado e igual). Por debajo de 720 px, una columna.
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

/** Una celda: el número de su lado (que no se lee ni se copia) y el texto. */
function Celda({ linea, lado }: { linea: LineaDiff | undefined; lado: 'a' | 'b' }) {
  if (!linea) return <td className="diff-celda vacia" />;
  return (
    <td className={`diff-celda ${CLASE[linea.t]}`}>
      <span className="ln" aria-hidden="true">
        {linea[lado]}
      </span>
      {linea.v}
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
  return (
    <section className="card diff-archivo" aria-label={archivo.ruta}>
      <div className="row">
        <span className="mono sm diff-ruta">{archivo.ruta}</span>
        <span className="st">{t(`estados.${archivo.estado}`)}</span>
        {archivo.antes && <span className="xs muted mono">{t('renombradoDe', { ruta: archivo.antes })}</span>}
        <span className="sp" />
        <span className="mono xs">
          <span className="diff-mas">+{fmtNumero(archivo.anadidas, idioma)}</span>{' '}
          <span className="diff-menos">−{fmtNumero(archivo.quitadas, idioma)}</span>
        </span>
      </div>
      {filas.length ? (
        <table className="diff diff-lado" aria-label={archivo.ruta}>
          <thead>
            <tr className="diff-titulos">
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
                <tr key={i} className="diff-fila">
                  <Celda linea={f.izquierda} lado="a" />
                  <Celda linea={f.derecha} lado="b" />
                </tr>
              ),
            )}
          </tbody>
        </table>
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
        <Detalles resumen={t('masArchivos', { n: resto.length })}>
          {resto.map((a, i) => (
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
