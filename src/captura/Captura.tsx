/**
 * Captura en la interfaz (IN-014, CAP-01, CAP-02): pegar fuera de un campo de texto lleva lo pegado al
 * compositor; soltar archivos sobre cualquier pantalla los guarda uno a uno, con «Guardado. Deshacer».
 */

import { isoConZona, type Resultado } from '@rimor/formato';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { opcionesCaptura } from '../espacio/ajustes';
import { useEspacioOpcional } from '../espacio/Espacio';
import { useEspacio } from '../estado/espacio';
import { useFrescos } from '../estado/frescos';
import { formarPorHuella } from '../hilos/formar';
import { fmtBytes } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { useLectoresOpcional } from '../lectores/Lectores';
import { esCampoDeTexto } from '../ui/atajos/atajos';
import { useAvisos } from '../ui/componentes';
import { useCompositor } from './compositor';
import { type Capturado, type Capturador, crearCapturador, LIMITE_ARCHIVO, type ResultadoCaptura } from './flujo';

interface ValorCaptura {
  capturador: Capturador | null;
  /** Avisa del resultado de varias capturas: «Guardado. Deshacer» primero y después lo demás. */
  informar(resultados: readonly ResultadoDe[]): void;
}

/** El resultado de capturar una cosa, con lo que hace falta para explicarlo. */
export interface ResultadoDe {
  nombre: string;
  tam?: number;
  r: Resultado<ResultadoCaptura> | null;
}

const Contexto = createContext<ValorCaptura>({ capturador: null, informar: () => undefined });

/** El capturador del espacio abierto (o `null` si aún no hay) y cómo avisar de lo capturado. */
export function useCaptura(): ValorCaptura {
  return useContext(Contexto);
}

const conArchivos = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');

/** Una zona que gestiona su propio soltar (el compositor): el soltar global la respeta. */
export const ATRIBUTO_ZONA_SOLTAR = 'data-zona-soltar';
const enZonaPropia = (e: Event) =>
  e.target instanceof Element && e.target.closest(`[${ATRIBUTO_ZONA_SOLTAR}]`) !== null;

interface Props {
  children: ReactNode;
  /** Tras llevar lo pegado al compositor: ir a Inicio (lo da la carcasa, que tiene el router). */
  alRecibir?: () => void;
  /** Abrir un elemento por su ref (el existente, ante un duplicado). */
  alAbrir?: (ref: string) => void;
}

