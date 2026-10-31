/**
 * «Guardar como vista» en Buscar (IN-054, ORG-11): con una consulta escrita, un diálogo pide el nombre (propuesto: la
 * consulta) y la guarda en `vistas.json`. Si ya hay una vista con esa consulta, se dice y se enlaza a ella.
 */
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { ErrorRegistroIlegible } from '../../espacio/registro';
import { useVistas } from '../../espacio/useVistas';
import { crearVista, LARGO_NOMBRE, type Vista, vistaConConsulta } from '../../espacio/vistas';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Boton, Dialogo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';

export function GuardarVista({ consulta }: { consulta: string }) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const vistas = useVistas();
  const [abierto, setAbierto] = useState(false);
  if (!espacio || !consulta) return null;
  const ya = vistaConConsulta(vistas, consulta);
  if (ya)
    return (
      <span className="xs muted">
        {t('pantallas.vista.yaGuardada')}{' '}
        <Link to="/v/$vista" params={{ vista: ya.id }}>
          {ya.nombre}
        </Link>
      </span>
    );
  if (soloLectura) return null;

  function guardar(nombre: string) {
    if (!espacio) return;
    setAbierto(false);
    let creada: Vista | null = null;
    void espacio
      .guardarVistas((d) => {
        const r = crearVista(d, nombre, consulta);
        creada = r?.vista ?? null;
        return r?.datos ?? d;
      })
      .then(() => {
        const v = creada as Vista | null;
        if (v) avisos?.avisar(t('pantallas.vista.guardada', { nombre: v.nombre }));
      })
      .catch((e) =>
        avisos?.avisar(
          t(e instanceof ErrorRegistroIlegible ? 'pantallas.vista.ilegible' : 'pantallas.vista.noGuardada'),
        ),
      );
  }

  return (
    <>
      <Boton pequeno icono="mas" onClick={() => setAbierto(true)}>
        {t('pantallas.vista.guardar')}
      </Boton>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={t('pantallas.vista.guardarTitulo')}>
        {abierto && <FormularioNombre inicial={consulta} alGuardar={guardar} alCerrar={() => setAbierto(false)} />}
      </Dialogo>
    </>
  );
}

function FormularioNombre({
  inicial,
  alGuardar,
  alCerrar,
}: {
  inicial: string;
  alGuardar: (nombre: string) => void;
  alCerrar: () => void;
}) {
  const { t } = useT();
  const [valor, setValor] = useState(inicial.slice(0, LARGO_NOMBRE));
  return (
    <form
      method="dialog"
      className="formulario-dialogo"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim()) alGuardar(valor);
      }}
    >
      <label className="xs muted">
        {t('pantallas.vista.nombre')}
        <input
          type="text"
          value={valor}
          maxLength={LARGO_NOMBRE}
          onChange={(e) => setValor(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: el diálogo se abre para escribir el nombre.
          autoFocus
        />
      </label>
      <div className="row">
        <Boton variante="primario" pequeno type="submit" disabled={!valor.trim()}>
          {t('pantallas.vista.guardarBoton')}
        </Boton>
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </form>
  );
}
