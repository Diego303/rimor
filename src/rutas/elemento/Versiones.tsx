/**
 * Versiones de un elemento en su pantalla (IN-029, CMP-02 y DAT-08): «Cambios de la versión 1 a la 2» con el diff
 * por líneas, como la referencia, y «Versiones (N)» con cada copia del historial, su diff con la actual y
 * «Restaurar esta versión» (con confirmación y la señal «guardado» al hacerlo).
 */
import type { Elemento } from '@rimor/formato';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { VersionGuardada } from '../../almacen/repositorio';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { fmtFecha } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Dialogo } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
import { diffLineas, plegar } from '../../versiones/diff';

/**
 * Las copias del historial del elemento, releídas cuando el elemento cambia; mientras se releen, las de antes (la
 * lista no se desmonta ni se cierra al restaurar). `null` solo hasta la primera lectura.
 */
export function useVersiones(el: Elemento): VersionGuardada[] | null {
  const espacio = useEspacioOpcional();
  const fm = el.frontmatter;
  const [lista, setLista] = useState<{ clave: string; versiones: VersionGuardada[] } | null>(null);
  // Otro elemento (navegar de uno a otro): sus versiones, no las del anterior.
  if (lista && !lista.clave.startsWith(`${fm.id}|`)) setLista(null);
  const clave = `${fm.id}|${fm.modificado}|${fm.version ?? 1}`;
  useEffect(() => {
    if (!espacio) return undefined;
    let vigente = true;
    void espacio.repositorio
      .versiones(fm.id)
      .then((versiones) => vigente && setLista({ clave, versiones }))
      .catch(() => vigente && setLista({ clave, versiones: [] }));
    return () => {
      vigente = false;
    };
  }, [espacio, fm.id, clave]);
  return lista?.versiones ?? null;
}

/** La versión de contenido anterior a la actual (la copia más reciente con la versión de antes), si la hay. */
export const anteriorDe = (el: Elemento, versiones: readonly VersionGuardada[] | null): VersionGuardada | null =>
  versiones?.find((v) => v.version === (el.frontmatter.version ?? 1) - 1 && v.elemento.original !== null) ?? null;

/** El diff por líneas pintado como la referencia, con lo igual plegado. */
export function DiffLineas({ antigua, nueva }: { antigua: string; nueva: string }) {
  const { t } = useT();
  const tramos = useMemo(() => plegar(diffLineas(antigua, nueva)), [antigua, nueva]);
  return (
    <div className="diff">
      {tramos.flatMap((tramo, i) =>
        tramo.t === 'plegado' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: los tramos del diff son fijos y en su orden.
          <div key={i} className="s">
            {t('pantallas.elemento.versiones.iguales', { n: tramo.n })}
          </div>
        ) : (
          tramo.ops.map((op, j) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: las líneas del diff son fijas y en su orden.
              key={`${i}-${j}`}
              className={op.t === '+' ? 'a' : op.t === '-' ? 'r' : undefined}
            >
              {op.t === '+' ? '+ ' : op.t === '-' ? '− ' : '  '}
              {op.texto || ' '}
            </div>
          ))
        ),
      )}
    </div>
  );
}

/** «Cambios de la versión 1 a la 2»: entre la versión de contenido anterior y la actual. */
export function CambiosDeVersion({ el, anterior }: { el: Elemento; anterior: VersionGuardada }) {
  const { t } = useT();
  if (el.original === null || anterior.elemento.original === null) return null;
  return (
    <Detalles
      resumen={t('pantallas.elemento.versiones.cambios', { de: anterior.version, a: el.frontmatter.version ?? 1 })}
    >
      <DiffLineas antigua={anterior.elemento.original} nueva={el.original} />
    </Detalles>
  );
}

interface PropsLista {
  el: Elemento;
  versiones: readonly VersionGuardada[];
  editable: boolean;
  /** Restaura una copia; devuelve la versión que queda, o `null` si no se pudo. */
  alRestaurar: (v: VersionGuardada) => Promise<number | null>;
}

