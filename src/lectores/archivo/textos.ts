/** Textos del lector genérico de archivo (LEC-01). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Leyendo los datos del archivo',
    guardado: 'Archivo de {tam} guardado. Rimor aún no sabe leer este tipo.',
    sinTipo: 'tipo desconocido',
    nombre: 'Nombre',
    tamano: 'Tamaño',
    tipo: 'Tipo',
    descargar: 'Descargar el original',
    noDisponible: 'El original no está en el espacio.',
  },
  {
    analizando: 'Reading the file details',
    guardado: '{tam} file saved. Rimor cannot read this type yet.',
    sinTipo: 'unknown type',
    nombre: 'Name',
    tamano: 'Size',
    tipo: 'Type',
    descargar: 'Download the original',
    noDisponible: 'The original is not in the workspace.',
  },
);
