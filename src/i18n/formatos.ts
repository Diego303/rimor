/**
 * Formateadores de números, cifras, p-valores, duraciones, tamaños y fechas (rimor-diseno.md §4.3).
 * TS puro: reciben el idioma y, en las fechas, la zona horaria, para que se puedan probar sin entorno.
 */

export type Idioma = 'es' | 'en';

const LOCALE: Record<Idioma, string> = { es: 'es-ES', en: 'en-GB' };
/** Espacio de no separación: entre la cifra y su unidad o `%`. */
export const NBSP = ' ';
/** Signo menos tipográfico. */
export const MENOS = '−';
const NO_FINITO = '—';

const MESES: Record<Idioma, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const RELATIVOS: Record<Idioma, { hoy: string; ayer: string }> = {
  es: { hoy: 'hoy', ayer: 'ayer' },
  en: { hoy: 'today', ayer: 'yesterday' },
};

const cacheNumeros = new Map<string, Intl.NumberFormat>();
function formateador(idioma: Idioma, min: number, max: number): Intl.NumberFormat {
  const clave = `${idioma}:${min}:${max}`;
  let f = cacheNumeros.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[idioma], {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      // En español, los miles se separan a partir de 10.000 (2400, 10.000), como hace es-ES.
      useGrouping: idioma === 'es' ? 'min2' : 'auto',
    });
    cacheNumeros.set(clave, f);
  }
  return f;
}

/**
 * Número con el separador del idioma y el menos tipográfico.
 * Sin `decimales`, deja hasta 2 y quita los ceros finales; con ellos, fija exactamente esos.
 */
export function fmtNumero(n: number, idioma: Idioma, decimales?: number): string {
  if (!Number.isFinite(n)) return NO_FINITO;
  const f = decimales === undefined ? formateador(idioma, 0, 2) : formateador(idioma, decimales, decimales);
  const texto = f.format(n);
  // «−0» no existe en pantalla: si redondea a cero, sin signo.
  if (/^-0(?:[.,]0+)?$/.test(texto)) return texto.slice(1);
  return texto.replace('-', MENOS);
}

/** Cifra con su unidad tras un espacio de no separación: `fmtCifra(-4.515, 1, '%')` → `−4,5 %`. */
export function fmtCifra(n: number, decimales: number, unidad: string | undefined, idioma: Idioma): string {
  const v = fmtNumero(n, idioma, decimales);
  return unidad && v !== NO_FINITO ? `${v}${NBSP}${unidad}` : v;
}

/** p-valor: `p < 0,001` o `p = 0,031`, con tres decimales. */
export function fmtP(p: number, idioma: Idioma): string {
  if (!Number.isFinite(p)) return NO_FINITO;
  if (p < 0.001) return `p${NBSP}<${NBSP}${fmtNumero(0.001, idioma, 3)}`;
  return `p${NBSP}=${NBSP}${fmtNumero(Math.min(p, 1), idioma, 3)}`;
}

const DIA = 86_400_000;

/** Redondea a `decimales`. */
const redondear = (x: number, decimales: number) => Math.round(x * 10 ** decimales) / 10 ** decimales;

/**
 * Duración legible: `850 ms`, `1,6 s`, `12 min`, `3,5 h`, `1,6 días`.
 * La unidad se elige con el valor ya redondeado, así que 999,6 ms es `1 s` y no `1000 ms`.
 */
export function fmtDuracion(ms: number, idioma: Idioma): string {
  if (!Number.isFinite(ms)) return NO_FINITO;
  const a = Math.abs(ms);
  const escalas: [number, number, string][] = [
    [1, 0, 'ms'],
    [1000, 1, 's'],
    [60_000, 0, 'min'],
    [3_600_000, 1, 'h'],
  ];
  const limites = [1000, 60, 60, 24];
  let valor = redondear(a / DIA, 1);
  let unidad = '';
  for (const [i, [divisor, dec, u]] of escalas.entries()) {
    const r = redondear(a / divisor, dec);
    if (r < (limites[i] ?? Number.POSITIVE_INFINITY)) {
      valor = r;
      unidad = u;
      break;
    }
  }
  if (!unidad) unidad = idioma === 'es' ? (valor === 1 ? 'día' : 'días') : valor === 1 ? 'day' : 'days';
  // Sin «−0»: el signo solo si lo redondeado no es cero.
  const signo = ms < 0 && valor !== 0 ? -1 : 1;
  return `${fmtNumero(signo * valor, idioma)}${NBSP}${unidad}`;
}

