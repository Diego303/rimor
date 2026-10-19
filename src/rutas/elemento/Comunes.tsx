/**
 * Lo común de «Detalles» de cualquier elemento (VIS-01), como filas `dt`/`dd` que la vista del lector pone en su
 * plegado: colecciones y etiquetas (en el sitio), secretos ocultados, origen, tipo con «Cambiar tipo», el original
 * y la referencia con sus alias.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useMemo, useState } from 'react';
import { limpiarColeccion, limpiarEtiqueta } from '../../espacio/ediciones';
import { fmtBytes, fmtFecha } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton } from '../../ui/componentes';
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
  alGuardarColecciones: (texto: string) => void;
  alGuardarEtiquetas: (texto: string) => void;
  alCambiarTipo: () => void;
  alVerOriginal: () => void;
}

export function FilasComunes({
  fm,
  editable,
  existentes,
  alGuardarColecciones,
  alGuardarEtiquetas,
  alCambiarTipo,
  alVerOriginal,
}: Props) {
  const { t, idioma } = useT();
  const [editando, setEditando] = useState<'colecciones' | 'etiquetas' | null>(null);
  // Las existentes se miran al empezar a editar (no en cada tecla: el espacio puede tener miles de elementos).
  // biome-ignore lint/correctness/useExhaustiveDependencies: se recalculan al empezar cada edición.
  const nombres = useMemo(() => (editando ? existentes() : { colecciones: [], etiquetas: [] }), [editando]);
  const colecciones = fm.colecciones ?? [];
  const etiquetas = fm.etiquetas ?? [];
  const ninguna = <span className="muted">{t('pantallas.elemento.ninguna')}</span>;
  const terminar = (guardar: (texto: string) => void) => (texto: string | null) => {
    setEditando(null);
    if (texto !== null) guardar(texto);
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
          alEmpezar={() => setEditando('colecciones')}
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
          alEmpezar={() => setEditando('etiquetas')}
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
