import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { escribirTexto, leerTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { leerAjustes, respuestaDesactivada } from '../espacio/ajustes';
import type { Idioma } from '../i18n/formatos';
import { lectorPlantilla } from '../lectores/_plantilla/lector';
import type { Contexto, Lector } from '../lectores/contrato';
import { elementoFalso, lectorFalso } from '../lectores/pruebas/falsos';
import { REGISTRO } from '../lectores/registro';
import { componer, respuestaSinDatos } from './componer';
import { abrirContadores, leerContadores, RUTA_CONTADORES } from './contadores';
import { coleccionesCandidatas, construirContexto } from './contexto';
import { comprobarEstilo, contarFrases } from './reglas';

const ctx = (idioma: Idioma = 'es'): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
});

function con(el: Elemento, cambios: Partial<Elemento['frontmatter']>): Elemento {
  return { ...el, frontmatter: { ...el.frontmatter, ...cambios } };
}

describe('reglas de estilo', () => {
  it('cuentan frases sin cortar en los números', () => {
    expect(contarFrases('Log de 1.042 líneas. 16 errores entre 17:40 y 17:43.')).toBe(2);
    expect(contarFrases('Mediana 38,5 ms')).toBe(1);
    expect(contarFrases('Una. Dos. Tres.')).toBe(3);
    expect(contarFrases('¿Lo añado a su hilo?')).toBe(1);
  });

  it('detectan exclamaciones, emojis, frases de más y acciones de más', () => {
    const bien = { texto: [{ t: 'texto' as const, v: 'Idea guardada. Volverá dentro de 7 días.' }] };
    expect(comprobarEstilo(bien)).toEqual([]);
    expect(comprobarEstilo({ texto: [{ t: 'texto', v: '¡Genial!' }] }).join()).toContain('exclamación');
    expect(comprobarEstilo({ texto: [{ t: 'texto', v: 'Hecho 🎉' }] }).join()).toContain('emoji');
    expect(comprobarEstilo({ texto: [{ t: 'texto', v: 'Uno. Dos. Tres.' }] }).join()).toContain('más de 2 frases');
    const tres = { id: 'a', etiqueta: 'A' };
    const r = { texto: bien.texto, acciones: [tres, tres, tres] } as unknown as Parameters<typeof comprobarEstilo>[0];
    expect(comprobarEstilo(r).join()).toContain('más de 2 acciones');
    expect(comprobarEstilo({ texto: [{ t: 'cifra', v: '' }] }).join()).toContain('fragmento vacío');
    expect(comprobarEstilo({ texto: [{ t: 'texto', v: 'España 🇪🇸' }] }).join()).toContain('emoji');
  });

  it('no cuentan el contenido del usuario (citas, mono, refs) ni las abreviaturas', () => {
    const r: Parameters<typeof comprobarEstilo>[0] = {
      texto: [
        { t: 'texto', v: 'Es la tercera vez. El 15 oct escribiste: ' },
        { t: 'cita', v: 'Subí el pool. Ya no pasa. ¡Por fin!', fecha: '2026-10-15' },
        { t: 'texto', v: ', p. ej. con ' },
        { t: 'mono', v: 'a != b' },
        { t: 'texto', v: ' © y ' },
        { t: 'ref', ref: 'ERR-0015' },
        { t: 'texto', v: '.' },
      ],
    };
    expect(comprobarEstilo(r)).toEqual([]);
  });
});

describe('componer', () => {
  it('añade la frase común de secretos, en singular y plural y en los dos idiomas', () => {
    const lector = lectorFalso();
    const uno = con(elementoFalso(1), { ocultados: 1 });
    expect(componer(uno, lector, { largo: 1 }, ctx()).texto.at(-1)).toEqual({
      t: 'texto',
      v: ' He ocultado un secreto antes de guardar.',
    });
    const tres = con(elementoFalso(2), { ocultados: 3 });
    expect(componer(tres, lector, { largo: 1 }, ctx('en')).texto.at(-1)).toEqual({
      t: 'texto',
      v: ' I hid 3 secrets before saving.',
    });
    expect(componer(elementoFalso(3), lector, { largo: 1 }, ctx()).texto).toEqual([{ t: 'texto', v: 'Falso.' }]);
  });

  it('si el lector falla, una respuesta honesta; las acciones se recortan a dos', () => {
    const roto = lectorFalso({
      respuesta: () => {
        throw new Error('roto');
      },
    });
    expect(componer(elementoFalso(1), roto, {}, ctx()).texto).toEqual([{ t: 'texto', v: 'Guardado como Texto.' }]);
    const muchas = lectorFalso({
      respuesta: () =>
        ({
          texto: [{ t: 'texto', v: 'Hola.' }],
          acciones: [
            { id: 'a', etiqueta: 'A' },
            { id: 'b', etiqueta: 'B' },
            { id: 'c', etiqueta: 'C' },
          ],
        }) as unknown as ReturnType<Lector['respuesta']>,
    });
    expect(componer(elementoFalso(2), muchas, {}, ctx()).acciones?.map((a) => a?.id)).toEqual(['a', 'b']);
    expect(respuestaSinDatos(con(elementoFalso(3), { tipo: 'log' }), 'es').texto[0]).toEqual({
      t: 'texto',
      v: 'Guardado como Log. No pude analizarlo: se ve el original.',
    });
  });
});

