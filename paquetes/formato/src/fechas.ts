/** Fechas ISO 8601 con la zona del usuario, como las escribe Rimor en el frontmatter (plan §13.4). */

const dos = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');

/** `2026-10-18T15:40:12+02:00`: fecha local con su desfase, sin milisegundos. */
export function isoConZona(fecha: Date): string {
  const desfase = -fecha.getTimezoneOffset();
  const signo = desfase >= 0 ? '+' : '-';
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}` +
    `${signo}${dos(desfase / 60)}:${dos(desfase % 60)}`
  );
}
