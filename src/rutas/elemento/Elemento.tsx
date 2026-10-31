/**
 * Pantalla de un elemento (VIS-01, ORG-04, ORG-07): la cabecera con tipo, estado, título editable y meta; la vista
 * de su lector con lo común en su «Detalles»; las notas del usuario; fijar, cambiar tipo y papelera. Todo se edita
 * en el sitio, con un clic o con el teclado (`e s t f n Supr`).
 */
import { analizarRef, type Elemento as ElementoFormato, isoConZona, PREFIJOS } from '@rimor/formato';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { VersionGuardada } from '../../almacen/repositorio';
import { aprenderCorreccion } from '../../captura/aprender';
import { cambiarTipo, sePuedeCambiar } from '../../captura/reprocesar';
import { claseDe } from '../../comparaciones/clases';
import { useEspacioOpcional } from '../../espacio/Espacio';
import {
  aplicarCambios,
  conColecciones,
  conEstado,
  conEtiquetas,
  conFijado,
  limpiarColeccion,
  limpiarEtiqueta,
  listaDeTexto,
  tituloNuevo,
} from '../../espacio/ediciones';
import { useEdicion } from '../../espacio/useEdicion';
import { useEspacio } from '../../estado/espacio';
import { useFrescos } from '../../estado/frescos';
import { formarSiEsError } from '../../hilos/formar';
import { elementosDe, hiloDe, moverAHilo } from '../../hilos/hilos';
import { useT } from '../../i18n/useT';
import { ContextoComparar } from '../../lectores/ContextoComparar';
import { ContextoHilo } from '../../lectores/ContextoHilo';
import { ContextoVersion, ContextoVersionVista } from '../../lectores/ContextoVersion';
import type { Lector } from '../../lectores/contrato';
import { ContextoAntesDeDetalles, ContextoDetalles } from '../../lectores/DetallesElemento';
import { useLectoresOpcional, VistaElemento } from '../../lectores/Lectores';
import type { Atajo } from '../../ui/atajos/atajos';
import { useAtajos } from '../../ui/atajos/useAtajos';
import { Banner, Boton, Segmentado, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { PantallaComparacion } from '../comparacion/Comparacion';
import { DialogoComparar } from '../comparacion/DialogoComparar';
import { useComparar } from '../comparacion/useComparar';
import { DialogoTipo } from '../inicio/Dialogos';
import { Pantalla } from '../Pantalla';
import { AccionesElemento, MarcasElemento, metaDe, TituloElemento } from './Cabecera';
import { FilasComunes } from './Comunes';
import { DialogoEstado, DialogoMoverHilo, DialogoOriginal } from './Dialogos';
import { Notas } from './Notas';
import { useElementoVivo } from './useElementoVivo';
import {
  anteriorDe,
  CambiosDeVersion,
  ListaVersiones,
  useEstadoVersiones,
  useVersiones,
  versionesParaVer,
} from './Versiones';

export function Elemento() {
  const { ref } = useParams({ from: '/e/$ref' });
  // Las comparaciones (`CMP-0004`) van a la misma ruta que los elementos: así llevan a ellas `[[CMP-0004]]` y sus
  // refs pulsables.
  return analizarRef(ref)?.prefijo === PREFIJOS.comparacion ? (
    <PantallaComparacion refe={ref} />
  ) : (
    <ElementoNormal refe={ref} />
  );
}

function ElementoNormal({ refe: ref }: { refe: string }) {
  const { t } = useT();
  const navegar = useNavigate();
  const leido = useElementoVivo(ref);

  // Una ref antigua (un alias, tras cambiar el tipo) o el id llevan a la ref vigente.
  const vigente = leido.estado === 'listo' ? leido.vigente : null;
  useEffect(() => {
    if (vigente && vigente !== ref) void navegar({ to: '/e/$ref', params: { ref: vigente }, replace: true });
  }, [vigente, ref, navegar]);

  if (leido.estado === 'listo') return <PantallaElemento el={leido.el} enPapelera={leido.enPapelera} />;
  // Leer un elemento es casi inmediato: mientras tanto, solo la cabecera con su ref (sin una espera que parpadee).
  return (
    <Pantalla titulo={ref}>
      {leido.estado === 'no-encontrado' && (
        <>
          <Vacio titulo={t('pantallas.elemento.noEncontradoTitulo')}>{t('pantallas.elemento.noEncontrado')}</Vacio>
          <div className="row">
            <Boton pequeno onClick={() => void navegar({ to: '/' })}>
              {t('pantallas.elemento.volver')}
            </Boton>
          </div>
        </>
      )}
    </Pantalla>
  );
}

type Dialogo = 'estado' | 'tipo' | 'original' | 'comparar' | 'hilo' | null;

function PantallaElemento({ el, enPapelera }: { el: ElementoFormato; enPapelera: boolean }) {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const { editarFrontmatter, editarConHistorial } = useEdicion();
  const fm = el.frontmatter;
  const lector: Lector | null = lectores?.registro.paraElemento(el) ?? null;
  const editable = Boolean(espacio) && !soloLectura && !enPapelera;

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [editandoNota, setEditandoNota] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  // Abrirlo es haberlo visto: deja de estar fresco en Inicio.
  useEffect(() => useFrescos.getState().abierto(fm.id), [fm.id]);

  const fallo = useCallback(() => avisos?.avisar(t('pantallas.elemento.noGuardado')), [avisos, t]);

  const guardarTitulo = useCallback(
    async (escrito: string) => {
      const titulo = tituloNuevo(fm.titulo, escrito);
      // Una edición del usuario deja copia en el historial (IN-029).
      if (titulo && !(await editarConHistorial(fm.id, (e) => ({ ...e, frontmatter: { ...e.frontmatter, titulo } }))))
        fallo();
    },
    [fm.id, fm.titulo, editarConHistorial, fallo],
  );

  const elegirEstado = useCallback(
    async (estado: string) => {
      setDialogo(null);
      if (!(await editarFrontmatter(fm.id, (f) => conEstado(f, estado)))) fallo();
    },
    [fm.id, editarFrontmatter, fallo],
  );

  const fijar = useCallback(async () => {
    // Se alterna lo que hay al escribir (no lo pintado): dos `f` seguidos fijan y sueltan.
    let fijado = false;
    const hecho = await editarFrontmatter(fm.id, (f) => {
      fijado = !f.fijado;
      return conFijado(f, fijado);
    });
    if (hecho) avisos?.avisar(t(fijado ? 'pantallas.inicio.fijado' : 'pantallas.inicio.soltado', { ref: fm.ref }));
    else fallo();
  }, [fm.id, fm.ref, editarFrontmatter, avisos, t, fallo]);

  /**
   * Guarda una lista escrita a mano si cambió: solo lo añadido y lo quitado respecto a lo que había al empezar,
   * sobre la lista de ahora (lo que otro añadió mientras tanto se queda).
   */
  const guardarLista = useCallback(
    async (texto: string, inicial: readonly string[], cual: 'colecciones' | 'etiquetas') => {
      const lista = listaDeTexto(texto, cual === 'colecciones' ? limpiarColeccion : limpiarEtiqueta);
      if (lista.join('\n') === inicial.join('\n')) return;
      const con = cual === 'colecciones' ? conColecciones : conEtiquetas;
      if (!(await editarFrontmatter(fm.id, (f) => con(f, aplicarCambios(f[cual] ?? [], inicial, lista))))) fallo();
    },
    [fm.id, editarFrontmatter, fallo],
  );

  const guardarNota = useCallback(
    async (texto: string) => {
      const notas = texto.trimEnd();
      if (notas === el.notas.trimEnd()) return;
      if (!(await editarConHistorial(fm.id, (actual) => (actual.notas === notas ? actual : { ...actual, notas }))))
        fallo();
    },
    [fm.id, el.notas, editarConHistorial, fallo],
  );

  const restaurar = useCallback(
    async (id: string, refe: string) => {
      const r = espacio ? await espacio.repositorio.restaurar(id).catch(() => null) : null;
      avisos?.avisar(t(r?.ok ? 'pantallas.elemento.restaurado' : 'pantallas.elemento.noRestaurado', { ref: refe }));
    },
    [espacio, avisos, t],
  );

  const aPapelera = useCallback(async () => {
    if (!espacio) return;
    const r = await espacio.repositorio.moverAPapelera(fm.id).catch(() => null);
    if (!r?.ok) return avisos?.avisar(t('pantallas.elemento.noMovido'));
    void navegar({ to: '/' });
    avisos?.avisar(t('pantallas.elemento.movido', { ref: fm.ref }), {
      accion: { etiqueta: t('pantallas.inicio.deshacer'), alPulsar: () => void restaurar(fm.id, fm.ref) },
    });
  }, [espacio, fm.id, fm.ref, navegar, avisos, t, restaurar]);

  const otrosLectores = useMemo(
    () => (dialogo === 'tipo' && lectores ? lectores.registro.lectores.filter((l) => sePuedeCambiar(el, l)) : []),
    [dialogo, lectores, el],
  );

  const elegirTipo = useCallback(
    async (nuevo: Lector) => {
      setDialogo(null);
      if (!espacio) return;
      const opciones = lector ? { anterior: lector } : {};
      const ref = await cambiarTipo(fm.id, nuevo, espacio.repositorio, opciones).catch(() => null);
      if (!ref) return avisos?.avisar(t('pantallas.inicio.noCambiado'));
      void espacio.contadores.contar('correccionesDeTipo').catch(() => undefined);
      // Tres correcciones de contenidos que empiezan igual proponen una regla en el feed (IN-049).
      aprenderCorreccion(espacio, el.original, nuevo.tipo);
      // Ahora es un error: entra en el hilo de su huella, si lo hay (IN-030).
      void formarSiEsError(ref, { repositorio: espacio.repositorio, entidades: espacio.entidades }).catch(() => null);
      void navegar({ to: '/e/$ref', params: { ref }, replace: true });
      avisos?.avisar(t('pantallas.inicio.tipoCambiado', { tipo: t(`tipos.${nuevo.tipo}`), ref }));
    },
    [espacio, lector, el.original, fm.id, navegar, avisos, t],
  );

  // «Comparar con…» (logs y mediciones): los del mismo tipo y lector, salvo él mismo.
  const { comparar } = useComparar();
  const abrirComparar = useCallback(() => setDialogo('comparar'), []);
  const sePuedeComparar = editable && claseDe(fm.tipo) !== null;
  const candidatos = useMemo(
    () =>
      dialogo === 'comparar' && espacio
        ? espacio.repositorio
            .elementos()
            .filter((o) => o.tipo === fm.tipo && o.id !== fm.id && o.lector.nombre === fm.lector.nombre)
        : [],
    [dialogo, espacio, fm.tipo, fm.id, fm.lector.nombre],
  );
  const resumenDe = useCallback(
    (o: (typeof candidatos)[number]) => {
      try {
        return lectores?.registro.paraElemento({ frontmatter: o })?.resumenLegible?.(o.lector.resumen, idioma) ?? '';
      } catch {
        return '';
      }
    },
    [lectores, idioma],
  );

  // Versiones (IN-029): las copias del historial, la versión de contenido anterior y restaurar.
  const versiones = useVersiones(el);
  const anterior = anteriorDe(el, versiones);
  const versionAnterior = useMemo(
    () =>
      anterior?.elemento.original != null ? { version: anterior.version, original: anterior.elemento.original } : null,
    [anterior],
  );
  // Prompt (CMP-02, como `SC.prompt`): «v1 · v2 · actual» en la cabecera; una anterior se ve sin restaurarla.
  const paraVer = useMemo(
    () => (lector?.nombre === 'prompt' && versiones ? versionesParaVer(versiones, fm.version ?? 1) : []),
    [lector, versiones, fm.version],
  );
  const [vista, setVista] = useState<number | null>(null);
  // Otro elemento, o una versión nueva: se vuelve a la actual.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reinicia al cambiar de elemento o de versión.
  useEffect(() => setVista(null), [fm.id, fm.version]);
  const vistaVersion = useMemo(() => {
    const v = paraVer.find((p) => p.version === vista);
    return v?.elemento.original != null ? { version: v.version, original: v.elemento.original } : null;
  }, [paraVer, vista]);

  // Lo que los plegados de versiones recuerdan aunque la vista del lector se vuelva a montar.
  const estadoVersiones = useEstadoVersiones(fm.id);
  const restaurarVersion = useCallback(
    async (v: VersionGuardada) => {
      if (!espacio) return null;
      const copia = v.elemento;
      const r = await espacio.repositorio
        .guardarConHistorial(
          fm.id,
          (actual) => {
            // Igual que la actual: nada que restaurar (ni copia nueva en el historial).
            if (
              actual.original === copia.original &&
              actual.notas === copia.notas &&
              actual.frontmatter.titulo === copia.frontmatter.titulo
            )
              return null;
            // El lector es el de ahora (tras cambiar el tipo, la copia lleva el de antes); su resumen, el de la
            // copia si es del mismo lector, y si no, vacío hasta que se derive.
            const mismoLector = copia.frontmatter.lector.nombre === actual.frontmatter.lector.nombre;
            return {
              ...actual,
              original: copia.original,
              notas: copia.notas,
              frontmatter: {
                ...actual.frontmatter,
                titulo: copia.frontmatter.titulo,
                hash: copia.frontmatter.hash,
                ocultados: copia.frontmatter.ocultados,
                lector: { ...actual.frontmatter.lector, resumen: mismoLector ? copia.frontmatter.lector.resumen : {} },
                modificado: isoConZona(new Date()),
              },
            };
          },
          'restaurar',
        )
        .catch(() => null);
      if (!r?.ok) {
        avisos?.avisar(t('pantallas.elemento.versiones.noRestaurada'));
        return null;
      }
      if (!r.valor.copia) {
        avisos?.avisar(t('pantallas.elemento.versiones.sinCambios'));
        return null;
      }
      avisos?.avisar(t('pantallas.elemento.versiones.restaurada', { n: r.valor.version }));
      return r.valor.version;
    },
    [espacio, fm.id, avisos, t],
  );

  // El hilo del elemento (D13: uno solo) y moverlo a otro, con confirmación.
  const hiloActual = espacio ? hiloDe(fm.hilo, espacio.entidades) : null;
  const otrosHilos = useMemo(
    () =>
      dialogo === 'hilo' && espacio
        ? espacio.entidades
            .lista('hilo')
            // Abiertos, con algo dentro (uno que se quedó vacío no es un destino) y que no sea el suyo.
            .filter(
              (h) => h.estado === 'abierto' && h.ref !== fm.hilo && elementosDe(h.ref, espacio.repositorio).length > 0,
            )
            .sort((a, b) => Date.parse(b.modificado ?? b.creado) - Date.parse(a.modificado ?? a.creado))
        : [],
    [dialogo, espacio, fm.hilo],
  );
  const moverHilo = useCallback(
    async (destino: string | null) => {
      setDialogo(null);
      if (!espacio) return;
      const hecho = await moverAHilo(fm.id, destino, {
        repositorio: espacio.repositorio,
        entidades: espacio.entidades,
      }).catch(() => false);
      if (!hecho) return avisos?.avisar(t('pantallas.hilo.noMovido'));
      avisos?.avisar(
        destino
          ? t('pantallas.hilo.movido', { ref: fm.ref, hilo: destino })
          : t('pantallas.hilo.sacado', { ref: fm.ref }),
      );
    },
    [espacio, fm.id, fm.ref, avisos, t],
  );

  /** Colecciones y etiquetas del espacio, para sugerirlas al editar. */
  const existentes = useCallback(() => {
    const todos = espacio?.repositorio.elementos() ?? [];
    const ordenados = (lista: string[]) => [...new Set(lista)].sort((a, b) => a.localeCompare(b));
    return {
      colecciones: ordenados([
        ...(espacio?.colecciones.lista().map((c) => c.id) ?? []),
        ...todos.flatMap((f) => f.colecciones ?? []),
      ]),
      etiquetas: ordenados(todos.flatMap((f) => f.etiquetas ?? [])),
    };
  }, [espacio]);

  // Los atajos leen lo de ahora (un frontmatter recién releído), no lo del momento en que se registraron.
  const actual = useRef({ fijar, aPapelera });
  useLayoutEffect(() => {
    actual.current = { fijar, aPapelera };
  });
  const atajos = useMemo<Atajo[]>(
    () =>
      editable
        ? [
            { teclas: 'e', descripcion: 'atajos.elementoTitulo', accion: () => setEditandoTitulo(true) },
            { teclas: 's', descripcion: 'atajos.elementoEstado', accion: () => setDialogo('estado') },
            { teclas: 't', descripcion: 'atajos.elementoTipo', accion: () => setDialogo('tipo') },
            { teclas: 'f', descripcion: 'atajos.elementoFijar', accion: () => void actual.current.fijar() },
            { teclas: 'n', descripcion: 'atajos.elementoNota', accion: () => setEditandoNota(true) },
            { teclas: 'delete', descripcion: 'atajos.elementoPapelera', accion: () => void actual.current.aPapelera() },
            // `#` también (en un teclado sin Supr).
            { teclas: '#', descripcion: 'atajos.elementoPapelera', accion: () => void actual.current.aPapelera() },
          ]
        : [],
    [editable],
  );
  useAtajos('elemento', atajos);

  let legible = '';
  try {
    legible = lector?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
  } catch {
    // Un resumen de otra forma (de otra versión del lector) no rompe la cabecera.
  }

  // Los plegados de versiones van antes de «Detalles», que es el último (guía §8.2).
  const antesDeDetalles = (
    <>
      {anterior && <CambiosDeVersion el={el} anterior={anterior} estado={estadoVersiones} />}
      {versiones && (
        <ListaVersiones
          el={el}
          versiones={versiones}
          editable={editable}
          alRestaurar={restaurarVersion}
          estado={estadoVersiones}
        />
      )}
    </>
  );

  const abrirHilo = (r: string) => void navegar({ to: '/hilo/$ref', params: { ref: r } });

  const comunes = (
    <FilasComunes
      fm={fm}
      editable={editable}
      existentes={existentes}
      alGuardarColecciones={(texto, inicial) => void guardarLista(texto, inicial, 'colecciones')}
      alGuardarEtiquetas={(texto, inicial) => void guardarLista(texto, inicial, 'etiquetas')}
      alCambiarTipo={() => setDialogo('tipo')}
      alVerOriginal={() => setDialogo('original')}
      hilo={hiloActual ? { ref: hiloActual.ref, titulo: hiloActual.titulo } : null}
      alAbrirHilo={abrirHilo}
      alMoverHilo={() => setDialogo('hilo')}
    />
  );

  return (
    <Pantalla
      marcas={<MarcasElemento fm={fm} lector={lector} editable={editable} alPedirEstado={() => setDialogo('estado')} />}
      titulo={
        <TituloElemento
          titulo={fm.titulo}
          editable={editable}
          editando={editandoTitulo}
          alEditar={setEditandoTitulo}
          alGuardar={(titulo) => void guardarTitulo(titulo)}
        />
      }
      meta={metaDe(fm, legible, new Date(), idioma, t)}
      control={
        paraVer.length || (espacio && !soloLectura) ? (
          <div className="row">
            {paraVer.length > 0 && (
              <Segmentado
                etiqueta={t('pantallas.elemento.versiones.verVersion')}
                valor={String(vista ?? 'actual')}
                opciones={[
                  ...paraVer.map((v) => ({
                    valor: String(v.version),
                    etiqueta: t('pantallas.elemento.versiones.version', { n: v.version }),
                  })),
                  {
                    valor: 'actual',
                    etiqueta: t('pantallas.elemento.versiones.versionActual', { n: fm.version ?? 1 }),
                  },
                ]}
                alCambiar={(v) => setVista(v === 'actual' ? null : Number(v))}
              />
            )}
            {espacio && !soloLectura && (
              <AccionesElemento
                fijado={Boolean(fm.fijado)}
                enPapelera={enPapelera}
                alFijar={() => void fijar()}
                alPapelera={() => void aPapelera()}
                alRestaurar={() => void restaurar(fm.id, fm.ref)}
              />
            )}
          </div>
        ) : undefined
      }
    >
      {enPapelera && <Banner>{t('pantallas.elemento.enPapelera')}</Banner>}
      <ContextoDetalles.Provider value={comunes}>
        <ContextoAntesDeDetalles.Provider value={antesDeDetalles}>
          <ContextoComparar.Provider value={sePuedeComparar ? abrirComparar : null}>
            <ContextoHilo.Provider value={hiloActual ? () => abrirHilo(hiloActual.ref) : null}>
              <ContextoVersion.Provider value={versionAnterior}>
                <ContextoVersionVista.Provider value={vistaVersion}>
                  <VistaElemento el={el} editable={!enPapelera} />
                </ContextoVersionVista.Provider>
              </ContextoVersion.Provider>
            </ContextoHilo.Provider>
          </ContextoComparar.Provider>
        </ContextoAntesDeDetalles.Provider>
      </ContextoDetalles.Provider>
      <Notas
        notas={el.notas}
        editable={editable}
        editando={editandoNota}
        alEmpezar={() => setEditandoNota(true)}
        alTerminar={(texto) => {
          setEditandoNota(false);
          if (texto !== null) void guardarNota(texto);
        }}
      />
      <DialogoEstado
        abierto={dialogo === 'estado'}
        refe={fm.ref}
        estado={fm.estado}
        lector={lector}
        alElegir={(estado) => void elegirEstado(estado)}
        alCerrar={() => setDialogo(null)}
      />
      <DialogoTipo
        refe={dialogo === 'tipo' ? fm.ref : null}
        lectores={otrosLectores}
        alCerrar={() => setDialogo(null)}
        alElegir={(l) => void elegirTipo(l)}
      />
      <DialogoOriginal abierto={dialogo === 'original'} el={el} alCerrar={() => setDialogo(null)} />
      <DialogoMoverHilo
        abierto={dialogo === 'hilo'}
        refe={fm.ref}
        actual={hiloActual}
        otros={otrosHilos}
        alMover={(destino) => void moverHilo(destino)}
        alCerrar={() => setDialogo(null)}
      />
      <DialogoComparar
        abierto={dialogo === 'comparar'}
        refe={fm.ref}
        candidatos={candidatos}
        resumen={resumenDe}
        alCerrar={() => setDialogo(null)}
        alElegir={(otra) => {
          setDialogo(null);
          // Este, la referencia; el elegido, el que se compara (en la comparación se pueden intercambiar).
          void comparar(fm.ref, otra);
        }}
      />
    </Pantalla>
  );
}
