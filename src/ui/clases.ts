/** Une nombres de clase, descartando los vacíos. */
export function clases(...nombres: (string | false | null | undefined)[]): string {
  return nombres.filter(Boolean).join(' ');
}
