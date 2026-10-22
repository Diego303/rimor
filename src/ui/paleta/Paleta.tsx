/**
 * Paleta de comandos (BUS-03, `Ctrl+K`): un diálogo con la caja de Buscar y una lista que mezcla las acciones de
 * la pantalla y las globales (los atajos, con o sin tecla), las colecciones y, al escribir, los elementos que
 * encuentra el buscador. Se maneja con el teclado (flechas, Ctrl+Inicio, Ctrl+Fin, Enter, Esc) como un
 * *combobox*: Inicio y Fin solos siguen moviéndose por lo escrito. Las últimas usadas salen primero.
 */
import { useNavigate } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBuscar } from '../../busqueda/Busqueda';
import { Resaltado } from '../../busqueda/Resaltado';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import type { Vista } from '../../rutas/vistas/orden';
import { Teclas } from '../atajos/AyudaAtajos';
import { esGlobal } from '../atajos/atajos';
import { useGestorAtajos } from '../atajos/useAtajos';
import { IconoTipo } from '../componentes';
import { Icono, type NombreIcono } from '../iconos/Icono';
import { apuntarReciente, COINCIDE_BIEN, type Entrada, type EntradaOrdenada, leerRecientes, ordenar } from './entradas';

/** Los elementos del buscador que salen en la paleta. */
export const MAX_ELEMENTOS_PALETA = 6;

const ICONO: Record<Exclude<Entrada['grupo'], 'elemento'>, NombreIcono> = {
  accion: 'comando',
  coleccion: 'coleccion',
  buscar: 'buscar',
};

interface Props {
  abierta: boolean;
  alCerrar: () => void;
}

