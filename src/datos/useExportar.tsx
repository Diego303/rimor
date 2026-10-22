/**
 * Exportar desde la interfaz (IN-035): el botón de Datos y copias, `Ctrl+E` y la copia previa a lo destructivo.
 * Avisa al terminar («Exportado rimor-trabajo-2026-10-22.zip (148 MB)», con la señal de copia al día si es
 * completa) o si falla.
 */
import { useCallback } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { fmtBytes } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { useAvisosOpcional } from '../ui/componentes/Avisos';
import { Senal } from '../ui/marca/Senal';
import { exportarEspacio, type TipoExportacion } from './exportacion';

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
