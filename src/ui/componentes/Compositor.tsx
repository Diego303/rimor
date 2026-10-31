/**
 * Compositor de Inicio (IN-015, CAP-03, CAP-13): se captura como en un chat. Enter guarda, Mayús+Enter salta de
 * línea; la vista previa dice qué tipo saldría, con qué indicaciones y cuántos secretos se ocultarán; `@`, `#`
 * y `/` se autocompletan. Pintado con las reglas `.composer`/`.cbox` de la pantalla de referencia.
 */
import type { TipoElemento } from '@rimor/formato';
import { isoConZona, TIPOS_ELEMENTO } from '@rimor/formato';
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBuscar } from '../../busqueda/Busqueda';
import { ATRIBUTO_ZONA_SOLTAR, type ResultadoDe, useCaptura } from '../../captura/Captura';
import { useCompositor } from '../../captura/compositor';
import { partes } from '../../captura/dividir';
import type { EntradaCaptura } from '../../captura/flujo';
import { analizarIndicaciones } from '../../captura/indicaciones';
import { PREVIA_EN_WORKER, type Previa, previsualizar } from '../../captura/previa';
import { opcionesCaptura } from '../../espacio/ajustes';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { anadirAHilo, hiloDe, hiloPara } from '../../hilos/hilos';
import { fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Icono } from '../iconos/Icono';
import { useAvisos } from './Avisos';
import { Boton } from './Boton';
import { ChipTipo, Estado, Ref } from './Marcas';

/** Espera tras la última tecla antes de recalcular la vista previa. */
export const ESPERA_PREVIA_MS = 120;
/** Altura máxima del área de texto; a partir de ahí, desplaza. */
export const ALTO_MAXIMO = 220;
const MAX_SUGERENCIAS = 8;

interface Sugerencias {
  /** `@`, `#` o `/`. */
  marca: string;
  /** Dónde empieza lo que se está escribiendo (tras la marca) y hasta dónde llega (el cursor). */
  desde: number;
  hasta: number;
  opciones: string[];
}

