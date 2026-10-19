/**
 * Vista del lector Código: el código con números de línea y resaltado de solo lectura (Lezer, cargado bajo
 * demanda; mientras llega, o si el lenguaje no tiene analizador, el texto tal cual), y «Detalles» con el lenguaje,
 * cómo se supo, las líneas, las definiciones y las cifras.
 */
import { useEffect, useMemo, useState } from 'react';
import { fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Tarjeta } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { type DatosCodigo, lectorCodigo, nombreDeLenguaje } from './lector';
import { resaltar, type Trozo, tieneResaltado } from './resaltado';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

export default function VistaCodigo({ el, datos }: PropsVista<DatosCodigo>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const codigo = useMemo(() => (el.original ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, ''), [el.original]);
  const [resaltado, setResaltado] = useState<Trozo[][] | null>(null);

  useEffect(() => {
    let vigente = true;
    setResaltado(null);
    resaltar(codigo, datos.lenguaje)
      .then((r) => vigente && setResaltado(r))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [codigo, datos.lenguaje]);

  const lineas: Trozo[][] = resaltado ?? codigo.split('\n').map((l) => [{ texto: l, clases: '' }]);
  const lenguaje = nombreDeLenguaje(datos.lenguaje, idioma);
  const cifras = cifrasDe(lectorCodigo, datos);

  return (
    <>
      <Tarjeta>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: una región que se desplaza necesita el foco del teclado (WCAG 2.1.1). */}
        <section className="codigo-desplazable" aria-label={t('codigo')} tabIndex={0}>
          <pre className="code codigo">
            {lineas.map((trozos, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: las líneas del código son fijas y en su orden.
              <span key={i} className="linea">
                {/* El número de línea no se lee ni se copia. */}
                <span className="ln" aria-hidden="true">
                  {i + 1}
                </span>
                {trozos.map((tr, j) =>
                  tr.clases ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: los trozos de una línea son fijos y en su orden.
                    <span key={j} className={tr.clases}>
                      {tr.texto}
                    </span>
                  ) : (
                    tr.texto
                  ),
                )}
                {'\n'}
              </span>
            ))}
          </pre>
        </section>
        {datos.lenguaje && !tieneResaltado(datos.lenguaje) && <p className="xs muted">{t('sinResaltado')}</p>}
      </Tarjeta>

      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras}>
        <dt>{t('lenguaje')}</dt>
        <dd>
          {lenguaje ?? t('sinLenguaje')}
          {lenguaje && <span className="xs muted"> ({t(`comoSeSupo.${datos.comoSeSupo}`)})</span>}
        </dd>
        <dt>{t('etiquetaLineas')}</dt>
        <dd className="mono">{fmtNumero(datos.lineas, idioma)}</dd>
        <dt>{t('caracteres')}</dt>
        <dd className="mono">{fmtNumero(datos.caracteres, idioma)}</dd>
        <dt>{t('definiciones')}</dt>
        <dd className="mono">{datos.definiciones.length ? datos.definiciones.join(' · ') : t('ninguna')}</dd>
      </DetallesElemento>
    </>
  );
}
