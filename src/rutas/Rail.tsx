/** Raíl de la carcasa (rimor-diseno.md §8.1): logotipo, secciones, colecciones y pie del espacio. */
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useEspacio } from '../estado/espacio';
import { fmtFechaRelativa } from '../i18n/formatos';
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
function PilotoCopia({ alDia, etiqueta }: { alDia: boolean; etiqueta: string }) {
  const antes = useRef(alDia);
  const [animando, setAnimando] = useState(false);
  useEffect(() => {
    const paso = alDia && !antes.current;
    antes.current = alDia;
    if (!paso) return undefined;
    setAnimando(true);
    const fin = setTimeout(() => setAnimando(false), ESTADOS_SENAL['copia-al-dia'].duracionS * 1000);
    return () => clearTimeout(fin);
  }, [alDia]);
  return animando ? (
    <Senal estado="copia-al-dia" veces={1} tamano={12} etiqueta={etiqueta} textoOculto />
  ) : (
    <Piloto tono={alDia ? 'ok' : 'warn'} etiqueta={etiqueta} />
  );
}

export function Rail() {
  const { t, idioma } = useT();
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  const espacio = useEspacio();
  const copia = espacio.ultimaCopia
    ? t('rail.ultimaCopia', { cuando: fmtFechaRelativa(new Date(espacio.ultimaCopia), new Date(), idioma) })
    : t('rail.sinCopia');
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
            alDia={espacio.copiaAlDia}
            etiqueta={espacio.copiaAlDia ? t('rail.copiaAlDia') : t('rail.copiaPendiente')}
          />
          {espacio.nombre || t('rail.espacioSinNombre')}
        </b>
        <span>{copia}</span>
      </Link>
    </nav>
  );
}
