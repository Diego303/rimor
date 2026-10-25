/**
 * La consulta SQL de unos datos (IN-044, plegada como en `SC.tabla`): el editor CodeMirror (cargado al abrirla), la
 * tabla `datos` sobre el archivo, «Ejecutar» (o `Ctrl+Intro`, `⌘+Intro` en Mac), el resultado (hasta 200 filas) y
 * cuánto tardó. La primera vez, «DuckDB, solo la primera vez» con la señal `cargando`; después, `leyendo-datos`. Un
 * error de SQL se enseña tal cual. Cada ejecución va en su propia conexión: lo que haga la consulta (un `BEGIN`, un
 * `SET`, otra vista `datos`) no se queda para la siguiente ni toca la de otro elemento.
 */
import type { Elemento } from '@rimor/formato';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { Boton, Detalles } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
import { useEsperaVisible } from '../../ui/marca/useEsperaVisible';
import { ERROR_SIN_BYTES, valorLegible } from './lector';
import { type MotorSql, motorListo, obtenerMotor, type ResultadoSql } from './motor';
import { type FormatoDatos, lecturaDe, muestraCsv } from './perfil';
import { textos } from './textos';

const EditorSql = lazy(() => import('./EditorSql'));

/** La consulta con la que empieza el editor. */
export const CONSULTA_INICIAL = 'SELECT * FROM datos LIMIT 10';
/** Las filas del resultado que se pintan (y se convierten: el resto se cuenta). */
export const MAX_FILAS_RESULTADO = 200;

/** La tecla que acompaña a Intro: ⌘ en Mac, Ctrl en lo demás (CodeMirror usa la misma, `Mod-Enter`). */
export const teclaEjecutar = () => (/Mac|iPhone|iPad|iPod/.test(globalThis.navigator?.platform ?? '') ? '⌘' : 'Ctrl');

type Estado =
  | { fase: 'quieta' }
  | { fase: 'consultando'; primeraVez: boolean }
  | { fase: 'hecha'; resultado: ResultadoSql; ms: number }
  | { fase: 'error'; mensaje: string };

/** Un archivo registrado en el motor por esta consulta: con qué contenido. */
interface Registrado {
  motor: MotorSql;
  archivo: string;
  hash: string;
}

let secuencia = 0;

