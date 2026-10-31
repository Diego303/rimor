/**
 * Una vista guardada (ORG-11, IN-054): una búsqueda con nombre que funciona como colección que se llena sola. Su
 * nombre se edita en el sitio; su consulta, en Buscar («Editar la búsqueda»); su cuerpo es el panel común de grupo con
 * lo que encuentra (lo más reciente primero), y plegado al final, borrarla (los elementos se quedan).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useBuscar } from '../../busqueda/Busqueda';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { ErrorRegistroIlegible } from '../../espacio/registro';
import { useVistas } from '../../espacio/useVistas';
import { borrarVista, editarVista } from '../../espacio/vistas';
import { useEspacio } from '../../estado/espacio';
import { fmtDia } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Dialogo, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Icono } from '../../ui/iconos/Icono';
import { TituloElemento } from '../elemento/Cabecera';
import { CuerpoGrupo, ExportarGrupo } from '../grupo/PanelGrupo';
import { Pantalla } from '../Pantalla';
import { type Vista, vistaDe } from '../vistas/orden';

export function VistaGuardada() {
  const { t, idioma } = useT();
  const { vista: id } = useParams({ from: '/v/$vista' });
  const modo = vistaDe(useSearch({ from: '/v/$vista' }).vista);
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const vistas = useVistas();
  const vista = vistas.vistas.find((v) => v.id === id);
  const { busqueda } = useBuscar(vista?.consulta ?? '');
  // Lo más reciente primero, como una colección (la búsqueda los da por relevancia).
  const elementos = useMemo<FrontmatterComun[]>(
    () =>
      [...(busqueda?.resultados ?? [])].map((r) => r.fm).sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)),
    [busqueda],
  );
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const editable = Boolean(espacio) && !soloLectura;

  if (!vista)
    return (
      <Pantalla titulo={id}>
        <Vacio titulo={t('pantallas.vista.noEncontrada')}>{t('pantallas.vista.noEncontradaTexto')}</Vacio>
      </Pantalla>
    );

  const avisarFallo = (e: unknown) =>
    avisos?.avisar(t(e instanceof ErrorRegistroIlegible ? 'pantallas.vista.ilegible' : 'pantallas.vista.noGuardada'));
  const renombrar = (nombre: string) => {
    if (nombre.trim() && nombre.trim() !== vista.nombre)
      void espacio?.guardarVistas((d) => editarVista(d, vista.id, { nombre })).catch(avisarFallo);
  };
  const borrar = () => {
    setBorrando(false);
    void espacio
      ?.guardarVistas((d) => borrarVista(d, vista.id))
      .then(() => {
        avisos?.avisar(t('pantallas.vista.borrada', { nombre: vista.nombre }));
        void navegar({ to: '/buscar', search: { q: vista.consulta } });
      })
      .catch(avisarFallo);
  };
  const cambiarModo = (nuevo: Vista) =>
    void navegar({
      to: '/v/$vista',
      params: { vista: id },
      search: nuevo === 'lista' ? {} : { vista: nuevo },
      replace: true,
    });

  const total = busqueda?.total ?? 0;
  const masAntiguo = new Date(elementos.at(-1)?.creado ?? '');
  const meta = busqueda?.aproximado
    ? t('pantallas.buscar.alMenos', { n: total })
    : t('pantallas.coleccion.meta', { n: total });

  return (
    <Pantalla
      marcas={
        <>
          <Icono nombre="buscar" tamano={16} />
          <span className="lbl">{t('pantallas.vista.etiqueta')}</span>
        </>
      }
      titulo={
        <TituloElemento
          titulo={vista.nombre}
          editable={editable}
          editando={editando}
          alEditar={setEditando}
          alGuardar={renombrar}
        />
      }
      meta={
        Number.isNaN(masAntiguo.getTime())
          ? meta
          : t('pantallas.coleccion.desde', { meta, fecha: fmtDia(masAntiguo, new Date(), idioma) })
      }
      control={
        elementos.length ? (
          <ExportarGrupo elementos={elementos} nombre={vista.nombre} grupo={{ clase: 'vista', valor: vista.id }} />
        ) : undefined
      }
    >
      <p className="row consulta-vista">
        <span className="mono sm">{vista.consulta}</span>
        <Boton
          variante="fantasma"
          pequeno
          onClick={() => void navegar({ to: '/buscar', search: { q: vista.consulta } })}
        >
          {t('pantallas.vista.editarBusqueda')}
        </Boton>
      </p>
      {elementos.length ? (
        <CuerpoGrupo
          key={vista.id}
          elementos={elementos}
          vista={modo}
          alCambiarVista={cambiarModo}
          id="elementos-vista"
        />
      ) : busqueda ? (
        <Vacio titulo={t('pantallas.vista.vaciaTitulo')}>{t('pantallas.vista.vacia')}</Vacio>
      ) : null}
      {editable && (
        <Detalles resumen={t('pantallas.vista.organizar')}>
          <div className="row">
            <Boton pequeno peligro onClick={() => setBorrando(true)}>
              {t('pantallas.vista.borrar')}
            </Boton>
          </div>
        </Detalles>
      )}
      <Dialogo
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        titulo={t('pantallas.vista.borrarTitulo', { nombre: vista.nombre })}
      >
        <p className="sm">{t('pantallas.vista.borrarTexto')}</p>
        <div className="row">
          <Boton variante="primario" peligro pequeno onClick={borrar}>
            {t('pantallas.vista.borrar')}
          </Boton>
          <Boton pequeno onClick={() => setBorrando(false)}>
            {t('pantallas.inicio.cancelar')}
          </Boton>
        </div>
      </Dialogo>
    </Pantalla>
  );
}
