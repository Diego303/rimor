/**
 * Lo común de «Detalles» de cualquier elemento (VIS-01), como filas `dt`/`dd` que la vista del lector pone en su
 * plegado: colecciones y etiquetas (en el sitio), secretos ocultados, origen, tipo con «Cambiar tipo», el original
 * y la referencia con sus alias.
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import { Link } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { limpiarColeccion, limpiarEtiqueta } from '../../espacio/ediciones';
import { type ClaveGrupo, clavesDe } from '../../espacio/grupos';
import { fmtBytes, fmtFecha } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Ref } from '../../ui/componentes';
import { EnSitio } from '../../ui/componentes/EnSitio';

/** Sugerencias que se enseñan como mucho a la vez. */
const MAX_SUGERENCIAS = 6;

/**
 * Las sugerencias para lo escrito: los nombres existentes que empiezan por la última palabra (o todos, si se va a
 * empezar una nueva) y que no están ya escritos.
 */
export function sugerir(
  texto: string,
  existentes: readonly string[],
  limpiar: (s: string) => string,
  max = MAX_SUGERENCIAS,
): string[] {
  const escritos = new Set(
    texto
      .split(/[\s,]+/)
      .map(limpiar)
      .filter(Boolean),
  );
  // La que se está escribiendo no cuenta como escrita: se completa.
  const enCurso = /[\s,]$/.test(texto) ? '' : limpiar(texto.split(/[\s,]+/).at(-1) ?? '');
  escritos.delete(enCurso);
  const ultima = enCurso.toLowerCase();
  return existentes
    .filter((e) => !escritos.has(e) && e.toLowerCase().startsWith(ultima) && e.toLowerCase() !== ultima)
    .slice(0, max);
}

interface Props {
  fm: FrontmatterComun;
  editable: boolean;
  /** Todas las colecciones y etiquetas del espacio, para sugerirlas. */
  existentes: () => { colecciones: string[]; etiquetas: string[] };
  /** Lo escrito y la lista que había al empezar a editar (para aplicar solo lo que cambió). */
  alGuardarColecciones: (texto: string, inicial: readonly string[]) => void;
  alGuardarEtiquetas: (texto: string, inicial: readonly string[]) => void;
  alCambiarTipo: () => void;
  alVerOriginal: () => void;
  /** El hilo en que está (D13: uno solo), y abrirlo o moverlo a otro. */
  hilo: { ref: string; titulo: string } | null;
  alAbrirHilo: (ref: string) => void;
  alMoverHilo: () => void;
}

