/**
 * Vista del lector Log, como la pantalla de referencia: cifras, histograma por minuto y nivel y dónde se
 * concentran los errores; «Qué dice» con las plantillas (al pulsar una, sus líneas); y, plegados, las líneas
 * originales y los detalles con las cifras citables.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { fmtDuracion, fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import type { Barra, DatosLog, Nivel } from './analisis';
import { lectorLog } from './lector';
import { textos } from './textos';

const MAX_LINEAS = 200;
const PLANTILLAS_A_LA_VISTA = 5;

/** Una plantilla con sus marcadores (`<N>`, `<ID>`…) y su nivel resaltados, como en la pantalla de referencia. */
function PlantillaPintada({ plantilla }: { plantilla: string }) {
  const piezas: ReactNode[] = [];
  let resto = plantilla;
  let k = 0;
  const patron = /<(N|ID|IP|HEX)>|\b(ERROR|WARN)\b/;
  for (let m = patron.exec(resto); m; m = patron.exec(resto)) {
    if (m.index) piezas.push(resto.slice(0, m.index));
    piezas.push(
      m[1] ? (
        <span key={k++} className="ph">
          {m[1]}
        </span>
      ) : (
        <span key={k++} className={`lv-${m[2]}`}>
          {m[2]}
        </span>
      ),
    );
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) piezas.push(resto);
  return <>{piezas}</>;
}

/** Una línea del log con su número y el nivel coloreado. */
function Linea({ n, texto }: { n: number; texto: string }) {
  const m = /\b(ERROR|WARN|DEBUG)\b/.exec(texto);
  return (
    <>
      <span className="ln">{n}</span>
      {m ? (
        <>
          {texto.slice(0, m.index)}
          <span className={`lv-${m[1]}`}>{m[1]}</span>
          {texto.slice(m.index + (m[1]?.length ?? 0))}
        </>
      ) : (
        texto
      )}
      {'\n'}
    </>
  );
}

