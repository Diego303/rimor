/** Vista del lector genérico de archivo: nombre, tamaño y tipo, y descarga del original tal cual. */
import { useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { fmtBytes } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Tarjeta } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import type { PropsVista } from '../contrato';
import type { DatosArchivo } from './lector';
import { textos } from './textos';

/** Descarga unos bytes con su nombre (Blob y un enlace temporal que se revoca al acabar). */
export function descargar(bytes: Uint8Array, nombre: string, mime: string): void {
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime || 'application/octet-stream' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // El navegador ya tiene la descarga: el enlace temporal no hace falta.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function VistaArchivo({ el, datos }: PropsVista<DatosArchivo>) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const [bajando, setBajando] = useState(false);
  const t = (clave: Parameters<typeof textos.t>[1]) => textos.t(idioma, clave);
  const ruta = el.frontmatter.adjunto?.ruta;

  async function bajar() {
    if (!espacio || !ruta) return;
    setBajando(true);
    const bytes = await espacio.repositorio.leerAdjunto(ruta).catch(() => null);
    setBajando(false);
    if (bytes) descargar(bytes, datos.nombre, datos.mime);
    else avisos?.avisar(t('noDisponible'));
  }

  return (
    <Tarjeta>
      <dl className="kv">
        <dt>{t('nombre')}</dt>
        <dd className="mono">{datos.nombre}</dd>
        <dt>{t('tamano')}</dt>
        <dd>{fmtBytes(datos.tam, idioma)}</dd>
        <dt>{t('tipo')}</dt>
        <dd className="mono">{datos.mime || t('sinTipo')}</dd>
      </dl>
      <div className="row">
        <Boton onClick={() => void bajar()} disabled={bajando || !ruta}>
          {t('descargar')}
        </Boton>
      </div>
    </Tarjeta>
  );
}
