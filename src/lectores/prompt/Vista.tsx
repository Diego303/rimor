/**
 * Vista del lector Prompt, como la pantalla de referencia: el texto con sus variables resaltadas; «Copiar con
 * valores» (una caja por variable, valores recordados en este navegador, copia al portapapeles o, si el navegador
 * no deja, el texto listo para seleccionarlo); los resultados plegados con su número y los detalles.
 */
import { isoConZona } from '@rimor/formato';
import { useContext, useEffect, useId, useMemo, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Hueco, Huecos, Tarjeta } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { ContextoVersionVista } from '../ContextoVersion';
import { CopiarConValores } from '../CopiarConValores';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { analizarPrompt, escrituraDe, sustituir, trozosDe } from './analisis';
import { type DatosPrompt, lectorPrompt } from './lector';
import {
  archivoResultado,
  baseResultado,
  conResultado,
  estrellas,
  type ResultadoPrompt,
  resultadosDe,
  valoracionMedia,
} from './resultados';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

interface PropsResultados {
  el: PropsVista<DatosPrompt>['el'];
  resultados: readonly ResultadoPrompt[];
  /** Se ha guardado uno: la lista lo enseña ya, sin esperar a que llegue el elemento releído. */
  alGuardar: (r: ResultadoPrompt) => void;
  editable: boolean;
  t: T;
}

function Resultados({ el, resultados, alGuardar, editable, t }: PropsResultados) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const avisos = useAvisosOpcional();
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [valoracion, setValoracion] = useState(0);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const nombreGrupo = useId();

  async function guardar() {
    if (!espacio || valoracion < 1) return;
    setGuardando(true);
    const fecha = isoConZona(new Date()).slice(0, 10);
    const ref = el.frontmatter.ref;
    const repo = espacio.repositorio;
    let archivo: string | null = null;
    try {
      archivo = await repo.guardarEnHistorial(
        baseResultado(ref, fecha),
        archivoResultado({ ref, fecha, valoracion, nota: nota.trim(), respuesta }),
      );
      const nuevo: ResultadoPrompt = { fecha, valoracion, nota: nota.trim(), archivo };
      const r = await repo.actualizarElemento(el.frontmatter.id, (actual) => ({
        ...actual,
        frontmatter: { ...conResultado(actual.frontmatter, nuevo), modificado: isoConZona(new Date()) },
      }));
      if (!r.ok) throw new Error(r.error.codigo);
      archivo = null;
      alGuardar(nuevo);
      setAbierto(false);
      setRespuesta('');
      setValoracion(0);
      setNota('');
      avisos?.avisar(t('resultadoGuardado'));
    } catch {
      // Si el elemento no se pudo actualizar, el archivo del resultado no queda huérfano en el historial.
      if (archivo) await repo.borrarDeHistorial(archivo).catch(() => undefined);
      avisos?.avisar(t('noGuardado'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Detalles resumen={t('resultados')} recuento={resultados.length}>
      {resultados.length ? (
        <Huecos>
          {resultados.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los resultados solo se añaden al final.
            <Hueco key={i} gravedad="resuelto">
              <span className="row">
                <b>
                  <span aria-hidden="true">{estrellas(r.valoracion)}</span>
                  <span className="solo-lector">{t('estrellas', { n: r.valoracion })}</span>
                </b>
                <span className="xs muted">{fmtDia(new Date(`${r.fecha}T12:00:00`), new Date(), idioma)}</span>
              </span>
              {r.nota && <span className="sm">{r.nota}</span>}
            </Hueco>
          ))}
        </Huecos>
      ) : (
        <p className="sm muted">{t('sinResultados')}</p>
      )}
      {editable &&
        !soloLectura &&
        espacio &&
        (abierto ? (
          <div className="nuevo-resultado">
            <label className="xs muted">
              {t('respuestaPegada')}
              <textarea rows={5} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
            </label>
            <fieldset className="valoracion">
              <legend className="xs muted">{t('valoracion')}</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} title={t('estrellas', { n })}>
                  <input
                    type="radio"
                    name={nombreGrupo}
                    value={n}
                    checked={valoracion === n}
                    onChange={() => setValoracion(n)}
                    aria-label={t('estrellas', { n })}
                  />
                  <span aria-hidden="true">{n <= valoracion ? '★' : '☆'}</span>
                </label>
              ))}
            </fieldset>
            <label className="xs muted">
              {t('nota')}
              <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
            <div className="row">
              <Boton variante="primario" pequeno disabled={valoracion < 1 || guardando} onClick={() => void guardar()}>
                {t('guardar')}
              </Boton>
              <Boton pequeno onClick={() => setAbierto(false)}>
                {t('cancelar')}
              </Boton>
            </div>
          </div>
        ) : (
          <div className="row">
            <Boton pequeno onClick={() => setAbierto(true)}>
              {t('anadirResultado')}
            </Boton>
          </div>
        ))}
    </Detalles>
  );
}

