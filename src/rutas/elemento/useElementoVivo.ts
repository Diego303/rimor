/**
 * El elemento de la pantalla, al día: se lee al abrirlo y se vuelve a leer cuando su frontmatter cambia en el
 * repositorio (una edición aquí, en Inicio o en otra pestaña). La ref puede ser un alias o el id: se dice cuál es
 * la vigente para llevar a ella.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';

export type EstadoElemento =
  | { estado: 'cargando' }
  | { estado: 'no-encontrado' }
  | { estado: 'listo'; el: Elemento; enPapelera: boolean; vigente: string };

export function useElementoVivo(refe: string): EstadoElemento {
  const espacio = useEspacioOpcional();
  const [estado, setEstado] = useState<{ refe: string; valor: EstadoElemento }>({
    refe,
    valor: { estado: 'cargando' },
  });

  useEffect(() => {
    if (!espacio) return undefined;
    const repo = espacio.repositorio;
    let vigente = true;
    // Lo último leído: cada guardado deja en el repositorio un frontmatter nuevo (otro objeto), y moverlo cambia
    // su ruta; si nada de eso cambió, no hay que volver a leer el archivo.
    let visto: { fm: FrontmatterComun | undefined; ruta: string } | null = null;
    const leer = () => {
      const entrada = repo.buscar(refe);
      const fm = entrada ? repo.frontmatter(entrada.id) : undefined;
      if (visto && visto.fm === fm && visto.ruta === (entrada?.ruta ?? '')) return;
      const este = { fm, ruta: entrada?.ruta ?? '' };
      visto = este;
      if (!entrada) {
        setEstado({ refe, valor: { estado: 'no-encontrado' } });
        return;
      }
      void repo
        .leerElemento(entrada.id)
        .then((r) => {
          // Si mientras se leía cambió otra vez, manda la lectura siguiente.
          if (!vigente || visto !== este) return;
          setEstado({
            refe,
            valor: r.ok
              ? { estado: 'listo', el: r.valor, enPapelera: entrada.enPapelera, vigente: entrada.ref }
              : { estado: 'no-encontrado' },
          });
        })
        .catch(() => vigente && visto === este && setEstado({ refe, valor: { estado: 'no-encontrado' } }));
    };
    leer();
    const baja = espacio.alCambiar(leer);
    return () => {
      vigente = false;
      baja();
    };
  }, [espacio, refe]);

  // Mientras no se ha leído la ref nueva, no se enseña el elemento de la anterior.
  return estado.refe === refe ? estado.valor : { estado: 'cargando' };
}
