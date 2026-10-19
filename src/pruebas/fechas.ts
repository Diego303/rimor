/**
 * Fechas para las pruebas: «hace un rato, hoy». Justo pasada la medianoche, «hace 30 minutos» sería ayer y las
 * pruebas que esperan «Hoy» fallarían según la hora: el instante de referencia nunca es anterior a las 02:00 de hoy
 * (de madrugada queda algo en el futuro, sin salir de hoy). Solo para pruebas.
 */
export function haceMinutos(minutos: number): Date {
  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);
  const referencia = Math.max(Date.now(), inicioDelDia.getTime() + 2 * 60 * 60_000);
  return new Date(referencia - minutos * 60_000);
}
