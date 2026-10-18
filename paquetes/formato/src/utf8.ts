/** Codificación UTF-8 sin depender de TextEncoder (que no está en `lib: ES2023`). */
export function utf8(texto: string): Uint8Array {
  const salida: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) ?? 0;
    if (c < 0x80) salida.push(c);
    else if (c < 0x800) salida.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) salida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else salida.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(salida);
}

/** Número de bytes que ocupa un texto en UTF-8, sin codificarlo. */
export function bytesUtf8(texto: string): number {
  let n = 0;
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}