/** «Versiones (N)»: la actual y cada copia del historial, con su diff con la actual y «Restaurar esta versión». */
export function ListaVersiones({ el, versiones, editable, alRestaurar }: PropsLista) {
  const { t, idioma } = useT();
  const [viendo, setViendo] = useState<VersionGuardada | null>(null);
  const [restaurando, setRestaurando] = useState<VersionGuardada | null>(null);
  const [hecha, setHecha] = useState<number | null>(null);
  const fm = el.frontmatter;
  // La señal «guardado» se ve un momento al restaurar.
  useEffect(() => {
    if (hecha === null) return undefined;
    const id = setTimeout(() => setHecha(null), 2500);
    return () => clearTimeout(id);
  }, [hecha]);
  if (!versiones.length) return null;

  const nombre = (v: VersionGuardada) =>
    v.motivo === 'edicion'
      ? t('pantallas.elemento.versiones.edicion', { n: v.version })
      : t('pantallas.elemento.versiones.version', { n: v.version });

  async function confirmar() {
    const v = restaurando;
    setRestaurando(null);
    if (!v) return;
    const version = await alRestaurar(v);
    if (version !== null) setHecha(version);
  }

  return (
    <Detalles resumen={t('pantallas.elemento.versiones.titulo')}>
      {hecha !== null && (
        <Senal estado="guardado" veces={1} etiqueta={t('pantallas.elemento.versiones.restaurada', { n: hecha })} />
      )}
      <dl className="kv lista-versiones">
        <dt>{t('pantallas.elemento.versiones.version', { n: fm.version ?? 1 })}</dt>
        <dd>
          {fmtFecha(new Date(fm.modificado), idioma)} · {t('pantallas.elemento.versiones.actual')}
        </dd>
        {versiones.map((v) => (
          <Fragment key={v.ruta}>
            <dt>{nombre(v)}</dt>
            <dd>
              {fmtFecha(new Date(v.elemento.frontmatter.modificado), idioma)}{' '}
              <Boton
                variante="fantasma"
                pequeno
                aria-label={t('pantallas.elemento.versiones.verCambiosDe', { version: nombre(v) })}
                onClick={() => setViendo(v)}
              >
                {t('pantallas.elemento.versiones.verCambios')}
              </Boton>
              {editable && (
                <Boton
                  variante="fantasma"
                  pequeno
                  aria-label={t('pantallas.elemento.versiones.restaurarDe', { version: nombre(v) })}
                  onClick={() => setRestaurando(v)}
                >
                  {t('pantallas.elemento.versiones.restaurar')}
                </Boton>
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
      <Dialogo
        abierto={viendo !== null}
        alCerrar={() => setViendo(null)}
        titulo={
          viendo
            ? t('pantallas.elemento.versiones.cambiosDesde', { version: nombre(viendo) })
            : t('pantallas.elemento.versiones.titulo')
        }
      >
        {viendo && <CambiosCon el={el} v={viendo} />}
        <div className="row">
          <Boton pequeno onClick={() => setViendo(null)}>
            {t('pantallas.elemento.cerrar')}
          </Boton>
        </div>
      </Dialogo>
      <Dialogo
        abierto={restaurando !== null}
        alCerrar={() => setRestaurando(null)}
        titulo={t('pantallas.elemento.versiones.restaurarTitulo', { version: restaurando ? nombre(restaurando) : '' })}
      >
        <p className="sm">{t('pantallas.elemento.versiones.restaurarTexto')}</p>
        <div className="row">
          <Boton variante="primario" pequeno onClick={() => void confirmar()}>
            {t('pantallas.elemento.versiones.restaurar')}
          </Boton>
          <Boton pequeno onClick={() => setRestaurando(null)}>
            {t('pantallas.inicio.cancelar')}
          </Boton>
        </div>
      </Dialogo>
    </Detalles>
  );
}

/** Lo que cambia de una copia a la actual: el original, el título y las notas. */
function CambiosCon({ el, v }: { el: Elemento; v: VersionGuardada }) {
  const { t } = useT();
  const antes = v.elemento;
  const original = antes.original !== el.original;
  const titulo = antes.frontmatter.titulo !== el.frontmatter.titulo;
  const notas = antes.notas !== el.notas;
  if (!original && !titulo && !notas) return <p className="sm muted">{t('pantallas.elemento.versiones.sinCambios')}</p>;
  return (
    <div className="col-versiones">
      {titulo && (
        <>
          <p className="xs muted">{t('pantallas.elemento.campoTitulo')}</p>
          <DiffLineas antigua={antes.frontmatter.titulo} nueva={el.frontmatter.titulo} />
        </>
      )}
      {original && (
        <>
          <p className="xs muted">{t('pantallas.elemento.original')}</p>
          <DiffLineas antigua={antes.original ?? ''} nueva={el.original ?? ''} />
        </>
      )}
      {notas && (
        <>
          <p className="xs muted">{t('pantallas.elemento.notas')}</p>
          <DiffLineas antigua={antes.notas} nueva={el.notas} />
        </>
      )}
    </div>
  );
}