export function ConsultaSql({ el, formato }: { el: Elemento; formato: FormatoDatos }) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as (c: string, v?: Record<string, string | number>) => string;
  const espacio = useEspacioOpcional();
  const [abierta, setAbierta] = useState(false);
  const [sql, setSql] = useState(CONSULTA_INICIAL);
  const [estado, setEstado] = useState<Estado>({ fase: 'quieta' });
  const espera = useEsperaVisible(estado.fase === 'consultando');
  const registrado = useRef<Registrado | null>(null);
  // Una ejecución a la vez (el atajo del editor no mira si el botón está desactivado).
  const enMarcha = useRef(false);
  const montada = useRef(true);

  // El archivo se suelta del motor al salir (no se queda en memoria mientras dure la pestaña).
  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      const r = registrado.current;
      registrado.current = null;
      if (r) void r.motor.quitar(r.archivo).catch(() => undefined);
    };
  }, []);

  /** El archivo de este elemento en el motor: se registra la primera vez y otra vez si su contenido cambió. */
  async function archivoEn(motor: MotorSql): Promise<string> {
    const hash = el.frontmatter.hash;
    const previo = registrado.current;
    if (previo && previo.hash === hash) return previo.archivo;
    const ruta = el.frontmatter.adjunto?.ruta;
    const adjunto = el.original === null && ruta && espacio ? await espacio.repositorio.leerAdjunto(ruta) : null;
    // Un CSV de Excel (Windows-1252, UTF-16) se pasa a UTF-8, entero: la consulta es sobre todo el archivo.
    const bytes =
      el.original !== null
        ? new TextEncoder().encode(el.original)
        : adjunto && formato !== 'parquet'
          ? muestraCsv(adjunto, Number.POSITIVE_INFINITY).datos
          : adjunto;
    if (!bytes) throw new Error(ERROR_SIN_BYTES);
    const archivo = `rimor_consulta_${secuencia++}.${formato === 'parquet' ? 'parquet' : 'csv'}`;
    await motor.registrar(archivo, bytes);
    if (previo) await motor.quitar(previo.archivo).catch(() => undefined);
    // Si se desmontó mientras tanto, nadie lo soltaría: se suelta al acabar la consulta (`soltarSiDesmontada`).
    registrado.current = { motor, archivo, hash };
    return archivo;
  }

  function soltarSiDesmontada() {
    const r = registrado.current;
    if (montada.current || !r) return;
    registrado.current = null;
    void r.motor.quitar(r.archivo).catch(() => undefined);
  }

  async function ejecutar() {
    if (enMarcha.current) return;
    enMarcha.current = true;
    try {
      await consultar();
    } finally {
      enMarcha.current = false;
      soltarSiDesmontada();
    }
  }

  async function consultar() {
    setEstado({ fase: 'consultando', primeraVez: !motorListo() });
    let motor: MotorSql;
    try {
      motor = await obtenerMotor();
    } catch {
      setEstado({ fase: 'error', mensaje: t('errorMotor') });
      return;
    }
    try {
      const archivo = await archivoEn(motor);
      const sesion = await motor.sesion();
      try {
        await sesion.consultar(`CREATE TEMP VIEW datos AS SELECT * FROM ${lecturaDe(archivo, formato)}`);
        const inicio = performance.now();
        const resultado = await sesion.consultar(sql, { maxFilas: MAX_FILAS_RESULTADO });
        setEstado({ fase: 'hecha', resultado, ms: Math.round(performance.now() - inicio) });
      } finally {
        await sesion.cerrar().catch(() => undefined);
      }
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      setEstado({ fase: 'error', mensaje: mensaje === ERROR_SIN_BYTES ? t('errorSinBytes') : mensaje });
    }
  }

  const consultando = estado.fase === 'consultando';
  const total = estado.fase === 'hecha' ? (estado.resultado.total ?? estado.resultado.filas.length) : 0;
  return (
    <Detalles resumen={t('consulta')} alAlternar={setAbierta}>
      {abierta && (
        <Suspense
          fallback={<textarea className="editor-sql-reserva" aria-label={t('editor')} value={sql} readOnly rows={3} />}
        >
          <EditorSql valor={sql} alCambiar={setSql} alEjecutar={() => void ejecutar()} etiqueta={t('editor')} />
        </Suspense>
      )}
      <p className="xs muted">{t('consultaAyuda', { tecla: teclaEjecutar() })}</p>
      <div className="row">
        <Boton variante="primario" pequeno disabled={consultando} onClick={() => void ejecutar()}>
          {t('ejecutar')}
        </Boton>
        {/* La región viva dice cuándo empieza, cómo acaba (las filas) o el error. */}
        <span className="row inline sm" role="status">
          {consultando && espera && (
            <>
              <Senal estado={estado.primeraVez ? 'cargando' : 'leyendo-datos'} decorativa etiqueta="" />
              {estado.primeraVez ? t('primeraVez') : t('consultando')}
            </>
          )}
          {estado.fase === 'hecha' && <span className="solo-lector">{t('resultadoListo', { n: total })}</span>}
          {estado.fase === 'error' && <span className="warn-texto">{t('errorSql', { mensaje: estado.mensaje })}</span>}
        </span>
      </div>
      {estado.fase === 'hecha' && (
        <>
          <div className="tbl-wrap">
            <table className="tabla-resultado">
              <thead>
                <tr>
                  {estado.resultado.columnas.map((c, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: dos columnas pueden llamarse igual.
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estado.resultado.filas.map((fila, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: las filas de un resultado son fijas y en su orden.
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
          <p className="xs muted">
            {t('filasResultado', { n: total })} · {t('enNavegador', { ms: estado.ms })}
            {total > estado.resultado.filas.length && ` · ${t('recortado', { n: estado.resultado.filas.length })}`}
          </p>
        </>
      )}
    </Detalles>
  );
}