export function ProveedorCaptura({ children, alRecibir, alAbrir }: Props) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const { avisar } = useAvisos();
  const recibir = useCompositor((s) => s.recibir);
  const soloLectura = useEspacio((s) => s.soloLectura);
  const [soltando, setSoltando] = useState(false);
  // `dragenter` y `dragleave` llegan por cada hijo: se cuentan para saber cuándo sale de verdad.
  const dentro = useRef(0);

  const capturador = useMemo(
    () =>
      espacio && lectores
        ? crearCapturador({
            repositorio: espacio.repositorio,
            registro: lectores.registro,
            cola: lectores.cola,
            opciones: () => opcionesCaptura(espacio.ajustes()),
          })
        : null,
    [espacio, lectores],
  );

  /**
   * Con los derivados de un error: cuenta un error reconocido si su huella ya estaba en un elemento anterior (los
   * ULID se ordenan por su creación: de dos errores iguales soltados a la vez, solo cuenta el segundo) y lo mete en
   * el hilo de su error, o crea el hilo con todas sus ocurrencias (IN-030).
   */
  const contarSiReconocido = useCallback(
    async (c: Capturado) => {
      if (!espacio || !lectores || !c.derivados) return;
      const lector = lectores.registro.paraElemento(c.elemento);
      if (lector?.tipo !== 'error') return;
      const datos = await c.derivados.catch(() => null);
      // Si los derivados no llegan (un plazo agotado), la huella que dejó el lector al leer.
      const huella = datos ? lector.resumen(datos).huella : c.elemento.frontmatter.lector.resumen.huella;
      if (typeof huella !== 'string' || !huella) return;
      const id = c.elemento.frontmatter.id;
      if (espacio.repositorio.elementos().some((o) => o.id < id && o.lector.resumen.huella === huella))
        await espacio.contadores.contar('erroresReconocidos');
      if (espacio.repositorio.escribible())
        await formarPorHuella(id, huella, { repositorio: espacio.repositorio, entidades: espacio.entidades }).catch(
          () => null,
        );
    },
    [espacio, lectores],
  );

  const informar = useCallback(
    (resultados: readonly ResultadoDe[]) => {
      const creados: Capturado[] = [];
      // Los demás avisos van después del de «Guardado», para que Deshacer salga en cuanto se guarda.
      const otros: (() => void)[] = [];
      for (const { nombre, tam, r } of resultados) {
        if (!r) otros.push(() => avisar(t('captura.fallo', { nombre })));
        else if (r.ok) {
          if (r.valor.tipo === 'creado') creados.push(r.valor.capturado);
          else if (r.valor.tipo === 'version') {
            const v = r.valor;
            const fm = v.capturado.elemento.frontmatter;
            // El feed la pinta en su momento (el elemento es de otro día); el aviso, con deshacer.
            useCompositor.getState().anotarVersion({ ...v, en: isoConZona(new Date()) });
            otros.push(() =>
              avisar(t('captura.version', { n: v.version, ref: fm.ref }), {
                accion: {
                  etiqueta: t('captura.deshacer'),
                  alPulsar: () =>
                    void (capturador?.deshacerVersion(v) ?? Promise.resolve(false))
                      .catch(() => false)
                      .then((hecho) => {
                        if (hecho) useCompositor.getState().quitarVersion(v.copia);
                        else avisar(t('captura.noDeshecho'));
                      }),
                },
              }),
            );
          } else {
            const ref = r.valor.ref;
            // Lo que Rimor ha ahorrado (MET-06): un duplicado que no se creó.
            void espacio?.contadores.contar('duplicadosEvitados');
            otros.push(() =>
              avisar(t('captura.duplicado', { ref }), {
                ...(alAbrir ? { accion: { etiqueta: t('captura.ver'), alPulsar: () => alAbrir(ref) } } : {}),
              }),
            );
          }
        } else {
          const codigo = r.error.codigo;
          const texto =
            codigo === 'captura.demasiadoGrande'
              ? t('captura.demasiadoGrande', {
                  nombre,
                  tam: fmtBytes(tam ?? 0, idioma),
                  limite: fmtBytes(LIMITE_ARCHIVO, idioma),
                })
              : codigo === 'almacen.soloLectura'
                ? t('espacio.aviso.soloLectura')
                : codigo === 'captura.sinLector'
                  ? t('captura.sinLector', { nombre })
                  : codigo === 'captura.vacia'
                    ? null
                    : t('captura.fallo', { nombre });
          if (texto) otros.push(() => avisar(texto));
        }
      }
      if (creados.length)
        avisar(t('captura.guardado', { n: creados.length }), {
          accion: {
            etiqueta: t('captura.deshacer'),
            alPulsar: () =>
              void Promise.all(creados.map((c) => capturador?.deshacer(c).catch(() => false))).then((hechos) => {
                // Si alguno ya se había editado, movido o no se pudo borrar, se dice: nunca se finge.
                if (hechos.some((h) => !h)) avisar(t('captura.noDeshecho'));
              }),
          },
        });
      for (const avisarOtro of otros) avisarOtro();
      // Lo que Rimor ha ahorrado (MET-06): un error que ya había pasado, reconocido por su huella.
      for (const c of creados) void contarSiReconocido(c);
      // El feed los marca como frescos (borde naranja) durante unos minutos.
      if (creados.length) useFrescos.getState().anadir(creados.map((c) => c.elemento.frontmatter.id));
    },
    [avisar, t, idioma, alAbrir, capturador, espacio, contarSiReconocido],
  );

  // Pegar fuera de un campo: al compositor (no guarda directamente) y a Inicio.
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      if (e.defaultPrevented || esCampoDeTexto(document.activeElement) || document.querySelector('dialog[open]'))
        return;
      const texto = e.clipboardData?.getData('text/plain') ?? '';
      const archivos = [...(e.clipboardData?.files ?? [])];
      if (!texto.trim() && !archivos.length) return;
      e.preventDefault();
      // En una pestaña que solo lee no se podría guardar: se dice y no se toca el borrador.
      if (soloLectura) return avisar(t('espacio.aviso.soloLectura'));
      recibir(texto, archivos);
      alRecibir?.();
    };
    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  }, [recibir, alRecibir, soloLectura, avisar, t]);

  // Soltar archivos en cualquier pantalla (salvo en una zona que lo gestiona ella, como el compositor).
  useEffect(() => {
    const entrar = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      dentro.current++;
      setSoltando(!enZonaPropia(e));
    };
    const encima = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      setSoltando(!enZonaPropia(e));
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const salir = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      dentro.current = Math.max(0, dentro.current - 1);
      if (!dentro.current) setSoltando(false);
    };
    const soltar = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      dentro.current = 0;
      setSoltando(false);
      if (enZonaPropia(e)) return;
      e.preventDefault();
      void guardar([...(e.dataTransfer?.files ?? [])]);
    };
    async function guardar(archivos: File[]) {
      if (!archivos.length || !capturador) return;
      if (soloLectura) return avisar(t('espacio.aviso.soloLectura'));
      const resultados: ResultadoDe[] = [];
      for (const archivo of archivos) {
        const r = await capturador.capturar({ archivo, origen: 'soltado' }).catch(() => null);
        resultados.push({ nombre: archivo.name, tam: archivo.size, r });
      }
      informar(resultados);
    }
    window.addEventListener('dragenter', entrar);
    window.addEventListener('dragover', encima);
    window.addEventListener('dragleave', salir);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragenter', entrar);
      window.removeEventListener('dragover', encima);
      window.removeEventListener('dragleave', salir);
      window.removeEventListener('drop', soltar);
    };
  }, [capturador, avisar, t, soloLectura, informar]);

  const valor = useMemo(() => ({ capturador, informar }), [capturador, informar]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      {soltando && (
        <div className="capa-soltar" aria-hidden="true">
          <span className="sm">{t('captura.soltar')}</span>
        </div>
      )}
    </Contexto.Provider>
  );
}
