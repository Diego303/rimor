/** Textos de la plantilla: cada lector trae los suyos en español (base) e inglés. `analizando` es obligatorio. */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Contando líneas y palabras',
    resumen: { one: '{n} línea', other: '{n} líneas' },
    palabras: { one: '{n} palabra', other: '{n} palabras' },
    respuesta: 'Texto de {lineas} y {palabras}.',
    vacio: 'Sin texto',
    etiquetas: { lineas: { one: 'línea', other: 'líneas' }, palabras: { one: 'palabra', other: 'palabras' } },
  },
  {
    analizando: 'Counting lines and words',
    resumen: { one: '{n} line', other: '{n} lines' },
    palabras: { one: '{n} word', other: '{n} words' },
    respuesta: 'Text with {lineas} and {palabras}.',
    vacio: 'No text',
    etiquetas: { lineas: { one: 'line', other: 'lines' }, palabras: { one: 'word', other: 'words' } },
  },
);
