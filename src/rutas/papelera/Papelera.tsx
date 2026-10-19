/**
 * Papelera (ORG-07): lo que hay en ella, con «Restaurar» en cada uno, y «Vaciar la papelera», que antes descarga
 * un ZIP con todo lo que hay y solo después lo borra (si el ZIP no se puede hacer, no se borra nada).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { nombreZipPapelera, vaciarConCopia } from '../../espacio/papelera';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { descargar } from '../../lectores/descargar';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, Dialogo, FilaElemento, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Pantalla } from '../Pantalla';

/** Lo que hay en la papelera, al día con cada cambio, de lo más reciente a lo más antiguo. */
function useEnPapelera(): readonly FrontmatterComun[] {
  const espacio = useEspacioOpcional();
  const [lista, setLista] = useState<readonly FrontmatterComun[]>([]);
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () =>
      setLista(espacio.repositorio.enPapelera().sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)));
    leer();
    return espacio.alCambiar(leer);
  }, [espacio]);
  return lista;
}

export function Papelera() {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const nombre = useEspacio((s) => s.nombre);
  const lista = useEnPapelera();
  const [confirmando, setConfirmando] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const editable = Boolean(espacio) && !soloLectura;

  const abrir = (ref: string) => void navegar({ to: '/e/$ref', params: { ref } });
  const legible = (fm: FrontmatterComun) => {
    try {
      return lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
    } catch {
      return '';
    }
  };

  async function restaurar(fm: FrontmatterComun) {
    const r = espacio ? await espacio.repositorio.restaurar(fm.id).catch(() => null) : null;
    avisos?.avisar(t(r?.ok ? 'pantallas.elemento.restaurado' : 'pantallas.elemento.noRestaurado', { ref: fm.ref }));
  }

  async function vaciar() {
    setConfirmando(false);
    if (!espacio) return;
    setVaciando(true);
    const n = await vaciarConCopia(espacio.repositorio, (zip) =>
      descargar(zip, nombreZipPapelera(nombre, new Date()), 'application/zip'),
    ).catch(() => null);
    setVaciando(false);
    avisos?.avisar(n === null ? t('pantallas.papelera.noVaciada') : t('pantallas.papelera.vaciada', { n }));
  }

  return (
    <Pantalla
      titulo={t('pantallas.papelera.titulo')}
      meta={lista.length ? t('pantallas.papelera.meta', { n: lista.length }) : undefined}
      control={
        editable && lista.length > 0 ? (
          <Boton peligro pequeno icono="papelera" disabled={vaciando} onClick={() => setConfirmando(true)}>
            {t('pantallas.papelera.vaciar')}
          </Boton>
        ) : undefined
      }
    >
      {lista.length === 0 ? (
        <Vacio titulo={t('pantallas.papelera.vaciaTitulo')}>{t('pantallas.papelera.vacia')}</Vacio>
      ) : (
        <section className="card" aria-label={t('pantallas.papelera.lista')}>
          <div className="list">
            {lista.map((fm) => (
              <div key={fm.id} className="row fila-papelera">
                <FilaElemento fm={fm} resumen={legible(fm)} alAbrir={abrir} />
                {editable && (
                  <Boton
                    pequeno
                    aria-label={t('pantallas.papelera.restaurar', { ref: fm.ref })}
                    onClick={() => void restaurar(fm)}
                  >
                    {t('pantallas.elemento.restaurar')}
                  </Boton>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialogo
        abierto={confirmando}
        alCerrar={() => setConfirmando(false)}
        titulo={t('pantallas.papelera.vaciarTitulo')}
      >
        <p className="sm">{t('pantallas.papelera.vaciarTexto', { n: lista.length })}</p>
        <div className="row">
          <Boton variante="primario" peligro pequeno onClick={() => void vaciar()}>
            {t('pantallas.papelera.confirmar')}
          </Boton>
          <Boton pequeno onClick={() => setConfirmando(false)}>
            {t('pantallas.papelera.cancelar')}
          </Boton>
        </div>
      </Dialogo>
    </Pantalla>
  );
}
