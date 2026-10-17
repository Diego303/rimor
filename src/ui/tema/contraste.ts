/** Contraste WCAG 2.x entre dos colores hexadecimales (rimor-diseno.md §13.1). TS puro. */

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de `#rrggbb`. */
export function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Color no válido: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => canal(Number.parseInt(x ?? '0', 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Relación de contraste (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
}
