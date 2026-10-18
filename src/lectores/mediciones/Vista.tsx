/**
 * Vista del lector Mediciones, con las piezas de la comparación de la pantalla de referencia: la mediana como
 * veredicto, el gráfico de puntos con la banda del IC y la línea de la mediana, la leyenda, la tabla
 * «Mediana · IC 95 % · Variación», los avisos de método plegados con su número y los detalles con las cifras.
 */
import type { AvisoMetodo } from '@rimor/estadistica';
import { fmtCifra, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Detalles, Hueco, Huecos, Tabla, Tarjeta, Veredicto } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import { GraficoPuntos } from './GraficoPuntos';
import {
  type DatosMediciones,
  type Escala,
  escalaDe,
  formatosDe,
  lectorMediciones,
  type SerieDerivada,
} from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Atípicos que se nombran en el aviso; el resto, «…». */
const MAX_ATIPICOS = 5;

interface FilaSerie {
  nombre: string;
  s: SerieDerivada;
}

function textoAviso(a: AvisoMetodo, s: SerieDerivada, escala: Escala, idioma: Idioma, t: T): string {
  const f = formatosDe(s, idioma, escala);
  switch (a.tipo) {
    case 'pocas':
      return t('aviso.pocas', { mediciones: t('mediciones', { n: a.n }), minimo: a.minimo });
    case 'ruido':
      return t('aviso.ruido', { cv: f.porcentaje(a.cv), maximo: fmtCifra(a.maximo * 100, 0, '%', idioma) });
    case 'atipicos': {
      const nombrados = a.valores.slice(0, MAX_ATIPICOS).map(f.conUnidad).join(', ');
      const valores = a.valores.length > MAX_ATIPICOS ? `${nombrados}…` : nombrados;
      return t('aviso.atipicos', { n: a.valores.length, valores });
    }
  }
}

export default function VistaMediciones({ el, datos }: PropsVista<DatosMediciones>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const filas: FilaSerie[] = datos.series.map((s, i) => ({
    nombre: s.etiqueta ?? (datos.series.length > 1 ? t('serieSinNombre', { n: i + 1 }) : t('titulo')),
    s,
  }));
  const primera = filas[0];
  const varias = filas.length > 1;
  // Una sola escala para todo (gráfico, tabla y avisos): µs o ns si los valores son de menos de 1 ms.
  const escala = escalaDe(datos.series);
  const fmt = (s: SerieDerivada) => formatosDe(s, idioma, escala);
  const avisos = filas.flatMap(({ nombre, s }) =>
    s.avisos.map(
      (a) => `${varias ? t('aviso.prefijo', { etiqueta: nombre }) : ''}${textoAviso(a, s, escala, idioma, t)}`,
    ),
  );
  const cifras = Object.entries(lectorMediciones.cifras ?? {}).map(([nombre, f]) => [nombre, f(datos).texto] as const);

  if (!primera || !primera.s.d.n) {
    return (
      <Tarjeta>
        <p className="sm muted">{t('respuesta.vacia')}</p>
      </Tarjeta>
    );
  }

  const fp = fmt(primera.s);
  const escalar = (v: number) => v * escala.factor;

  return (
    <>
      <Tarjeta>
        <Veredicto
          tono={primera.s.avisos.some((a) => a.tipo !== 'atipicos') ? 'warn' : 'ok'}
          cifra={fp.conUnidad(primera.s.d.mediana)}
          frase={t('medianaDe', { mediciones: t('mediciones', { n: primera.s.d.n }) })}
          explicacion={
            primera.s.d.n > 1
              ? t('explicacion', {
                  bajo: fp.numero(primera.s.d.icBajo),
                  alto: fp.numero(primera.s.d.icAlto),
                  cv: fp.porcentaje(primera.s.d.cv),
                })
              : t('sinVariacion')
          }
        />
        <div className="tbl-wrap">
          <GraficoPuntos
            filas={filas.map((f) => ({
              etiqueta: f.nombre,
              valores: f.s.valores.map(escalar),
              d: { mediana: escalar(f.s.d.mediana), icBajo: escalar(f.s.d.icBajo), icAlto: escalar(f.s.d.icAlto) },
            }))}
            unidad={escala.unidad}
            idioma={idioma}
            titulo={t('grafico', { etiquetas: filas.map((f) => f.nombre).join(', ') })}
          />
        </div>
        <div className="legend">
          {/* Con varias series, cada fila del gráfico ya lleva su nombre: el color no las distinguiría. */}
          {!varias && (
            <span>
              <i className="clave" />
              {primera.nombre}
            </span>
          )}
          <span>{t('leyenda')}</span>
        </div>
        <Tabla<FilaSerie>
          className="tabla-mediciones"
          titulo={t('tabla')}
          filas={filas}
          clave={(f) => `${filas.indexOf(f)}`}
          columnas={[
            { id: 'serie', titulo: '', celda: (f) => <b>{f.nombre}</b> },
            {
              id: 'mediana',
              titulo: t('columnas.mediana'),
              numerica: true,
              celda: (f) => fmt(f.s).conUnidad(f.s.d.mediana),
            },
            {
              id: 'ic',
              titulo: t('columnas.ic'),
              numerica: true,
              celda: (f) => {
                const ff = fmt(f.s);
                return f.s.d.n > 1 ? `${ff.numero(f.s.d.icBajo)} – ${ff.numero(f.s.d.icAlto)}` : '—';
              },
            },
            {
              id: 'cv',
              titulo: t('columnas.variacion'),
              numerica: true,
              celda: (f) => (f.s.d.n > 1 ? fmt(f.s).porcentaje(f.s.d.cv) : '—'),
            },
          ]}
        />
      </Tarjeta>

      {avisos.length > 0 && (
        <Detalles resumen={t('avisos')} recuento={avisos.length}>
          <Huecos>
            {avisos.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: los avisos son fijos y en su orden.
              <Hueco key={i}>{a}</Hueco>
            ))}
          </Huecos>
        </Detalles>
      )}

      <Detalles resumen={t('detalles')}>
        <dl className="kv">
          <dt>{t('formato')}</dt>
          <dd>{t(`formatos.${datos.formato}`)}</dd>
        </dl>
        {filas.map(({ nombre, s }, i) => {
          const f = fmt(s);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: dos series pueden llamarse igual; el orden es fijo.
            <div key={i}>
              {varias && (
                <p className="sm">
                  <b>{nombre}</b>
                </p>
              )}
              <dl className="kv">
                <dt>{t('estadisticos.media')}</dt>
                <dd className="mono">{f.conUnidad(s.d.media)}</dd>
                <dt>{t('estadisticos.desviacion')}</dt>
                <dd className="mono">{s.d.n > 1 ? f.conUnidad(s.d.desviacion) : '—'}</dd>
                <dt>{t('estadisticos.minimo')}</dt>
                <dd className="mono">{f.conUnidad(s.d.minimo)}</dd>
                <dt>{t('estadisticos.maximo')}</dt>
                <dd className="mono">{f.conUnidad(s.d.maximo)}</dd>
                <dt>{t('estadisticos.p5')}</dt>
                <dd className="mono">{f.conUnidad(s.d.p5)}</dd>
                <dt>{t('estadisticos.p95')}</dt>
                <dd className="mono">{f.conUnidad(s.d.p95)}</dd>
              </dl>
            </div>
          );
        })}
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
