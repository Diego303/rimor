/**
 * Respuesta de Rimor (guía §7.6, IN-016): bloque hundido con el símbolo mono como avatar y la frase con sus
 * datos marcados. Mientras se compone, el texto es «Leyendo…» y, si tarda más de 400 ms, el avatar pasa a la
 * animación «contestando»: una sola a la vez en pantalla (las demás respuestas pendientes, con el avatar quieto).
 */
import type { ReactNode } from 'react';
import { fmtFecha } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { Ref } from '../ui/componentes';
import { Senal } from '../ui/marca/Senal';
import { SimboloRimor } from '../ui/marca/SimboloRimor';
import { PRIORIDAD_BUCLE, useTurnoBucle } from '../ui/marca/turnoBucle';
import { useEsperaVisible } from '../ui/marca/useEsperaVisible';
import type { Fragmento, Respuesta } from './tipos';

interface Props {
  /** `null` mientras se compone. */
  respuesta: Respuesta | null;
  /** Abrir un elemento al pulsar una ref; sin ella, las refs se pintan en mono sin botón. */
  alAbrir?: (ref: string) => void;
  /**
   * Anunciarla a los lectores de pantalla cuando llega (`aria-live`). En un feed solo la de lo recién capturado: al
   * desplazarse, cada mensaje que se monta no debe anunciarse.
   */
  anunciar?: boolean;
}

export function RespuestaRimor({ respuesta, alAbrir, anunciar = true }: Props) {
  const { t } = useT();
  const esperaVisible = useEsperaVisible(respuesta === null);
  // La de lo recién capturado (la que se anuncia) tiene preferencia para animarse.
  const conTurno = useTurnoBucle(esperaVisible, anunciar ? PRIORIDAD_BUCLE.principal : PRIORIDAD_BUCLE.secundaria);
  return (
    <div className="rimor">
      <span className="av">
        {conTurno ? (
          <Senal estado="contestando" decorativa tamano={13} etiqueta="" prioridad="sinTurno" />
        ) : (
          <SimboloRimor variante="mono" tamano={13} />
        )}
      </span>
      <p aria-live={anunciar ? 'polite' : undefined}>
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
      // Como en la pantalla de referencia, el dato va en negrita (no con la ficha de cifra de los documentos).
      return <b className="dato">{f.v}</b>;
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
