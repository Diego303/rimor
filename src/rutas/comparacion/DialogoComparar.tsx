/**
 * «Comparar con…» (CMP-01): los elementos del mismo tipo (lo más reciente arriba), con un campo para filtrar por
 * título o ref; uno se elige con un clic (o con el teclado: Tab y Enter). Sin formularios largos.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import { Boton, Dialogo, FilaElemento } from '../../ui/componentes';

/** Filas que se enseñan a la vez (las más recientes que coinciden). */
const MAX_FILAS = 50;

interface Props {
  abierto: boolean;
  refe: string;
  candidatos: readonly FrontmatterComun[];
  /** El resumen legible de cada uno (la línea de debajo del título). */
  resumen: (fm: FrontmatterComun) => string;
  alElegir: (ref: string) => void;
  alCerrar: () => void;
}

export function DialogoComparar({ abierto, refe, candidatos, resumen, alElegir, alCerrar }: Props) {
  const { t } = useT();
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={t('pantallas.comparacion.crear.titulo', { ref: refe })}>
      {/* Dentro del diálogo: se monta en cada apertura, con el filtro vacío. */}
      <Lista candidatos={candidatos} resumen={resumen} alElegir={alElegir} />
      <div className="row">
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </Dialogo>
  );
}

function Lista({ candidatos, resumen, alElegir }: Pick<Props, 'candidatos' | 'resumen' | 'alElegir'>) {
  const { t } = useT();
  const [filtro, setFiltro] = useState('');
  const ordenados = useMemo(
    () => [...candidatos].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)),
    [candidatos],
  );
  const buscado = filtro.trim().toLocaleLowerCase();
  const visibles = (
    buscado ? ordenados.filter((fm) => `${fm.ref} ${fm.titulo}`.toLocaleLowerCase().includes(buscado)) : ordenados
  ).slice(0, MAX_FILAS);
  if (!candidatos.length) return <p className="sm muted">{t('pantallas.comparacion.crear.ninguno')}</p>;
  return (
    <>
      <input
        type="search"
        aria-label={t('pantallas.comparacion.crear.filtrar')}
        placeholder={t('pantallas.comparacion.crear.filtrar')}
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        // biome-ignore lint/a11y/noAutofocus: el diálogo se abre para elegir; filtrar es lo primero.
        autoFocus
      />
      {visibles.length ? (
        <div className="list lista-comparar">
          {visibles.map((fm) => (
            <FilaElemento key={fm.id} fm={fm} resumen={resumen(fm)} alAbrir={alElegir} />
          ))}
        </div>
      ) : (
        <p className="sm muted">{t('pantallas.comparacion.crear.sinCoincidencias')}</p>
      )}
    </>
  );
}
