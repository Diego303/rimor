/**
 * Diálogos de la pantalla de elemento: elegir el estado (una lista de botones, sin formularios) y ver el original
 * tal cual (con copiar) o descargarlo si va como adjunto.
 */
import type { Elemento } from '@rimor/formato';
import { useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { estadosPosibles, estadoVisible, tonoDeEstado } from '../../espacio/estados';
import { fmtBytes } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import type { Lector } from '../../lectores/contrato';
import { descargar } from '../../lectores/descargar';
import { Boton, Dialogo, Estado } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Icono } from '../../ui/iconos/Icono';
import { nombreDeEstado } from './estados';

interface PropsEstado {
  abierto: boolean;
  refe: string;
  estado: string | undefined;
  lector: Lector | null;
  alElegir: (estado: string) => void;
  alCerrar: () => void;
}

export function DialogoEstado({ abierto, refe, estado, lector, alElegir, alCerrar }: PropsEstado) {
  const { t, idioma } = useT();
  const actual = estadoVisible(estado, lector);
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={t('pantallas.elemento.estadoTitulo', { ref: refe })}>
      <div className="list lista-estados">
        {estadosPosibles(lector, estado).map((e) => (
          <button
            key={e}
            type="button"
            className="it"
            aria-current={e === actual ? true : undefined}
            onClick={() => alElegir(e)}
          >
            <Estado tono={tonoDeEstado(e)}>{nombreDeEstado(e, lector, idioma)}</Estado>
            {e === actual && <Icono nombre="hecho" tamano={14} />}
          </button>
        ))}
      </div>
      <div className="row">
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </Dialogo>
  );
}

interface PropsOriginal {
  abierto: boolean;
  el: Elemento;
  alCerrar: () => void;
}

export function DialogoOriginal({ abierto, el, alCerrar }: PropsOriginal) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const [bajando, setBajando] = useState(false);
  const fm = el.frontmatter;
  const adjunto = fm.adjunto;

  async function copiar() {
    const portapapeles = globalThis.navigator?.clipboard;
    const hecho = portapapeles?.writeText
      ? await portapapeles.writeText(el.original ?? '').then(
          () => true,
          () => false,
        )
      : false;
    avisos?.avisar(t(hecho ? 'pantallas.elemento.copiado' : 'pantallas.elemento.noCopiado'));
  }

  async function bajar() {
    if (!espacio || !adjunto) return;
    setBajando(true);
    const bytes = await espacio.repositorio.leerAdjunto(adjunto.ruta).catch(() => null);
    setBajando(false);
    if (bytes) descargar(bytes, adjunto.nombre ?? adjunto.ruta.split('/').at(-1) ?? fm.ref, adjunto.mime ?? '');
    else avisos?.avisar(t('pantallas.elemento.noDisponible'));
  }

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={t('pantallas.elemento.originalTitulo', { ref: fm.ref })}>
      {el.original !== null && <pre className="code original-elemento">{el.original}</pre>}
      {adjunto && (
        <p className="sm">
          <span className="mono">{adjunto.nombre ?? adjunto.ruta}</span>{' '}
          <span className="muted">· {fmtBytes(adjunto.tam, idioma)}</span>
        </p>
      )}
      <div className="row">
        {el.original !== null && (
          <Boton variante="primario" pequeno icono="copiar" onClick={() => void copiar()}>
            {t('pantallas.elemento.copiar')}
          </Boton>
        )}
        {adjunto && (
          <Boton
            variante={el.original === null ? 'primario' : 'secundario'}
            pequeno
            icono="descargar"
            disabled={bajando}
            onClick={() => void bajar()}
          >
            {t('pantallas.elemento.descargar')}
          </Boton>
        )}
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.elemento.cerrar')}
        </Boton>
      </div>
    </Dialogo>
  );
}
