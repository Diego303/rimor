/**
 * Saneado de todo lo pegado que se pinta (SEG-01): Markdown, HTML suelto y SVG pasan por rehype-sanitize con
 * un esquema propio. Nada pegado puede ejecutar código, cargar recursos de fuera ni pisar la app.
 */
import type { Element, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as Esquema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const PROHIBIDAS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'base',
  'meta',
  'link',
  'frame',
  'frameset',
  'noscript',
  'template',
  'svg',
  'math',
];
const PROTOCOLOS = ['http', 'https', 'mailto'];

/** Esquema de Markdown y HTML pegado: el de GitHub sin estilos, sin formularios y con protocolos seguros. */
export const ESQUEMA: Esquema = {
  ...defaultSchema,
  clobberPrefix: 'rimor-',
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => !PROHIBIDAS.includes(t)),
  attributes: Object.fromEntries(
    Object.entries(defaultSchema.attributes ?? {}).map(([etiqueta, atributos]) => [
      etiqueta,
      (atributos ?? []).filter((a) => {
        const nombre = Array.isArray(a) ? String(a[0]) : String(a);
        return nombre !== 'style' && !nombre.startsWith('on');
      }),
    ]),
  ),
  protocols: { href: PROTOCOLOS, src: PROTOCOLOS, cite: PROTOCOLOS, longDesc: PROTOCOLOS },
  strip: ['script', 'style'],
};

/**
 * Tras sanear: las imágenes remotas no se cargan (avisarían a un servidor de que has abierto el elemento, P6)
 * y pasan a ser un enlace con su texto; los enlaces externos se abren aparte y sin referer.
 */
function endurecer() {
  return (arbol: Root) => {
    visit(arbol, 'element', (nodo: Element, indice, padre) => {
      if (nodo.tagName === 'img' && padre && indice !== undefined) {
        const src = String(nodo.properties.src ?? '');
        const alt = String(nodo.properties.alt ?? src);
        const enlace: Element = {
          type: 'element',
          tagName: 'a',
          properties: {
            href: src,
            rel: ['noopener', 'noreferrer', 'nofollow'],
            target: '_blank',
            className: ['imagen-externa'],
          },
          children: [{ type: 'text', value: alt || src }],
        };
        padre.children.splice(indice, 1, src ? enlace : { type: 'text', value: alt });
        return indice;
      }
      if (nodo.tagName === 'a' && nodo.properties.href !== undefined) {
        const href = String(nodo.properties.href);
        if (/^(https?:|mailto:)/i.test(href)) {
          nodo.properties.rel = ['noopener', 'noreferrer', 'nofollow'];
          nodo.properties.target = '_blank';
        } else if (href.startsWith('#')) {
          // Anclas internas (notas al pie, `[ir](#seccion)`): apuntan a los `id`, que llevan el prefijo. Con el
          // router por hash, `MarkdownSeguro` intercepta el clic y desplaza sin navegar.
          if (!href.startsWith('#rimor-')) nodo.properties.href = `#rimor-${href.slice(1)}`;
        } else {
          // Relativos («/otra/ruta», «../») o sin protocolo («//dominio»): sacarían de la app por la misma pestaña.
          delete nodo.properties.href;
        }
      }
      return undefined;
    });
  };
}

/** Textos de las notas al pie de GFM, en el idioma de la interfaz. */
const NOTAS_AL_PIE = {
  es: { footnoteLabel: 'Notas', footnoteBackLabel: (i: number) => `Volver a la referencia ${i + 1}` },
  en: { footnoteLabel: 'Footnotes', footnoteBackLabel: (i: number) => `Back to reference ${i + 1}` },
} as const;

const procesadorPara = (idioma: 'es' | 'en') =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true, ...NOTAS_AL_PIE[idioma] })
    .use(rehypeRaw)
    .use(rehypeSanitize, ESQUEMA)
    .use(endurecer);
const PROCESADORES = { es: procesadorPara('es'), en: procesadorPara('en') };

/** Markdown pegado → árbol hast saneado, listo para pintar. */
export function markdownAHast(md: string, idioma: 'es' | 'en' = 'es'): Root {
  const procesador = PROCESADORES[idioma];
  return procesador.runSync(procesador.parse(md)) as Root;
}

const procesadorHtml = unified().use(rehypeSanitize, ESQUEMA).use(endurecer);

/** HTML suelto pegado → árbol hast saneado. */
export function sanearHtml(html: string): Root {
  return procesadorHtml.runSync(fromHtml(html, { fragment: true })) as Root;
}

const ETIQUETAS_SVG = [
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'defs',
  'marker',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'use',
  'symbol',
  'pattern',
  'mask',
];
const ATRIBUTOS_SVG = [
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeDasharray',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'transform',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'textAnchor',
  'dominantBaseline',
  'dx',
  'dy',
  'markerEnd',
  'markerStart',
  'markerWidth',
  'markerHeight',
  'refX',
  'refY',
  'orient',
  'offset',
  'stopColor',
  'clipPath',
  'mask',
  'id',
  'className',
  'role',
  'ariaLabel',
  'preserveAspectRatio',
  'gradientUnits',
  'patternUnits',
  'xmlns',
];

/** Esquema de SVG (diagramas, IN-066): formas y texto, sin `script`, `foreignObject`, `on*` ni enlaces de fuera. */
const ESQUEMA_SVG: Esquema = {
  tagNames: ETIQUETAS_SVG,
  attributes: { '*': ATRIBUTOS_SVG, use: [...ATRIBUTOS_SVG, ['href', /^#/]] },
  protocols: { href: [] },
  strip: ['script', 'style', 'foreignObject'],
  clobberPrefix: 'rimor-',
  clobber: ['id'],
};

/** Atributos que pueden llevar `url(…)`: solo se admite una referencia interna, `url(#id)`. */
const CON_URL = ['fill', 'stroke', 'mask', 'clipPath', 'markerEnd', 'markerStart', 'markerMid', 'filter'];

/**
 * Tras sanear un SVG: quita las `url()` que no apuntan dentro del propio SVG y lleva las referencias internas
 * (`href="#x"`, `url(#x)`) a los `id` con prefijo.
 */
function referenciasInternas() {
  return (arbol: Root) => {
    visit(arbol, 'element', (nodo: Element) => {
      for (const atributo of CON_URL) {
        const v = nodo.properties[atributo];
        if (typeof v !== 'string' || !v.includes('url(')) continue;
        const interna = /^\s*url\(\s*['"]?#([\w-]+)['"]?\s*\)\s*$/.exec(v);
        if (interna) nodo.properties[atributo] = `url(#rimor-${interna[1]})`;
        else delete nodo.properties[atributo];
      }
      const href = nodo.properties.href;
      if (typeof href === 'string' && href.startsWith('#') && !href.startsWith('#rimor-'))
        nodo.properties.href = `#rimor-${href.slice(1)}`;
    });
  };
}

/** SVG pegado o generado → SVG saneado como texto. */
export function sanearSvg(svg: string): string {
  const arbol = fromHtml(svg, { fragment: true, space: 'svg' });
  const limpio = unified().use(rehypeSanitize, ESQUEMA_SVG).use(referenciasInternas).runSync(arbol) as Root;
  return toHtml(limpio, { space: 'svg' });
}
