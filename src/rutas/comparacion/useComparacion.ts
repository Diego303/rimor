/**
 * Una comparación al día (CMP-01): la entidad y sus fuentes se releen cuando cambian en el espacio; el cálculo se
 * rehace con los derivados de las fuentes (de la caché si están). Si el resultado guardado ya no es el de ahora
 * (una fuente cambió, o es de otra versión del cálculo), se guarda el nuevo y, si cambió una fuente, se dice cuál.
 */
import {
  type Comparacion,
  type Elemento,
  type Entidad,
  type FrontmatterComun,
  type FrontmatterEntidad,
  isoConZona,
} from '@rimor/formato';
import { useEffect, useState } from 'react';
import { type Calculo, calcular, resultadoDe } from '../../comparaciones/crear';
import { fuentesCambiadas, leerResultado, type ResultadoComparacion } from '../../comparaciones/resultado';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useLectoresOpcional } from '../../lectores/Lectores';

export type EstadoComparacion =
  | { estado: 'cargando' }
  | { estado: 'no-encontrada' }
  | {
      estado: 'lista';
      entidad: Entidad<Comparacion>;
      /** Las fuentes, en su orden; `null` la que ya no está. */
      fuentes: (Elemento | null)[];
      /** El cálculo de ahora; `null` mientras se calcula o si no se puede. */
      calculo: Calculo | null;
      /** Si no se puede calcular, por qué (`comparacion.distintoTipo`…). */
      motivo: string | null;
      /** El resultado guardado (el que se enseña si no se puede calcular). */
      guardado: ResultadoComparacion | null;
      /** Refs de las fuentes que cambiaron desde que se hizo (en esta visita). */
      cambiaron: string[];
    };

/** Lo que identifica lo leído: cada guardado deja en el repositorio un frontmatter nuevo (otro objeto). */
type Visto = (FrontmatterComun | FrontmatterEntidad | undefined)[];
const igual = (a: Visto | null, b: Visto) => a !== null && a.length === b.length && a.every((x, i) => x === b[i]);

export function useComparacion(refe: string): EstadoComparacion {
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const [estado, setEstado] = useState<{ refe: string; valor: EstadoComparacion }>({
    refe,
    valor: { estado: 'cargando' },
  });

  useEffect(() => {
    if (!espacio || !lectores) return undefined;
    const { entidades, repositorio } = espacio;
    const parar = new AbortController();
    let visto: Visto | null = null;
    // Lo que se dijo que cambió no se olvida al guardar el resultado nuevo (que ya no difiere).
    const cambiaron = new Set<string>();

    const leer = async () => {
      const fm = entidades.frontmatter(refe);
      const fuentesFm = fm?.tipo === 'comparacion' ? fm.fuentes.map((r) => repositorio.frontmatter(r)) : [];
      const ahora: Visto = [fm, ...fuentesFm];
      if (igual(visto, ahora)) return;
      visto = ahora;
      if (fm?.tipo !== 'comparacion') {
        setEstado({ refe, valor: { estado: 'no-encontrada' } });
        return;
      }
      const leida = await entidades.leer(fm.id);
      if (parar.signal.aborted || visto !== ahora) return;
      if (!leida.ok || leida.valor.frontmatter.tipo !== 'comparacion') {
        setEstado({ refe, valor: { estado: 'no-encontrada' } });
        return;
      }
      const entidad = leida.valor as Entidad<Comparacion>;
      const guardado = leerResultado(entidad.frontmatter.resultado);
      const fuentes = await Promise.all(
        entidad.frontmatter.fuentes.map(async (r) => {
          const el = await repositorio.leerElemento(r);
          return el.ok ? el.valor : null;
        }),
      );
      if (parar.signal.aborted || visto !== ahora) return;
      const base = { estado: 'lista' as const, entidad, fuentes, guardado, cambiaron: [...cambiaron] };
      const [a, b] = fuentes;
      if (!a || !b || fuentes.length !== 2) {
        setEstado({ refe, valor: { ...base, calculo: null, motivo: null } });
        return;
      }
      // Lo guardado se enseña mientras se calcula (la cifra no salta a «—»).
      setEstado((e) =>
        e.refe === refe && e.valor.estado === 'lista' && e.valor.entidad.frontmatter.id === entidad.frontmatter.id
          ? { refe, valor: { ...e.valor, ...base, calculo: e.valor.calculo } }
          : { refe, valor: { ...base, calculo: null, motivo: null } },
      );
      const calculo = await calcular(a, b, (el) =>
        lectores.cola.pedir(el, { prioridad: 'visible', senal: parar.signal }),
      ).catch(() => null);
      if (parar.signal.aborted || visto !== ahora) return;
      if (!calculo?.ok) {
        const motivo = calculo ? calculo.error.codigo : 'comparacion.error';
        setEstado({ refe, valor: { ...base, calculo: null, motivo } });
        return;
      }
      const cambiadas = fuentesCambiadas(guardado, [a.frontmatter.hash, b.frontmatter.hash]);
      // Solo se avisa si había un resultado válido que ya no lo es por una fuente (no al rehacer uno de otra versión).
      if (guardado) for (const i of cambiadas) cambiaron.add(entidad.frontmatter.fuentes[i] ?? '');
      setEstado({ refe, valor: { ...base, calculo: calculo.valor, motivo: null, cambiaron: [...cambiaron] } });
      if (cambiadas.length && entidades.escribible()) {
        const nuevo = resultadoDe(calculo.valor, [a, b]) as unknown as Record<string, unknown>;
        void entidades
          .actualizar(entidad.frontmatter.id, (e) =>
            e.frontmatter.tipo === 'comparacion'
              ? {
                  ...e,
                  frontmatter: { ...e.frontmatter, resultado: nuevo, modificado: isoConZona(new Date()) },
                }
              : null,
          )
          .catch(() => undefined);
      }
    };

    const releer = () => void leer().catch(() => undefined);
    releer();
    const baja = espacio.alCambiar(releer);
    return () => {
      parar.abort();
      baja();
    };
  }, [espacio, lectores, refe]);

  // Mientras no se ha leído la ref nueva, no se enseña la comparación de la anterior.
  return estado.refe === refe ? estado.valor : { estado: 'cargando' };
}
