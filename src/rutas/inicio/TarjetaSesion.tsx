/**
 * Tarjeta de una sesión en el feed (IN-051, ORG-08), como `.sess` en la portada de referencia: «Sesión «nombre»», sus
 * elementos de cuándo a cuándo y sus tipos más frecuentes, y «Renombrar». El nombre es el editado (`sesiones.json`) o
 * el propuesto (colección o etiquetas dominantes, o la franja: «Sesión de la tarde»). El diálogo de renombrar vive en
 * Inicio, fuera de la lista virtual (que puede desmontar la fila con él abierto).
 */
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { LARGO_NOMBRE, limpiarNombre, nombrePropuesto } from '../../espacio/sesiones';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Dialogo } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';
import { claveDia, type ResumenSesion } from './filas';

/** «Log, Error y Código» en el idioma de la interfaz. */
const lista = (partes: readonly string[], idioma: string) =>
  new Intl.ListFormat(idioma, { style: 'long', type: 'conjunction' }).format(partes);

/** Lo que se renombra: la sesión, su nombre editado (si lo tiene) y el propuesto. */
export interface ARenombrar {
  id: string;
  editado: string | undefined;
  propuesto: string;
}

/** El título de una sesión, su nombre editado y el propuesto (en el idioma de la interfaz). */
export function useNombreSesion(s: Pick<ResumenSesion, 'id' | 'elementos'>) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const colecciones = useEspacio((e) => e.colecciones);
  const [editado, setEditado] = useState(() => espacio?.sesiones().nombres[s.id]);
  // Al día con lo que se edite aquí o en la otra pestaña.
  useEffect(
    () => (espacio ? espacio.alCambiar(() => setEditado(espacio.sesiones().nombres[s.id])) : undefined),
    [espacio, s.id],
  );
  const p = nombrePropuesto(s.id, s.elementos);
  const propuesto =
    p.t === 'coleccion'
      ? (colecciones.find((c) => c.id === p.coleccion)?.nombre ?? p.coleccion)
      : p.t === 'etiquetas'
        ? lista(p.etiquetas, idioma)
        : t(`pantallas.inicio.sesionFranja.${p.franja}`);
  // La franja ya es «Sesión de la tarde»: no «Sesión «Sesión de la tarde»».
  const titulo =
    editado || p.t !== 'franja' ? t('pantallas.inicio.sesion', { nombre: editado ?? propuesto }) : propuesto;
  return { titulo, editado, propuesto };
}

interface Props {
  sesion: ResumenSesion;
  soloLectura: boolean;
  alRenombrar: (r: ARenombrar) => void;
}

export function TarjetaSesion({ sesion: s, soloLectura, alRenombrar }: Props) {
  const { t, idioma } = useT();
  const { titulo, editado, propuesto } = useNombreSesion(s);
  const desde = new Date(s.desde);
  const hasta = new Date(s.hasta);
  // De un día a otro (pasada la medianoche), con el día de cada extremo.
  const cuando =
    claveDia(desde) === claveDia(hasta)
      ? t('pantallas.inicio.sesionResumen', { n: s.elementos.length, desde: fmtHora(desde), hasta: fmtHora(hasta) })
      : t('pantallas.inicio.sesionResumenDias', {
          n: s.elementos.length,
          desde: `${fmtDia(desde, new Date(), idioma)} ${fmtHora(desde)}`,
          hasta: `${fmtDia(hasta, new Date(), idioma)} ${fmtHora(hasta)}`,
        });
  const resumen = `${cuando} · ${lista(
    s.tipos.map((tipo) => t(`tipos.${tipo}`)),
    idioma,
  )}`;
  return (
    <article className="sess" aria-label={titulo}>
      <Icono nombre="tiempo" tamano={16} />
      <div className="sess-cuerpo">
        <b className="sm">{titulo}</b>
        <p className="xs muted">{resumen}</p>
      </div>
      {!soloLectura && (
        <Boton
          pequeno
          aria-label={t('pantallas.inicio.sesionRenombrarDe', { nombre: titulo })}
          onClick={() => alRenombrar({ id: s.id, editado, propuesto })}
        >
          {t('pantallas.inicio.sesionRenombrar')}
        </Boton>
      )}
    </article>
  );
}

/** El diálogo de renombrar una sesión (vacío, o igual que el propuesto, vuelve al propuesto). */
export function DialogoSesion({
  sesion,
  alGuardar,
  alCerrar,
}: {
  sesion: ARenombrar | null;
  alGuardar: (r: ARenombrar, nombre: string) => void;
  alCerrar: () => void;
}) {
  const { t } = useT();
  return (
    <Dialogo abierto={sesion !== null} alCerrar={alCerrar} titulo={t('pantallas.inicio.sesionTitulo')}>
      {/* Dentro del diálogo: se monta en cada apertura, con el nombre de esa sesión. */}
      {sesion && <FormularioNombre sesion={sesion} alGuardar={alGuardar} alCerrar={alCerrar} />}
    </Dialogo>
  );
}

function FormularioNombre({
  sesion,
  alGuardar,
  alCerrar,
}: {
  sesion: ARenombrar;
  alGuardar: (r: ARenombrar, nombre: string) => void;
  alCerrar: () => void;
}) {
  const { t } = useT();
  const [valor, setValor] = useState(sesion.editado ?? '');
  return (
    <form
      method="dialog"
      className="formulario-dialogo"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar(sesion, limpiarNombre(valor));
      }}
    >
      <label className="xs muted">
        {t('pantallas.inicio.sesionCampo')}
        <input
          type="text"
          value={valor}
          placeholder={sesion.propuesto}
          maxLength={LARGO_NOMBRE}
          onChange={(e) => setValor(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: el diálogo se abre para escribir el nombre.
          autoFocus
        />
      </label>
      <div className="row">
        <Boton variante="primario" pequeno type="submit">
          {t('pantallas.inicio.sesionGuardar')}
        </Boton>
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </form>
  );
}
