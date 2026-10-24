/** Raíl de la carcasa (rimor-diseno.md §8.1): logotipo, secciones, colecciones y pie del espacio. */
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { SenalExportacion, useEsperaExportacion } from '../datos/useExportar';
import { useEspacio } from '../estado/espacio';
import { diasDesde, type Idioma } from '../i18n/formatos';
import { traducir } from '../i18n/i18n';
import { useT } from '../i18n/useT';
import { Piloto } from '../ui/componentes';
import { Icono, type NombreIcono } from '../ui/iconos/Icono';
import { ESTADOS_SENAL } from '../ui/marca/estadosSenal';
import { Logotipo } from '../ui/marca/Logotipo';
import { Senal } from '../ui/marca/Senal';

/** Contenido de un botón del raíl: icono de 17 px, texto con elipsis y recuento opcional. */
function ContenidoRb({ icono, texto, recuento }: { icono: NombreIcono; texto: string; recuento?: number }) {
  return (
    <>
      <Icono nombre={icono} tamano={17} />
      <span className="t">{texto}</span>
      {recuento !== undefined && <span className="n num">{recuento}</span>}
    </>
  );
}

const actual = (activo: boolean) => (activo ? ('page' as const) : undefined);

/**
 * El piloto de la copia: verde al día, ámbar si toca copiar. Al pasar a verde (una copia completa), en su sitio se ve
 * una vez la señal «copia al día» y después el piloto (IN-037).
 */
export function PilotoCopia({
  alDia,
  ultimaCopia,
  etiqueta,
  exportando,
}: {
  alDia: boolean;
  ultimaCopia: string | null;
  etiqueta: string;
  /** Una exportación en marcha (con `Ctrl+E` desde cualquier pantalla): el piloto la enseña. */
  exportando?: boolean;
}) {
  const antes = useRef({ alDia, ultimaCopia });
  const [animando, setAnimando] = useState(false);
  useEffect(() => {
    // Solo con una copia nueva (no si se suben los umbrales, ni al abrir).
    const copia = alDia && !antes.current.alDia && ultimaCopia !== antes.current.ultimaCopia;
    antes.current = { alDia, ultimaCopia };
    if (!alDia) setAnimando(false);
    if (!copia) return undefined;
    setAnimando(true);
    const fin = setTimeout(() => setAnimando(false), ESTADOS_SENAL['copia-al-dia'].duracionS * 1000);
    return () => {
      clearTimeout(fin);
      setAnimando(false);
    };
  }, [alDia, ultimaCopia]);
  if (exportando)
    return (
      <span className="piloto-animado">
        <SenalExportacion tamano={12} textoOculto prioridad="secundaria" />
      </span>
    );
  return animando ? (
    // En una caja del tamaño del piloto: el nombre del espacio no se mueve.
    <span className="piloto-animado">
      <Senal estado="copia-al-dia" veces={1} tamano={12} etiqueta={etiqueta} textoOculto />
    </span>
  ) : (
    <Piloto tono={alDia ? 'ok' : 'warn'} etiqueta={etiqueta} />
  );
}

/** «Última copia hace 2 días» (como `.space` de la referencia), «hoy» o «ayer»; o «Sin copia todavía». */
export function textoUltimaCopia(ultimaCopia: string | null, idioma: Idioma, ahora = new Date()): string {
  const dias = ultimaCopia ? diasDesde(new Date(ultimaCopia), ahora) : Number.NaN;
  if (!Number.isFinite(dias)) return traducir(idioma, 'rail.sinCopia');
  if (dias <= 0) return traducir(idioma, 'rail.ultimaCopia.hoy');
  if (dias === 1) return traducir(idioma, 'rail.ultimaCopia.ayer');
  return traducir(idioma, 'rail.ultimaCopia.hace', { n: dias });
}

export function Rail() {
  const { t, idioma } = useT();
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  const espacio = useEspacio();
  const exportacion = useEsperaExportacion();
  const copia = textoUltimaCopia(espacio.ultimaCopia, idioma);
  return (
    <nav className="rail" aria-label={t('rail.etiqueta')}>
      <div className="rbrand">
        <Logotipo tamano={18} />
      </div>
      <Link to="/" className="rb" aria-current={actual(ruta === '/')}>
        <ContenidoRb icono="inicio" texto={t('rail.inicio')} recuento={espacio.sinClasificar} />
      </Link>
      <Link to="/buscar" className="rb" aria-current={actual(ruta === '/buscar')}>
        <ContenidoRb icono="buscar" texto={t('rail.buscar')} />
      </Link>
      {espacio.colecciones.length > 0 && <span className="lbl sec">{t('rail.colecciones')}</span>}
      {espacio.colecciones.map((c) => (
        <Link
          key={c.id}
          to="/c/$coleccion"
          params={{ coleccion: c.id }}
          className="rb sub"
          aria-current={actual(ruta === `/c/${encodeURIComponent(c.id)}`)}
        >
          <ContenidoRb icono="coleccion" texto={c.nombre} recuento={c.recuento} />
        </Link>
      ))}
      {/* No es «sub»: también va en la barra inferior del móvil, donde no hay pie del espacio. */}
      <Link to="/ajustes" className="rb" aria-current={actual(ruta === '/ajustes')}>
        <ContenidoRb icono="ajustes" texto={t('rail.ajustes')} />
      </Link>
      <Link to="/datos" className="space" aria-current={actual(ruta === '/datos')}>
        <b>
          <PilotoCopia
            ultimaCopia={espacio.ultimaCopia}
            alDia={espacio.copiaAlDia}
            etiqueta={espacio.copiaAlDia ? t('rail.copiaAlDia') : t('rail.copiaPendiente')}
            // En Datos y copias ya la enseña su tarjeta.
            exportando={exportacion.visible && ruta !== '/datos'}
          />
          {espacio.nombre || t('rail.espacioSinNombre')}
        </b>
        <span>{copia}</span>
      </Link>
    </nav>
  );
}
