/**
 * Crear una comparación desde la interfaz (CMP-01): dice por qué no se puede si no se puede, la crea con los
 * derivados de la cola (de la caché si están) y lleva a ella.
 */
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useRef, useState } from 'react';
import { comparables } from '../../comparaciones/clases';
import { crearComparacion } from '../../comparaciones/crear';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';

export function useComparar(): { comparar: (refA: string, refB: string) => Promise<void>; creando: boolean } {
  const { t } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const [creando, setCreando] = useState(false);
  // Una a la vez: un doble clic o un doble Ctrl+Mayús+C mientras se calcula no crea dos.
  const enCurso = useRef(false);

  const comparar = useCallback(
    async (refA: string, refB: string) => {
      if (!espacio || !lectores) return;
      const a = espacio.repositorio.frontmatter(refA);
      const b = espacio.repositorio.frontmatter(refB);
      if (!a || !b) return void avisos?.avisar(t('pantallas.comparacion.crear.noCreada'));
      const c = comparables(a, b);
      if ('motivo' in c) {
        const motivo =
          c.motivo === 'distintoTipo'
            ? t('pantallas.comparacion.motivos.distintoTipo', { a: t(`tipos.${a.tipo}`), b: t(`tipos.${b.tipo}`) })
            : t(`pantallas.comparacion.motivos.${c.motivo}`);
        return void avisos?.avisar(t('pantallas.comparacion.crear.noSePuede', { motivo }));
      }
      if (enCurso.current) return;
      enCurso.current = true;
      setCreando(true);
      const r = await crearComparacion(refA, refB, {
        repositorio: espacio.repositorio,
        entidades: espacio.entidades,
        derivar: (el) => lectores.cola.pedir(el, { prioridad: 'visible' }),
        titular: (x, y) => t('pantallas.comparacion.titulo', { a: x, b: y }),
      }).catch(() => null);
      enCurso.current = false;
      setCreando(false);
      if (!r?.ok) {
        const clave = r?.error.codigo.slice('comparacion.'.length);
        const motivo =
          clave === 'sinValores' || clave === 'otroLector' || clave === 'sinComparacion' || clave === 'ilegible'
            ? t(`pantallas.comparacion.motivos.${clave}`)
            : null;
        return void avisos?.avisar(
          motivo ? t('pantallas.comparacion.crear.noSePuede', { motivo }) : t('pantallas.comparacion.crear.noCreada'),
        );
      }
      void navegar({ to: '/e/$ref', params: { ref: r.valor } });
      avisos?.avisar(t('pantallas.comparacion.crear.creada', { ref: r.valor }));
    },
    [espacio, lectores, avisos, navegar, t],
  );
  return { comparar, creando };
}