/** Tamaño de archivo en unidades de 1024: `512 B`, `2,4 KB`, `2,4 MB` (la unidad, con el valor redondeado). */
export function fmtBytes(b: number, idioma: Idioma): string {
  if (!Number.isFinite(b) || b < 0) return NO_FINITO;
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b;
  let i = 0;
  while (redondear(v, i === 0 ? 0 : 1) >= 1024 && i < unidades.length - 1) {
    v /= 1024;
    i++;
  }
  return `${fmtNumero(redondear(v, i === 0 ? 0 : 1), idioma)}${NBSP}${unidades[i]}`;
}

interface Partes {
  anio: number;
  mes: number; // 1–12
  dia: number;
  hora: string; // «17:49»
}

const cacheFechas = new Map<string, Intl.DateTimeFormat>();
function partes(fecha: Date, zona: string | undefined): Partes {
  const clave = zona ?? '';
  let f = cacheFechas.get(clave);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zona,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    cacheFechas.set(clave, f);
  }
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return { anio: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora: `${p.hour}:${p.minute}` };
}

const valida = (d: Date) => Number.isFinite(d.getTime());

/** Hora `17:49` en la zona indicada (por defecto, la del sistema). */
export function fmtHora(fecha: Date, zona?: string): string {
  return valida(fecha) ? partes(fecha, zona).hora : NO_FINITO;
}

function diaMes(p: Partes, idioma: Idioma, conAnio: boolean): string {
  const mes = MESES[idioma][p.mes - 1];
  if (idioma === 'es') return conAnio ? `${p.dia} ${mes} ${p.anio}` : `${p.dia} ${mes}`;
  return conAnio ? `${mes} ${p.dia}, ${p.anio}` : `${mes} ${p.dia}`;
}

/** Número de día civil (para comparar «hoy» y «ayer» en una zona horaria). */
const numeroDia = (p: Partes) => Date.UTC(p.anio, p.mes - 1, p.dia) / DIA;

/** Fecha relativa: «hoy, 17:49», «ayer, 18:21», «2 oct» o, de otro año, «2 oct 2025». */
export function fmtFechaRelativa(fecha: Date, ahora: Date, idioma: Idioma, zona?: string): string {
  if (!valida(fecha) || !valida(ahora)) return NO_FINITO;
  const p = partes(fecha, zona);
  const hoy = partes(ahora, zona);
  const diferencia = numeroDia(hoy) - numeroDia(p);
  if (diferencia === 0) return `${RELATIVOS[idioma].hoy}, ${p.hora}`;
  if (diferencia === 1) return `${RELATIVOS[idioma].ayer}, ${p.hora}`;
  return diaMes(p, idioma, p.anio !== hoy.anio);
}

/** Cuántos días civiles van de `fecha` a `ahora` en la zona indicada: 0 es hoy, 1 ayer; `NaN` si no son fechas. */
export function diasDesde(fecha: Date, ahora: Date, zona?: string): number {
  if (!valida(fecha) || !valida(ahora)) return Number.NaN;
  return numeroDia(partes(ahora, zona)) - numeroDia(partes(fecha, zona));
}

/** Día y mes, con año si no es el actual: «2 oct» (para separadores del feed). */
export function fmtDia(fecha: Date, ahora: Date, idioma: Idioma, zona?: string): string {
  if (!valida(fecha) || !valida(ahora)) return NO_FINITO;
  const p = partes(fecha, zona);
  return diaMes(p, idioma, p.anio !== partes(ahora, zona).anio);
}

/** El día de una fila de lista (`fdia` de la referencia): «hoy», «ayer» o «2 oct». */
export function fmtDiaRelativo(fecha: Date, ahora: Date, idioma: Idioma, zona?: string): string {
  const dias = diasDesde(fecha, ahora, zona);
  if (dias === 0) return RELATIVOS[idioma].hoy;
  if (dias === 1) return RELATIVOS[idioma].ayer;
  return fmtDia(fecha, ahora, idioma, zona);
}

/** Fecha completa para Detalles y documentos: «17 oct 2026, 17:49». */
export function fmtFecha(fecha: Date, idioma: Idioma, zona?: string): string {
  if (!valida(fecha)) return NO_FINITO;
  const p = partes(fecha, zona);
  return `${diaMes(p, idioma, true)}, ${p.hora}`;
}

const SUFIJOS_EN: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const reglasOrdinales = new Intl.PluralRules('en', { type: 'ordinal' });

/** Ordinal: `3.ª` (femenino, por defecto) o `3.º` en español; `3rd` en inglés. */
export function fmtOrdinal(n: number, idioma: Idioma, genero: 'f' | 'm' = 'f'): string {
  if (!Number.isFinite(n)) return NO_FINITO;
  const entero = Math.trunc(n);
  if (idioma === 'es') return `${fmtNumero(entero, idioma, 0)}.${genero === 'f' ? 'ª' : 'º'}`;
  return `${fmtNumero(entero, idioma, 0)}${SUFIJOS_EN[reglasOrdinales.select(entero)] ?? 'th'}`;
}
