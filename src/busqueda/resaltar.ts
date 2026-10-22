/**
 * Lo que casa de un texto, para resaltarlo (`mark`): las palabras de la búsqueda se comparan sin acentos ni
 * mayúsculas, pero se marca el texto tal cual («Canción» casa con «cancion»). TS puro.
 */
import { normalizarBusqueda } from './contrato';

export interface Trozo {
  texto: string;
  marca: boolean;
}

/** Los trozos del texto, marcados los que casan con algún término (de 2 letras o más). */
export function resaltar(texto: string, terminos: readonly string[]): Trozo[] {
  const buscados = [...new Set(terminos.map(normalizarBusqueda).filter((t) => t.length >= 2))];
  if (!texto || !buscados.length) return texto ? [{ texto, marca: false }] : [];
  // El texto normalizado y, para cada una de sus letras, dónde empieza y acaba en el original.
  let normal = '';
  const inicio: number[] = [];
  const fin: number[] = [];
  let i = 0;
  for (const c of texto) {
    const n = normalizarBusqueda(c);
    for (let k = 0; k < n.length; k++) {
      inicio.push(i);
      fin.push(i + c.length);
    }
    normal += n;
    i += c.length;
  }
  const marcado = new Array<boolean>(texto.length).fill(false);
  for (const t of buscados)
    for (let desde = normal.indexOf(t); desde >= 0; desde = normal.indexOf(t, desde + 1)) {
      const a = inicio[desde] ?? 0;
      const b = fin[desde + t.length - 1] ?? texto.length;
      marcado.fill(true, a, b);
    }
  const trozos: Trozo[] = [];
  for (let j = 0; j < texto.length; j++) {
    const ultimo = trozos.at(-1);
    if (ultimo && ultimo.marca === marcado[j]) ultimo.texto += texto[j];
    else trozos.push({ texto: texto[j] ?? '', marca: marcado[j] ?? false });
  }
  return trozos;
}
