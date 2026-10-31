/**
 * Tarjeta de una sesión en el feed (IN-051, ORG-08), como `.sess` en la portada de referencia: «Sesión «nombre»», sus
 * elementos de cuándo a cuándo y sus tipos más frecuentes, y «Renombrar». El nombre es el editado (`sesiones.json`) o
 * el propuesto (colección o etiquetas dominantes, o la franja).
 */
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { limpiarNombre, nombrePropuesto, renombrar } from '../../espacio/sesiones';
import { useEspacio } from '../../estado/espacio';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Dialogo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Icono } from '../../ui/iconos/Icono';
import type { ResumenSesion } from './filas';

/** «Log, Error y Código» en el idioma de la interfaz. */
const lista = (partes: readonly string[], idioma: string) =>
  new Intl.ListFormat(idioma, { style: 'long', type: 'conjunction' }).format(partes);

interface Props {
  sesion: ResumenSesion;
  soloLectura: boolean;
}

export function TarjetaSesion({ sesion: s, soloLectura }: Props) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const colecciones = useEspacio((e) => e.colecciones);
  const [editado, setEditado] = useState(() => espacio?.sesiones().nombres[s.id]);
  // Al día con lo que se edite aquí o en la otra pestaña.
  useEffect(
    () => (espacio ? espacio.alCambiar(() => setEditado(espacio.sesiones().nombres[s.id])) : undefined),
    [espacio, s.id],
  );
  const [renombrando, setRenombrando] = useState(false);

  const propuesto = nombrePropuesto(s.id, s.elementos);
  const nombre =
    editado ??
    (propuesto.t === 'coleccion'
      ? (colecciones.find((c) => c.id === propuesto.coleccion)?.nombre ?? propuesto.coleccion)
      : propuesto.t === 'etiquetas'
        ? lista(propuesto.etiquetas, idioma)
        : t(`pantallas.inicio.sesionFranja.${propuesto.franja}`));
  const resumen = [
    t('pantallas.inicio.sesionResumen', {
      n: s.elementos.length,
      desde: fmtHora(new Date(s.desde)),
      hasta: fmtHora(new Date(s.hasta)),
    }),
    lista(
      s.tipos.map((tipo) => t(`tipos.${tipo}`)),
      idioma,
    ),
  ].join(' · ');

  function guardar(nuevo: string) {
    setRenombrando(false);
    if (!espacio) return;
    void espacio
      .guardarSesiones((d) => renombrar(d, s.id, nuevo))
      .catch(() => avisos?.avisar(t('pantallas.inicio.sesionNoGuardada')));
    setEditado(espacio.sesiones().nombres[s.id]);
  }

  return (
    <div className="sess">
      <Icono nombre="tiempo" tamano={16} />
      <div className="sess-cuerpo">
        <b className="sm">{t('pantallas.inicio.sesion', { nombre })}</b>
        <p className="xs muted">{resumen}</p>
      </div>
      {!soloLectura && (
        <Boton pequeno onClick={() => setRenombrando(true)}>
          {t('pantallas.inicio.sesionRenombrar')}
        </Boton>
      )}
      <Dialogo abierto={renombrando} alCerrar={() => setRenombrando(false)} titulo={t('pantallas.inicio.sesionTitulo')}>
        {renombrando && (
          <FormularioNombre
            inicial={editado ?? ''}
            propuesto={nombre}
            alGuardar={guardar}
            alCerrar={() => setRenombrando(false)}
          />
        )}
      </Dialogo>
    </div>
  );
}

function FormularioNombre({
  inicial,
  propuesto,
  alGuardar,
  alCerrar,
}: {
  inicial: string;
  propuesto: string;
  alGuardar: (nombre: string) => void;
  alCerrar: () => void;
}) {
  const { t } = useT();
  const [valor, setValor] = useState(inicial);
  return (
    <form
      method="dialog"
      className="formulario-dialogo"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar(limpiarNombre(valor));
      }}
    >
      <label className="xs muted">
        {t('pantallas.inicio.sesionCampo')}
        <input
          type="text"
          value={valor}
          placeholder={propuesto}
          maxLength={80}
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