/** Histograma de barras apiladas (otros, avisos, errores) con una etiqueta cada 5 barras, como la referencia. */
function Histograma({ barras, etiqueta }: { barras: Barra[]; etiqueta: string }) {
  const W = 720;
  const H = 130;
  const ancho = (W - 40) / Math.max(barras.length, 1);
  const maximo = Math.max(1, ...barras.map((b) => b.errores + b.avisos + b.otros));
  const cada = Math.max(1, Math.ceil(barras.length / 6 / 5) * 5);
  const escala = (v: number) => (v / maximo) * (H - 34);
  return (
    <div className="tbl-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="histograma-log" role="img" aria-label={etiqueta}>
        {barras.map((b, i) => {
          const x = 34 + i * ancho;
          let y = H - 20;
          const segmento = (v: number, clase: string) => {
            if (!v) return null;
            const alto = escala(v);
            y -= alto;
            return (
              <rect
                key={clase}
                x={x + 1}
                y={y}
                width={Math.max(ancho - 2, 0.5)}
                height={alto}
                rx={1.5}
                className={clase}
              />
            );
          };
          return (
            <g key={b.inicio}>
              {segmento(b.otros, 'barra-otros')}
              {segmento(b.avisos, 'barra-avisos')}
              {segmento(b.errores, 'barra-errores')}
              {i % cada === 0 && (
                <text x={x + ancho / 2} y={H - 5} textAnchor="middle" className="eje">
                  {b.pared}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function VistaLog({ el, datos }: PropsVista<DatosLog>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as (
    c: Parameters<typeof textos.t>[1],
    v?: Record<string, string | number>,
  ) => string;
  const [elegida, setElegida] = useState<number | null>(null);
  const [todas, setTodas] = useState(false);
  const lineas = useMemo(() => (el.original ?? '').replace(/\r\n?/g, '\n').split('\n'), [el.original]);
  const nErr = datos.niveles.ERROR + datos.niveles.FATAL;
  const plantillas = todas ? datos.plantillas : datos.plantillas.slice(0, PLANTILLAS_A_LA_VISTA);
  const deLaElegida = useMemo(() => {
    if (elegida === null) return [];
    const r: { n: number; texto: string }[] = [];
    for (let i = 0; i < datos.lineaPlantilla.length && r.length < MAX_LINEAS; i++)
      if (datos.lineaPlantilla[i] === elegida) r.push({ n: i + 1, texto: lineas[i] ?? '' });
    return r;
  }, [elegida, datos.lineaPlantilla, lineas]);
  const etiquetaHistograma =
    datos.histograma?.paso === 'hora'
      ? t('histogramaHora')
      : datos.histograma?.paso === 'dia'
        ? t('histogramaDia')
        : t('histograma');
  const cifras = Object.entries(lectorLog.cifras ?? {}).map(([nombre, f]) => [nombre, f(datos).texto] as const);
  const nivel = (n: Nivel) => datos.niveles[n];
  const elegir = (i: number) => setElegida(elegida === i ? null : i);

  return (
    <>
      <section className="card">
        <div className="stats">
          <div className="stat">
            <span className="v bad">{fmtNumero(nErr, idioma)}</span>
            <span className="xs muted">{t('etiquetas.errores', { n: nErr })}</span>
          </div>
          <div className="stat">
            <span className="v warn">{fmtNumero(nivel('WARN'), idioma)}</span>
            <span className="xs muted">{t('etiquetas.avisos', { n: nivel('WARN') })}</span>
          </div>
          <div className="stat">
            <span className="v">{fmtNumero(datos.plantillas.length, idioma)}</span>
            <span className="xs muted">{t('etiquetas.plantillas', { n: datos.plantillas.length })}</span>
          </div>
        </div>
        {datos.histograma && <Histograma barras={datos.histograma.barras} etiqueta={etiquetaHistograma} />}
        {datos.concentracion && (
          <p className="sm">
            {t('concentracion')}
            <b>
              {datos.concentracion.desde}
              {t('y')}
              {datos.concentracion.hasta}
            </b>
            .
          </p>
        )}
      </section>

      <section className="card">
        <div className="ah">
          <h3>{t('queDice')}</h3>
          <span className="xs muted">{t('pulsa')}</span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-plantillas">
            <tbody>
              {plantillas.map((p, i) => (
                // La fila entera se pulsa con el ratón; con teclado, el botón de la plantilla.
                <tr key={p.plantilla} className={elegida === i ? 'click on' : 'click'} onClick={() => elegir(i)}>
                  <td className="n">{fmtNumero(p.n, idioma)}</td>
                  <td className="mono xs plantilla">
                    <button
                      type="button"
                      className="boton-plantilla"
                      aria-pressed={elegida === i}
                      onClick={(e) => {
                        e.stopPropagation();
                        elegir(i);
                      }}
                    >
                      <PlantillaPintada plantilla={p.plantilla} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {datos.plantillas.length > PLANTILLAS_A_LA_VISTA && (
          <div className="row">
            <Boton variante="fantasma" pequeno onClick={() => setTodas(!todas)}>
              {todas ? t('verMenos') : t('verTodas', { n: datos.plantillas.length })}
            </Boton>
          </div>
        )}
        {elegida !== null && (
          <pre className="code lineas-log lineas-plantilla" title={t('lineasDe')}>
            {deLaElegida.map((l) => (
              <Linea key={l.n} n={l.n} texto={l.texto} />
            ))}
          </pre>
        )}
      </section>

      <Detalles resumen={t('originales')}>
        <pre className="code lineas-log">
          {lineas.slice(0, MAX_LINEAS).map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: las líneas de un log son fijas y en su orden.
            <Linea key={i} n={i + 1} texto={l} />
          ))}
        </pre>
        {lineas.length > MAX_LINEAS && <p className="xs muted">{t('mostrando', { n: MAX_LINEAS })}</p>}
      </Detalles>

      <Detalles resumen={t('detalles')}>
        <dl className="kv">
          <dt>{t('formato')}</dt>
          <dd>{t(`formatos.${datos.formato}`)}</dd>
          {datos.desde && datos.hasta && (
            <>
              <dt>{t('rango')}</dt>
              <dd>
                {datos.desde} – {datos.hasta}
                {datos.duracionMs !== null && ` · ${fmtDuracion(datos.duracionMs, idioma)}`}
              </dd>
            </>
          )}
          {datos.primerError && (
            <>
              <dt>{t('primerError')}</dt>
              <dd className="mono xs">
                {t('linea', { n: datos.primerError.linea })} · {datos.primerError.texto}
              </dd>
            </>
          )}
          {datos.ultimoError && datos.ultimoError.linea !== datos.primerError?.linea && (
            <>
              <dt>{t('ultimoError')}</dt>
              <dd className="mono xs">
                {t('linea', { n: datos.ultimoError.linea })} · {datos.ultimoError.texto}
              </dd>
            </>
          )}
          {datos.pares.length > 0 && (
            <>
              <dt>{t('pares')}</dt>
              <dd className="mono xs">
                {datos.pares
                  .slice(0, 8)
                  .map((p) => `${p.clave} (${p.valores.map((v) => v.valor).join(', ')})`)
                  .join(' · ')}
              </dd>
            </>
          )}
        </dl>
        <p className="xs muted">
          {t('cifras')} <span className="mono">{t('sintaxisCifra', { ref: el.frontmatter.ref })}</span>:
        </p>
        <div className="row">
          {cifras.map(([nombre, valor]) => (
            <span key={nombre} className="st">
              <span className="mono">{nombre}</span> {valor}
            </span>
          ))}
        </div>
      </Detalles>
    </>
  );
}