export function Paleta({ abierta, alCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal?.();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  const { t } = useT();
  return (
    <dialog ref={dialogo} className="dialogo card paleta" aria-label={t('paleta.titulo')} onClose={alCerrar}>
      {abierta && <Contenido alCerrar={() => dialogo.current?.close()} />}
    </dialog>
  );
}

/** Lo de dentro, montado solo con la paleta abierta: cada apertura empieza de cero y lee lo de ese momento. */
function Contenido({ alCerrar }: { alCerrar: () => void }) {
  const { t } = useT();
  const id = useId();
  const gestor = useGestorAtajos();
  const espacio = useEspacioOpcional();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  // La activa se recuerda por su id: si llegan los elementos del buscador, sigue siendo la misma.
  const [activaId, setActivaId] = useState<string | null>(null);
  const [recientes] = useState(() => leerRecientes());
  const consulta = texto.trim();
  const { busqueda, buscando } = useBuscar(consulta);

  // Lo que se puede hacer ahora: se lee al abrir (la paleta es modal; nada cambia por detrás mientras tanto).
  const fijas = useMemo<Entrada[]>(() => {
    const acciones: Entrada[] = gestor.acciones().map(({ ambito, atajo }) => ({
      id: `accion:${atajo.descripcion}`,
      grupo: 'accion',
      titulo: t(atajo.descripcion),
      detalle: esGlobal(ambito) ? t('paleta.global') : t('paleta.pantalla'),
      ...(atajo.teclas ? { teclas: atajo.teclas } : {}),
      ejecutar: atajo.accion,
    }));
    const colecciones: Entrada[] = (espacio?.colecciones.lista() ?? []).map((c) => ({
      id: `coleccion:${c.id}`,
      grupo: 'coleccion',
      titulo: c.nombre,
      detalle: t('paleta.coleccion'),
      ejecutar: () => void navegar({ to: '/c/$coleccion', params: { coleccion: c.id } }),
    }));
    return [...acciones, ...colecciones];
  }, [gestor, espacio, navegar, t]);

  const entradas = useMemo<EntradaOrdenada[]>(() => {
    const lista = ordenar(consulta, fijas, recientes);
    if (!consulta) return lista;
    // Solo los de lo escrito ahora: los de la tecla anterior podrían abrirse con Enter sin tocar.
    const encontrados = buscando ? [] : (busqueda?.resultados ?? []);
    const elementos: EntradaOrdenada[] = encontrados.slice(0, MAX_ELEMENTOS_PALETA).map((r) => ({
      id: `elemento:${r.fm.id}`,
      grupo: 'elemento',
      titulo: r.fm.titulo,
      detalle: `${t(`tipos.${r.fm.tipo}`)} · ${r.fm.ref}`,
      tipo: r.fm.tipo,
      reciente: false,
      puntuacion: 0,
      ejecutar: () => void navegar({ to: '/e/$ref', params: { ref: r.fm.ref } }),
    }));
    const buscar: EntradaOrdenada = {
      id: 'buscar',
      grupo: 'buscar',
      titulo: t('paleta.buscarEn', { texto: consulta }),
      reciente: false,
      puntuacion: 0,
      // Desde Buscar, con la vista que tenga.
      ejecutar: () =>
        void navegar({
          to: '/buscar',
          search: (antes: { vista?: Vista }) => ({ q: consulta, ...(antes.vista ? { vista: antes.vista } : {}) }),
        }),
    };
    // Lo que casa por poco (las letras en orden) va después de los elementos: «rec» abre «Receta…», no «Escribir…».
    const fuertes = lista.filter((e) => e.puntuacion >= COINCIDE_BIEN);
    const debiles = lista.filter((e) => e.puntuacion < COINCIDE_BIEN);
    return [...fuertes, ...elementos, ...debiles, buscar];
  }, [consulta, fijas, recientes, busqueda, buscando, navegar, t]);

  const actual = Math.max(
    0,
    entradas.findIndex((e) => e.id === activaId),
  );
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  });

  function ejecutar(e: Entrada) {
    // Los elementos y «Buscar…» dependen de lo escrito: no se recuerdan.
    if (e.grupo === 'accion' || e.grupo === 'coleccion') apuntarReciente(e.id);
    // Primero se cierra: la acción puede abrir otro diálogo o llevar el foco a otro sitio.
    alCerrar();
    e.ejecutar();
  }

  function alPulsar(ev: KeyboardEvent<HTMLInputElement>) {
    // Mientras un IME compone (japonés, chino), Enter y las flechas son suyos.
    if (ev.nativeEvent.isComposing || ev.keyCode === 229) return;
    const n = entradas.length;
    const mod = ev.ctrlKey || ev.metaKey;
    const mover = (i: number) => {
      ev.preventDefault();
      setActivaId(n ? (entradas[(i + n) % n]?.id ?? null) : null);
    };
    // Ctrl (o Cmd) con Inicio o Fin, y Cmd con las flechas (lo de macOS), van a los extremos.
    if ((ev.key === 'Home' && mod) || (ev.key === 'ArrowUp' && ev.metaKey)) mover(0);
    else if ((ev.key === 'End' && mod) || (ev.key === 'ArrowDown' && ev.metaKey)) mover(n - 1);
    else if (ev.key === 'ArrowDown') mover(actual + 1);
    else if (ev.key === 'ArrowUp') mover(actual - 1);
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      const e = entradas[actual];
      if (e) ejecutar(e);
    } else if (ev.key.toLowerCase() === 'k' && mod) {
      ev.preventDefault();
      alCerrar();
    }
  }

  const etiquetaGrupo = (e: EntradaOrdenada) =>
    e.reciente ? t('paleta.recientes') : e.grupo === 'buscar' ? null : t(`paleta.grupos.${e.grupo}`);
  const idOpcion = (i: number) => `${id}-${i}`;

  // Los grupos, seguidos: cada uno con su etiqueta, también para el lector de pantalla (`role="group"`).
  const grupos: { etiqueta: string | null; entradas: { e: EntradaOrdenada; i: number }[] }[] = [];
  entradas.forEach((e, i) => {
    const etiqueta = etiquetaGrupo(e);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.entradas.push({ e, i });
    else grupos.push({ etiqueta, entradas: [{ e, i }] });
  });

  const opcion = (e: EntradaOrdenada, i: number) => (
    // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado va por la caja (combobox con aria-activedescendant).
    <div
      key={e.id}
      id={idOpcion(i)}
      role="option"
      tabIndex={-1}
      aria-selected={i === actual}
      className="it"
      onClick={() => ejecutar(e)}
      onMouseMove={() => i !== actual && setActivaId(e.id)}
    >
      <span className="ic">
        {e.tipo ? (
          <IconoTipo tipo={e.tipo} />
        ) : (
          <span className="ti">
            <Icono nombre={ICONO[e.grupo as Exclude<Entrada['grupo'], 'elemento'>]} />
          </span>
        )}
      </span>
      <span className="tt">
        <Resaltado texto={e.titulo} terminos={consulta ? consulta.split(/\s+/) : []} />
      </span>
      {e.detalle && <span className="mm">{e.detalle}</span>}
      {e.teclas && (
        <span className="rt">
          <Teclas teclas={e.teclas} />
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="cbox caja-buscar">
        <Icono nombre="buscar" tamano={17} />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-lista`}
          aria-activedescendant={entradas.length ? idOpcion(actual) : undefined}
          aria-autocomplete="list"
          aria-label={t('paleta.titulo')}
          placeholder={t('paleta.placeholder')}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivaId(null);
          }}
          onKeyDown={alPulsar}
          spellCheck={false}
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: la paleta se abre para escribir en ella.
          autoFocus
        />
      </div>
      <div ref={lista} id={`${id}-lista`} role="listbox" aria-label={t('paleta.titulo')} className="list paleta-lista">
        {entradas.length === 0 && <p className="sm muted paleta-vacia">{t('paleta.nada')}</p>}
        {grupos.map((g) =>
          g.etiqueta ? (
            // biome-ignore lint/a11y/useSemanticElements: un grupo de opciones dentro de un listbox, no un formulario.
            <div key={g.entradas[0]?.e.id} role="group" aria-label={g.etiqueta} className="contents">
              <span className="lbl paleta-grupo" aria-hidden="true">
                {g.etiqueta}
              </span>
              {g.entradas.map(({ e, i }) => opcion(e, i))}
            </div>
          ) : (
            g.entradas.map(({ e, i }) => opcion(e, i))
          ),
        )}
      </div>
    </>
  );
}
