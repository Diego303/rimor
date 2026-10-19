/** Vista del lector Texto: el texto como Markdown saneado y, debajo, sus enlaces y las refs que menciona. */
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { fmtBytes } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Tarjeta } from '../../ui/componentes';
import MarkdownSeguro from '../../ui/componentes/MarkdownSeguro';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { descargar } from '../descargar';
import { type DatosTexto, lectorTexto } from './lector';
import { textos } from './textos';

/** De un texto guardado aparte, lo que se pinta (en plano: Markdown de varios MB bloquearía la página). */
const MUESTRA_GRANDE = 100 * 1024;

/** Un texto de más de 2 MB guardado como adjunto: su principio y la descarga del completo. */
function TextoGrande({ el }: { el: PropsVista<DatosTexto>['el'] }) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const adjunto = el.frontmatter.adjunto;
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  useEffect(() => {
    if (!espacio || !adjunto) return undefined;
    let vigente = true;
    void espacio.repositorio
      .leerAdjunto(adjunto.ruta)
      .then((b) => vigente && setBytes(b))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [espacio, adjunto]);
  if (!adjunto) return null;
  const muestra = bytes ? new TextDecoder().decode(bytes.subarray(0, MUESTRA_GRANDE)) : '';
  return (
    <Tarjeta>
      <p className="sm muted">
        {textos.t(idioma, 'grande', { tam: fmtBytes(adjunto.tam, idioma), muestra: fmtBytes(MUESTRA_GRANDE, idioma) })}
      </p>
      <pre className="code">{muestra}</pre>
      <div className="row">
        <Boton
          disabled={!bytes}
          onClick={() => bytes && descargar(bytes, adjunto.nombre ?? `${el.frontmatter.ref}.txt`, 'text/plain')}
        >
          {textos.t(idioma, 'descargar')}
        </Boton>
      </div>
    </Tarjeta>
  );
}

export default function VistaTexto({ el, datos }: PropsVista<DatosTexto>) {
  const { idioma } = useT();
  return (
    <>
      {el.original === null ? (
        <TextoGrande el={el} />
      ) : (
        <Tarjeta>
          <MarkdownSeguro texto={el.original} />
        </Tarjeta>
      )}
      {datos.enlaces.length > 0 && (
        <Tarjeta titulo={textos.t(idioma, 'tituloEnlaces')}>
          <ul className="lista-enlaces">
            {datos.enlaces.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="mono sm">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {datos.menciones.length > 0 && (
        <Tarjeta titulo={textos.t(idioma, 'tituloMenciones')}>
          <div className="row">
            {datos.menciones.map((ref) => (
              <a key={ref} className="ref" href={`#/e/${ref}`}>
                {ref}
              </a>
            ))}
          </div>
        </Tarjeta>
      )}
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifrasDe(lectorTexto, datos)} />
    </>
  );
}
