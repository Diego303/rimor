/** Textos del lector Código (LEC-09). */
import { definirTextos } from '../textos';

export const textos = definirTextos(
  {
    analizando: 'Reconociendo el lenguaje',
    titulo: 'Código',
    lenguajes: {
      typescript: 'TypeScript',
      javascript: 'JavaScript',
      python: 'Python',
      java: 'Java',
      csharp: 'C#',
      cpp: 'C/C++',
      go: 'Go',
      rust: 'Rust',
      php: 'PHP',
      ruby: 'Ruby',
      shell: 'Shell',
      sql: 'SQL',
    },
    lineas: { one: '{n} línea', other: '{n} líneas' },
    respuesta: {
      conLenguaje: 'Código {lenguaje}, {lineas}.',
      sinLenguaje: 'Código de {lineas}.',
    },
    lenguaje: 'Lenguaje',
    sinLenguaje: 'Sin reconocer',
    comoSeSupo: {
      extension: 'por la extensión del archivo',
      sintaxis: 'por su sintaxis',
      ninguno: '',
    },
    sinResaltado: 'Sin resaltado de sintaxis para este lenguaje.',
    codigo: 'Código',
    etiquetaLineas: 'Líneas',
    caracteres: 'Caracteres',
    definiciones: 'Definiciones',
    ninguna: 'Ninguna',
  },
  {
    analizando: 'Recognising the language',
    titulo: 'Code',
    lineas: { one: '{n} line', other: '{n} lines' },
    respuesta: {
      conLenguaje: '{lenguaje} code, {lineas}.',
      sinLenguaje: 'Code of {lineas}.',
    },
    lenguaje: 'Language',
    sinLenguaje: 'Not recognised',
    comoSeSupo: {
      extension: 'by the file extension',
      sintaxis: 'by its syntax',
      ninguno: '',
    },
    sinResaltado: 'No syntax highlighting for this language.',
    codigo: 'Code',
    etiquetaLineas: 'Lines',
    caracteres: 'Characters',
    definiciones: 'Definitions',
    ninguna: 'None',
  },
);
