/**
 * Compone la respuesta de Rimor a un elemento (IN-016): la del lector con sus datos y su contexto y, si se
 * ocultaron secretos, la frase común al final. Nunca inventa: si el lector falla, dice lo que sabe.
 */
import type { Elemento } from '@rimor/formato';
import type { Idioma } from '../i18n/formatos';
import { traducir } from '../i18n/i18n';
import type { Contexto, Lector } from '../lectores/contrato';
import { contarFrases, textoDe } from './reglas';
import type { Accion, Respuesta } from './tipos';

const nombreTipo = (el: Elemento, idioma: Idioma) => traducir(idioma, `tipos.${el.frontmatter.tipo}`);

/** «He ocultado un secreto antes de guardar.», si los hubo. */
function fraseSecretos(el: Elemento, idioma: Idioma): Respuesta['texto'] {
  const n = el.frontmatter.ocultados;
  return n > 0 ? [{ t: 'texto', v: ` ${traducir(idioma, 'respuestas.secretos', { n })}` }] : [];
}

/** Respuesta honesta cuando no hay datos del lector (falló o no hay lector). */
export function respuestaSinDatos(el: Elemento, idioma: Idioma): Respuesta {
  return {
    texto: [
      { t: 'texto', v: traducir(idioma, 'respuestas.sinDatos', { tipo: nombreTipo(el, idioma) }) },
      ...fraseSecretos(el, idioma),
    ],
  };
}

export function componer(el: Elemento, lector: Lector, datos: unknown, ctx: Contexto): Respuesta {
  let propia: Respuesta;
  try {
    propia = lector.respuesta(el, datos, ctx);
  } catch {
    propia = {
      texto: [{ t: 'texto', v: traducir(ctx.idioma, 'respuestas.reserva', { tipo: nombreTipo(el, ctx.idioma) }) }],
    };
  }
  const [primera, segunda] = (propia.acciones ?? []).filter((a): a is Accion => Boolean(a));
  const texto = [...propia.texto, ...fraseSecretos(el, ctx.idioma)];
  if (primera) return { texto, acciones: segunda ? [primera, segunda] : [primera] };
  return conSugerencia({ texto }, el, ctx);
}

/**
 * Si el lector no propone nada, el elemento no está en ninguna colección y el contexto tiene una candidata (por
 * etiquetas compartidas o palabras del título), se propone (ORG-02): «¿Lo añado a la colección gateway?». Solo si
 * cabe sin pasar de dos frases.
 */
function conSugerencia(r: Respuesta, el: Elemento, ctx: Contexto): Respuesta {
  const coleccion = ctx.colecciones[0];
  if (!coleccion || el.frontmatter.colecciones?.length) return r;
  if (contarFrases(r.texto.map(textoDe).join('')) >= 2) return r;
  return {
    texto: [...r.texto, { t: 'texto', v: ` ${traducir(ctx.idioma, 'respuestas.coleccion', { nombre: coleccion })}` }],
    acciones: [
      {
        id: `coleccion:${coleccion}`,
        etiqueta: traducir(ctx.idioma, 'respuestas.siColeccion', { nombre: coleccion }),
        principal: true,
      },
      { id: 'no', etiqueta: traducir(ctx.idioma, 'respuestas.no') },
    ],
  };
}
