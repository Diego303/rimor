/**
 * Pantalla de un elemento (VIS-01, ORG-04, ORG-07): la cabecera con tipo, estado, título editable y meta; la vista
 * de su lector con lo común en su «Detalles»; las notas del usuario; fijar, cambiar tipo y papelera. Todo se edita
 * en el sitio, con un clic o con el teclado (`e s t f n Supr`).
 */
import { analizarRef, type Elemento as ElementoFormato, PREFIJOS } from '@rimor/formato';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useT } from '../../i18n/useT';
import { ContextoComparar } from '../../lectores/ContextoComparar';
import type { Lector } from '../../lectores/contrato';
import { ContextoDetalles } from '../../lectores/DetallesElemento';
import { useLectoresOpcional, VistaElemento } from '../../lectores/Lectores';
import type { Atajo } from '../../ui/atajos/atajos';
import { useAtajos } from '../../ui/atajos/useAtajos';
import { Banner, Boton, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { PantallaComparacion } from '../comparacion/Comparacion';
import { DialogoComparar } from '../comparacion/DialogoComparar';
import { useComparar } from '../comparacion/useComparar';
import { DialogoTipo } from '../inicio/Dialogos';
import { Pantalla } from '../Pantalla';
import { AccionesElemento, MarcasElemento, metaDe, TituloElemento } from './Cabecera';
import { FilasComunes } from './Comunes';
import { DialogoEstado, DialogoOriginal } from './Dialogos';
import { Notas } from './Notas';
import { useElementoVivo } from './useElementoVivo';

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

type Dialogo = 'estado' | 'tipo' | 'original' | 'comparar' | null;

function PantallaElemento({ el, enPapelera }: { el: ElementoFormato; enPapelera: boolean }) {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const { editar, editarFrontmatter } = useEdicion();
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
      if (titulo && !(await editarFrontmatter(fm.id, (f) => ({ ...f, titulo })))) fallo();
    },
    [fm.id, fm.titulo, editarFrontmatter, fallo],
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
      if (!(await editar(fm.id, (actual) => ({ ...actual, notas })))) fallo();
    },
    [fm.id, el.notas, editar, fallo],
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
      void navegar({ to: '/e/$ref', params: { ref }, replace: true });
      avisos?.avisar(t('pantallas.inicio.tipoCambiado', { tipo: t(`tipos.${nuevo.tipo}`), ref }));
    },
    [espacio, lector, fm.id, navegar, avisos, t],
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

  /** Colecciones y etiquetas del espacio, para sugerirlas al editar. */
  const existentes = useCallback(() => {
    const todos = espacio?.repositorio.elementos() ?? [];
    const ordenados = (lista: string[]) => [...new Set(lista)].sort((a, b) => a.localeCompare(b));
    return {
      colecciones: ordenados(todos.flatMap((f) => f.colecciones ?? [])),
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

  const comunes = (
    <FilasComunes
      fm={fm}
      editable={editable}
      existentes={existentes}
      alGuardarColecciones={(texto, inicial) => void guardarLista(texto, inicial, 'colecciones')}
      alGuardarEtiquetas={(texto, inicial) => void guardarLista(texto, inicial, 'etiquetas')}
      alCambiarTipo={() => setDialogo('tipo')}
      alVerOriginal={() => setDialogo('original')}
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
        espacio && !soloLectura ? (
          <AccionesElemento
            fijado={Boolean(fm.fijado)}
            enPapelera={enPapelera}
            alFijar={() => void fijar()}
            alPapelera={() => void aPapelera()}
            alRestaurar={() => void restaurar(fm.id, fm.ref)}
          />
        ) : undefined
      }
    >
      {enPapelera && <Banner>{t('pantallas.elemento.enPapelera')}</Banner>}
      <ContextoDetalles.Provider value={comunes}>
        <ContextoComparar.Provider value={sePuedeComparar ? abrirComparar : null}>
          <VistaElemento el={el} editable={!enPapelera} />
        </ContextoComparar.Provider>
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
