/**
 * Inicio (ORG-01, plan §9.1): la cabecera con la fecha y el segmentado «Todo / Sin clasificar · N», el feed por
 * días con lo capturado y la respuesta de Rimor, las búsquedas del compositor, las ideas que vuelven, el triaje
 * con teclado y el compositor fijo abajo.
 */
import { type FrontmatterComun, isoConZona } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCompositor } from '../../captura/compositor';
import { cambiarTipo, sePuedeCambiar } from '../../captura/reprocesar';
import { TarjetaPersistencia } from '../../espacio/Avisos';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { esFresco, useFrescos } from '../../estado/frescos';
import { useT } from '../../i18n/useT';
import { IdeasQueVuelven } from '../../lectores/idea/IdeasQueVuelven';
import { vuelven } from '../../lectores/idea/resurgir';
import { useLectoresOpcional } from '../../lectores/Lectores';
import type { Accion } from '../../respuestas/tipos';
import type { Atajo } from '../../ui/atajos/atajos';
import { useAtajos } from '../../ui/atajos/useAtajos';
import { Boton, Segmentado } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Compositor } from '../../ui/componentes/Compositor';
import { Pantalla } from '../Pantalla';
import { DialogoColeccion, DialogoTipo } from './Dialogos';
import { Feed, mensajeDe, moverSeleccion } from './Feed';
import {
  buscarEnMemoria,
  DIAS_POR_TANDA,
  diasConMensajes,
  diasIniciales,
  type FilaFeed,
  type Filtro,
  filasDelFeed,
} from './filas';
import { Mensaje } from './Mensaje';
import { MensajeBusqueda } from './MensajeBusqueda';
import { PrimerUso } from './PrimerUso';

/** Los elementos del repositorio, al día con cada cambio (también los de otra pestaña). */
function useElementos(): readonly FrontmatterComun[] {
  const espacio = useEspacioOpcional();
  const [elementos, setElementos] = useState<readonly FrontmatterComun[]>(() => espacio?.repositorio.elementos() ?? []);
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () => setElementos(espacio.repositorio.elementos());
    leer();
    return espacio.alCambiar(leer);
  }, [espacio]);
  return elementos;
}

