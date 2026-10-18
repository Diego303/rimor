/**
 * Plantilla de lector (IN-012). Copia esta carpeta a `src/lectores/<nombre>/`, cambia `nombre` y `tipo`,
 * rellena cada función y regístralo en `registro.ts`. Ver README.md.
 *
 * Este ejemplo funciona: cuenta líneas y palabras de un texto.
 */
import type { Elemento } from '@rimor/formato';
import type { Borrador, Entrada, Lector } from '../contrato';
import { textos } from './textos';

/** Lo que `derivar` calcula. Tiene que poder copiarse con structured clone (nada de funciones ni clases). */
export interface DatosPlantilla {
  lineas: number;
  palabras: number;
  /** Las primeras líneas, para la tarjeta. */
  inicio: string[];
}

function contar(texto: string): DatosPlantilla {
  // Un salto de línea al final no abre otra línea.
  const sinFinal = texto.replace(/\r?\n$/, '');
  const lineas = sinFinal === '' ? [] : sinFinal.split(/\r?\n/);
  return {
    lineas: lineas.length,
    palabras: texto.split(/\s+/).filter(Boolean).length,
    inicio: lineas.slice(0, 3),
  };
}

export const lectorPlantilla: Lector<DatosPlantilla> = {
  nombre: 'plantilla',
  tipo: 'texto',
  version: 1,
  textos,

  // Barata y síncrona: una confianza entre 0 y 1. La plantilla nunca gana a nadie.
  detectar(e: Entrada): number {
    return e.texto ? 0.1 : 0;
  },

  // Lo justo para guardar al instante: título y original. Lo caro va en `derivar`.
  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const primera = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
    return { titulo: primera.trim().slice(0, 80), original: texto, resumen: { lineas: contar(texto).lineas } };
  },

  // Se ejecuta en el Worker de derivados; si sube `version`, se recalcula para todos los elementos.
  async derivar(el: Elemento): Promise<DatosPlantilla> {
    return contar(el.original ?? '');
  },

  // Lo pequeño que va al frontmatter (`lector.resumen`).
  resumen: (d) => ({ lineas: d.lineas, palabras: d.palabras }),

  resumenLegible: (r, idioma) =>
    typeof r.lineas === 'number' ? textos.t(idioma, 'resumen', { n: r.lineas }) : textos.t(idioma, 'vacio'),

  // La frase de Rimor en Inicio: una o dos frases, sin «!», con las cifras marcadas.
  respuesta: (_el, d, ctx) => ({
    texto: [
      {
        t: 'texto',
        v: textos.t(ctx.idioma, 'respuesta', {
          lineas: textos.t(ctx.idioma, 'resumen', { n: d.lineas }),
          palabras: textos.t(ctx.idioma, 'palabras', { n: d.palabras }),
        }),
      },
    ],
  }),

  cifras: {
    lineas: (d) => ({ texto: String(d.lineas), valor: d.lineas }),
    palabras: (d) => ({ texto: String(d.palabras), valor: d.palabras }),
  },

  textoIndexable: (d) => d.inicio.join('\n'),
};
