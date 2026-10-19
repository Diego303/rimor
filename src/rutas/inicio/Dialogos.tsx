/**
 * Los diálogos del triaje: añadir a colección (`c`) y cambiar tipo (`t`). Sin formularios largos: una caja con
 * autocompletado o una lista de botones.
 */
import { useId, useState } from 'react';
import { useT } from '../../i18n/useT';
import type { Lector } from '../../lectores/contrato';
import { Boton, Dialogo, IconoTipo } from '../../ui/componentes';

interface PropsColeccion {
  refe: string | null;
  existentes: readonly string[];
  alElegir: (coleccion: string) => void;
  alCerrar: () => void;
}

/** Nombre de colección limpio: sin espacios de más ni `@`. */
export const limpiarColeccion = (s: string) => s.trim().replace(/^@/, '').replace(/\s+/g, '-').toLowerCase();

export function DialogoColeccion({ refe, existentes, alElegir, alCerrar }: PropsColeccion) {
  const { t } = useT();
  const [valor, setValor] = useState('');
  const lista = useId();
  const nombre = limpiarColeccion(valor);
  return (
    <Dialogo abierto={refe !== null} alCerrar={alCerrar} titulo={t('pantallas.inicio.coleccionTitulo')}>
      <form
        method="dialog"
        className="formulario-dialogo"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre) alElegir(nombre);
        }}
      >
        <label className="xs muted">
          {t('pantallas.inicio.coleccionCampo')}
          <input
            type="text"
            list={lista}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: el diálogo se abre para escribir el nombre.
            autoFocus
          />
        </label>
        <datalist id={lista}>
          {existentes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="row">
          <Boton variante="primario" pequeno type="submit" disabled={!nombre}>
            {t('pantallas.inicio.coleccionAnadir')}
          </Boton>
          <Boton pequeno onClick={alCerrar}>
            {t('pantallas.inicio.cancelar')}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

interface PropsTipo {
  refe: string | null;
  lectores: readonly Lector[];
  alElegir: (lector: Lector) => void;
  alCerrar: () => void;
}

export function DialogoTipo({ refe, lectores, alElegir, alCerrar }: PropsTipo) {
  const { t } = useT();
  return (
    <Dialogo abierto={refe !== null} alCerrar={alCerrar} titulo={t('pantallas.inicio.tipoTitulo', { ref: refe ?? '' })}>
      {lectores.length ? (
        <div className="list">
          {lectores.map((l) => (
            <button key={l.nombre} type="button" className="it" onClick={() => alElegir(l)}>
              <IconoTipo tipo={l.tipo} denso />
              <span className="sm">{t(`tipos.${l.tipo}`)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="sm muted">{t('pantallas.inicio.sinOtroTipo')}</p>
      )}
      <div className="row">
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </Dialogo>
  );
}
