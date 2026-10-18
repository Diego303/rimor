/**
 * Gráfico de puntos de una o varias series (LEC-06), como `benchSVG` de la pantalla de referencia: una fila por
 * serie con sus valores (con un pequeño temblor vertical, determinista), la banda del IC 95 % de la mediana y la
 * línea de la mediana; eje con marcas «bonitas» y la unidad arriba a la derecha. Lo reutiliza la comparación.
 */
import type { Descriptiva } from '@rimor/estadistica';
import { fmtNumero, type Idioma } from '../../i18n/formatos';

export interface FilaGrafico {
  etiqueta: string;
  valores: readonly number[];
  d: Pick<Descriptiva, 'mediana' | 'icBajo' | 'icAlto'>;
  /** `clave` (la serie que importa) o `referencia` (la de antes, en gris). */
  tono?: 'clave' | 'referencia';
}

interface PropsGrafico {
  filas: readonly FilaGrafico[];
  unidad: string;
  idioma: Idioma;
  /** Para el lector de pantalla. */
  titulo: string;
}

const ANCHO = 720;
const IZQUIERDA = 70;
const DERECHA = 18;
/** Separación entre filas y margen para el eje, como en la referencia (160 de alto con dos filas). */
const ALTO_FILA = 51;
const ALTO_EJE = 58;
const LARGO_ETIQUETA = 9;

/** Paso «bonito» (1, 2 o 5 × 10ⁿ) cercano a `x`. */
export function pasoBonito(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const e = 10 ** Math.floor(Math.log10(x));
  const f = x / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}

/** Las marcas del eje entre `mn` y `mx`, de `paso` en `paso` (sin acumular errores de coma flotante). */
export function marcasEje(mn: number, mx: number, paso: number): number[] {
  const marcas: number[] = [];
  for (let k = Math.ceil(mn / paso); k * paso <= mx; k++) marcas.push(k * paso);
  return marcas;
}

/** Desplazamiento vertical del punto `i`, entre −8 y 8: el de la referencia. */
const temblor = (i: number) => (((i * 37) % 13) / 13 - 0.5) * 16;

const corta = (s: string) => (s.length > LARGO_ETIQUETA ? `${s.slice(0, LARGO_ETIQUETA - 1)}…` : s);

export function GraficoPuntos({ filas, unidad, idioma, titulo }: PropsGrafico) {
  const todos = filas.flatMap((f) => f.valores).filter(Number.isFinite);
  if (!todos.length) return null;
  let mn = Math.min(...todos);
  let mx = Math.max(...todos);
  // Un 8 % de aire a cada lado; si todos los valores son iguales, un 5 % del valor (o 1).
  const aire = mx > mn ? (mx - mn) * 0.08 : Math.abs(mn) * 0.05 || 1;
  mn -= aire;
  mx += aire;
  const alto = ALTO_FILA * filas.length + ALTO_EJE;
  const x = (v: number) => IZQUIERDA + ((v - mn) / (mx - mn)) * (ANCHO - IZQUIERDA - DERECHA);
  const paso = pasoBonito((mx - mn) / 5);
  const decimales = Math.max(0, -Math.floor(Math.log10(paso)));

  return (
    <svg viewBox={`0 0 ${ANCHO} ${alto}`} width="100%" className="grafico-puntos" role="img" aria-label={titulo}>
      {marcasEje(mn, mx, paso).map((t) => (
        <g key={t} className="gp-eje">
          <line x1={x(t)} x2={x(t)} y1={12} y2={alto - 26} />
          <text x={x(t)} y={alto - 9} textAnchor="middle">
            {fmtNumero(t, idioma, decimales)}
          </text>
        </g>
      ))}
      {filas.map((f, fila) => {
        const y = ALTO_FILA * (fila + 1);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: las filas son fijas y dos series pueden llamarse igual.
          <g key={fila} className={`gp-serie ${f.tono === 'referencia' ? 'referencia' : 'clave'}`}>
            <text x={IZQUIERDA - 10} y={y + 4} textAnchor="end" className="gp-etiqueta">
              {f.etiqueta.length > LARGO_ETIQUETA && <title>{f.etiqueta}</title>}
              {corta(f.etiqueta)}
            </text>
            {Number.isFinite(f.d.icBajo) && Number.isFinite(f.d.icAlto) && (
              <rect
                className="gp-banda"
                x={x(f.d.icBajo)}
                y={y - 15}
                width={Math.max(2, x(f.d.icAlto) - x(f.d.icBajo))}
                height={30}
                rx={4}
              />
            )}
            {f.valores.map((v, i) =>
              Number.isFinite(v) ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: el orden de las medidas es fijo.
                <circle key={i} cx={x(v)} cy={y + temblor(i)} r={3.4} />
              ) : null,
            )}
            {Number.isFinite(f.d.mediana) && (
              <line className="gp-mediana" x1={x(f.d.mediana)} x2={x(f.d.mediana)} y1={y - 19} y2={y + 19} />
            )}
          </g>
        );
      })}
      <text x={ANCHO - DERECHA} y={10} textAnchor="end" className="gp-unidad">
        {unidad}
      </text>
    </svg>
  );
}
