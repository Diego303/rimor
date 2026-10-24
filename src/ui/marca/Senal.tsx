/**
 * Animaciones del símbolo «Señal» (IN-090, D18): SVG en línea con la geometría del símbolo y una clase por
 * estado; los @keyframes de senal.css portan los SVG de rimor-animaciones. Siempre con texto al lado y
 * anunciada como estado; con movimiento reducido, el fotograma de reposo.
 */
import { useEffect, useState } from 'react';
import { ESTADOS_SENAL, type EstadoSenal, LIMITE_BUCLE_MS } from './estadosSenal';
import { GUION, NOMBRE_APP, ONDA, PUNTO, TRAZO, TRAZO_PEQUENO, UMBRAL_PEQUENO } from './geometria';
import { type PrioridadSenal, useSinTurno } from './turnoBucle';

export type { EstadoSenal } from './estadosSenal';

interface Props {
  estado: EstadoSenal;
  /** Alto en px (el ancho de arranque y primer uso es proporcional). */
  tamano?: number;
  /** `'bucle'` o 1 vez. Por defecto, el del estado. */
  veces?: 'bucle' | 1;
  /** Lo que se está esperando, con su progreso si lo hay: «Indexando 4.210 de 10.000». */
  etiqueta: string;
  /** El texto ya está a la vista en otro sitio (el «Leyendo…» de la respuesta de Rimor): aquí, solo para el lector. */
  textoOculto?: boolean;
  /** Frase del primer uso, bajo el nombre. */
  frase?: string;
  /** El texto y el anuncio ya los da el contenedor (una ErrorTarjeta con su título): solo el símbolo, oculto. */
  decorativa?: boolean;
  /** Un bucle solo se anima con el turno de la pantalla (`turnoBucle.ts`). */
  prioridad?: PrioridadSenal;
}

export function Senal({
  estado,
  tamano = 24,
  veces,
  etiqueta,
  textoOculto,
  frase,
  decorativa,
  prioridad = 'principal',
}: Props) {
  const def = ESTADOS_SENAL[estado];
  const bucle = (veces ?? (def.bucle ? 'bucle' : 1)) === 'bucle';
  const [reposo, setReposo] = useState(false);
  const sinTurno = useSinTurno(bucle && !reposo, prioridad);

  // biome-ignore lint/correctness/useExhaustiveDependencies: un estado nuevo vuelve a empezar su animación y su límite.
  useEffect(() => {
    setReposo(false);
    if (!bucle) return undefined;
    // Bucles con límite: a los 20 s se queda en el reposo y sigue el texto con el progreso.
    const t = setTimeout(() => setReposo(true), LIMITE_BUCLE_MS);
    return () => clearTimeout(t);
  }, [bucle, estado]);

  const trazo = tamano < UMBRAL_PEQUENO ? TRAZO_PEQUENO : TRAZO;
  // Una vez: se detiene en la fracción del ciclo de su reposo (iteraciones fraccionarias y fill-mode both).
  const iteraciones = bucle ? 'infinite' : String(def.reposo);
  // Con el reposo al final del ciclo, el último fotograma no tiene por qué ser el reposo (el tramo de «cargando»
  // sigue visible): sin fill-mode, al acabar se ve la base, que es el reposo.
  const relleno = !bucle && def.reposo === 1 ? 'none' : 'both';
  const anchoVista = def.ancho ? 156 : 48;
  return (
    <span
      className={`senal senal-${estado}${reposo || sinTurno ? ' reposo' : ''}`}
      role={decorativa ? undefined : 'status'}
      aria-live={decorativa ? undefined : 'polite'}
      aria-hidden={decorativa ? true : undefined}
      style={{ ['--senal-veces' as string]: iteraciones, ['--senal-relleno' as string]: relleno }}
    >
      <svg
        viewBox={`0 0 ${anchoVista} 48`}
        width={(tamano * anchoVista) / 48}
        height={tamano}
        aria-hidden="true"
        focusable="false"
      >
        {(estado === 'cargando' || estado === 'indexando') && (
          <path className="tenue" d={ONDA} pathLength={100} strokeWidth={trazo} />
        )}
        {estado === 'comparando' && <path className="referencia anima" d={ONDA} strokeWidth={trazo} />}
        {/* «cargando» no lleva la onda llena: solo la tenue y el tramo que la recorre (SVG 04). */}
        {estado !== 'cargando' && (
          <g className="escala anima">
            <path className="onda anima" d={ONDA} pathLength={100} strokeWidth={trazo} />
          </g>
        )}
        {estado === 'cargando' && <path className="tramo anima" d={ONDA} pathLength={100} strokeWidth={trazo} />}
        {estado === 'guardado' && <circle className="anillo anima" cx={PUNTO.cx} cy={PUNTO.cy} r={PUNTO.r} />}
        {estado === 'indexando' ? (
          // Recorre la onda con offset-path: sin cx/cy, la posición la da la ruta.
          <circle className="punto anima" r={PUNTO.r} />
        ) : (
          <circle className="punto anima" cx={PUNTO.cx} cy={PUNTO.cy} r={PUNTO.r} />
        )}
        <path className="guion anima" d={GUION} strokeWidth={trazo} />
        {def.ancho && (
          <text className="nombre anima" x={52} y={estado === 'primer-uso' ? 27 : 31.5}>
            {NOMBRE_APP}
          </text>
        )}
        {estado === 'primer-uso' && frase && (
          <text className="frase anima" x={52} y={37.5}>
            {frase}
          </text>
        )}
      </svg>
      {!decorativa && <span className={textoOculto ? 'solo-lector' : 'senal-texto'}>{etiqueta}</span>}
    </span>
  );
}
