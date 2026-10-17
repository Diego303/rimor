/**
 * Iconos de Rimor: los trazados de «Pantallas de Rimor» (ADR-0004), en retícula de 24 px con trazo 1,8,
 * extremos y uniones redondeados y `currentColor`, el mismo estilo que pide la guía (§6.1).
 */
import type { ReactElement } from 'react';

const TRAZOS = {
  inicio: <path d="M4 6h16v10H9l-5 4z" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  coleccion: (
    <>
      <path d="M12 4l8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
    </>
  ),
  investigacion: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M14 14l6 6M10 7.5v5M7.5 10h5" />
    </>
  ),
  documento: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h4" />
    </>
  ),
  documentos: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  metricas: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l4-5 3 3 5-6" />
    </>
  ),
  lienzo: (
    <>
      <rect x="3" y="4" width="7" height="6" rx="1.5" />
      <rect x="14" y="14" width="7" height="6" rx="1.5" />
      <path d="M10 7h4a3 3 0 0 1 3 3v4" />
    </>
  ),
  tiempo: <path d="M3 12h18M7 8v8M12 6v12M17 9v6" />,
  hilo: (
    <>
      <path d="M6 4v10a4 4 0 0 0 4 4h8" />
      <path d="M15 15l3 3-3 3" />
      <circle cx="6" cy="4" r="1.5" />
    </>
  ),
  enviar: <path d="M5 12h14M13 6l6 6-6 6" />,
  adjuntar: <path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14 7.6" />,
  responder: (
    <>
      <path d="M10 8L5 12l5 4" />
      <path d="M5 12h9a5 5 0 0 1 5 5v1" />
    </>
  ),
  archivar: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10h14V9M10 13h4" />
    </>
  ),
  log: <path d="M5 6h9M5 10h14M5 14h11M5 18h7" />,
  error: (
    <>
      <path d="M12 3.5l9 15.5H3z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
  mediciones: <path d="M4 20V11M10 20V5M16 20v-6M2 20h20" />,
  prompt: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M6 15V9l3 3 3-3v6M16 9v6M14 13l2 2 2-2" />
    </>
  ),
  enlace: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  idea: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />
    </>
  ),
  datos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M9 10v9M15 10v9" />
    </>
  ),
  codigo: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  comando: <path d="M5 8l4 4-4 4M11 16h8" />,
  json: (
    <path d="M9 4c-2 0-3 1-3 3v2c0 1-1 2-2 3 1 1 2 2 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1 1 2 2 3-1 1-2 2-2 3v2c0 2-1 3-3 3" />
  ),
  texto: <path d="M5 6h14M5 10h14M5 14h14M5 18h8" />,
  comparacion: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  http: (
    <>
      <path d="M4 7h16M4 12h10M4 17h7" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  // Añadidos con la misma retícula (las pantallas no los dibujan).
  imagen: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  pdf: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 14h6" />
    </>
  ),
  formula: <path d="M17 5H7l5 7-5 7h10" />,
  diagrama: (
    <>
      <rect x="3" y="3" width="7" height="6" rx="1.5" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" />
      <path d="M6.5 9v3h11v3" />
    </>
  ),
  calculo: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
    </>
  ),
  datosCopias: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  fijar: <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />,
  papelera: (
    <>
      <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  copiar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  descargar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  subir: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  mas: <path d="M12 5v14M5 12h14" />,
  hecho: <path d="M5 12.5l4.5 4.5L19 7.5" />,
} satisfies Record<string, ReactElement>;

export type NombreIcono = keyof typeof TRAZOS;

interface Props {
  nombre: NombreIcono;
  /** Lado en px: 16 en línea y botones, 17 en el raíl, 13 en chips (guía §6.1). */
  tamano?: number;
}

/** Icono decorativo: siempre acompaña a un texto, así que va oculto al lector de pantalla. */
export function Icono({ nombre, tamano = 16 }: Props) {
  return (
    <svg
      className="i"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
