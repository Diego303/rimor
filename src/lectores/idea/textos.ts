/** Textos del lector Idea (LEC-02) y de su resurgimiento (ORG-13 mínimo). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Guardando la idea',
    guardada: 'Idea guardada. Volverá dentro de 7 días si no haces nada con ella.',
    palabras: { one: '{n} palabra', other: '{n} palabras' },
    estados: {
      semilla: 'Semilla',
      explorando: 'Explorando',
      aparcada: 'Aparcada',
      descartada: 'Descartada',
      convertida: 'Convertida',
    },
    estado: 'Estado de la idea',
    vuelve: { one: 'Hace {n} día guardaste una idea: ', other: 'Hace {n} días guardaste una idea: ' },
    sigue: '. ¿Sigue en pie?',
    masAdelante: 'Más adelante',
    descartar: 'Descartar',
    pospuesta: 'Volverá dentro de 30 días',
    descartadaAviso: 'Idea descartada',
    noGuardado: 'No se pudo guardar el cambio.',
  },
  {
    analizando: 'Saving the idea',
    guardada: 'Idea saved. It will come back in 7 days if you do nothing with it.',
    palabras: { one: '{n} word', other: '{n} words' },
    estados: {
      semilla: 'Seed',
      explorando: 'Exploring',
      aparcada: 'Parked',
      descartada: 'Discarded',
      convertida: 'Converted',
    },
    estado: 'Idea status',
    vuelve: { one: '{n} day ago you saved an idea: ', other: '{n} days ago you saved an idea: ' },
    sigue: '. Is it still on?',
    masAdelante: 'Later',
    descartar: 'Discard',
    pospuesta: 'It will come back in 30 days',
    descartadaAviso: 'Idea discarded',
    noGuardado: 'The change could not be saved.',
  },
);
