/** Textos del lector Texto (LEC-01). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Buscando enlaces y menciones',
    lineas: { one: '{n} línea', other: '{n} líneas' },
    enlaces: { one: '{n} enlace', other: '{n} enlaces' },
    guardado: 'Texto guardado.',
    coleccion: '¿Lo añado a la colección {nombre}?',
    siColeccion: 'Sí, a {nombre}',
    no: 'No',
    menciona: 'Menciona ',
    y: ' y ',
    yMas: ' y {n} más',
    grande: 'Texto de {tam}, guardado aparte por su tamaño. Aquí se ven sus primeros {muestra}.',
    descargar: 'Descargar el texto completo',
    tituloEnlaces: 'Enlaces',
    tituloMenciones: 'Menciones',
  },
  {
    analizando: 'Looking for links and mentions',
    lineas: { one: '{n} line', other: '{n} lines' },
    enlaces: { one: '{n} link', other: '{n} links' },
    guardado: 'Text saved.',
    coleccion: 'Shall I add it to the {nombre} collection?',
    siColeccion: 'Yes, to {nombre}',
    no: 'No',
    menciona: 'It mentions ',
    y: ' and ',
    yMas: ' and {n} more',
    grande: '{tam} text, stored apart because of its size. Here are its first {muestra}.',
    descargar: 'Download the full text',
    tituloEnlaces: 'Links',
    tituloMenciones: 'Mentions',
  },
);
