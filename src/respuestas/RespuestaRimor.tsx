/**
 * Respuesta de Rimor (guía §7.6, IN-016): bloque hundido con el símbolo mono como avatar y la frase con sus
 * datos marcados. Mientras se compone, el avatar es la animación «contestando» y el texto, «Leyendo…».
 */
import type { ReactNode } from 'react';
import { fmtFecha } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { Ref } from '../ui/componentes';
import { Senal } from '../ui/marca/Senal';
import { SimboloRimor } from '../ui/marca/SimboloRimor';
import type { Fragmento, Respuesta } from './tipos';

interface Props {
  /** `null` mientras se compone. */
  respuesta: Respuesta | null;
  /** Abrir un elemento al pulsar una ref; sin ella, las refs se pintan en mono sin botón. */
  alAbrir?: (ref: string) => void;
}

export function RespuestaRimor({ respuesta, alAbrir }: Props) {
  const { t } = useT();
  return (
    <div className="rimor">
      <span className="av">
        {respuesta ? (
          <SimboloRimor variante="mono" tamano={13} />
        ) : (
          <Senal estado="contestando" decorativa tamano={13} etiqueta="" />
        )}
      </span>
      <p aria-live="polite">
        {respuesta
          ? // biome-ignore lint/suspicious/noArrayIndexKey: los fragmentos de una respuesta no se reordenan ni cambian.
            respuesta.texto.map((f, i) => <Pieza key={i} f={f} alAbrir={alAbrir} />)
          : t('respuestas.leyendo')}
      </p>
    </div>
  );
}

function Pieza({ f, alAbrir }: { f: Fragmento; alAbrir: Props['alAbrir'] }): ReactNode {
  const { idioma } = useT();
  switch (f.t) {
    case 'texto':
      return f.v;
    case 'fuerte':
      return <b>{f.v}</b>;
    case 'cifra':
      return <b className="cifra">{f.v}</b>;
    case 'mono':
      return <span className="mono">{f.v}</span>;
    case 'ref':
      return alAbrir ? <Ref refe={f.ref} alPulsar={alAbrir} /> : <span className="mono">{f.ref}</span>;
    case 'cita': {
      const fecha = new Date(f.fecha);
      return <q title={Number.isNaN(fecha.getTime()) ? undefined : fmtFecha(fecha, idioma)}>{f.v}</q>;
    }
  }
}
