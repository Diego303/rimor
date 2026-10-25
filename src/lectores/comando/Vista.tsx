/**
 * Vista del lector Comando (IN-043): la chuleta, con cada comando en mono tras su `$` y los huecos resaltados como
 * las variables de un prompt; «Copiar con valores» (el mismo componente que el Prompt) o, sin huecos, «Copiar».
 */
import { useT } from '../../i18n/useT';
import { Boton, Tarjeta } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { CopiarConValores, copiarAlPortapapeles } from '../CopiarConValores';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { rellenar, trozosComando } from './analisis';
import { type DatosComando, lectorComando } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

export default function VistaComando({ el, datos }: PropsVista<DatosComando>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const avisos = useAvisosOpcional();
  const texto = datos.comandos.join('\n');
  const cifras = cifrasDe(lectorComando, datos);
  return (
    <>
      <Tarjeta titulo={t('chuleta')}>
        <pre className="code comando-texto">
          {datos.comandos.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los comandos son fijos y en su orden.
            <span key={i} className="linea">
              <span className="prompt-comando" aria-hidden="true">
                ${' '}
              </span>
              {trozosComando(c).map((tr, j) =>
                tr.t === 'hueco' ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: los trozos de un comando son fijos y en su orden.
                  <span key={j} className="var">
                    {tr.v}
                  </span>
                ) : (
                  tr.v
                ),
              )}
              {'\n'}
            </span>
          ))}
        </pre>
        {!datos.huecos.length && (
          <div className="row">
            <Boton
              variante="primario"
              pequeno
              onClick={() => void copiarAlPortapapeles(texto).then((hecho) => hecho && avisos?.avisar(t('copiado')))}
            >
              {t('copiar')}
            </Boton>
          </div>
        )}
      </Tarjeta>
      {datos.huecos.length > 0 && (
        <CopiarConValores
          ambito="comando"
          idElemento={el.frontmatter.id}
          texto={texto}
          huecos={datos.huecos}
          sustituir={rellenar}
          textos={{
            titulo: t('copiarConValores'),
            copiar: t('copiar'),
            copiado: t('copiado'),
            noCopiado: t('noCopiado'),
            textoListo: t('textoListo'),
          }}
        />
      )}
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras}>
        {datos.programa && (
          <>
            <dt>{t('programa')}</dt>
            <dd className="mono">{datos.programa}</dd>
          </>
        )}
      </DetallesElemento>
    </>
  );
}
