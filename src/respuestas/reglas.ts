/**
 * Reglas de estilo de las respuestas de Rimor (guía §9.1, IN-016): como mucho dos frases, sin exclamaciones ni
 * emojis, y como mucho dos acciones. Se comprueban en las pruebas sobre todo lo que generan los lectores.
 */
import type { Fragmento, Respuesta } from './tipos';

/** El texto que se lee de un fragmento. */
export function textoDe(f: Fragmento): string {
  switch (f.t) {
    case 'ref':
      return f.ref;
    case 'cita':
      return `«${f.v}»`;
    default:
      return f.v;
  }
}

/** Frases: cada «.», «?» o «…» seguido de espacio o del final (los números «1.042» o «38,5» no cortan). */
export function contarFrases(texto: string): number {
  const t = texto.trim();
  if (!t) return 0;
  const cortes = t.match(/[.?…]+(?=\s|$)/g)?.length ?? 0;
  // Un texto sin punto final también es una frase.
  return /[.?…]$/.test(t) ? cortes : cortes + 1;
}

/** Abreviaturas que no cierran frase. */
const ABREVIATURAS = /\b(?:p\.\s?ej|e\.\s?g|i\.\s?e|etc|aprox|núm|pág)\./gi;
/** Emojis de verdad (con presentación de emoji, banderas o selector de emoji), no «©» ni «™». */
const EMOJI = /\p{Emoji_Presentation}|\p{Regional_Indicator}|\uFE0F/u;

/**
 * Faltas de estilo de lo que dice el lector. Las citas, los fragmentos `mono` y las refs son contenido del
 * usuario (una nota, un nombre de variable): no cuentan para frases, exclamaciones ni emojis.
 */
export function comprobarEstilo(r: Respuesta): string[] {
  const faltas: string[] = [];
  const texto = r.texto
    .map((f) => (f.t === 'texto' || f.t === 'fuerte' || f.t === 'cifra' ? f.v : f.t === 'ref' ? 'REF' : '«…»'))
    .join('')
    .replace(ABREVIATURAS, 'abrev');
  if (r.texto.some((f) => !textoDe(f).trim() && f.t !== 'texto')) faltas.push('fragmento vacío');
  if (!r.texto.map(textoDe).join('').trim()) faltas.push('sin texto');
  if (contarFrases(texto) > 2) faltas.push(`más de 2 frases: «${texto}»`);
  if (/[!¡]/.test(texto)) faltas.push(`exclamación: «${texto}»`);
  if (EMOJI.test(texto)) faltas.push(`emoji: «${texto}»`);
  if ((r.acciones?.filter(Boolean).length ?? 0) > 2) faltas.push('más de 2 acciones');
  return faltas;
}
