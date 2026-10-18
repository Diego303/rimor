/**
 * Captura en la interfaz (IN-014, CAP-01, CAP-02): pegar fuera de un campo de texto lleva lo pegado al
 * compositor; soltar archivos sobre cualquier pantalla los guarda uno a uno, con «Guardado. Deshacer».
 */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { fmtBytes } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { useLectoresOpcional } from '../lectores/Lectores';
import { esCampoDeTexto } from '../ui/atajos/atajos';
import { useAvisos } from '../ui/componentes';
import { useCompositor } from './compositor';
import { type Capturado, type Capturador, crearCapturador, LIMITE_ARCHIVO } from './flujo';

const Contexto = createContext<Capturador | null>(null);

/** El capturador del espacio abierto (lo usa el compositor), o `null` si aún no hay espacio. */
export function useCapturador(): Capturador | null {
  return useContext(Contexto);
}

const conArchivos = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');

interface Props {
  children: ReactNode;
  /** Tras llevar lo pegado al compositor: ir a Inicio (lo da la carcasa, que tiene el router). */
  alRecibir?: () => void;
}

export function ProveedorCaptura({ children, alRecibir }: Props) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const { avisar } = useAvisos();
  const recibir = useCompositor((s) => s.recibir);
  const [soltando, setSoltando] = useState(false);
  // `dragenter` y `dragleave` llegan por cada hijo: se cuentan para saber cuándo sale de verdad.
  const dentro = useRef(0);

  const capturador = useMemo(
    () =>
      espacio && lectores
        ? crearCapturador({ repositorio: espacio.repositorio, registro: lectores.registro, cola: lectores.cola })
        : null,
    [espacio, lectores],
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
      recibir(texto, archivos);
      alRecibir?.();
    };
    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  }, [recibir, alRecibir]);

  // Soltar archivos en cualquier pantalla.
  useEffect(() => {
    const entrar = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      dentro.current++;
      setSoltando(true);
    };
    const encima = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const salir = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      dentro.current = Math.max(0, dentro.current - 1);
      if (!dentro.current) setSoltando(false);
    };
    const soltar = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      dentro.current = 0;
      setSoltando(false);
      void guardar([...(e.dataTransfer?.files ?? [])]);
    };
    async function guardar(archivos: File[]) {
      if (!archivos.length) return;
      if (!capturador) return;
      const creados: Capturado[] = [];
      for (const archivo of archivos) {
        const r = await capturador.capturar({ archivo, origen: 'soltado' }).catch(() => null);
        if (!r) avisar(t('captura.fallo', { nombre: archivo.name }));
        else if (r.ok) {
          if (r.valor.tipo === 'creado') creados.push(r.valor.capturado);
          else avisar(t('captura.duplicado', { ref: r.valor.ref }));
        } else if (r.error.codigo === 'captura.demasiadoGrande')
          avisar(
            t('captura.demasiadoGrande', {
              nombre: archivo.name,
              tam: fmtBytes(archivo.size, idioma),
              limite: fmtBytes(LIMITE_ARCHIVO, idioma),
            }),
          );
        else if (r.error.codigo === 'almacen.soloLectura') avisar(t('espacio.aviso.soloLectura'));
        else if (r.error.codigo === 'captura.sinLector') avisar(t('captura.sinLector', { nombre: archivo.name }));
        else avisar(t('captura.fallo', { nombre: archivo.name }));
      }
      if (creados.length)
        avisar(t('captura.guardado', { n: creados.length }), {
          accion: {
            etiqueta: t('captura.deshacer'),
            alPulsar: () => {
              for (const c of creados) void capturador?.deshacer(c).catch(() => undefined);
            },
          },
        });
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
  }, [capturador, avisar, t, idioma]);

  return (
    <Contexto.Provider value={capturador}>
      {children}
      {soltando && (
        <div className="capa-soltar" aria-hidden="true">
          <span className="sm">{t('captura.soltar')}</span>
        </div>
      )}
    </Contexto.Provider>
  );
}
