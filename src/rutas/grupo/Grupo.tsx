/**
 * Un grupo automático (ORG-09, IN-052): `/g/$clase/$valor` (una etiqueta, un dominio, un repositorio, un paquete, la
 * huella de un error, un tipo, un mes o una sesión) con el panel común de grupo, como la colección.
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { type ClaseGrupo, elementosDe, esClaseGrupo } from '../../espacio/grupos';
import { fmtDia } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Icono, type NombreIcono } from '../../ui/iconos/Icono';
import { ASPECTO_TIPO } from '../../ui/iconos/tipos';
import { useNombreSesion } from '../inicio/TarjetaSesion';
import { Pantalla } from '../Pantalla';
import { type Vista, vistaDe } from '../vistas/orden';
import { SelectorVista } from '../vistas/Vistas';
import { CuerpoGrupo, ExportarGrupo, GrupoVacio } from './PanelGrupo';

/** El icono de cada clase de grupo (el de su tipo, si es un tipo). */
const ICONOS: Record<ClaseGrupo, NombreIcono> = {
  coleccion: 'coleccion',
  sesion: 'tiempo',
  huella: 'error',
  dominio: 'enlace',
  repositorio: 'codigo',
  paquete: 'datos',
  etiqueta: 'coleccion',
  tipo: 'texto',
  mes: 'tiempo',
};

/** Los elementos de un grupo, al día con cada cambio. */
export function useElementosDeGrupo(clase: ClaseGrupo | null, valor: string): FrontmatterComun[] {
  const espacio = useEspacioOpcional();
  const [elementos, setElementos] = useState<FrontmatterComun[]>([]);
  useEffect(() => {
    if (!espacio || !clase) return undefined;
    const leer = () => setElementos(elementosDe(clase, valor, espacio.repositorio.elementos()));
    leer();
    return espacio.alCambiar(leer);
  }, [espacio, clase, valor]);
  return elementos;
}

/** El nombre de un grupo en el idioma de la interfaz. */
function useNombreGrupo(clase: ClaseGrupo, valor: string, elementos: readonly FrontmatterComun[]): string {
  const { t, idioma } = useT();
  const sesion = useNombreSesion({ id: valor, elementos: [...elementos] });
  if (clase === 'sesion') return sesion.titulo;
  if (clase === 'tipo') return t(`tipos.${valor as TipoElemento}`);
  if (clase === 'etiqueta') return `#${valor}`;
  if (clase === 'huella') return elementos[0]?.titulo ?? valor;
  if (clase === 'mes') {
    const f = new Date(`${valor}-15T12:00:00`);
    if (Number.isNaN(f.getTime())) return valor;
    const texto = new Intl.DateTimeFormat(idioma, { month: 'long', year: 'numeric' }).format(f);
    return texto.charAt(0).toLocaleUpperCase(idioma) + texto.slice(1);
  }
  return valor;
}

export function Grupo() {
  const { t, idioma } = useT();
  const { clase: crudo, valor } = useParams({ from: '/g/$clase/$valor' });
  const clase = esClaseGrupo(crudo) ? crudo : null;
  const navegar = useNavigate();
  const vista = vistaDe(useSearch({ from: '/g/$clase/$valor' }).vista);
  const cambiarVista = (nueva: Vista) =>
    void navegar({
      to: '/g/$clase/$valor',
      params: { clase: crudo, valor },
      search: nueva === 'lista' ? {} : { vista: nueva },
      replace: true,
    });
  const elementos = useElementosDeGrupo(clase, valor);
  const nombre = useNombreGrupo(clase ?? 'etiqueta', valor, elementos);
  if (!clase || !elementos.length)
    return (
      <Pantalla titulo={clase ? nombre : valor}>
        <GrupoVacio />
      </Pantalla>
    );
  const masAntiguo = new Date(elementos.at(-1)?.creado ?? '');
  const meta = t('pantallas.coleccion.meta', { n: elementos.length });
  const icono = clase === 'tipo' ? (ASPECTO_TIPO[valor as TipoElemento]?.icono ?? 'texto') : ICONOS[clase];
  return (
    <Pantalla
      marcas={
        <>
          <Icono nombre={icono} tamano={16} />
          <span className="lbl">{t(`pantallas.grupo.clases.${clase}`)}</span>
        </>
      }
      titulo={nombre}
      meta={
        Number.isNaN(masAntiguo.getTime())
          ? meta
          : t('pantallas.coleccion.desde', { meta, fecha: fmtDia(masAntiguo, new Date(), idioma) })
      }
      control={
        <div className="row">
          <ExportarGrupo elementos={elementos} nombre={nombre} />
          <SelectorVista vista={vista} alCambiar={cambiarVista} />
        </div>
      }
    >
      <CuerpoGrupo elementos={elementos} vista={vista} id="elementos-grupo" />
    </Pantalla>
  );
}
