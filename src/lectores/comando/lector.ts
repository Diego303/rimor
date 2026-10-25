/**
 * Lector Comando (LEC-10, IN-043): un comando de terminal como chuleta, con sus huecos `{{x}}` y «Copiar con
 * valores» (el mismo del Prompt). Puesto 13 del Anexo D.
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { analizarComando, type DatosComando, puntuarComando } from './analisis';
import { textos } from './textos';

export type { DatosComando } from './analisis';

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

const LARGO_TITULO = 80;
/** Los huecos que se nombran en la respuesta; los demás, «…». */
const HUECOS_EN_RESPUESTA = 3;

/** El primer comando, recortado. */
export function tituloDeComando(d: Pick<DatosComando, 'comandos'>): string {
  const primero = d.comandos[0] ?? '';
  if (!primero) return t('es', 'titulo');
  return primero.length > LARGO_TITULO ? `${primero.slice(0, LARGO_TITULO - 1)}…` : primero;
}

export const lectorComando: Lector<DatosComando> = {
  nombre: 'comando',
  tipo: 'comando',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined && !e.archivos?.length ? puntuarComando(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const d = analizarComando(texto);
    return { titulo: tituloDeComando(d), original: texto, resumen: lectorComando.resumen(d) };
  },

  async derivar(el: Elemento): Promise<DatosComando> {
    if (el.original === null) throw new Error('comando.sinOriginal');
    return analizarComando(el.original);
  },

  resumen: (d) => ({ ...(d.programa ? { programa: d.programa } : {}), huecos: d.huecos.length }),

  resumenLegible(r, idioma) {
    const huecos = typeof r.huecos === 'number' && r.huecos > 0 ? t(idioma, 'huecos', { n: r.huecos }) : '';
    return [typeof r.programa === 'string' ? r.programa : '', huecos].filter(Boolean).join(' · ');
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    if (!d.huecos.length)
      return {
        texto: [
          {
            t: 'texto',
            v: d.programa ? t(i, 'respuesta.sinHuecos', { programa: d.programa }) : t(i, 'respuesta.sinPrograma'),
          },
        ],
      };
    // «Comando con 2 huecos: {{host}} y {{puerto}}.»: los huecos en mono (son del usuario).
    const nombrados = d.huecos.slice(0, HUECOS_EN_RESPUESTA);
    const texto: Fragmento[] = [
      {
        t: 'texto',
        v: d.huecos.length === 1 ? t(i, 'respuesta.unHueco') : t(i, 'respuesta.varios', { n: d.huecos.length }),
      },
    ];
    nombrados.forEach((h, k) => {
      if (k > 0)
        texto.push({
          t: 'texto',
          v: k === nombrados.length - 1 && d.huecos.length <= HUECOS_EN_RESPUESTA ? t(i, 'respuesta.y') : ', ',
        });
      texto.push({ t: 'mono', v: h });
    });
    texto.push({ t: 'texto', v: `${d.huecos.length > HUECOS_EN_RESPUESTA ? '…' : ''}${t(i, 'respuesta.fin')}` });
    return { texto, acciones: [{ id: 'abrir', etiqueta: t(i, 'copiarConValores') }] };
  },

  cifras: {
    huecos: (d) => ({ texto: fmtNumero(d.huecos.length, 'es'), valor: d.huecos.length }),
  },

  textoIndexable: (d) => [d.programa ?? '', ...d.huecos].filter(Boolean).join('\n'),
};
