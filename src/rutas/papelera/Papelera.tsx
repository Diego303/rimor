/**
 * Papelera (ORG-07): lo que hay en ella, con «Restaurar» en cada uno, y «Vaciar la papelera» en dos pasos: primero
 * se descarga un ZIP con todo lo que hay y después se borra lo que entró en él. El navegador no dice si una
 * descarga se guardó, así que vaciar es un clic aparte, después de descargar.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { type CopiaZip, nombreZipPapelera, prepararCopia } from '../../espacio/papelera';
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
  // El diálogo de vaciar: abierto, con la copia (o `null` mientras se prepara), si ya se descargó y si se borra.
  const [vaciado, setVaciado] = useState<{ copia: CopiaZip | null; descargada: boolean; borrando: boolean } | null>(
    null,
  );
  const pedida = useRef(0);
  const editable = Boolean(espacio) && !soloLectura;
  // Mientras se vacía, nada de restaurar: lo que entró en la copia se va a borrar.
  const ocupado = vaciado !== null;

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

  /** Abre el diálogo y prepara el ZIP con lo que hay ahora. */
  async function empezar() {
    if (!espacio) return;
    const esta = ++pedida.current;
    setVaciado({ copia: null, descargada: false, borrando: false });
    const copia = await prepararCopia(espacio.repositorio).catch(() => undefined);
    if (pedida.current !== esta) return;
    if (copia === undefined) avisos?.avisar(t('pantallas.papelera.noVaciada'));
    setVaciado(copia ? { copia, descargada: false, borrando: false } : null);
  }

  const cerrar = () => {
    pedida.current++;
    setVaciado(null);
  };

  /** Primer paso: descargar el ZIP (con el clic del usuario, para que el navegador lo deje). */
  function bajarZip() {
    if (!vaciado?.copia) return;
    try {
      descargar(vaciado.copia.zip, nombreZipPapelera(nombre, new Date()), 'application/zip');
      setVaciado({ ...vaciado, descargada: true });
    } catch {
      avisos?.avisar(t('pantallas.papelera.noDescargada'));
    }
  }

  /** Segundo paso, con el ZIP ya descargado: borrar lo que entró en él. */
  async function vaciar() {
    const copia = vaciado?.copia;
    if (!espacio || !copia || !vaciado.descargada) return;
    setVaciado({ ...vaciado, borrando: true });
    const n = await espacio.repositorio.vaciarPapelera(copia).catch(() => null);
    cerrar();
    avisos?.avisar(n === null ? t('pantallas.papelera.noBorrada') : t('pantallas.papelera.vaciada', { n }));
  }

  return (
    <Pantalla
      titulo={t('pantallas.papelera.titulo')}
      meta={lista.length ? t('pantallas.papelera.meta', { n: lista.length }) : undefined}
      control={
        editable && lista.length > 0 ? (
          <Boton peligro pequeno icono="papelera" disabled={ocupado} onClick={() => void empezar()}>
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
                    disabled={ocupado}
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
      <Dialogo abierto={ocupado} alCerrar={cerrar} titulo={t('pantallas.papelera.vaciarTitulo')}>
        <p className="sm">{t('pantallas.papelera.vaciarTexto', { n: vaciado?.copia?.ids.length ?? lista.length })}</p>
        {vaciado?.descargada && <p className="xs muted">{t('pantallas.papelera.descargada')}</p>}
        <div className="row">
          <Boton
            variante={vaciado?.descargada ? 'secundario' : 'primario'}
            pequeno
            icono="descargar"
            disabled={!vaciado?.copia || vaciado.borrando}
            onClick={bajarZip}
          >
            {vaciado?.copia ? t('pantallas.papelera.descargarZip') : t('pantallas.papelera.preparando')}
          </Boton>
          <Boton
            variante="primario"
            peligro
            pequeno
            disabled={!vaciado?.descargada || vaciado.borrando}
            onClick={() => void vaciar()}
          >
            {t('pantallas.papelera.confirmar')}
          </Boton>
          <Boton pequeno disabled={vaciado?.borrando} onClick={cerrar}>
            {t('pantallas.papelera.cancelar')}
          </Boton>
        </div>
      </Dialogo>
    </Pantalla>
  );
}
