/**
 * La respuesta de Rimor con la ficha de un enlace (IN-041): «Repositorio activo: último lanzamiento hace 12 días,
 * licencia MIT.», «serde 1.0.210, publicado hace 3 días, licencia MIT; sin vulnerabilidades conocidas.», «Paper de
 * 2023 en Nature: «…».». TS puro.
 */
import { diasDesde, fmtDia, type Idioma } from '../../../i18n/formatos';
import type { DatosEnlace } from '../lector';
import { textos } from '../textos';
import type { Ficha } from './contrato';

/** Un repositorio sin push en este tiempo se dice «sin actividad». */
export const DIAS_ACTIVO = 90;

/** «hoy», «ayer», «hace 12 días»; `undefined` si no es una fecha. */
export function hace(iso: string | undefined, ahora: Date, idioma: Idioma): string | undefined {
  if (!iso) return undefined;
  const dias = diasDesde(new Date(iso), ahora);
  if (!Number.isFinite(dias)) return undefined;
  if (dias <= 0) return textos.t(idioma, 'cuando.hoy');
  if (dias === 1) return textos.t(idioma, 'cuando.ayer');
  return textos.t(idioma, 'cuando.hace', { n: dias });
}

const textoDe = (x: unknown) => (typeof x === 'string' && x ? x : undefined);
const numeroDe = (x: unknown) => (typeof x === 'number' ? x : undefined);

/** La frase de la ficha, o `null` si no dice lo bastante (se queda la respuesta de siempre). */
export function fraseDeFicha(d: DatosEnlace, ficha: Ficha, idioma: Idioma, ahora = new Date()): string | null {
  const t = textos.t.bind(textos, idioma);
  const c = ficha.campos;
  if ((ficha.fuente === 'github' || ficha.fuente === 'gitlab') && (d.clase === 'issue' || d.clase === 'pr')) {
    const titulo = textoDe(c.titulo);
    const estado = textoDe(c.estado);
    if (!titulo || !estado || d.numero === undefined) return null;
    const legible = ['open', 'closed', 'fusionado'].includes(estado)
      ? t(`ficha.estados.${estado as 'open' | 'closed' | 'fusionado'}`)
      : estado;
    return t(d.clase === 'pr' ? 'conFicha.pr' : 'conFicha.issue', {
      numero: String(d.numero),
      estado: legible,
      titulo,
    });
  }
  if (ficha.fuente === 'github' || ficha.fuente === 'gitlab') {
    const push = textoDe(c.ultimoPush);
    const activo = push ? diasDesde(new Date(push), ahora) <= DIAS_ACTIVO : undefined;
    if (activo === undefined && c.archivado !== true) return null;
    const estado =
      c.archivado === true
        ? t('conFicha.repoArchivado')
        : activo
          ? t('conFicha.repoActivo')
          : t('conFicha.repoInactivo', { fecha: fmtDia(new Date(push ?? ''), ahora, idioma) });
    const lanzamiento = hace(textoDe(c.fechaLanzamiento), ahora, idioma);
    const licencia = textoDe(c.licencia);
    const partes = [
      lanzamiento ? t('conFicha.lanzamiento', { cuando: lanzamiento }) : undefined,
      licencia ? t('conFicha.licencia', { licencia }) : undefined,
    ].filter(Boolean);
    return partes.length ? `${estado}: ${partes.join(', ')}.` : `${estado}.`;
  }
  if (ficha.fuente === 'paquete') {
    const version = textoDe(c.version);
    if (!version || !d.nombre) return null;
    const publicado = hace(textoDe(c.fechaVersion), ahora, idioma);
    const licencia = textoDe(c.licencia);
    const vulnerabilidades = numeroDe(c.vulnerabilidades);
    const cabeza = [
      t('conFicha.paquete', { nombre: d.nombre, version }),
      publicado ? t('conFicha.publicado', { cuando: publicado }) : undefined,
      licencia ? t('conFicha.licencia', { licencia }) : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    if (vulnerabilidades === undefined) return `${cabeza}.`;
    const vul =
      vulnerabilidades === 0
        ? t('conFicha.sinVulnerabilidades')
        : t('conFicha.vulnerabilidades', { n: vulnerabilidades });
    return `${cabeza}; ${vul}.`;
  }
  const titulo = textoDe(c.titulo);
  if (!titulo) return null;
  const anio = numeroDe(c.anio);
  const revista = textoDe(c.revista);
  if (anio !== undefined && revista) return t('conFicha.paper', { anio: String(anio), revista, titulo });
  if (anio !== undefined) return t('conFicha.paperSinRevista', { anio: String(anio), titulo });
  return t('conFicha.paperSoloTitulo', { titulo });
}
