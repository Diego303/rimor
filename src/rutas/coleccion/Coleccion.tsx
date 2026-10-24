/**
 * Una colección (ORG-02; cabecera como `SC.coleccion`): la lista simple de sus elementos, de lo más reciente a lo
 * más antiguo (el panel visual llega con IN-052); el nombre se edita en el sitio (renombrar), a la derecha solo el
 * selector de vista (guía §8.2) y, plegado al final, subirla o bajarla (su sitio en el raíl) o borrarla (con
 * confirmación: los elementos se quedan).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { limpiarColeccion } from '../../espacio/ediciones';
import { useEspacio } from '../../estado/espacio';
import { fmtDia } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, Detalles, Dialogo, FilaElemento, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Icono } from '../../ui/iconos/Icono';
import { TituloElemento } from '../elemento/Cabecera';
import { Pantalla } from '../Pantalla';
import { type Vista, vistaDe } from '../vistas/orden';
import { ListaDensa, Mosaico, SelectorVista } from '../vistas/Vistas';

/** Los elementos de la colección y si existe, al día con cada cambio. */
function useColeccion(id: string): { existe: boolean; elementos: FrontmatterComun[]; posicion: number; total: number } {
  const espacio = useEspacioOpcional();
  const [estado, setEstado] = useState({ existe: false, elementos: [] as FrontmatterComun[], posicion: -1, total: 0 });
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () => {
      const lista = espacio.colecciones.lista();
      setEstado({
        existe: lista.some((c) => c.id === id),
        posicion: lista.findIndex((c) => c.id === id),
        total: lista.length,
        elementos: espacio.repositorio
          .elementos()
          .filter((fm) => fm.colecciones?.includes(id))
          .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)),
      });
    };
    leer();
    return espacio.alCambiar(leer);
  }, [espacio, id]);
  return estado;
}

export function Coleccion() {
  const { t, idioma } = useT();
  const { coleccion } = useParams({ from: '/c/$coleccion' });
  const navegar = useNavigate();
  const vista = vistaDe(useSearch({ from: '/c/$coleccion' }).vista);
  const cambiarVista = (nueva: Vista) =>
    void navegar({
      to: '/c/$coleccion',
      params: { coleccion },
      search: nueva === 'lista' ? {} : { vista: nueva },
      replace: true,
    });
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const { existe, elementos, posicion, total } = useColeccion(coleccion);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const editable = Boolean(espacio) && !soloLectura;

  const abrir = (ref: string) => void navegar({ to: '/e/$ref', params: { ref } });
  const legible = (fm: FrontmatterComun) => {
    try {
      return lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
    } catch {
      return '';
    }
  };

  if (!existe)
    return (
      <Pantalla titulo={coleccion}>
        <Vacio titulo={t('pantallas.coleccion.noEncontrada')}>{t('pantallas.coleccion.vacio')}</Vacio>
      </Pantalla>
    );

  async function renombrar(escrito: string) {
    if (!espacio) return;
    if (limpiarColeccion(escrito) === coleccion) return;
    const hecho = await espacio.colecciones.renombrar(coleccion, escrito).catch(() => false);
    // Lleva a la colección con su nombre nuevo (limpio, como lo guarda el registro); sus elementos siguen en
    // segundo plano.
    if (hecho)
      void navegar({
        to: '/c/$coleccion',
        params: { coleccion: limpiarColeccion(escrito) },
        search: (antes) => antes,
        replace: true,
      });
    else avisos?.avisar(t('pantallas.elemento.noGuardado'));
  }

  async function borrar() {
    setBorrando(false);
    if (!espacio) return;
    const hecho = await espacio.colecciones.borrar(coleccion).catch(() => false);
    avisos?.avisar(t(hecho ? 'pantallas.coleccion.borrada' : 'pantallas.elemento.noGuardado', { nombre: coleccion }));
    if (hecho) void navegar({ to: '/' });
  }

  const mover = async (paso: -1 | 1) => {
    const hecho = await espacio?.colecciones.mover(coleccion, paso).catch(() => false);
    if (!hecho) avisos?.avisar(t('pantallas.elemento.noGuardado'));
  };

  // «12 elementos · desde el 2 oct»: el más antiguo es el último (están de lo más reciente a lo más antiguo).
  const masAntiguo = new Date(elementos.at(-1)?.creado ?? '');
  const meta = t('pantallas.coleccion.meta', { n: elementos.length });

  return (
    <Pantalla
      marcas={
        <>
          <Icono nombre="coleccion" tamano={16} />
          <span className="lbl">{t('pantallas.coleccion.titulo')}</span>
        </>
      }
      titulo={
        <TituloElemento
          titulo={coleccion}
          editable={editable}
          editando={editando}
          alEditar={setEditando}
          alGuardar={(nombre) => void renombrar(nombre)}
        />
      }
      meta={
        Number.isNaN(masAntiguo.getTime())
          ? meta
          : t('pantallas.coleccion.desde', { meta, fecha: fmtDia(masAntiguo, new Date(), idioma) })
      }
      control={elementos.length > 0 ? <SelectorVista vista={vista} alCambiar={cambiarVista} /> : undefined}
    >
      {elementos.length && vista === 'mosaico' ? (
        <Mosaico elementos={elementos} alAbrir={abrir} />
      ) : elementos.length && vista === 'densa' ? (
        <section className="card" aria-labelledby="elementos-coleccion">
          <h3 id="elementos-coleccion">{t('pantallas.coleccion.elementos')}</h3>
          <ListaDensa elementos={elementos} alAbrir={abrir} />
        </section>
      ) : elementos.length ? (
        <section className="card" aria-labelledby="elementos-coleccion">
          <h3 id="elementos-coleccion">{t('pantallas.coleccion.elementos')}</h3>
          <div className="list">
            {elementos.map((fm) => (
              <FilaElemento key={fm.id} fm={fm} resumen={legible(fm)} alAbrir={abrir} />
            ))}
          </div>
        </section>
      ) : (
        <Vacio titulo={t('pantallas.coleccion.vaciaTitulo')}>{t('pantallas.coleccion.vacio')}</Vacio>
      )}
      {editable && (
        <Detalles resumen={t('pantallas.coleccion.organizar')}>
          <p className="xs muted">{t('pantallas.coleccion.organizarTexto')}</p>
          <div className="row">
            <Boton pequeno disabled={posicion <= 0} onClick={() => void mover(-1)}>
              {t('pantallas.coleccion.subir')}
            </Boton>
            <Boton pequeno disabled={posicion < 0 || posicion >= total - 1} onClick={() => void mover(1)}>
              {t('pantallas.coleccion.bajar')}
            </Boton>
            <span className="sp" />
            <Boton pequeno peligro onClick={() => setBorrando(true)}>
              {t('pantallas.coleccion.borrar')}
            </Boton>
          </div>
        </Detalles>
      )}
      <Dialogo
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        titulo={t('pantallas.coleccion.borrarTitulo', { nombre: coleccion })}
      >
        <p className="sm">{t('pantallas.coleccion.borrarTexto', { n: elementos.length })}</p>
        <div className="row">
          <Boton variante="primario" peligro pequeno onClick={() => void borrar()}>
            {t('pantallas.coleccion.borrar')}
          </Boton>
          <Boton pequeno onClick={() => setBorrando(false)}>
            {t('pantallas.inicio.cancelar')}
          </Boton>
        </div>
      </Dialogo>
    </Pantalla>
  );
}