export default function VistaPrompt({ el, datos: datosActuales, editable = true }: PropsVista<DatosPrompt>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  // Otra versión elegida en la cabecera: su texto, y copiar con sus variables (sin restaurarla).
  const vista = useContext(ContextoVersionVista);
  const texto = vista?.original ?? el.original ?? '';
  const trozos = useMemo(() => trozosDe(texto), [texto]);
  const elVisto = useMemo(() => (vista ? { ...el, original: vista.original } : el), [el, vista]);
  // Sus variables y detalles, los de esa versión (se analiza aquí: es un texto corto y ya escrito).
  const datos = useMemo(() => (vista ? analizarPrompt(vista.original) : datosActuales), [datosActuales, vista]);
  const [resultados, setResultados] = useState(() => resultadosDe(el.frontmatter));
  // Cuando llega el elemento releído (o otro), manda lo que dice su frontmatter.
  useEffect(() => setResultados(resultadosDe(el.frontmatter)), [el.frontmatter]);
  // Las cifras citables son siempre las de la actual: es a lo que lleva citarlas (`{{PRM-0012.tokens}}`).
  const cifras = cifrasDe(lectorPrompt, datosActuales);
  const media = valoracionMedia(resultados);

  return (
    <>
      <Tarjeta>
        <pre className="code prompt-texto">
          {trozos.map((tr, i) =>
            tr.t === 'variable' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: los trozos del texto son fijos y en su orden.
              <span key={i} className="var">
                {tr.v}
              </span>
            ) : (
              tr.v
            ),
          )}
        </pre>
      </Tarjeta>

      {datos.variables.length > 0 && (
        <CopiarConValores
          ambito="prompt"
          idElemento={el.frontmatter.id}
          texto={elVisto.original ?? ''}
          huecos={datos.variables.map(escrituraDe)}
          sustituir={sustituir}
          textos={{
            titulo: t('copiarConValores'),
            copiar: t('copiar'),
            copiado: t('copiado'),
            noCopiado: t('noCopiado'),
            textoListo: t('textoListo'),
          }}
          pie={
            media !== null && (
              <span className="xs muted">
                {t('valoracionMedia', { media: fmtNumero(media, idioma, 1), n: resultados.length })}
              </span>
            )
          }
        />
      )}

      <Resultados
        el={el}
        resultados={resultados}
        alGuardar={(r) => setResultados((p) => [...p, r])}
        editable={editable}
        t={t}
      />

      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras}>
        <dt>{t('tokensAprox')}</dt>
        <dd>
          <span className="mono">{fmtNumero(datos.tokens, idioma)}</span>{' '}
          <span className="xs muted">({t('comoSeCuentan')})</span>
        </dd>
        <dt>{t('lineas')}</dt>
        <dd className="mono">{fmtNumero(datos.lineas, idioma)}</dd>
        <dt>{t('forma')}</dt>
        <dd>{t(`formas.${datos.forma}`)}</dd>
        {datos.destino && (
          <>
            <dt>{t('destino')}</dt>
            <dd>{datos.destino}</dd>
          </>
        )}
        <dt>{t('secciones')}</dt>
        <dd>{datos.secciones.length ? datos.secciones.join(' · ') : t('ninguna')}</dd>
      </DetallesElemento>
    </>
  );
}
