/**
 * Comparación de mediciones, como `SC.medic` de la referencia: un veredicto claro (cambio de la mediana y si es
 * significativo), el gráfico de las dos series con su leyenda, la tabla de dos filas y los avisos de método
 * plegados con su número.
 */

import type { ComparacionMediciones } from '../../comparaciones/mediciones';
import { type ResultadoMediciones, textoCambio } from '../../comparaciones/resultado';
import { fmtCifra, fmtP } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { textoAviso } from '../../lectores/mediciones/avisos';
import { GraficoPuntos } from '../../lectores/mediciones/GraficoPuntos';
import { escalaDe, formatosDe, type SerieDerivada } from '../../lectores/mediciones/lector';
import { textos as textosMediciones } from '../../lectores/mediciones/textos';
import { Detalles, Hueco, Huecos, Tabla, Tarjeta, Veredicto } from '../../ui/componentes';

interface Props {
  c: ComparacionMediciones;
  /** Cómo se llama cada serie (su etiqueta o el título de su elemento). */
  nombres: [string, string];
}

interface Fila {
  nombre: string;
  s: SerieDerivada;
}

/** Lo que hace falta para el veredicto: del cálculo de ahora o del resultado guardado. */
type DatosVeredicto = Pick<ResultadoMediciones, 'cambio' | 'p' | 'significativo' | 'sentido' | 'n_a' | 'n_b'>;

/**
 * El veredicto, como la referencia: «−4,5 %», «ureq es un 4,5 % más rápido» y «Diferencia significativa ·
 * Mann-Whitney, p < 0,001 · 20 repeticiones cada uno». Son tiempos: que baje es ir más rápido.
 */
export function VeredictoMediciones({ r, nombre }: { r: DatosVeredicto; nombre: string }) {
  const { t, idioma } = useT();
  const claro = r.significativo && r.cambio !== null;
  const repeticiones =
    r.n_a === r.n_b
      ? t('pantallas.comparacion.mediciones.cadaUno', { n: r.n_a })
      : t('pantallas.comparacion.mediciones.distintas', { a: r.n_a, b: r.n_b });
  return (
    <Veredicto
      tono={r.significativo ? (r.sentido === 'baja' ? 'ok' : 'bad') : 'warn'}
      cifra={claro ? textoCambio(r.cambio, idioma) : '≈'}
      frase={
        claro
          ? t(
              r.sentido === 'baja'
                ? 'pantallas.comparacion.mediciones.masRapido'
                : 'pantallas.comparacion.mediciones.masLento',
              { nombre, cambio: fmtCifra(Math.abs(r.cambio ?? 0), 1, '%', idioma) },
            )
          : t('pantallas.comparacion.mediciones.sinDiferencia')
      }
      explicacion={t('pantallas.comparacion.mediciones.explicacion', {
        sig: t(
          r.significativo
            ? 'pantallas.comparacion.mediciones.significativa'
            : 'pantallas.comparacion.mediciones.noSignificativa',
        ),
        p: r.p === null ? '—' : fmtP(r.p, idioma),
        repeticiones,
      })}
    />
  );
}

/**
 * Cuánto cambia según Hodges-Lehmann, dicho como «B frente a A» (B − A), con su intervalo del 95 % si hay
 * mediciones para darlo (IN-047).
 */
function DiferenciaHl({ c, nombres: [a, b] }: { c: ComparacionMediciones; nombres: [string, string] }) {
  const { t, idioma } = useT();
  const { hl } = c.resultado;
  if (!Number.isFinite(hl.estimacion)) return null;
  const f = formatosDe(c.b, idioma, escalaDe([c.a, c.b]));
  const diferencia = f.conUnidad(hl.estimacion);
  return (
    <p className="sm muted">
      {Number.isFinite(hl.icBajo) && Number.isFinite(hl.icAlto)
        ? t('pantallas.comparacion.mediciones.hodgesLehmann', {
            a,
            b,
            diferencia,
            bajo: f.numero(hl.icBajo),
            alto: f.numero(hl.icAlto),
          })
        : t('pantallas.comparacion.mediciones.hodgesLehmannSinIc', { a, b, diferencia })}
    </p>
  );
}

