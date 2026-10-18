/** Vista del lector Texto: el texto como Markdown saneado y, debajo, sus enlaces y las refs que menciona. */
import { useT } from '../../i18n/useT';
import { Tarjeta } from '../../ui/componentes';
import MarkdownSeguro from '../../ui/componentes/MarkdownSeguro';
import type { PropsVista } from '../contrato';
import type { DatosTexto } from './lector';
import { textos } from './textos';

export default function VistaTexto({ el, datos }: PropsVista<DatosTexto>) {
  const { idioma } = useT();
  return (
    <>
      <Tarjeta>
        <MarkdownSeguro texto={el.original ?? ''} />
      </Tarjeta>
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
    </>
  );
}
