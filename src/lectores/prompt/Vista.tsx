/**
 * Vista del lector Prompt, como la pantalla de referencia: el texto con sus variables resaltadas; «Copiar con
 * valores» (una caja por variable, valores recordados en este navegador, copia al portapapeles o, si el navegador
 * no deja, el texto listo para seleccionarlo); los resultados plegados con su número y los detalles.
 */
import { isoConZona } from '@rimor/formato';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Hueco, Huecos, Tarjeta } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { escrituraDe, sustituir, trozosDe } from './analisis';
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

/** Clave de los valores recordados de un prompt: de este navegador y de este espacio. */
const claveValores = (espacio: string, id: string) => `rimor:${espacio}:prompt:${id}`;

function leerValores(clave: string): Record<string, string> {
  try {
    const guardado = JSON.parse(globalThis.localStorage?.getItem(clave) ?? '{}') as unknown;
    if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return {};
    return Object.fromEntries(Object.entries(guardado).filter(([, v]) => typeof v === 'string')) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function guardarValores(clave: string, valores: Record<string, string>): void {
  try {
    const conAlgo = Object.fromEntries(Object.entries(valores).filter(([, v]) => v));
    if (Object.keys(conAlgo).length) globalThis.localStorage?.setItem(clave, JSON.stringify(conAlgo));
    else globalThis.localStorage?.removeItem(clave);
  } catch {
    // Sin almacenamiento del navegador (ventana privada estricta): los valores duran lo que la vista.
  }
}

/** Copia al portapapeles; `false` si el navegador no deja (sin permiso, sin contexto seguro, sin API). */
async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) return false;
    await globalThis.navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function CopiarConValores({
  el,
  datos,
  resultados,
  t,
}: PropsVista<DatosPrompt> & { resultados: readonly ResultadoPrompt[]; t: T }) {
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const clave = claveValores(espacio?.manifest.espacio.id ?? 'local', el.frontmatter.id);
  const [valores, setValores] = useState<Record<string, string>>(() => leerValores(clave));
  // `vez` cambia en cada intento: si vuelve a fallar con el mismo texto, se vuelve a seleccionar.
  const [listo, setListo] = useState<{ texto: string; vez: number } | null>(null);
  const areaLista = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => setValores(leerValores(clave)), [clave]);
  // Si el navegador no dejó copiar, el texto queda seleccionado para Ctrl+C.
  useEffect(() => {
    if (listo !== null) areaLista.current?.select();
  }, [listo]);

  function cambiar(variable: string, valor: string) {
    const nuevos = { ...valores, [variable]: valor };
    setValores(nuevos);
    guardarValores(clave, nuevos);
    setListo(null);
  }

  async function copiar() {
    const texto = sustituir(el.original ?? '', valores);
    void espacio?.contadores.contar('copiasConValores').catch(() => undefined);
    if (await copiarAlPortapapeles(texto)) {
      setListo(null);
      avisos?.avisar(t('copiado'));
    } else setListo((previo) => ({ texto, vez: (previo?.vez ?? 0) + 1 }));
  }

  const media = valoracionMedia(resultados);
  const { idioma } = useT();

  return (
    <Tarjeta titulo={t('copiarConValores')}>
      <div className="g3">
        {datos.variables.map((v, i) => {
          const escrita = escrituraDe(v);
          return (
            <label key={escrita} className="xs muted campo-variable" htmlFor={`${id}-${i}`}>
              {escrita}
              <input
                id={`${id}-${i}`}
                type="text"
                value={valores[escrita] ?? ''}
                onChange={(e) => cambiar(escrita, e.target.value)}
              />
            </label>
          );
        })}
      </div>
      <div className="row">
        <Boton variante="primario" pequeno onClick={() => void copiar()}>
          {t('copiar')}
        </Boton>
        {media !== null && (
          <span className="xs muted">
            {t('valoracionMedia', { media: fmtNumero(media, idioma, 1), n: resultados.length })}
          </span>
        )}
      </div>
      {listo !== null && (
        <div className="copia-manual">
          <p className="xs muted" role="status">
            {t('noCopiado')}
          </p>
          <textarea ref={areaLista} readOnly rows={6} aria-label={t('textoListo')} value={listo.texto} />
        </div>
      )}
    </Tarjeta>
  );
}

interface PropsResultados {
  el: PropsVista<DatosPrompt>['el'];
  resultados: readonly ResultadoPrompt[];
  /** Se ha guardado uno: la lista lo enseña ya, sin esperar a que llegue el elemento releído. */
  alGuardar: (r: ResultadoPrompt) => void;
  t: T;
}

function Resultados({ el, resultados, alGuardar, t }: PropsResultados) {
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
      {!soloLectura &&
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

export default function VistaPrompt({ el, datos }: PropsVista<DatosPrompt>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const trozos = useMemo(() => trozosDe(el.original ?? ''), [el.original]);
  const [resultados, setResultados] = useState(() => resultadosDe(el.frontmatter));
  // Cuando llega el elemento releído (o otro), manda lo que dice su frontmatter.
  useEffect(() => setResultados(resultadosDe(el.frontmatter)), [el.frontmatter]);
  const cifras = cifrasDe(lectorPrompt, datos);

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

      {datos.variables.length > 0 && <CopiarConValores el={el} datos={datos} resultados={resultados} t={t} />}

      <Resultados el={el} resultados={resultados} alGuardar={(r) => setResultados((p) => [...p, r])} t={t} />

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
