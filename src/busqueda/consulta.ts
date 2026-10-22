/**
 * La consulta de búsqueda (BUS-02, Anexo G del plan): texto (todas las palabras), frases exactas entre comillas y
 * filtros `tipo:`, `en:`, `#etiqueta`, `desde:`/`hasta:` (fechas, `hoy`, `ayer`, `semana`), `estado:`, `nivel:`,
 * `huella:`, `dominio:` y `-excluir`. Sin acentos ni mayúsculas. Los filtros se comprueban sobre el frontmatter
 * (lo que el repositorio tiene en memoria), sin abrir archivos. TS puro.
 */
import { type FrontmatterComun, TIPOS_ELEMENTO, type TipoElemento } from '@rimor/formato';
import { ALIAS_TIPO } from '../captura/indicaciones';
import { estadoVisible } from '../espacio/estados';
import { IDIOMAS, traducir } from '../i18n/i18n';
import { normalizarBusqueda } from './contrato';

export { normalizarBusqueda };

export type Nivel = 'error' | 'warn';

export interface Consulta {
  /** Palabras que deben estar todas (en el título, el contenido, las notas, las etiquetas o la ref). */
  palabras: string[];
  /** Frases que deben estar tal cual. */
  frases: string[];
  /** Palabras o frases que no deben estar. */
  excluir: string[];
  tipos: TipoElemento[];
  /** Colecciones o investigaciones (`en:`). */
  en: string[];
  etiquetas: string[];
  /** Desde el principio de ese día (ms). */
  desde?: number;
  /** Hasta el final de ese día (ms). */
  hasta?: number;
  estados: string[];
  niveles: Nivel[];
  huellas: string[];
  dominios: string[];
  /** Algún filtro no puede cumplirse (`tipo:` que no existe, `nivel:` desconocido): no hay resultados. */
  imposible: boolean;
}

/** Hay algo que buscar (texto o algún filtro). */
export const hayConsulta = (c: Consulta): boolean =>
  c.imposible ||
  [c.palabras, c.frases, c.excluir, c.tipos, c.en, c.etiquetas, c.estados, c.niveles, c.huellas, c.dominios].some(
    (l) => l.length,
  ) ||
  c.desde !== undefined ||
  c.hasta !== undefined;

const PLURALES: Readonly<Record<string, TipoElemento>> = {
  textos: 'texto',
  ideas: 'idea',
  enlaces: 'enlace',
  logs: 'log',
  errores: 'error',
  prompts: 'prompt',
  documento: 'markdown',
  documentos: 'markdown',
  codigos: 'codigo',
  comandos: 'comando',
  imagenes: 'imagen',
  pdfs: 'pdf',
  formulas: 'formula',
  diagramas: 'diagrama',
  calculos: 'calculo',
  archivos: 'archivo',
};

/** Todos los nombres de cada tipo: el suyo, los alias del compositor, plurales y sus nombres en cada idioma. */
const NOMBRES_TIPO: ReadonlyMap<string, TipoElemento> = (() => {
  const m = new Map<string, TipoElemento>();
  for (const tipo of TIPOS_ELEMENTO) {
    m.set(tipo, tipo);
    for (const idioma of IDIOMAS)
      m.set(normalizarBusqueda(traducir(idioma, `tipos.${tipo}`)).replace(/\s+/g, ''), tipo);
  }
  for (const [alias, tipo] of Object.entries({ ...ALIAS_TIPO, ...PLURALES })) m.set(alias, tipo);
  return m;
})();

const NIVELES: Readonly<Record<string, Nivel>> = {
  error: 'error',
  errores: 'error',
  errors: 'error',
  warn: 'warn',
  warning: 'warn',
  warnings: 'warn',
  aviso: 'warn',
  avisos: 'warn',
};

const DIA = 86_400_000;
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Una fecha de la consulta: `AAAA-MM-DD`, `hoy`, `ayer` o `semana` (hace 7 días); `null` si no lo es. */
function fecha(valor: string, ahora: Date): number | null {
  if (valor === 'hoy' || valor === 'today') return inicioDelDia(ahora);
  if (valor === 'ayer' || valor === 'yesterday') return inicioDelDia(ahora) - DIA;
  if (valor === 'semana' || valor === 'week') return inicioDelDia(ahora) - 7 * DIA;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d.getTime() : null;
}

/** Quita las comillas de una frase. */
const sinComillas = (s: string) => s.replace(/^"|"$/g, '').trim();

