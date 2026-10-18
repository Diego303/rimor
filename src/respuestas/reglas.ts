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

export function comprobarEstilo(r: Respuesta): string[] {
  const faltas: string[] = [];
  const texto = r.texto.map(textoDe).join('');
  if (r.texto.some((f) => !textoDe(f).trim() && f.t !== 'texto')) faltas.push('fragmento vacío');
  if (!texto.trim()) faltas.push('sin texto');
  if (contarFrases(texto) > 2) faltas.push(`más de 2 frases: «${texto}»`);
  if (/[!¡]/.test(texto)) faltas.push(`exclamación: «${texto}»`);
  if (/\p{Extended_Pictographic}/u.test(texto)) faltas.push(`emoji: «${texto}»`);
  if ((r.acciones?.filter(Boolean).length ?? 0) > 2) faltas.push('más de 2 acciones');
  return faltas;
}