export function VistaComparacionMediciones({ c, nombres }: Props) {
  const { t, idioma } = useT();
  const tm = (clave: 'leyenda' | 'columnas.mediana' | 'columnas.ic' | 'columnas.variacion') =>
    textosMediciones.t(idioma, clave);
  const [na, nb] = nombres;
  const filas: Fila[] = [
    { nombre: na, s: c.a },
    { nombre: nb, s: c.b },
  ];
  // Una sola escala para las dos (µs o ns si son de menos de 1 ms).
  const escala = escalaDe([c.a, c.b]);
  const fmt = (s: SerieDerivada) => formatosDe(s, idioma, escala);
  const r = c.resultado;
  const escalar = (v: number) => v * escala.factor;
  // Son tiempos: que baje es ir más rápido.
  const avisos = [
    ...filas.flatMap(({ nombre, s }) => s.avisos.map((a) => `${nombre}: ${textoAviso(a, s, escala, idioma)}`)),
    t('pantallas.comparacion.mediciones.mismaMaquina'),
    t('pantallas.comparacion.mediciones.antesDeMedir'),
  ];

  return (
    <>
      <Tarjeta>
        <VeredictoMediciones
          r={{ ...r, cambio: Number.isFinite(r.cambio) ? r.cambio : null, n_a: c.a.d.n, n_b: c.b.d.n }}
          nombre={nb}
        />
        <div className="tbl-wrap">
          <GraficoPuntos
            filas={filas.map((f, i) => ({
              etiqueta: f.nombre,
              valores: f.s.valores.map(escalar),
              d: { mediana: escalar(f.s.d.mediana), icBajo: escalar(f.s.d.icBajo), icAlto: escalar(f.s.d.icAlto) },
              tono: i === 0 ? 'referencia' : 'clave',
            }))}
            unidad={escala.unidad}
            idioma={idioma}
            titulo={t('pantallas.comparacion.mediciones.grafico', { a: na, b: nb })}
          />
        </div>
        <div className="legend">
          <span>
            <i className="referencia" />
            {na}
          </span>
          <span>
            <i className="clave" />
            {nb}
          </span>
          <span>{tm('leyenda')}</span>
        </div>
        <Tabla<Fila>
          className="tabla-mediciones"
          titulo={t('pantallas.comparacion.mediciones.tabla')}
          filas={filas}
          clave={(f) => String(filas.indexOf(f))}
          columnas={[
            { id: 'serie', titulo: '', celda: (f) => <b>{f.nombre}</b> },
            {
              id: 'mediana',
              titulo: tm('columnas.mediana'),
              numerica: true,
              celda: (f) => fmt(f.s).conUnidad(f.s.d.mediana),
            },
            {
              id: 'ic',
              titulo: tm('columnas.ic'),
              numerica: true,
              celda: (f) => (f.s.d.n > 1 ? `${fmt(f.s).numero(f.s.d.icBajo)} – ${fmt(f.s).numero(f.s.d.icAlto)}` : '—'),
            },
            {
              id: 'cv',
              titulo: tm('columnas.variacion'),
              numerica: true,
              celda: (f) => (f.s.d.n > 1 ? fmt(f.s).porcentaje(f.s.d.cv) : '—'),
            },
          ]}
        />
        <DiferenciaHl c={c} nombres={nombres} />
      </Tarjeta>
      <Detalles resumen={t('pantallas.comparacion.mediciones.avisos')} recuento={avisos.length}>
        <Huecos>
          {avisos.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los avisos son fijos y en su orden.
            <Hueco key={i}>{a}</Hueco>
          ))}
        </Huecos>
      </Detalles>
    </>
  );
}
