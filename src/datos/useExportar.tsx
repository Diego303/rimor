/**
 * Exportar desde la interfaz (IN-035): el botón de Datos y copias, `Ctrl+E` y la copia previa a lo destructivo.
 * Avisa al terminar («Exportado rimor-trabajo-2026-10-22.zip (148 MB)», con la señal de copia al día si es
 * completa) o si falla.
 */
import { type ComponentProps, useCallback, useRef } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { fmtBytes } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { useAvisosOpcional } from '../ui/componentes/Avisos';
import { Senal } from '../ui/marca/Senal';
import { useEsperaVisible } from '../ui/marca/useEsperaVisible';
import { type EstadoExportacion, exportarEspacio, type TipoExportacion, useExportacion } from './exportacion';

/**
 * Si hay una exportación en marcha y si se enseña: visible pasados 400 ms y al menos 600 ms (guía §11.1). No sigue
 * al porcentaje: quien lo usa (el raíl, siempre montado) no se repinta con cada paso.
 */
export function useEsperaExportacion(): { visible: boolean; enMarcha: boolean } {
  const enMarcha = useExportacion((s) => s.tipo !== null);
  return { visible: useEsperaVisible(enMarcha), enMarcha };
}

/** La señal `exportando` con el porcentaje (el de la última, mientras se sigue viendo aunque ya haya acabado). */
export function SenalExportacion(props: Omit<ComponentProps<typeof Senal>, 'estado' | 'etiqueta'>) {
  const { t } = useT();
  const { tipo, porcentaje } = useExportacion();
  const ultima = useRef<EstadoExportacion>({ tipo: 'zip', porcentaje: 0 });
  if (tipo) ultima.current = { tipo, porcentaje };
  const clave = ultima.current.tipo === 'json' ? 'pantallas.datos.exportandoJson' : 'pantallas.datos.exportandoZip';
  return <Senal estado="exportando" etiqueta={t(clave, { p: ultima.current.porcentaje })} {...props} />;
}

/**
 * Exporta el espacio abierto. Devuelve si se exportó (`false` si no hay espacio, ya había una exportación en marcha
 * o falló). `motivo` va en el nombre del archivo: la copia previa («antes de reemplazar»).
 */
export function useExportar(): (tipo: TipoExportacion, motivo?: string) => Promise<boolean> {
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const { t, idioma } = useT();
  return useCallback(
    async (tipo, motivo) => {
      if (!espacio) return false;
      try {
        const hecho = await exportarEspacio(espacio, tipo, motivo ? { motivo } : {});
        if (!hecho) return false;
        const texto = !hecho.completa
          ? t('exportar.hechoConExcluidos', { nombre: hecho.nombre, n: hecho.excluidos.length })
          : hecho.apuntada
            ? t('exportar.hecho', { nombre: hecho.nombre, tam: fmtBytes(hecho.bytes, idioma) })
            : t('exportar.hechoSinApuntar', { nombre: hecho.nombre, tam: fmtBytes(hecho.bytes, idioma) });
        avisos?.avisar(
          hecho.apuntada ? (
            <span className="row inline">
              <Senal estado="copia-al-dia" veces={1} tamano={14} etiqueta={texto} decorativa />
              {texto}
            </span>
          ) : (
            texto
          ),
        );
        return true;
      } catch (e) {
        const cancelada = e instanceof Error && e.name === 'AbortError';
        const atascada = e instanceof Error && e.message === 'exportar.atascada';
        avisos?.avisar(t(cancelada ? 'exportar.cancelada' : atascada ? 'exportar.atascada' : 'exportar.fallo'));
        return false;
      }
    },
    [espacio, avisos, t, idioma],
  );
}