export function analizarConsulta(texto: string, { ahora = new Date() }: { ahora?: Date } = {}): Consulta {
  const c: Consulta = {
    palabras: [],
    frases: [],
    excluir: [],
    tipos: [],
    en: [],
    etiquetas: [],
    estados: [],
    niveles: [],
    huellas: [],
    dominios: [],
    imposible: false,
  };
  const palabraOFrase = (t: string, destino: 'incluir' | 'excluir') => {
    const limpio = sinComillas(t);
    if (!limpio) return;
    if (destino === 'excluir') c.excluir.push(limpio);
    else if (/\s/.test(limpio)) c.frases.push(limpio);
    else c.palabras.push(limpio);
  };
  for (const token of normalizarBusqueda(texto).match(/-?"[^"]*"?|\S+/g) ?? []) {
    if (token.startsWith('-') && token.length > 1) {
      palabraOFrase(token.slice(1), 'excluir');
      continue;
    }
    if (token.startsWith('"')) {
      palabraOFrase(token, 'incluir');
      continue;
    }
    if (token.startsWith('#') && token.length > 1) {
      c.etiquetas.push(token.slice(1));
      continue;
    }
    const m = /^([a-z]+):(.+)$/.exec(token);
    if (!m) {
      c.palabras.push(token);
      continue;
    }
    const [, clave = '', valor = ''] = m;
    const valores = valor.split(',').filter(Boolean);
    switch (clave) {
      case 'tipo':
      case 'type':
        for (const v of valores) {
          const tipo = NOMBRES_TIPO.get(v);
          if (tipo) c.tipos.push(tipo);
          else c.imposible = true;
        }
        break;
      case 'en':
      case 'in':
        c.en.push(...valores.map((v) => v.replace(/^@/, '')));
        break;
      case 'desde':
      case 'since':
      case 'hasta':
      case 'until': {
        const f = fecha(valor, ahora);
        if (f === null) c.palabras.push(token);
        else if (clave === 'desde' || clave === 'since') c.desde = f;
        // `hasta:` incluye ese día entero.
        else c.hasta = (valor === 'semana' || valor === 'week' ? inicioDelDia(ahora) : f) + DIA - 1;
        break;
      }
      case 'estado':
      case 'status':
        c.estados.push(...valores);
        break;
      case 'nivel':
      case 'level':
        for (const v of valores) {
          const nivel = NIVELES[v];
          if (nivel) c.niveles.push(nivel);
          else c.imposible = true;
        }
        break;
      case 'huella':
      case 'fingerprint':
        c.huellas.push(...valores);
        break;
      case 'dominio':
      case 'domain':
        c.dominios.push(...valores.map((v) => v.replace(/^www\./, '')));
        break;
      default:
        // Un filtro que no existe es una palabra («C:» o «hora:minuto» también).
        c.palabras.push(token);
    }
  }
  c.tipos = [...new Set(c.tipos)];
  c.niveles = [...new Set(c.niveles)];
  return c;
}

/** Lo que los filtros necesitan saber del lector de un elemento (sus estados propios). */
export type EstadosDe = (fm: FrontmatterComun) => { estados?: readonly string[] } | null | undefined;

const sinGuiones = (s: string) => normalizarBusqueda(s).replace(/[-\s]+/g, '');

/** El dominio de un enlace (su URL limpia, en sus metadatos o en su resumen). */
function dominioDe(fm: FrontmatterComun): string | null {
  const url = (fm as { url?: unknown }).url ?? fm.lector.resumen.url;
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLocaleLowerCase();
  } catch {
    return null;
  }
}

/** ¿Cumple el elemento los filtros de la consulta? (El texto se mira aparte, en el índice.) */
export function coincideFiltros(fm: FrontmatterComun, c: Consulta, estadosDe?: EstadosDe): boolean {
  if (c.imposible) return false;
  if (c.tipos.length && !c.tipos.includes(fm.tipo)) return false;
  if (c.en.length) {
    const grupos = [...(fm.colecciones ?? []), ...(fm.investigaciones ?? [])].map(normalizarBusqueda);
    if (!c.en.some((e) => grupos.includes(e))) return false;
  }
  if (c.etiquetas.length) {
    const propias = (fm.etiquetas ?? []).map(normalizarBusqueda);
    if (!c.etiquetas.every((e) => propias.includes(e))) return false;
  }
  if (c.desde !== undefined || c.hasta !== undefined) {
    const creado = Date.parse(fm.creado);
    if (!Number.isFinite(creado)) return false;
    if (c.desde !== undefined && creado < c.desde) return false;
    if (c.hasta !== undefined && creado > c.hasta) return false;
  }
  if (c.estados.length) {
    const visible = sinGuiones(estadoVisible(fm.estado, estadosDe?.(fm)));
    if (!c.estados.some((e) => sinGuiones(e) === visible)) return false;
  }
  if (c.niveles.length) {
    if (fm.tipo !== 'log') return false;
    const r = fm.lector.resumen;
    const tiene = (n: Nivel) => Number(n === 'error' ? r.errores : r.avisos) > 0;
    if (!c.niveles.some(tiene)) return false;
  }
  if (c.huellas.length) {
    const huella = fm.lector.resumen.huella;
    if (fm.tipo !== 'error' || typeof huella !== 'string') return false;
    if (!c.huellas.some((h) => normalizarBusqueda(huella).startsWith(h))) return false;
  }
  if (c.dominios.length) {
    const dominio = dominioDe(fm);
    if (!dominio || !c.dominios.some((d) => dominio === d || dominio.endsWith(`.${d}`))) return false;
  }
  return true;
}