/** «Sábado, 17 de octubre». */
const fechaLarga = (fecha: Date, idioma: string) => {
  const texto = new Intl.DateTimeFormat(idioma, { weekday: 'long', day: 'numeric', month: 'long' }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export function Inicio() {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const sinClasificarN = useEspacio((s) => s.sinClasificar);
  const soloLectura = useEspacio((s) => s.soloLectura);
  const busquedas = useCompositor((s) => s.busquedas);
  const responderA = useCompositor((s) => s.responderA);
  const capturados = useFrescos((s) => s.capturados);
  const elementos = useElementos();

  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [sinAcciones, setSinAcciones] = useState<ReadonlySet<string>>(new Set());
  const [coleccionPara, setColeccionPara] = useState<string | null>(null);
  const [tipoPara, setTipoPara] = useState<string | null>(null);
  // Un reloj que avanza cada minuto: «Hoy» cambia a medianoche y lo fresco deja de serlo.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dias = useMemo(() => diasConMensajes(elementos, filtro), [elementos, filtro]);
  const [diasCargados, setDiasCargados] = useState(() => diasIniciales(dias));
  useEffect(() => setDiasCargados((d) => Math.max(d, diasIniciales(dias))), [dias]);

  const conIdeas = useMemo(() => vuelven(elementos, ahora).length > 0, [elementos, ahora]);
  const filas = useMemo(
    () =>
      filasDelFeed(elementos, {
        filtro,
        dias: diasCargados,
        ahora,
        idioma,
        textos: { hoy: t('pantallas.inicio.hoy'), ayer: t('pantallas.inicio.ayer') },
        busquedas,
        conIdeas,
      }),
    [elementos, filtro, diasCargados, ahora, idioma, t, busquedas, conIdeas],
  );
  const legible = useCallback(
    (fm: FrontmatterComun) =>
      lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '',
    [lectores, idioma],
  );
  const resultadosBusqueda = useMemo(
    () => new Map(busquedas.map((b) => [b, buscarEnMemoria(elementos, b.texto, legible)] as const)),
    [busquedas, elementos, legible],
  );

  const abrir = useCallback(
    (ref: string) => {
      useFrescos.getState().abierto(ref);
      void navegar({ to: '/e/$ref', params: { ref } });
    },
    [navegar],
  );

  /** Cambia el frontmatter de un elemento; `null` si no se pudo. */
  const actualizar = useCallback(
    async (fm: FrontmatterComun, cambio: (f: FrontmatterComun) => FrontmatterComun) => {
      if (!espacio) return false;
      const r = await espacio.repositorio
        .actualizarElemento(fm.id, (el) => ({
          ...el,
          frontmatter: { ...cambio(el.frontmatter), modificado: isoConZona(new Date()) },
        }))
        .catch(() => null);
      return !!r?.ok;
    },
    [espacio],
  );

  const archivar = useCallback(
    async (fm: FrontmatterComun) => {
      const previo = fm.estado;
      const hecho = await actualizar(fm, (f) => ({ ...f, estado: 'archivado' }));
      if (!hecho) return avisos?.avisar(t('pantallas.inicio.noArchivado'));
      avisos?.avisar(t('pantallas.inicio.archivado', { ref: fm.ref }), {
        accion: {
          etiqueta: t('pantallas.inicio.deshacer'),
          alPulsar: () =>
            void actualizar(fm, (f) => {
              const { estado: _, ...resto } = f;
              return previo ? { ...resto, estado: previo } : resto;
            }),
        },
      });
    },
    [actualizar, avisos, t],
  );

  const fijar = useCallback(
    async (fm: FrontmatterComun) => {
      const fijado = !fm.fijado;
      const hecho = await actualizar(fm, (f) => {
        const { fijado: _, ...resto } = f;
        return fijado ? { ...resto, fijado: true } : resto;
      });
      if (hecho) avisos?.avisar(t(fijado ? 'pantallas.inicio.fijado' : 'pantallas.inicio.soltado', { ref: fm.ref }));
    },
    [actualizar, avisos, t],
  );

  const anadirColeccion = useCallback(
    async (fm: FrontmatterComun, coleccion: string) => {
      const hecho = await actualizar(fm, (f) => ({
        ...f,
        colecciones: [...new Set([...(f.colecciones ?? []), coleccion])],
      }));
      avisos?.avisar(
        hecho ? t('pantallas.inicio.anadidoA', { ref: fm.ref, coleccion }) : t('pantallas.inicio.noAnadido'),
      );
    },
    [actualizar, avisos, t],
  );

  const alAccion = useCallback(
    (fm: FrontmatterComun, accion: Accion) => {
      if (accion.id.startsWith('coleccion:')) void anadirColeccion(fm, accion.id.slice('coleccion:'.length));
      // Resuelta (también con «No»): no se vuelve a ofrecer.
      setSinAcciones((s) => new Set(s).add(fm.id));
    },
    [anadirColeccion],
  );

  const responder = useCallback((ref: string) => responderA(ref), [responderA]);

  const marcar = useCallback(
    (ref: string) =>
      setMarcados((s) => {
        const nuevo = new Set(s);
        if (!nuevo.delete(ref)) nuevo.add(ref);
        return nuevo;
      }),
    [],
  );

  const lectoresParaTipo = useMemo(() => {
    const fm = mensajeDe(filas, tipoPara);
    if (!fm || !lectores) return [];
    return lectores.registro.lectores.filter((l) => sePuedeCambiar({ frontmatter: fm }, l));
  }, [filas, tipoPara, lectores]);

  const elegirTipo = useCallback(
    async (lector: (typeof lectoresParaTipo)[number]) => {
      const ref = tipoPara;
      setTipoPara(null);
      if (!ref || !espacio) return;
      const nueva = await cambiarTipo(ref, lector, espacio.repositorio).catch(() => null);
      if (!nueva) return avisos?.avisar(t('pantallas.inicio.noCambiado'));
      void espacio.contadores.contar('correccionesDeTipo').catch(() => undefined);
      if (seleccionado === ref) setSeleccionado(nueva);
      avisos?.avisar(t('pantallas.inicio.tipoCambiado', { tipo: t(`tipos.${lector.tipo}`), ref: nueva }));
    },
    [tipoPara, espacio, avisos, t, seleccionado],
  );

  // Triaje con teclado (plan §9.1). El gestor no los atiende dentro de un campo de texto.
  // Los atajos leen siempre el feed y la selección de ahora (no los del momento en que se registraron): una tecla
  // pulsada justo después de un cambio actúa sobre lo que se ve.
  const actual = useRef({ filas, seleccionado });
  useLayoutEffect(() => {
    actual.current = { filas, seleccionado };
  });
  const conSeleccion = useCallback(
    (hacer: (fm: FrontmatterComun) => void) => () => {
      const fm = mensajeDe(actual.current.filas, actual.current.seleccionado);
      if (fm) hacer(fm);
    },
    [],
  );
  const atajos = useMemo<Atajo[]>(
    () => [
      {
        teclas: 'j',
        descripcion: 'atajos.feedSiguiente',
        accion: () => setSeleccionado((s) => moverSeleccion(actual.current.filas, s, 1)),
      },
      {
        teclas: 'k',
        descripcion: 'atajos.feedAnterior',
        accion: () => setSeleccionado((s) => moverSeleccion(actual.current.filas, s, -1)),
      },
      { teclas: 'enter', descripcion: 'atajos.feedAbrir', accion: conSeleccion((fm) => abrir(fm.ref)) },
      { teclas: 'r', descripcion: 'atajos.feedResponder', accion: conSeleccion((fm) => responder(fm.ref)) },
      ...(soloLectura
        ? []
        : ([
            {
              teclas: 'c',
              descripcion: 'atajos.feedColeccion',
              accion: conSeleccion((fm) => setColeccionPara(fm.ref)),
            },
            { teclas: 'e', descripcion: 'atajos.feedArchivar', accion: conSeleccion((fm) => void archivar(fm)) },
            { teclas: 'f', descripcion: 'atajos.feedFijar', accion: conSeleccion((fm) => void fijar(fm)) },
            { teclas: 't', descripcion: 'atajos.feedTipo', accion: conSeleccion((fm) => setTipoPara(fm.ref)) },
          ] satisfies Atajo[])),
      { teclas: 'x', descripcion: 'atajos.feedSeleccionar', accion: conSeleccion((fm) => marcar(fm.ref)) },
      { teclas: 'escape', descripcion: 'atajos.feedVaciarSeleccion', accion: () => setMarcados(new Set()) },
    ],
    [conSeleccion, abrir, responder, archivar, fijar, marcar, soloLectura],
  );
  useAtajos('inicio', atajos);

  const masDias = diasCargados < dias.length;
  const cargarAnteriores = useCallback(() => setDiasCargados((d) => d + DIAS_POR_TANDA), []);

  const pintar = useCallback(
    (fila: FilaFeed) => {
      switch (fila.t) {
        case 'dia':
          return <div className="day">{fila.etiqueta}</div>;
        case 'ideas':
          return <IdeasQueVuelven />;
        case 'busqueda':
          return (
            <MensajeBusqueda
              busqueda={fila.busqueda}
              resultado={resultadosBusqueda.get(fila.busqueda) ?? { total: 0, resultados: [] }}
              alAbrir={abrir}
              alBuscar={(texto) => void navegar({ to: '/buscar', search: { q: texto } })}
            />
          );
        case 'mensaje':
          return (
            <Mensaje
              fm={fila.fm}
              seleccionado={seleccionado === fila.fm.ref}
              marcado={marcados.has(fila.fm.ref)}
              fresco={esFresco(capturados, fila.fm.ref, ahora.getTime())}
              sinAcciones={sinAcciones.has(fila.fm.id)}
              alAbrir={abrir}
              alResponder={responder}
              alArchivar={(fm) => void archivar(fm)}
              alAccion={alAccion}
            />
          );
      }
    },
    [
      resultadosBusqueda,
      abrir,
      navegar,
      seleccionado,
      marcados,
      capturados,
      ahora,
      sinAcciones,
      responder,
      archivar,
      alAccion,
    ],
  );

  const vacio = elementos.length === 0 && busquedas.length === 0;
  const sinNada = !vacio && !filas.some((f) => f.t !== 'dia');
  const existentes = useMemo(
    () => [...new Set(elementos.flatMap((fm) => fm.colecciones ?? []))].sort((a, b) => a.localeCompare(b)),
    [elementos],
  );

  return (
    <>
      <Pantalla
        titulo={t('pantallas.inicio.titulo')}
        meta={fechaLarga(ahora, idioma)}
        control={
          <Segmentado
            etiqueta={t('pantallas.inicio.filtro')}
            valor={filtro}
            alCambiar={setFiltro}
            opciones={[
              { valor: 'todo', etiqueta: t('pantallas.inicio.todo') },
              { valor: 'sinClasificar', etiqueta: t('pantallas.inicio.sinClasificar', { n: sinClasificarN }) },
            ]}
          />
        }
      >
        <TarjetaPersistencia />
        {vacio ? (
          <PrimerUso />
        ) : sinNada ? (
          <div className="empty">
            <b>{t('pantallas.inicio.nadaSinClasificar')}</b>
            <span className="sm">{t('pantallas.inicio.nadaSinClasificarTexto')}</span>
          </div>
        ) : (
          <>
            {masDias && <p className="xs faint cargando-dias">{t('pantallas.inicio.cargando')}</p>}
            <Feed
              filas={filas}
              pintar={pintar}
              enfocado={seleccionado}
              etiqueta={t('pantallas.inicio.feed')}
              {...(masDias ? { alLlegarArriba: cargarAnteriores } : {})}
            />
          </>
        )}
      </Pantalla>
      <div className="col ccol">
        {marcados.size > 0 && (
          <div className="row barra-seleccion" role="status">
            <span className="sm">{t('pantallas.inicio.seleccionados', { n: marcados.size })}</span>
            <Boton pequeno onClick={() => setMarcados(new Set())}>
              {t('pantallas.inicio.vaciarSeleccion')}
            </Boton>
          </div>
        )}
        <Compositor alAbrir={abrir} />
      </div>
      <DialogoColeccion
        refe={coleccionPara}
        existentes={existentes}
        alCerrar={() => setColeccionPara(null)}
        alElegir={(coleccion) => {
          const fm = mensajeDe(filas, coleccionPara);
          setColeccionPara(null);
          if (fm) void anadirColeccion(fm, coleccion);
        }}
      />
      <DialogoTipo
        refe={tipoPara}
        lectores={lectoresParaTipo}
        alCerrar={() => setTipoPara(null)}
        alElegir={(l) => void elegirTipo(l)}
      />
    </>
  );
}