export function FilasComunes({
  fm,
  editable,
  existentes,
  alGuardarColecciones,
  alGuardarEtiquetas,
  alCambiarTipo,
  alVerOriginal,
  hilo,
  alAbrirHilo,
  alMoverHilo,
}: Props) {
  const { t, idioma } = useT();
  const [editando, setEditando] = useState<'colecciones' | 'etiquetas' | null>(null);
  // Las existentes se miran al empezar a editar (no en cada tecla: el espacio puede tener miles de elementos).
  // biome-ignore lint/correctness/useExhaustiveDependencies: se recalculan al empezar cada edición.
  const nombres = useMemo(() => (editando ? existentes() : { colecciones: [], etiquetas: [] }), [editando]);
  const colecciones = fm.colecciones ?? [];
  const etiquetas = fm.etiquetas ?? [];
  const ninguna = <span className="muted">{t('pantallas.elemento.ninguna')}</span>;
  // La lista al empezar a editar: lo que cambie mientras se escribe (otra pestaña, Inicio) no se pisa.
  const inicial = useRef<readonly string[]>([]);
  const empezar = (cual: 'colecciones' | 'etiquetas') => {
    inicial.current = cual === 'colecciones' ? colecciones : etiquetas;
    setEditando(cual);
  };
  const terminar = (guardar: Props['alGuardarColecciones']) => (texto: string | null) => {
    setEditando(null);
    if (texto !== null) guardar(texto, inicial.current);
  };
  const modificado = fm.modificado !== fm.creado;

  return (
    <>
      <dt>{t('pantallas.elemento.colecciones', { n: Math.max(1, colecciones.length) })}</dt>
      <dd>
        <EnSitio
          valor={colecciones.join(' ')}
          editando={editando === 'colecciones'}
          soloLectura={!editable}
          etiqueta={
            editando === 'colecciones'
              ? t('pantallas.elemento.campoColecciones')
              : t('pantallas.elemento.editarColecciones')
          }
          alEmpezar={() => empezar('colecciones')}
          alTerminar={terminar(alGuardarColecciones)}
          sugerencias={(texto) => sugerir(texto, nombres.colecciones, limpiarColeccion)}
        >
          {colecciones.length ? colecciones.join(' · ') : ninguna}
        </EnSitio>
      </dd>
      <dt>{t('pantallas.elemento.etiquetas')}</dt>
      <dd>
        <EnSitio
          valor={etiquetas.map((e) => `#${e}`).join(' ')}
          editando={editando === 'etiquetas'}
          soloLectura={!editable}
          etiqueta={
            editando === 'etiquetas' ? t('pantallas.elemento.campoEtiquetas') : t('pantallas.elemento.editarEtiquetas')
          }
          alEmpezar={() => empezar('etiquetas')}
          alTerminar={terminar(alGuardarEtiquetas)}
          sugerencias={(texto) => sugerir(texto, nombres.etiquetas, limpiarEtiqueta).map((e) => `#${e}`)}
        >
          {etiquetas.length ? etiquetas.map((e) => `#${e}`).join(' ') : ninguna}
        </EnSitio>
      </dd>
      <dt>{t('pantallas.elemento.ocultados')}</dt>
      <dd>{fm.ocultados}</dd>
      <dt>{t('pantallas.elemento.origenFila')}</dt>
      <dd>
        {t(`pantallas.elemento.origenes.${fm.origen}`)} · {fmtFecha(new Date(fm.creado), idioma)}
      </dd>
      {modificado && (
        <>
          <dt>{t('pantallas.elemento.modificado')}</dt>
          <dd>{fmtFecha(new Date(fm.modificado), idioma)}</dd>
        </>
      )}
      <dt>{t('pantallas.elemento.tipo')}</dt>
      <dd>
        {t(`tipos.${fm.tipo}`)}
        {editable && (
          <>
            {' '}
            <Boton variante="fantasma" pequeno onClick={alCambiarTipo}>
              {t('pantallas.elemento.cambiarTipo')}
            </Boton>
          </>
        )}
      </dd>
      <dt>{t('pantallas.elemento.original')}</dt>
      <dd>
        {fm.adjunto && (
          <span className="mono xs">
            {t('pantallas.elemento.adjunto', {
              nombre: fm.adjunto.nombre ?? fm.adjunto.ruta.split('/').at(-1) ?? '',
              tam: fmtBytes(fm.adjunto.tam, idioma),
            })}{' '}
          </span>
        )}
        <Boton variante="fantasma" pequeno onClick={alVerOriginal}>
          {t('pantallas.elemento.verOriginal')}
        </Boton>
      </dd>
      <dt>{t('pantallas.hilo.fila')}</dt>
      <dd>
        {hilo ? (
          <>
            <Ref refe={hilo.ref} alPulsar={alAbrirHilo} /> <span className="sm">{hilo.titulo}</span>
          </>
        ) : (
          <span className="muted">{t('pantallas.hilo.ninguno')}</span>
        )}
        {editable && (
          <>
            {' '}
            <Boton variante="fantasma" pequeno onClick={alMoverHilo}>
              {t('pantallas.hilo.mover')}
            </Boton>
          </>
        )}
      </dd>
      <dt>{t('pantallas.grupo.grupos')}</dt>
      <dd>
        <GruposDe fm={fm} />
      </dd>
      <dt>{t('pantallas.elemento.referencia')}</dt>
      <dd>
        <span className="mono">{fm.ref}</span>
        {fm.alias?.length ? (
          <span className="xs muted"> · {t('pantallas.elemento.antes', { alias: fm.alias.join(', ') })}</span>
        ) : null}
      </dd>
    </>
  );
}

/** El texto de un grupo en sus detalles: «#ureq», «github.com», «Log», «octubre de 2026», «mismo error»… */
function textoGrupo(c: ClaveGrupo, t: ReturnType<typeof useT>['t'], idioma: string): string {
  if (c.clase === 'etiqueta') return `#${c.valor}`;
  if (c.clase === 'tipo') return t(`tipos.${c.valor as TipoElemento}`);
  if (c.clase === 'huella') return t('pantallas.grupo.mismoError');
  if (c.clase === 'sesion') return t('pantallas.grupo.suSesion');
  if (c.clase === 'mes') {
    const f = new Date(`${c.valor}-15T12:00:00`);
    return Number.isNaN(f.getTime())
      ? c.valor
      : new Intl.DateTimeFormat(idioma, { month: 'long', year: 'numeric' }).format(f);
  }
  return c.valor;
}

/** Los grupos del elemento (IN-052): uno por clave, cada uno con su panel. */
function GruposDe({ fm }: { fm: FrontmatterComun }) {
  const { t, idioma } = useT();
  const claves = useMemo(() => clavesDe(fm), [fm]);
  return (
    <span className="grupos-elemento">
      {claves.map((c) =>
        c.clase === 'coleccion' ? (
          <Link key={`${c.clase}:${c.valor}`} className="st" to="/c/$coleccion" params={{ coleccion: c.valor }}>
            {c.valor}
          </Link>
        ) : (
          <Link
            key={`${c.clase}:${c.valor}`}
            className="st"
            to="/g/$clase/$valor"
            params={{ clase: c.clase, valor: c.valor }}
            title={t(`pantallas.grupo.clases.${c.clase}`)}
          >
            {textoGrupo(c, t, idioma)}
          </Link>
        ),
      )}
    </span>
  );
}
