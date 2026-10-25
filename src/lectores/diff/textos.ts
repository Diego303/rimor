/** Textos del lector Diff (LEC-09b). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Leyendo el parche',
    titulo: 'Parche',
    etiqueta: 'Diff o parche',
    tituloUno: 'Cambios en {ruta}',
    tituloVarios: 'Parche de {n} archivos',
    archivos: { one: '{n} archivo', other: '{n} archivos' },
    respuesta: {
      cambios: 'Parche de {archivos}: +{anadidas} −{quitadas}.',
      binario: 'Parche de {archivos}, binario.',
    },
    cifras: { archivos: 'Archivos', anadidas: 'Añadidas', quitadas: 'Quitadas' },
    estados: {
      modificado: 'modificado',
      nuevo: 'nuevo',
      borrado: 'borrado',
      renombrado: 'renombrado',
      binario: 'binario',
    },
    renombradoDe: 'antes {ruta}',
    antes: 'Antes',
    despues: 'Después',
    sinCambios: 'Sin líneas que enseñar.',
    verTodo: { one: 'Ver todo ({n} línea)', other: 'Ver todo ({n} líneas)' },
    masArchivos: { one: '{n} archivo más', other: '{n} archivos más' },
    asunto: 'Asunto',
  },
  {
    analizando: 'Reading the patch',
    titulo: 'Patch',
    etiqueta: 'Diff or patch',
    tituloUno: 'Changes in {ruta}',
    tituloVarios: 'Patch of {n} files',
    archivos: { one: '{n} file', other: '{n} files' },
    respuesta: {
      cambios: 'Patch of {archivos}: +{anadidas} −{quitadas}.',
      binario: 'Patch of {archivos}, binary.',
    },
    cifras: { archivos: 'Files', anadidas: 'Added', quitadas: 'Removed' },
    estados: {
      modificado: 'modified',
      nuevo: 'new',
      borrado: 'deleted',
      renombrado: 'renamed',
      binario: 'binary',
    },
    renombradoDe: 'was {ruta}',
    antes: 'Before',
    despues: 'After',
    sinCambios: 'No lines to show.',
    verTodo: { one: 'Show all ({n} line)', other: 'Show all ({n} lines)' },
    masArchivos: { one: '{n} more file', other: '{n} more files' },
    asunto: 'Subject',
  },
);