describe('contexto', () => {
  it('misma huella, notas de los resueltos, colecciones candidatas y respondeA', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    const huella = { nombre: 'falso', version: 1, resumen: { huella: 'h1' } };
    const antiguo = con(elementoFalso(1, 'a'), {
      lector: huella,
      estado: 'resuelto',
      creado: '2026-10-01T10:00:00+02:00',
      colecciones: ['gateway'],
    });
    await repo.guardarElemento({ ...antiguo, notas: '\nPasa cuando el pool se queda sin conexiones.\nMás.' });
    await repo.guardarElemento(con(elementoFalso(2, 'b'), { lector: huella, creado: '2026-10-10T10:00:00+02:00' }));
    await repo.guardarElemento(con(elementoFalso(3, 'c'), { etiquetas: ['rust'], colecciones: ['backend'] }));
    const nuevo = con(elementoFalso(4, 'd'), { lector: huella, etiquetas: ['rust'], titulo: 'Timeout en el gateway' });
    await repo.guardarElemento(nuevo);
    const c = await construirContexto(nuevo, repo, 'es', { respondeA: 'TXT-0003' });
    expect(c.mismaHuella.map((f) => f.ref)).toEqual(['TXT-0002', 'TXT-0001']);
    expect(c.notas).toEqual([
      { ref: 'TXT-0001', texto: 'Pasa cuando el pool se queda sin conexiones.', fecha: antiguo.frontmatter.modificado },
    ]);
    expect(c.colecciones).toEqual(['backend']);
    expect(c.respondeA?.ref).toBe('TXT-0003');
    // Todo lo guardado el mismo día (en las 24 h) está cerca, del más próximo al más lejano.
    expect(c.cercanos?.map((f) => f.ref)).toEqual(['TXT-0003']);
  });

  it('la huella sale del resumen de los derivados; los alias no son versiones', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    const conHuella = { nombre: 'falso', version: 1, resumen: { huella: 'h9' } };
    await repo.guardarElemento(con(elementoFalso(1, 'a'), { lector: conHuella }));
    await repo.guardarElemento(elementoFalso(2, 'ajeno'));
    // Captura nueva: su frontmatter trae el resumen provisional, sin huella, y un alias de una importación.
    const nuevo = con(elementoFalso(3, 'c'), { alias: ['TXT-0002'] });
    await repo.guardarElemento(nuevo);
    const c = await construirContexto(nuevo, repo, 'es', { resumen: { huella: 'h9' } });
    expect(c.mismaHuella.map((f) => f.ref)).toEqual(['TXT-0001']);
    expect(c.versiones).toEqual([]);
    expect((await construirContexto(nuevo, repo, 'es')).mismaHuella).toEqual([]);
  });

  it('colecciones por palabras del título si no comparten etiquetas', () => {
    const fm = con(elementoFalso(1), { titulo: 'Latencia del gateway en producción' }).frontmatter;
    const otro = con(elementoFalso(2), { titulo: 'Gateway caído', colecciones: ['infra'] }).frontmatter;
    const lejos = con(elementoFalso(3), { titulo: 'Receta de pan', colecciones: ['cocina'] }).frontmatter;
    expect(coleccionesCandidatas(fm, [otro, lejos])).toEqual(['infra']);
  });
});