/** Lo que se está escribiendo justo antes del cursor, si es una indicación. */
function tokenEnCursor(texto: string, cursor: number): { marca: string; parcial: string; desde: number } | null {
  const antes = texto.slice(0, cursor);
  const tipo = /^\s*\/([\p{L}]*)$/u.exec(antes);
  if (tipo) return { marca: '/', parcial: tipo[1] ?? '', desde: cursor - (tipo[1]?.length ?? 0) };
  const m = /(^|\s)([@#])([\p{L}\p{N}_./-]*)$/u.exec(antes);
  if (!m) return null;
  return { marca: m[2] ?? '', parcial: m[3] ?? '', desde: cursor - (m[3]?.length ?? 0) };
}

/** Clave estable de cada archivo adjunto (dos con el mismo nombre son dos). */
const claves = new WeakMap<File, number>();
let siguienteClave = 0;
function claveDe(f: File): number {
  let c = claves.get(f);
  if (c === undefined) {
    c = siguienteClave++;
    claves.set(f, c);
  }
  return c;
}

/** Una captura acabada: guardada, duplicada o rechazada para siempre (ya avisada). Lo demás se reintenta. */
const PERMANENTES = new Set(['captura.demasiadoGrande', 'captura.sinLector', 'captura.vacia']);
const terminado = (r: ResultadoDe['r']) => r !== null && (r.ok || PERMANENTES.has(r.error.codigo));

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  /** Abrir un elemento (la ref a la que se responde). */
  alAbrir?: (ref: string) => void;
  /** En la pantalla de un hilo: todo lo que se capture entra en él (IN-030). */
  hiloFijo?: string;
}

export function Compositor({ alAbrir, hiloFijo }: Props) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const { capturador, informar } = useCaptura();
  const { avisar } = useAvisos();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const colecciones = useEspacio((s) => s.colecciones);
  const {
    texto,
    archivos,
    respondiendoA,
    llegadas,
    setTexto,
    adjuntar,
    quitarArchivo,
    responderA,
    anotarBusqueda,
    quitarGuardado,
  } = useCompositor();
  const area = useRef<HTMLTextAreaElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  const idLista = useId();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencias | null>(null);
  const [activa, setActiva] = useState(0);
  const [guardando, setGuardando] = useState(false);

  // Altura según el contenido, hasta 220 px.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depende del texto pintado, que lee del DOM.
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${Math.min(a.scrollHeight, ALTO_MAXIMO)}px`;
  }, [texto]);

  // Lo que llega de fuera (pegar, responder, el atajo global) enfoca la caja con el cursor al final; al volver a
  // Inicio sin nada nuevo, no (en el móvil abriría el teclado).
  const atendidas = useCompositor((s) => s.atendidas);
  const atender = useCompositor((s) => s.atender);
  useEffect(() => {
    if (llegadas <= atendidas) return;
    atender();
    const a = area.current;
    a?.focus();
    a?.setSelectionRange(a.value.length, a.value.length);
  }, [llegadas, atendidas, atender]);

  // Las reglas aprendidas de ahora: si cambian (se acepta una con algo ya escrito), la vista previa se rehace.
  const [reglas, setReglas] = useState(() => espacio?.reglas().reglas);
  useEffect(() => (espacio ? espacio.alCambiar(() => setReglas(espacio.reglas().reglas)) : undefined), [espacio]);

  // Vista previa 120 ms después de la última tecla; con textos grandes, en el Worker. Con las opciones de los
  // ajustes de ahora (reglas de secretos y detección) y las reglas aprendidas, como la captura.
  useEffect(() => {
    const opciones = espacio ? opcionesCaptura(espacio.ajustes(), reglas) : undefined;
    if (!texto.trim() || !lectores) {
      setPrevia(null);
      return undefined;
    }
    let vigente = true;
    const espera = setTimeout(() => {
      const calculo =
        texto.length > PREVIA_EN_WORKER
          ? lectores.previsualizar(texto, opciones)
          : Promise.resolve(previsualizar(texto, lectores.registro, opciones));
      calculo.then((p) => vigente && setPrevia(p)).catch(() => vigente && setPrevia(null));
    }, ESPERA_PREVIA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, lectores, espacio, reglas]);

  /** Colecciones y etiquetas usadas, y tipos, para autocompletar. */
  const fuentes = useMemo(() => {
    const etiquetas = new Set<string>();
    for (const fm of espacio?.repositorio.elementos() ?? []) for (const e of fm.etiquetas ?? []) etiquetas.add(e);
    return {
      '@': colecciones.map((c) => c.nombre),
      '#': [...etiquetas].sort((a, b) => a.localeCompare(b)),
      '/': [...TIPOS_ELEMENTO],
    } as Record<string, string[]>;
    // Las etiquetas se recalculan cuando cambia lo que pinta el raíl (cada cambio del repositorio).
  }, [espacio, colecciones]);

  function actualizarSugerencias(valor: string, cursor: number) {
    const token = tokenEnCursor(valor, cursor);
    if (!token) return setSugerencias(null);
    const parcial = sinAcentos(token.parcial);
    const fuente = fuentes[token.marca] ?? [];
    // Con un nombre ya completo, nada que sugerir: Enter guarda en vez de cambiarlo por otro más largo.
    if (fuente.includes(token.parcial)) return setSugerencias(null);
    const opciones = fuente.filter((o) => sinAcentos(o).startsWith(parcial)).slice(0, MAX_SUGERENCIAS);
    setActiva(0);
    setSugerencias(opciones.length ? { marca: token.marca, desde: token.desde, hasta: cursor, opciones } : null);
  }

  function elegir(opcion: string) {
    if (!sugerencias) return;
    const nuevo = `${texto.slice(0, sugerencias.desde)}${opcion} ${texto.slice(sugerencias.hasta)}`;
    setTexto(nuevo);
    setSugerencias(null);
    const cursor = sugerencias.desde + opcion.length + 1;
    requestAnimationFrame(() => area.current?.setSelectionRange(cursor, cursor));
  }

  /** Guarda lo escrito; con `dividir`, cada parte (cada URL o cada bloque, IN-049) como un elemento. */
  async function guardar(dividir = false) {
    if (guardando) return;
    const ind = analizarIndicaciones(texto);
    if (ind.busqueda !== undefined) {
      // Solo el texto: los adjuntos y la respuesta siguen ahí para la siguiente captura.
      anotarBusqueda(ind.busqueda, isoConZona(new Date()));
      setTexto('');
      return;
    }
    if (!ind.cuerpo.trim() && !archivos.length) return;
    if (soloLectura) return avisar(t('espacio.aviso.soloLectura'));
    if (!capturador) return;
    // Dividir lo que se ofreció: si el texto ya no se parte en las mismas N (cambió desde la vista previa), nada.
    const divididas = dividir ? partes(ind.cuerpo)?.partes : undefined;
    if (dividir && divididas?.length !== previa?.division?.n) return;
    setGuardando(true);
    // Lo que se guarda ahora; lo que se escriba o adjunte mientras tanto se queda en el borrador.
    const textoGuardado = texto;
    const archivosGuardados = [...archivos];
    const respuesta = respondiendoA;
    // Responder a un elemento: la captura va a su hilo (IN-030); en la pantalla de un hilo (`hiloFijo`), a ese. Si
    // el respondido aún no tenía hilo, se crea después, y solo si la captura creó algo (no por un duplicado).
    const deHilos = espacio ? { repositorio: espacio.repositorio, entidades: espacio.entidades } : null;
    const hilo =
      hiloFijo ??
      (respuesta && deHilos
        ? hiloDe(deHilos.repositorio.frontmatter(respuesta)?.hilo, deHilos.entidades)?.ref
        : undefined);
    const comunes: Omit<EntradaCaptura, 'origen'> = {
      ...(ind.tipo ? { tipo: ind.tipo } : {}),
      colecciones: ind.colecciones,
      etiquetas: ind.etiquetas,
      ...(hilo ? { hilo } : {}),
    };
    const resultados: ResultadoDe[] = [];
    let textoHecho = true;
    const textos = ind.cuerpo.trim() ? (divididas ?? [ind.cuerpo]) : [];
    for (const cuerpo of textos) {
      const r = await capturador.capturar({ texto: cuerpo, origen: 'pegado', ...comunes }).catch(() => null);
      resultados.push({ nombre: cuerpo.split('\n')[0]?.slice(0, 40) ?? '', r });
      // El texto se queda en la caja si alguna parte no se pudo guardar (para reintentar).
      textoHecho = textoHecho && terminado(r);
    }
    const hechos: File[] = [];
    for (const archivo of archivosGuardados) {
      const r = await capturador.capturar({ archivo, origen: 'soltado', ...comunes }).catch(() => null);
      resultados.push({ nombre: archivo.name, tam: archivo.size, r });
      if (terminado(r)) hechos.push(archivo);
    }
    if (respuesta && !hilo && deHilos) {
      const nuevos = resultados.flatMap(({ r }) => (r?.ok && r.valor.tipo === 'creado' ? [r.valor.capturado] : []));
      if (nuevos.length) {
        const h = await hiloPara(respuesta, deHilos).catch(() => null);
        if (h) for (const c of nuevos) await anadirAHilo(h, c.elemento.frontmatter.id, deHilos).catch(() => false);
      }
    }
    setGuardando(false);
    informar(resultados);
    // Se quita lo guardado (o lo que nunca podrá guardarse, ya avisado); un fallo pasajero se queda para reintentar.
    quitarGuardado({
      ...(textoHecho ? { texto: textoGuardado } : {}),
      archivos: hechos,
      respondiendoA: textoHecho && hechos.length === archivosGuardados.length ? respuesta : null,
    });
  }

  function alPulsar(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Mientras un IME compone (japonés, chino…), Enter confirma la composición, no guarda.
    // Safari marca el Enter que cierra la composición con el código 229 en vez de `isComposing`.
    if (e.nativeEvent.isComposing || e.key === 'Process' || (e.nativeEvent as { keyCode?: number }).keyCode === 229)
      return;
    if (sugerencias) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = sugerencias.opciones.length;
        setActiva((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        const opcion = sugerencias.opciones[activa];
        if (opcion) elegir(opcion);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSugerencias(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void guardar();
    }
  }

  function alCambiar(e: ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value);
    actualizarSugerencias(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  const placeholder = respondiendoA || hiloFijo ? t('compositor.placeholderHilo') : t('compositor.placeholder');
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: zona de soltar archivos; con teclado se adjunta con el botón.
    <div
      className="composer"
      {...{ [ATRIBUTO_ZONA_SOLTAR]: '' }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        adjuntar([...e.dataTransfer.files]);
        area.current?.focus();
      }}
    >
      <div className="cbox">
        {respondiendoA && (
          <div className="replying">
            <Icono nombre="responder" tamano={14} />
            <span>
              {t('compositor.respondiendoA')} <Ref refe={respondiendoA} alPulsar={(r) => alAbrir?.(r)} />
              {t('compositor.iraASuHilo')}
            </span>
            <button
              type="button"
              className="ibtn"
              aria-label={t('compositor.noResponder')}
              onClick={() => responderA(null)}
            >
              <Icono nombre="cerrar" tamano={14} />
            </button>
          </div>
        )}
        <textarea
          ref={area}
          rows={2}
          value={texto}
          placeholder={placeholder}
          aria-label={t('compositor.etiqueta')}
          aria-describedby={sugerencias ? idLista : undefined}
          onChange={alCambiar}
          onKeyDown={alPulsar}
          onPaste={(e) => {
            // Una imagen o un archivo pegado dentro de la caja va a los adjuntos; el texto se pega como siempre.
            const pegados = [...e.clipboardData.files];
            if (!pegados.length) return;
            adjuntar(pegados);
            if (!e.clipboardData.getData('text/plain')) e.preventDefault();
          }}
          onBlur={() => setSugerencias(null)}
        />
        {sugerencias && (
          // Se recorre con las flechas desde el área de texto; el ratón también vale.
          <div className="sugerencias" id={idLista}>
            <span className="solo-lector" aria-live="polite">
              {t('compositor.sugerencia', { opcion: `${sugerencias.marca}${sugerencias.opciones[activa] ?? ''}` })}
            </span>
            {sugerencias.opciones.map((o, i) => (
              <button
                key={o}
                type="button"
                tabIndex={-1}
                className={i === activa ? 'activa' : undefined}
                // `mousedown` antes que el `blur` del área de texto, que cerraría la lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
              >
                <span className="mono">
                  {sugerencias.marca}
                  {o}
                </span>
              </button>
            ))}
          </div>
        )}
        <VistaPrevia
          previa={previa}
          archivos={archivos}
          alQuitar={quitarArchivo}
          {...(guardando || soloLectura ? {} : { alDividir: () => void guardar(true) })}
        />
        <div className="crow">
          <button
            type="button"
            className="ibtn"
            aria-label={t('compositor.adjuntar')}
            onClick={() => selector.current?.click()}
          >
            <Icono nombre="adjuntar" tamano={16} />
          </button>
          <input
            ref={selector}
            type="file"
            multiple
            hidden
            aria-label={t('compositor.adjuntar')}
            onChange={(e) => {
              adjuntar([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          <span className="hint xs faint">
            <span className="mono">@{t('compositor.pista.coleccion')}</span> ·{' '}
            <span className="mono">#{t('compositor.pista.etiqueta')}</span> ·{' '}
            <span className="mono">/{t('compositor.pista.tipo')}</span> ·{' '}
            <span className="mono">?{t('compositor.pista.buscar')}</span> · {t('compositor.pista.nuevaLinea')}
          </span>
          <button
            type="button"
            className="send"
            aria-label={t('compositor.guardar')}
            disabled={guardando}
            onClick={() => void guardar()}
          >
            <Icono nombre="enviar" tamano={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * «Buscar «timeout»: 3 resultados. Enter para verlos aquí.» (como `SC.inicio`): el recuento, del motor de búsqueda.
 * Mientras responde a lo último escrito se queda el recuento anterior (la vista previa es una región viva: cambiar a
 * la frase sin recuento y volver sería un anuncio de más); sin motor, o antes de la primera respuesta, sin recuento.
 */
function AvisoBusqueda({ texto }: { texto: string }) {
  const { t } = useT();
  const { busqueda } = useBuscar(texto);
  return (
    <span>
      {busqueda && texto.trim()
        ? t('compositor.buscarConRecuento', { texto, n: busqueda.total })
        : t('compositor.buscar', { texto })}
    </span>
  );
}

/** Bajo la caja: tipo, confianza, indicaciones, secretos, la duda del detector y los adjuntos. */
function VistaPrevia({
  previa: p,
  archivos: adjuntos,
  alQuitar,
  alDividir,
}: {
  previa: Previa | null;
  archivos: File[];
  alQuitar: (i: number) => void;
  /** Guardar cada parte como un elemento (sin ella, no se ofrece). */
  alDividir?: () => void;
}) {
  const { t, idioma } = useT();
  const lectores = useLectoresOpcional();
  const piezas = [];
  if (p?.indicaciones.busqueda !== undefined) {
    piezas.push(
      <span key="buscar" className="row">
        <Icono nombre="buscar" tamano={13} />
        <AvisoBusqueda texto={p.indicaciones.busqueda} />
      </span>,
    );
  } else if (p) {
    const tipo: TipoElemento = p.indicaciones.tipo ?? p.deteccion?.tipo ?? 'texto';
    const alternativa = p.deteccion?.alternativa;
    piezas.push(
      <span key="como" className="xs muted">
        {t('compositor.seGuardaraComo')}
      </span>,
      <ChipTipo
        key="tipo"
        tipo={tipo}
        etiqueta={
          !p.indicaciones.tipo && p.deteccion?.lector
            ? lectores?.registro.porNombre(p.deteccion.lector)?.etiqueta?.(idioma)
            : undefined
        }
      />,
      p.indicaciones.tipo ? (
        <span key="conf" className="xs faint">
          {t('compositor.elegido')}
        </span>
      ) : (
        <span key="conf" className="mono xs faint">
          {fmtNumero(p.deteccion?.confianza ?? 0, idioma, 2)}
        </span>
      ),
      ...p.indicaciones.colecciones.map((c) => (
        <Estado key={`@${c}`} tono="acc">
          @{c}
        </Estado>
      )),
      ...p.indicaciones.etiquetas.map((e) => <Estado key={`#${e}`}>#{e}</Estado>),
    );
    if (p.secretos)
      piezas.push(
        <Estado key="secretos" tono="warn">
          {t('compositor.secretos', { n: p.secretos })}
        </Estado>,
      );
    if (alternativa)
      piezas.push(
        <span key="alt" className="xs aviso-tipo">
          {t('compositor.alternativa', { tipo: t(`tipos.${alternativa.tipo}`), palabra: alternativa.tipo })}
        </span>,
      );
    // Varias URL o varios bloques que son cosas distintas: guardarlos por separado (IN-049).
    if (p.division && alDividir)
      piezas.push(
        <Boton key="dividir" pequeno onClick={alDividir}>
          {t('compositor.dividir', { n: p.division.n })}
        </Boton>,
      );
  }
  adjuntos.forEach((a, i) => {
    piezas.push(
      <span key={claveDe(a)} className="st adjunto">
        <Icono nombre="adjuntar" tamano={12} />
        {a.name}
        <button
          type="button"
          aria-label={t('compositor.quitarAdjunto', { nombre: a.name })}
          onClick={() => alQuitar(i)}
        >
          <Icono nombre="cerrar" tamano={12} />
        </button>
      </span>,
    );
  });
  return (
    <div className="cprev" aria-live="polite">
      {piezas}
    </div>
  );
}
