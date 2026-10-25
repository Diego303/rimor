/**
 * Vista del lector Datos tabulares (IN-044, como `SC.tabla`): «Columnas» (una fila por columna: nombre y tipo; su
 * forma —mini-histograma, los más repetidos o mínimo → máximo—; nulos, atípicos y filas en el máximo en ámbar), el
 * aviso si el perfil es de una muestra, el gráfico rápido, la consulta SQL plegada y la vista previa plegada.
 */
import { useContext, useState } from 'react';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Banner, Boton, Detalles, Tarjeta } from '../../ui/componentes';
import { ContextoComparar } from '../ContextoComparar';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { ConsultaSql } from './ConsultaSql';
import { type DatosTabla, lectorDatos, valorLegible } from './lector';
import type { PerfilColumna } from './perfil';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Barras de un histograma en SVG (las del mini y las del gráfico rápido). */
function Barras({
  cubetas,
  ancho,
  alto,
  etiqueta,
}: {
  cubetas: number[];
  ancho: number;
  alto: number;
  etiqueta?: string;
}) {
  const mayor = Math.max(...cubetas, 1);
  const paso = ancho / cubetas.length;
  const barras = cubetas.map((n, i) => {
    const h = (n / mayor) * (alto - 1);
    // biome-ignore lint/suspicious/noArrayIndexKey: las cubetas son fijas y en su orden.
    return <rect key={i} x={i * paso + 0.5} y={alto - h} width={Math.max(paso - 1, 0.5)} height={h} rx={0.8} />;
  });
  // Con etiqueta es una imagen que se describe (el gráfico rápido); sin ella, adorno (el mini de cada columna).
  return etiqueta ? (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
      className="histograma-datos"
      role="img"
      aria-label={etiqueta}
    >
      <title>{etiqueta}</title>
      {barras}
    </svg>
  ) : (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="histograma-datos" aria-hidden="true">
      {barras}
    </svg>
  );
}

/** La forma de una columna: su histograma, sus valores más repetidos o de mínimo a máximo. */
function Forma({ c, idioma }: { c: PerfilColumna; idioma: Idioma }) {
  if (c.histograma?.some((n) => n > 0)) return <Barras cubetas={c.histograma} ancho={120} alto={26} />;
  if (c.frecuentes?.length)
    return (
      <span className="xs">
        {c.frecuentes.map(([v, n], i) => (
          <span key={v}>
            {i > 0 && ' · '}
            {v} <span className="faint">{fmtNumero(n, idioma)}</span>
          </span>
        ))}
      </span>
    );
  if (c.min !== undefined || c.max !== undefined)
    return (
      <span className="mono xs muted">
        {valorLegible(c.min, idioma)} → {valorLegible(c.max, idioma)}
      </span>
    );
  return null;
}

/** Lo que hay que mirar de una columna: nulos, atípicos y filas en un máximo atípico. */
function Avisos({ c, t, idioma }: { c: PerfilColumna; t: T; idioma: Idioma }) {
  const avisos = [
    c.nulos > 0 ? t('nulosAviso', { n: c.nulos }) : '',
    c.maximoAtipico && (c.enMaximo ?? 0) >= 2
      ? t('enMaximoAviso', { n: c.enMaximo ?? 0, valor: valorLegible(c.max, idioma) })
      : c.atipicos
        ? t('atipicosAviso', { n: c.atipicos })
        : '',
  ].filter(Boolean);
  return avisos.length ? <span className="warn-texto">{avisos.join(' · ')}</span> : null;
}

function GraficoRapido({ columnas, t, idioma }: { columnas: PerfilColumna[]; t: T; idioma: Idioma }) {
  const numericas = columnas.filter((c) => c.histograma?.some((n) => n > 0));
  const [elegida, setElegida] = useState(numericas[0]?.nombre ?? '');
  const c = numericas.find((x) => x.nombre === elegida) ?? numericas[0];
  if (!c?.histograma) return null;
  const descripcion = t('graficoDescripcion', {
    columna: c.nombre,
    min: valorLegible(c.min, idioma),
    max: valorLegible(c.max, idioma),
  });
  return (
    <Tarjeta titulo={t('grafico')}>
      <label className="row xs muted">
        {t('graficoColumna')}
        <select value={c.nombre} onChange={(e) => setElegida(e.target.value)}>
          {numericas.map((x) => (
            <option key={x.nombre} value={x.nombre}>
              {x.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="grafico-datos">
        <Barras cubetas={c.histograma} ancho={480} alto={140} etiqueta={descripcion} />
        <div className="row mono xs muted grafico-datos-ejes">
          <span>{valorLegible(c.min, idioma)}</span>
          <span className="sp" />
          <span>{valorLegible(c.max, idioma)}</span>
        </div>
      </div>
    </Tarjeta>
  );
}

export default function VistaDatos({ el, datos }: PropsVista<DatosTabla>) {
  const { idioma, t: tg } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const comparar = useContext(ContextoComparar);
  const cifras = cifrasDe(lectorDatos, datos);
  return (
    <>
      {datos.muestra && (
        <Banner>
          {t('muestra', {
            filas: fmtNumero(datos.muestra.filas, idioma),
            aproximadas: fmtNumero(datos.muestra.aproximadas, idioma),
          })}
        </Banner>
      )}
      <Tarjeta titulo={t('columnasTitulo')}>
        <div className="tbl-wrap">
          <table className="tabla-columnas">
            <tbody>
              {datos.columnas.map((c) => (
                <tr key={c.nombre}>
                  <td>
                    <b className="mono sm">{c.nombre}</b>
                    <br />
                    <span className="xs faint">{c.tipo}</span>
                  </td>
                  <td>
                    <Forma c={c} idioma={idioma} />
                  </td>
                  <td className="xs">
                    <Avisos c={c} t={t} idioma={idioma} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
      {comparar && (
        <div className="row">
          <Boton variante="primario" pequeno onClick={comparar}>
            {tg('pantallas.comparacion.crear.conDatos')}
          </Boton>
        </div>
      )}
      <GraficoRapido columnas={datos.columnas} t={t} idioma={idioma} />
      <ConsultaSql el={el} formato={datos.formato} />
      <Detalles resumen={t('vistaPrevia')}>
        <div className="tbl-wrap">
          <table className="tabla-vista-previa">
            <thead>
              <tr>
                {datos.vistaPrevia.columnas.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.vistaPrevia.filas.map((fila, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: las filas de la vista previa son fijas y en su orden.
                <tr key={i}>
                  {fila.map((v, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: las celdas de una fila son fijas y en su orden.
                    <td key={j} className={typeof v === 'number' ? 'n' : undefined}>
                      {v === null ? (
                        <span className="faint">{valorLegible(null, idioma)}</span>
                      ) : (
                        valorLegible(v, idioma)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Detalles>
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras} />
    </>
  );
}
