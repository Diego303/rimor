/**
 * Vista del lector Petición HTTP (IN-046): el método y la URL, «Copiar como cURL» y «como fetch»; la consulta, las
 * cabeceras y el cuerpo en tablas (el JSON, con sangría); el usuario, las opciones y lo que va después. Los secretos
 * ya llegan ocultos (`‹oculto:…›`). La referencia no dibuja esta pantalla: se compone con sus piezas.
 */
import { useMemo } from 'react';
import { useT } from '../../i18n/useT';
import { Banner, Estado, Tarjeta, type TonoEstado } from '../../ui/componentes';
import { BotonCopiar } from '../CopiarConValores';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import type { CuerpoHttp, PeticionHttp } from './analisis';
import { aCurl, aFetch } from './exportar';
import { type DatosHttp, esPeticion, lectorHttp } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** El color del método solo refuerza lo que dice: los que borran, en rojo; los que cambian algo, con acento. */
const TONO_METODO: Record<string, TonoEstado> = { DELETE: 'bad', POST: 'acc', PUT: 'acc', PATCH: 'acc' };

function TablaPares({ pares, t }: { pares: readonly [string, string][]; t: T }) {
  return (
    <div className="tbl-wrap">
      <table className="tabla-http">
        <thead>
          <tr>
            <th>{t('nombre')}</th>
            <th>{t('valor')}</th>
          </tr>
        </thead>
        <tbody>
          {pares.map(([n, v], i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: una cabecera puede repetirse; el orden es el de la petición.
            <tr key={i}>
              <td className="mono xs">{n}</td>
              <td className="mono xs valor-http">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El cuerpo: los campos de un formulario en tabla; un JSON, con sangría; lo demás, tal cual. */
function Cuerpo({ cuerpo, t }: { cuerpo: CuerpoHttp; t: T }) {
  const texto = useMemo(() => {
    if (cuerpo.tipo !== 'json') return cuerpo.texto;
    try {
      return JSON.stringify(JSON.parse(cuerpo.texto), null, 2);
    } catch {
      return cuerpo.texto;
    }
  }, [cuerpo]);
  return (
    <Tarjeta titulo={t('cuerpo')}>
      {cuerpo.partes ? <TablaPares pares={cuerpo.partes} t={t} /> : <pre className="code">{texto}</pre>}
    </Tarjeta>
  );
}

function Peticion({ p, t }: { p: PeticionHttp; t: T }) {
  const curl = useMemo(() => aCurl(p), [p]);
  const fetch = useMemo(
    () =>
      aFetch(p, {
        opciones: (lista) => t('notas.opciones', { lista }),
        tuberia: (resto) => t('notas.tuberia', { resto }),
        usuarioOculto: (usuario) => t('notas.usuarioOculto', { usuario }),
        cookie: t('notas.cookie'),
      }),
    [p, t],
  );
  const copiar = (copiarTexto: string, copiado: string) => ({
    titulo: copiarTexto,
    copiar: copiarTexto,
    copiado,
    noCopiado: t('noCopiado'),
    textoListo: t('textoListo'),
  });
  return (
    <>
      <Tarjeta>
        <div className="row peticion-http">
          <Estado tono={TONO_METODO[p.metodo] ?? 'neutro'}>{p.metodo}</Estado>
          <code className="mono sm url-http">{p.url}</code>
        </div>
        {(p.usuario !== undefined || p.opciones.length > 0 || p.tuberia) && (
          <dl className="kv">
            {p.usuario !== undefined && (
              <>
                <dt>{t('usuario')}</dt>
                <dd className="mono">{p.usuario}</dd>
              </>
            )}
            {p.opciones.length > 0 && (
              <>
                <dt>{t('opciones')}</dt>
                <dd className="mono">{p.opciones.join(' ')}</dd>
              </>
            )}
            {p.tuberia && (
              <>
                <dt>{t('tuberia')}</dt>
                <dd className="mono">{p.tuberia}</dd>
              </>
            )}
          </dl>
        )}
        <div className="row">
          <BotonCopiar texto={curl} textos={copiar(t('copiarCurl'), t('copiadoCurl'))} variante="primario" />
          <BotonCopiar texto={fetch} textos={copiar(t('copiarFetch'), t('copiadoFetch'))} />
        </div>
      </Tarjeta>
      {p.consulta.length > 0 && (
        <Tarjeta titulo={t('consulta')}>
          <TablaPares pares={p.consulta} t={t} />
        </Tarjeta>
      )}
      {p.cabeceras.length > 0 && (
        <Tarjeta titulo={t('cabecerasTitulo')}>
          <TablaPares pares={p.cabeceras} t={t} />
        </Tarjeta>
      )}
      {p.cuerpo && <Cuerpo cuerpo={p.cuerpo} t={t} />}
    </>
  );
}

export default function VistaHttp({ el, datos }: PropsVista<DatosHttp>) {
  const { idioma } = useT();
  const t = useMemo(() => textos.t.bind(textos, idioma) as unknown as T, [idioma]);
  return (
    <>
      {esPeticion(datos) ? (
        <Peticion p={datos} t={t} />
      ) : (
        <>
          <Banner>{t('ilegible')}</Banner>
          <pre className="code">{el.original ?? ''}</pre>
        </>
      )}
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifrasDe(lectorHttp, datos)} />
    </>
  );
}
