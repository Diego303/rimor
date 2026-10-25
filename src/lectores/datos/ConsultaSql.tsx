/**
 * La consulta SQL de unos datos (IN-044, plegada como en `SC.tabla`): el editor CodeMirror (cargado al abrirla), la
 * tabla `datos` sobre el archivo, «Ejecutar» (o `Ctrl+Intro`), el resultado (hasta 200 filas) y cuánto tardó. La
 * primera vez, «DuckDB, solo la primera vez» con la señal `cargando`; después, `leyendo-datos`. Un error de SQL se
 * enseña tal cual.
 */
import type { Elemento } from '@rimor/formato';
import { lazy, Suspense, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { Boton, Detalles } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
import { useEsperaVisible } from '../../ui/marca/useEsperaVisible';
import { valorLegible } from './lector';
import { motorListo, obtenerMotor, type ResultadoSql } from './motor';
import { type FormatoDatos, lecturaDe } from './perfil';
import { textos } from './textos';

const EditorSql = lazy(() => import('./EditorSql'));

/** La consulta con la que empieza el editor. */
export const CONSULTA_INICIAL = 'SELECT * FROM datos LIMIT 10';
/** Las filas del resultado que se pintan. */
export const MAX_FILAS_RESULTADO = 200;

type Estado =
  | { fase: 'quieta' }
  | { fase: 'consultando'; primeraVez: boolean }
  | { fase: 'hecha'; resultado: ResultadoSql; ms: number }
  | { fase: 'error'; mensaje: string };

/** Los archivos ya registrados en el motor de este hilo (por elemento y contenido): no se vuelven a copiar. */
const registrados = new Set<string>();

export function ConsultaSql({ el, formato }: { el: Elemento; formato: FormatoDatos }) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as (c: string, v?: Record<string, string | number>) => string;
  const espacio = useEspacioOpcional();
  const [abierta, setAbierta] = useState(false);
  const [sql, setSql] = useState(CONSULTA_INICIAL);
  const [estado, setEstado] = useState<Estado>({ fase: 'quieta' });
  const espera = useEsperaVisible(estado.fase === 'consultando');

  async function ejecutar() {
    if (estado.fase === 'consultando') return;
    setEstado({ fase: 'consultando', primeraVez: !motorListo() });
    try {
      const motor = await obtenerMotor();
      const archivo = `rimor_consulta_${el.frontmatter.id}.${formato === 'parquet' ? 'parquet' : 'csv'}`;
      const clave = `${archivo}|${el.frontmatter.hash}`;
      if (!registrados.has(clave)) {
        const ruta = el.frontmatter.adjunto?.ruta;
        const bytes =
          el.original !== null
            ? new TextEncoder().encode(el.original)
            : ruta && espacio
              ? await espacio.repositorio.leerAdjunto(ruta)
              : null;
        if (!bytes) throw new Error('datos.sinBytes');
        await motor.registrar(archivo, bytes);
        registrados.add(clave);
      }
      await motor.consultar(`CREATE OR REPLACE TEMP VIEW datos AS SELECT * FROM ${lecturaDe(archivo, formato)}`);
      const inicio = performance.now();
      const resultado = await motor.consultar(sql);
      setEstado({ fase: 'hecha', resultado, ms: Math.round(performance.now() - inicio) });
    } catch (e) {
      setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) });
    }
  }

  const consultando = estado.fase === 'consultando';
  return (
    <Detalles resumen={t('consulta')} alAlternar={setAbierta}>
      {abierta && (
        <Suspense
          fallback={<textarea className="editor-sql-reserva" aria-label={t('editor')} value={sql} readOnly rows={3} />}
        >
          <EditorSql valor={sql} alCambiar={setSql} alEjecutar={() => void ejecutar()} etiqueta={t('editor')} />
        </Suspense>
      )}
      <p className="xs muted">{t('consultaAyuda')}</p>
      <div className="row">
        <Boton variante="primario" pequeno disabled={consultando} onClick={() => void ejecutar()}>
          {t('ejecutar')}
        </Boton>
        <span className="row inline sm" role="status">
          {consultando && espera && (
            <>
              <Senal estado={estado.primeraVez ? 'cargando' : 'leyendo-datos'} decorativa etiqueta="" />
              {estado.primeraVez ? t('primeraVez') : t('consultando')}
            </>
          )}
          {estado.fase === 'error' && <span className="warn-texto">{t('errorSql', { mensaje: estado.mensaje })}</span>}
        </span>
      </div>
      {estado.fase === 'hecha' && (
        <>
          <div className="tbl-wrap">
            <table className="tabla-resultado">
              <thead>
                <tr>
                  {estado.resultado.columnas.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estado.resultado.filas.slice(0, MAX_FILAS_RESULTADO).map((fila, i) => (
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
            {t('filasResultado', { n: estado.resultado.filas.length })} · {t('enNavegador', { ms: estado.ms })}
            {estado.resultado.filas.length > MAX_FILAS_RESULTADO && ` · ${t('recortado', { n: MAX_FILAS_RESULTADO })}`}
          </p>
        </>
      )}
    </Detalles>
  );
}
