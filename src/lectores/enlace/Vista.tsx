/** Vista del lector Enlace: la dirección limpia (se abre aparte), qué es y en qué sitio, y lo pegado si era otro. */
import { useT } from '../../i18n/useT';
import { Tarjeta } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import type { DatosEnlace } from './lector';
import { textos } from './textos';

export default function VistaEnlace({ el, datos }: PropsVista<DatosEnlace>) {
  const { idioma } = useT();
  const t = (clave: Parameters<typeof textos.t>[1]) => textos.t(idioma, clave);
  const pegado = (el.original ?? '').trim();
  return (
    <>
      <Tarjeta>
        <dl className="kv">
          <dt>{t('direccion')}</dt>
          <dd>
            {datos.url ? (
              <a href={datos.url} target="_blank" rel="noopener noreferrer nofollow" className="mono sm enlace-url">
                {datos.url}
              </a>
            ) : (
              <span className="mono sm">{pegado}</span>
            )}
          </dd>
          <dt>{t('clase')}</dt>
          <dd>{textos.t(idioma, `clases.${datos.clase}`)}</dd>
          {datos.sitio && (
            <>
              <dt>{t('sitio')}</dt>
              <dd>{datos.sitio}</dd>
            </>
          )}
          {datos.url && pegado !== datos.url && (
            <>
              <dt>{t('pegado')}</dt>
              <dd className="mono xs muted enlace-url">{pegado}</dd>
            </>
          )}
        </dl>
      </Tarjeta>
      <DetallesElemento refe={el.frontmatter.ref} />
    </>
  );
}
