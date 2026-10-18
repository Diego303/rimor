import { GUION, ONDA, PUNTO, TRAZO, TRAZO_PEQUENO, UMBRAL_PEQUENO, VIEWBOX } from './geometria';

interface Props {
  /** Color (punto naranja) o mono en tinta (avatar de Rimor, impresión). */
  variante?: 'color' | 'mono';
  /** Lado en px. */
  tamano?: number;
  /** Con título, es una imagen con nombre; sin él, decorativo. */
  titulo?: string;
}

/** Símbolo «Señal» en línea: onda y guion en `--ink`, punto en `--key` (o `--ink` en mono). Sigue al tema solo. */
export function SimboloRimor({ variante = 'color', tamano = 24, titulo }: Props) {
  const trazo = tamano < UMBRAL_PEQUENO ? TRAZO_PEQUENO : TRAZO;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: con `titulo` lleva <title>; sin él es decorativo (aria-hidden).
    <svg
      className={variante === 'mono' ? 'simbolo mono' : 'simbolo'}
      viewBox={VIEWBOX}
      width={tamano}
      height={tamano}
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title>{titulo}</title>}
      <path className="onda" d={ONDA} strokeWidth={trazo} />
      <circle className="punto" cx={PUNTO.cx} cy={PUNTO.cy} r={PUNTO.r} />
      <path className="guion" d={GUION} strokeWidth={trazo} />
    </svg>
  );
}
