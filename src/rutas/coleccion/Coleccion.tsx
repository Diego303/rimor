/**
 * Una colección (ORG-02): la lista simple de sus elementos, de lo más reciente a lo más antiguo (el panel visual
 * llega con IN-052); el nombre se edita en el sitio (renombrar) y a la derecha se sube, se baja (su sitio en el
 * raíl) o se borra (con confirmación: los elementos se quedan).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { limpiarColeccion } from '../../espacio/ediciones';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, Dialogo, FilaElemento, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { TituloElemento } from '../elemento/Cabecera';
import { Pantalla } from '../Pantalla';

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
    if (hecho) void navegar({ to: '/c/$coleccion', params: { coleccion: limpiarColeccion(escrito) }, replace: true });
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

  return (
    <Pantalla
      titulo={
        <TituloElemento
          titulo={coleccion}
          editable={editable}
          editando={editando}
          alEditar={setEditando}
          alGuardar={(nombre) => void renombrar(nombre)}
        />
      }
      meta={t('pantallas.coleccion.meta', { n: elementos.length })}
      control={
        editable ? (
          <div className="row">
            <Boton variante="fantasma" pequeno disabled={posicion <= 0} onClick={() => void mover(-1)}>
              {t('pantallas.coleccion.subir')}
            </Boton>
            <Boton
              variante="fantasma"
              pequeno
              disabled={posicion < 0 || posicion >= total - 1}
              onClick={() => void mover(1)}
            >
              {t('pantallas.coleccion.bajar')}
            </Boton>
            <Boton pequeno peligro onClick={() => setBorrando(true)}>
              {t('pantallas.coleccion.borrar')}
            </Boton>
          </div>
        ) : undefined
      }
    >
      {elementos.length ? (
        <section className="card" aria-label={t('pantallas.coleccion.lista')}>
          <div className="list">
            {elementos.map((fm) => (
              <FilaElemento key={fm.id} fm={fm} resumen={legible(fm)} alAbrir={abrir} />
            ))}
          </div>
        </section>
      ) : (
        <Vacio titulo={t('pantallas.coleccion.vaciaTitulo')}>{t('pantallas.coleccion.vacio')}</Vacio>
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
