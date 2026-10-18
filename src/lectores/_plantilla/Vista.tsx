/** Vista completa de la plantilla: recibe el elemento y lo que calculó `derivar`. Export por defecto. */
import { fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Tarjeta } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import type { DatosPlantilla } from './lector';
import { textos } from './textos';

export default function VistaPlantilla({ el, datos }: PropsVista<DatosPlantilla>) {
  const { idioma } = useT();
  return (
    <Tarjeta>
      <div className="stats">
        <div className="stat">
          <span className="v">{fmtNumero(datos.lineas, idioma)}</span>
          <span className="xs muted">{textos.t(idioma, 'etiquetas.lineas', { n: datos.lineas })}</span>
        </div>
        <div className="stat">
          <span className="v">{fmtNumero(datos.palabras, idioma)}</span>
          <span className="xs muted">{textos.t(idioma, 'etiquetas.palabras', { n: datos.palabras })}</span>
        </div>
      </div>
      <pre className="code">{el.original ?? ''}</pre>
    </Tarjeta>
  );
}
