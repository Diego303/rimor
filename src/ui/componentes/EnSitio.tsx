/**
 * Edición en el sitio (VIS-01): un texto que, al pulsarlo (o con `Enter` sobre él), pasa a ser un campo con lo
 * mismo. `Enter` o salir del campo guardan; `Esc` deja lo que había. Sin formularios. Puede ofrecer sugerencias
 * debajo (colecciones que ya existen), que completan la última palabra.
 */
import { type FocusEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { clases } from '../clases';
import { Filtro } from './Marcas';

interface Props {
  /** Lo que aparece en el campo al empezar a editar. */
  valor: string;
  editando: boolean;
  alEmpezar: () => void;
  /** El texto escrito, o `null` si se canceló. */
  alTerminar: (texto: string | null) => void;
  /** Qué se edita: la ayuda del texto pulsable y el nombre del campo. */
  etiqueta: string;
  /** Sin editar, solo se ve (pestaña de solo lectura). */
  soloLectura?: boolean;
  /** Sugerencias para el texto escrito hasta ahora (nombres completos). */
  sugerencias?: (texto: string) => readonly string[];
  className?: string;
  /** Cómo se ve sin editar. */
  children: ReactNode;
}

/** Cambia la última palabra (la que se está escribiendo) por `palabra`, y deja un espacio para la siguiente. */
export function completarUltima(texto: string, palabra: string): string {
  const base = /\s$/.test(texto) || !texto ? texto : texto.replace(/\S+$/, '');
  return `${base}${palabra} `;
}

export function EnSitio({
  valor,
  editando,
  alEmpezar,
  alTerminar,
  etiqueta,
  soloLectura,
  sugerencias,
  className,
  children,
}: Props) {
  const [texto, setTexto] = useState(valor);
  const campo = useRef<HTMLInputElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const contenedor = useRef<HTMLSpanElement>(null);
  // Terminar una sola vez (Enter y después el blur del campo que desaparece no guardan dos veces).
  const terminado = useRef(false);
  // Con Enter o Esc el foco vuelve al texto; si se salió pulsando en otro sitio, se queda donde fue.
  const devolverFoco = useRef(false);

  // Al empezar, el campo con lo que hay ahora; lo que llegue de fuera mientras se escribe no pisa lo escrito.
  const [antes, setAntes] = useState(editando);
  if (editando !== antes) {
    setAntes(editando);
    if (editando) setTexto(valor);
  }

  useEffect(() => {
    if (!editando) return;
    terminado.current = false;
    // El campo con el foco y su texto seleccionado, para escribir encima.
    campo.current?.focus();
    campo.current?.select();
  }, [editando]);

  useEffect(() => {
    if (editando || !devolverFoco.current) return;
    devolverFoco.current = false;
    boton.current?.focus();
  }, [editando]);

  const terminar = (resultado: string | null, conFoco: boolean) => {
    if (terminado.current) return;
    terminado.current = true;
    devolverFoco.current = conFoco;
    alTerminar(resultado);
  };

  if (soloLectura) return <span className={className}>{children}</span>;
  if (!editando)
    return (
      <button
        ref={boton}
        type="button"
        className={clases('en-sitio', className)}
        // Su nombre es lo que se ve (el título, las colecciones); lo que hace, en la ayuda emergente.
        title={etiqueta}
        onClick={alEmpezar}
      >
        {children}
      </button>
    );

  const propuestas = sugerencias?.(texto) ?? [];
  // Salir del conjunto (campo y sugerencias) guarda; pasar del campo a una sugerencia, no.
  const alSalir = (e: FocusEvent<HTMLElement>) => {
    if (!contenedor.current?.contains(e.relatedTarget as Node | null)) terminar(texto, false);
  };
  return (
    <span ref={contenedor} className={clases('en-sitio-campo', className)}>
      <input
        ref={campo}
        type="text"
        aria-label={etiqueta}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={alSalir}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            terminar(texto, true);
          } else if (e.key === 'Escape') {
            // Esc es del campo: no cierra nada más ni llega a los atajos de la pantalla.
            e.preventDefault();
            e.stopPropagation();
            terminar(null, true);
          }
        }}
      />
      {propuestas.length > 0 && (
        <span className="row sugerencias-en-sitio">
          {propuestas.map((p) => (
            <Filtro
              key={p}
              // Pulsar una sugerencia no saca el foco del campo.
              onMouseDown={(e) => e.preventDefault()}
              onBlur={alSalir}
              onClick={() => {
                setTexto((t) => completarUltima(t, p));
                campo.current?.focus();
              }}
            >
              {p}
            </Filtro>
          ))}
        </span>
      )}
    </span>
  );
}
