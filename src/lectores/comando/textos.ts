/** Textos del lector Comando (LEC-10). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Leyendo el comando',
    titulo: 'Comando',
    huecos: { one: '{n} hueco', other: '{n} huecos' },
    respuesta: {
      unHueco: 'Comando con un hueco: ',
      varios: 'Comando con {n} huecos: ',
      y: ' y ',
      fin: '.',
      sinHuecos: 'Comando de {programa}.',
      sinPrograma: 'Comando guardado.',
    },
    copiarConValores: 'Copiar con valores',
    copiar: 'Copiar',
    copiado: 'Copiado',
    noCopiado: 'El navegador no deja copiar: selecciónalo y cópialo con Ctrl+C.',
    textoListo: 'Comando con los valores',
    chuleta: 'Comando',
    programa: 'Programa',
    comandos: { one: '{n} comando', other: '{n} comandos' },
  },
  {
    analizando: 'Reading the command',
    titulo: 'Command',
    huecos: { one: '{n} blank', other: '{n} blanks' },
    respuesta: {
      unHueco: 'Command with one blank: ',
      varios: 'Command with {n} blanks: ',
      y: ' and ',
      fin: '.',
      sinHuecos: '{programa} command.',
      sinPrograma: 'Command saved.',
    },
    copiarConValores: 'Copy with values',
    copiar: 'Copy',
    copiado: 'Copied',
    noCopiado: 'The browser does not allow copying: select it and copy it with Ctrl+C.',
    textoListo: 'Command with the values',
    chuleta: 'Command',
    programa: 'Program',
    comandos: { one: '{n} command', other: '{n} commands' },
  },
);