describe('respuestas de los lectores sobre el corpus', () => {
  const raiz = join(process.cwd(), 'fixtures/deteccion');
  const ejemplos = readdirSync(raiz).flatMap((tipo) =>
    readdirSync(join(raiz, tipo))
      .filter((f) => f.endsWith('.txt'))
      .map((f) => readFileSync(join(raiz, tipo, f), 'utf8')),
  );
  const lectores: Lector[] = [...REGISTRO.lectores, lectorPlantilla];

  /** Un contexto lleno: lo que el lector puede recordar (misma huella, notas, colecciones, a qué responde). */
  const lleno = (idioma: Idioma): Contexto => {
    const otro = con(elementoFalso(90, 'x'), { estado: 'resuelto', colecciones: ['gateway'] }).frontmatter;
    return {
      idioma,
      mismaHuella: [otro, elementoFalso(91, 'y').frontmatter],
      versiones: [],
      notas: [
        {
          ref: otro.ref,
          texto: 'Pasa cuando el pool se queda sin conexiones. Subí el límite.',
          fecha: otro.modificado,
        },
      ],
      colecciones: ['gateway', 'backend'],
      respondeA: otro,
    };
  };

  it('ninguna incumple las reglas de estilo, en es ni en en, con el contexto vacío o lleno', async () => {
    for (const lector of lectores)
      for (const [i, texto] of ejemplos.entries()) {
        const el = con(elementoFalso(i + 1, texto), { tipo: lector.tipo, hash: hashOriginal(texto) });
        const datos = await lector.derivar(el);
        for (const idioma of ['es', 'en'] as const)
          for (const contexto of [ctx(idioma), lleno(idioma)])
            expect(comprobarEstilo(lector.respuesta(el, datos, contexto)), `${lector.nombre} ${i}`).toEqual([]);
      }
  });

  it('instantánea de la respuesta de cada lector con su primer ejemplo', async () => {
    const instantaneas: Record<string, unknown> = {};
    for (const lector of lectores) {
      // Su propio ejemplo (el primero de su carpeta del corpus): un texto pegado o un archivo soltado.
      let propios: string[] = [];
      try {
        propios = readdirSync(join(raiz, lector.tipo)).sort();
      } catch {
        propios = [];
      }
      const primero = propios[0];
      let el = con(elementoFalso(1, ejemplos[0] ?? ''), { tipo: lector.tipo });
      if (primero?.endsWith('.txt'))
        el = con(elementoFalso(1, readFileSync(join(raiz, lector.tipo, primero), 'utf8')), { tipo: lector.tipo });
      else if (primero) {
        const tam = readFileSync(join(raiz, lector.tipo, primero)).length;
        el = {
          ...con(elementoFalso(1, ''), { tipo: lector.tipo }),
          original: null,
        };
        el.frontmatter.adjunto = {
          hash: '0'.repeat(64),
          ruta: `adjuntos/00/${primero}`,
          nombre: primero,
          mime: '',
          tam,
        };
      }
      const datos = await lector.derivar(el);
      instantaneas[lector.nombre] = {
        es: lector.respuesta(el, datos, ctx('es')),
        en: lector.respuesta(el, datos, ctx('en')),
      };
    }
    expect(instantaneas).toMatchSnapshot();
  });
});

describe('ajustes y contadores', () => {
  it('ajustes: tipos desactivados válidos, sin repetir, y lo desconocido se conserva', () => {
    const a = leerAjustes('{"respuestas":{"desactivadas":["log","log","nada"]},"tema":"oscuro"}');
    expect(a.respuestas.desactivadas).toEqual(['log']);
    expect(a.tema).toBe('oscuro');
    expect(respuestaDesactivada(a, 'log')).toBe(true);
    expect(leerAjustes('roto').respuestas.desactivadas).toEqual([]);
  });

  it('contadores por día, que se releen al reabrir', async () => {
    const almacen = new AlmacenMemoria();
    let dia = new Date(2026, 9, 18, 10);
    const c = await abrirContadores(
      almacen,
      () => true,
      () => dia,
    );
    await c.contar('duplicadosEvitados');
    await c.contar('duplicadosEvitados', 2);
    dia = new Date(2026, 9, 19, 9);
    await c.contar('erroresReconocidos');
    expect(c.total('duplicadosEvitados')).toBe(3);
    expect(c.total('erroresReconocidos', '2026-10-19')).toBe(1);
    const otra = await abrirContadores(almacen, () => true);
    expect(otra.datos().dias['2026-10-18']).toEqual({ duplicadosEvitados: 3 });
    const raro = '{"dias":{"mal":{"x":1},"2026-01-01":{"duplicadosEvitados":-2,"copiasConValores":4}}}';
    expect(leerContadores(raro)?.dias).toEqual({ '2026-01-01': { copiasConValores: 4 } });
  });

  it('dos pestañas no se pisan: lo que cuenta la lectora espera y se suma al pasar a escribir', async () => {
    const almacen = new AlmacenMemoria();
    const dia = () => new Date(2026, 9, 18, 10);
    const a = await abrirContadores(almacen, () => true, dia);
    let bEscribe = false;
    const b = await abrirContadores(almacen, () => bEscribe, dia);
    for (let i = 0; i < 7; i++) await a.contar('duplicadosEvitados');
    await b.contar('duplicadosEvitados');
    expect(b.total('duplicadosEvitados')).toBe(1);
    const enArchivo = async () => leerContadores(await leerTexto(almacen, RUTA_CONTADORES))?.dias['2026-10-18'];
    expect(await enArchivo()).toEqual({ duplicadosEvitados: 7 });
    bEscribe = true;
    await b.recargar();
    expect(await enArchivo()).toEqual({ duplicadosEvitados: 8 });
    expect(b.total('duplicadosEvitados')).toBe(8);
  });

  it('un archivo de contadores ilegible no se sobrescribe', async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, RUTA_CONTADORES, '{ roto');
    const c = await abrirContadores(almacen, () => true);
    await c.contar('duplicadosEvitados');
    expect(await leerTexto(almacen, RUTA_CONTADORES)).toBe('{ roto');
    expect(c.total('duplicadosEvitados')).toBe(1);
  });
});
