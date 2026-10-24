import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../espacio/Espacio';
import VistaArchivo from './archivo/Vista';
import { ContextoComparar } from './ContextoComparar';
import { ContextoHilo } from './ContextoHilo';
import { analizarCodigo } from './codigo/analisis';
import VistaCodigo from './codigo/Vista';
import { analizarError } from './error/lector';
import VistaError, { listaDeFechas } from './error/Vista';
import { analizar } from './log/analisis';
import VistaLog from './log/Vista';
import { analizarMarkdown } from './markdown/analisis';
import { indiceDe } from './markdown/indice';
import VistaMarkdown from './markdown/Vista';
import { lectorMediciones } from './mediciones/lector';
import VistaMediciones from './mediciones/Vista';
import { analizarPrompt } from './prompt/analisis';
import VistaPrompt from './prompt/Vista';
import { elementoFalso } from './pruebas/falsos';
import VistaTexto from './texto/Vista';

describe('vista de Texto', () => {
  it('pinta el Markdown saneado (sin scripts) con sus enlaces y menciones', () => {
    const el = elementoFalso(
      1,
      '# Título\n\n**negrita** <script>window.malo = 1</script> https://docs.rs/ureq ERR-0015',
      'texto',
    );
    const { container } = render(
      <VistaTexto
        el={el}
        datos={{ lineas: 3, palabras: 6, enlaces: ['https://docs.rs/ureq'], menciones: ['ERR-0015'] }}
      />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Título');
    expect(container.querySelector('strong')?.textContent).toBe('negrita');
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { malo?: number }).malo).toBeUndefined();
    const enlace = screen.getAllByRole('link', { name: 'https://docs.rs/ureq' }).at(-1);
    expect(enlace?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'ERR-0015' }).getAttribute('href')).toBe('#/e/ERR-0015');
  });
});

describe('vista de Archivo', () => {
  it('enseña nombre, tamaño y tipo, y descarga los bytes del adjunto', async () => {
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-archivo',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const blobs: Blob[] = [];
    // Sin tocar el `URL` global para siempre: espías que se restauran al acabar.
    const crear = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob);
      return 'blob:x';
    });
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    function ConAdjunto() {
      const { repositorio } = useEspacioAbierto();
      const base = elementoFalso(1, '', 'archivo');
      const el = {
        ...base,
        original: null,
        frontmatter: {
          ...base.frontmatter,
          tipo: 'archivo' as const,
          adjunto: { hash: 'b'.repeat(64), ruta: 'adjuntos/bb/datos.bin', nombre: 'datos.bin', mime: '', tam: 3 },
        },
      };
      void repositorio;
      return <VistaArchivo el={el} datos={{ nombre: 'datos.bin', tam: 3, mime: '' }} />;
    }
    await almacen.escribir('adjuntos/bb/datos.bin', new Uint8Array([7, 8, 9]));
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <ConAdjunto />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('datos.bin')).toBeTruthy();
    expect(screen.getByText(/^3\sB$/)).toBeTruthy();
    expect(screen.getByText('tipo desconocido')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar el original' }));
    await waitFor(() => expect(clic).toHaveBeenCalled());
    // El enlace temporal no se revoca enseguida (Safari cancelaría la descarga).
    expect(revocar).not.toHaveBeenCalled();
    expect(new Uint8Array((await blobs[0]?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(new Uint8Array([7, 8, 9]));
    clic.mockRestore();
    crear.mockRestore();
    revocar.mockRestore();
  });
});

describe('vista de Texto guardado aparte', () => {
  it('enseña su principio y deja descargarlo entero', async () => {
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    await almacen.escribir('adjuntos/cc/grande.txt', new TextEncoder().encode('principio del texto enorme'));
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-texto-grande',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const base = elementoFalso(5, '', 'texto');
    const el = {
      ...base,
      original: null,
      frontmatter: {
        ...base.frontmatter,
        adjunto: { hash: 'c'.repeat(64), ruta: 'adjuntos/cc/grande.txt', mime: 'text/plain', tam: 3_000_000 },
      },
    };
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <VistaTexto el={el} datos={{ lineas: 0, palabras: 0, enlaces: [], menciones: [] }} />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('principio del texto enorme')).toBeTruthy();
    expect(screen.getByText(/guardado aparte por su tamaño/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar el texto completo' })).toBeTruthy();
  });
});

describe('vista de Enlace', () => {
  it('enlaza la dirección limpia aparte y enseña lo pegado si era distinto', async () => {
    const { default: VistaEnlace } = await import('./enlace/Vista');
    const el = elementoFalso(7, 'https://docs.rs/ureq?utm_source=hn', 'enlace');
    render(
      <VistaEnlace
        el={el}
        datos={{ url: 'https://docs.rs/ureq', clase: 'documentacion', sitio: 'docs.rs', nombre: 'ureq' }}
      />,
    );
    const enlace = screen.getByRole('link', { name: 'https://docs.rs/ureq' });
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Documentación')).toBeTruthy();
    expect(screen.getByText('https://docs.rs/ureq?utm_source=hn')).toBeTruthy();
  });
});

describe('vista de Log', () => {
  it('cifras, histograma, plantillas que filtran sus líneas y «Ver las N»', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const texto = readFileSync(join(process.cwd(), 'fixtures/logs/texto-iso.log'), 'utf8');
    const el = elementoFalso(8, texto, 'log');
    const datos = analizar(texto, { anio: 2026 });
    const { container } = render(<VistaLog el={el} datos={datos} />);
    expect(container.querySelector('.stat .v.bad')?.textContent).toBe('3');
    expect(container.querySelector('.stat .v.warn')?.textContent).toBe('1');
    expect(container.querySelectorAll('.histograma-log .barra-errores').length).toBeGreaterThan(0);
    expect(screen.getByText(/Los errores se concentran entre/).textContent).toBe(
      'Los errores se concentran entre 17:40 y 17:43.',
    );
    const filas = container.querySelectorAll('.tabla-plantillas tr');
    expect(filas).toHaveLength(5);
    // Con 5 plantillas no hace falta «Ver las N»: solo sale cuando hay más.
    expect(screen.queryByRole('button', { name: /Ver las/ })).toBeNull();
    const deError = [...filas].find((f) => f.textContent?.includes('read timeout')) as HTMLElement;
    expect(deError.querySelector('.lv-ERROR')).toBeTruthy();
    expect(deError.querySelector('.ph')?.textContent).toBe('N');
    fireEvent.click(deError.querySelector('button') as HTMLElement);
    expect(deError.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    const lineas = container.querySelector('pre.lineas-plantilla')?.textContent ?? '';
    expect(lineas.split('\n').filter(Boolean)).toHaveLength(3);
    // Sin hilo, no hay «Ver su hilo».
    expect(screen.queryByRole('button', { name: 'Ver su hilo' })).toBeNull();
  });

  it('con hilo, «Ver su hilo» junto a «Comparar con otro log» (como `SC.log`)', () => {
    const el = elementoFalso(8, '2026-10-17T17:40:45Z ERROR stream: read timeout', 'log');
    const datos = analizar(el.original ?? '', { anio: 2026 });
    const verHilo = vi.fn();
    render(
      <ContextoComparar.Provider value={() => undefined}>
        <ContextoHilo.Provider value={verHilo}>
          <VistaLog el={el} datos={datos} />
        </ContextoHilo.Provider>
      </ContextoComparar.Provider>,
    );
    const botones = [...document.querySelectorAll('.row .btn')].map((b) => [b.textContent, b.className]);
    expect(botones).toEqual([
      ['Comparar con otro log', 'btn pri sm'],
      ['Ver su hilo', 'btn sm'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Ver su hilo' }));
    expect(verHilo).toHaveBeenCalledOnce();
  });
});

describe('vista de Mediciones', () => {
  const cargar = async (archivo: string) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const texto = readFileSync(join(process.cwd(), 'fixtures/mediciones', archivo), 'utf8');
    const el = elementoFalso(9, texto, 'mediciones');
    return { el, datos: await lectorMediciones.derivar(el) };
  };

  it('la mediana como veredicto, el gráfico con su banda y su mediana, la tabla y los avisos con su número', async () => {
    const { el, datos } = await cargar('reqwest.txt');
    const { container } = render(<VistaMediciones el={el} datos={datos} />);
    expect(container.querySelector('.verdict.ok .big')?.textContent).toBe('38,54\u00a0ms');
    expect(screen.getByText('Mediana de 20 mediciones')).toBeTruthy();
    const grafico = container.querySelector('svg.grafico-puntos');
    expect(grafico?.getAttribute('aria-label')).toBe('Distribución de reqwest');
    expect(grafico?.querySelectorAll('.gp-serie.clave circle')).toHaveLength(20);
    expect(grafico?.querySelectorAll('.gp-banda')).toHaveLength(1);
    expect(grafico?.querySelectorAll('.gp-mediana')).toHaveLength(1);
    expect(grafico?.querySelector('.gp-unidad')?.textContent).toBe('ms');
    // La banda va del IC bajo al alto y la mediana cae dentro.
    const banda = grafico?.querySelector('.gp-banda');
    const x = Number(banda?.getAttribute('x'));
    const ancho = Number(banda?.getAttribute('width'));
    const mediana = Number(grafico?.querySelector('.gp-mediana')?.getAttribute('x1'));
    expect(mediana).toBeGreaterThan(x);
    expect(mediana).toBeLessThan(x + ancho);
    expect(screen.getByText('Línea: mediana · banda: intervalo de confianza del 95 %')).toBeTruthy();
    const celdas = [...container.querySelectorAll('.tabla-mediciones tbody td')].map((c) => c.textContent);
    // Las columnas de la referencia: serie, Mediana, IC 95 % y Variación.
    expect(celdas).toEqual(['reqwest', '38,54\u00a0ms', '38,11 – 39,02', expect.stringMatching(/^\d,\d\u00a0%$/)]);
    // Un atípico (41,70 ms): un aviso, con su número en el plegable.
    expect(screen.getByText('Avisos de método (1)')).toBeTruthy();
    expect(screen.getByText(/Un valor \(41,70 ms\) se aleja de la mediana/)).toBeTruthy();
    expect(screen.getByText('mediana').closest('.st')?.textContent).toBe('mediana 38,54\u00a0ms');
  });

  it('con pocas, el veredicto avisa; varias series, una fila y una banda por serie', async () => {
    const pocas = await cargar('pocas.txt');
    const { container, unmount } = render(<VistaMediciones el={pocas.el} datos={pocas.datos} />);
    expect(container.querySelector('.verdict.warn')).toBeTruthy();
    expect(screen.getByText(/^Solo 5 mediciones: lo recomendable son al menos 10/)).toBeTruthy();
    unmount();
    const go = await cargar('go-bench.txt');
    const otra = render(<VistaMediciones el={go.el} datos={go.datos} />);
    expect(otra.container.querySelectorAll('.gp-banda')).toHaveLength(2);
    expect(otra.container.querySelectorAll('.tabla-mediciones tbody tr')).toHaveLength(2);
    // De menos de 1 ms se enseña en µs (los valores se guardan en ms).
    expect(otra.container.querySelector('.verdict .big')?.textContent).toBe('12,73\u00a0µs');
    expect(otra.container.querySelector('.gp-unidad')?.textContent).toBe('µs');
    // Con varias series, la leyenda no pinta muestras de color que no las distinguirían.
    expect(otra.container.querySelectorAll('.legend i')).toHaveLength(0);
    // Los avisos de cada serie llevan su nombre delante.
    expect(screen.getAllByText(/^(Parse|Encode): Solo 5 mediciones/)).toHaveLength(2);
  });
});

describe('vista de Código', () => {
  it('números de línea y resaltado cargado bajo demanda, con el texto intacto', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const texto = readFileSync(join(process.cwd(), 'fixtures/codigo/rust-1.txt'), 'utf8');
    const { container } = render(<VistaCodigo el={elementoFalso(16, texto, 'codigo')} datos={analizarCodigo(texto)} />);
    const pre = container.querySelector('pre.codigo');
    expect(pre?.querySelectorAll('.linea')).toHaveLength(12);
    await waitFor(() => expect(pre?.querySelector('.tok-keyword')).toBeTruthy(), { timeout: 4000 });
    // El texto pintado, sin los números de línea (ocultos para los lectores de pantalla y sin copiarse), es el original.
    const sinNumeros = (nodo: Element | null | undefined) => {
      const copia = nodo?.cloneNode(true) as Element | undefined;
      for (const n of copia?.querySelectorAll('.ln') ?? []) n.remove();
      return copia?.textContent;
    };
    expect(sinNumeros(pre)).toBe(texto);
    expect(pre?.querySelector('.ln')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Rust')).toBeTruthy();
    expect(screen.getByText('(por su sintaxis)')).toBeTruthy();
  });

  it('sin analizador (SQL), el texto tal cual y el aviso', () => {
    const texto = 'SELECT id\nFROM elementos\nWHERE ref = 1;';
    const { container } = render(<VistaCodigo el={elementoFalso(17, texto, 'codigo')} datos={analizarCodigo(texto)} />);
    const copia = container.querySelector('pre.codigo')?.cloneNode(true) as Element;
    for (const n of copia.querySelectorAll('.ln')) n.remove();
    expect(copia.textContent).toBe(`${texto}\n`);
    expect(screen.getByText('Sin resaltado de sintaxis para este lenguaje.')).toBeTruthy();
  });
});

describe('vista de Documento Markdown', () => {
  it('progreso, índice con hechas/total que lleva a su encabezado y documento saneado', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const texto = `${readFileSync(join(process.cwd(), 'fixtures/markdown/plan-cliente-http.md'), 'utf8')}\n<script>alert(1)</script>\n`;
    const el = elementoFalso(13, texto, 'markdown');
    const datos = analizarMarkdown(texto);
    const { container } = render(<VistaMarkdown el={el} datos={datos} />);
    expect(screen.getByText('6 de 14 tareas')).toBeTruthy();
    expect(container.querySelector('.progreso-tareas .mono')?.textContent).toBe('43 %');
    expect(container.querySelector('.meter')?.getAttribute('aria-valuenow')).toBe('43');
    const filas = [...container.querySelectorAll('.seccion-indice')].map((b) => b.textContent);
    expect(filas).toEqual([
      '1. Objetivo',
      '2. Cliente HTTP3/5',
      '3. Streaming2/5',
      '4. Dependencias1/2',
      '5. Pruebas0/2',
    ]);
    // Cada entrada del índice tiene su encabezado con el mismo ancla en el documento pintado.
    for (const s of indiceDe(datos)) expect(container.querySelector(`#rimor-${s.ancla}`), s.ancla).toBeTruthy();
    const original = Element.prototype.scrollIntoView;
    const desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar;
    fireEvent.click(screen.getByRole('button', { name: /3\. Streaming/ }));
    expect(desplazar).toHaveBeenCalledTimes(1);
    Element.prototype.scrollIntoView = original;
    // Saneado: sin scripts; las casillas de las tareas, deshabilitadas.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(14);
    expect(screen.getByText('Detalles')).toBeTruthy();
  });

  it('las anclas del índice coinciden con los id pintados (imágenes, notas, HTML, Setext, repetidas, frontmatter)', () => {
    const texto = [
      '---',
      'title: Casos',
      '---',
      '## ![](https://x.com/a.png) Logo',
      '',
      '## Título[^1]',
      '',
      '## Hola <img alt="pic" src="https://x.com/b.png">',
      '',
      '## Hola <script>x</script>',
      '',
      'Foo  ',
      'bar',
      '===',
      '',
      '<h2>Intro</h2>',
      '',
      '## Intro',
      '',
      '## A',
      '',
      '## A',
      '',
      '## A-2',
      '',
      '[^1]: nota',
    ].join('\n');
    const datos = analizarMarkdown(texto);
    const { container } = render(<VistaMarkdown el={elementoFalso(15, texto, 'markdown')} datos={datos} />);
    const ids = [...container.querySelectorAll('.md-seguro [id]')].map((e) => e.id);
    for (const s of datos.secciones) expect(ids, s.titulo).toContain(`rimor-${s.ancla}`);
    // Ningún id repetido, y el `<h2>` crudo no se queda el ancla de `## Intro`.
    expect(new Set(ids).size).toBe(ids.length);
    const intro = datos.secciones.find((s) => s.titulo === 'Intro');
    expect(container.querySelector(`#rimor-${intro?.ancla}`)?.textContent).toBe('Intro');
    expect(container.querySelector(`#rimor-${intro?.ancla}`)?.tagName).toBe('H2');
    // El frontmatter no se pinta como documento (va en «Detalles»).
    expect(container.querySelector('.md-seguro')?.textContent).not.toContain('title: Casos');
  });

  it('sin tareas, la tarjeta es solo el índice', () => {
    const texto = '# Arquitectura\n\n## Capas\n\nTexto.\n\n## Datos\n\nMás texto.\n';
    const { container } = render(
      <VistaMarkdown el={elementoFalso(14, texto, 'markdown')} datos={analizarMarkdown(texto)} />,
    );
    expect(screen.getByText('Índice')).toBeTruthy();
    expect(container.querySelector('.meter')).toBeNull();
    expect(container.querySelectorAll('.seccion-indice')).toHaveLength(2);
  });
});

describe('vista de Prompt', () => {
  it('variables resaltadas, copiar con valores (portapapeles y alternativa), valores recordados y resultados', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ProveedorAvisos } = await import('../ui/componentes');
    const texto = readFileSync(join(process.cwd(), 'fixtures/prompts/revisor-adr.txt'), 'utf8');
    const datos = analizarPrompt(texto);
    const base = elementoFalso(12, texto, 'prompt');
    const el = { ...base, frontmatter: { ...base.frontmatter, tipo: 'prompt' as const, ref: 'PRM-0012' as const } };
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    // El mismo almacén al volver a montar: es el mismo espacio.
    const almacen = new AlmacenMemoria();
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-prompt',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const abierto: { e: ReturnType<typeof useEspacioAbierto> | null } = { e: null };
    function Montaje({ elemento, editable }: { elemento: typeof el; editable: boolean }) {
      abierto.e = useEspacioAbierto();
      return <VistaPrompt el={elemento} datos={datos} editable={editable} />;
    }
    const montar = (elemento: typeof el, editable = true) => (
      <ProveedorEspacio dependencias={dependencias}>
        <ProveedorAvisos>
          <Montaje elemento={elemento} editable={editable} />
        </ProveedorAvisos>
      </ProveedorEspacio>
    );
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
    const { container, unmount } = render(montar(el));
    await waitFor(() => expect(abierto.e).toBeTruthy());
    await act(async () => {
      await abierto.e?.repositorio.guardarElemento(el);
    });

    expect([...container.querySelectorAll('pre.prompt-texto .var')].map((v) => v.textContent)).toEqual([
      '{{adr}}',
      '{{contexto}}',
      '{{criterios}}',
    ]);
    fireEvent.change(screen.getByLabelText('{{adr}}'), { target: { value: 'ADR-0012 {{no}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledTimes(1));
    expect(escribir.mock.calls[0]?.[0]).toContain('Lee el ADR ADR-0012 {{no}} en el contexto de {{contexto}}.');
    await waitFor(() => expect(abierto.e?.contadores.total('copiasConValores')).toBe(1));

    // Los valores se recuerdan para este prompt (en este navegador).
    unmount();
    const otra = render(montar(el));
    expect(((await otra.findByLabelText('{{adr}}')) as HTMLInputElement).value).toBe('ADR-0012 {{no}}');

    // Si el navegador no deja copiar, el texto listo queda a la vista para seleccionarlo.
    escribir.mockRejectedValueOnce(new Error('NotAllowedError'));
    fireEvent.click(otra.getByRole('button', { name: 'Copiar' }));
    const listo = (await otra.findByLabelText('Prompt con los valores')) as HTMLTextAreaElement;
    expect(listo.value).toContain('ADR-0012 {{no}}');

    // Un resultado: archivo en historial/ y entrada en el frontmatter.
    expect(otra.getByText('Resultados (0)')).toBeTruthy();
    fireEvent.click(otra.getByRole('button', { name: 'Añadir resultado' }));
    fireEvent.change(otra.getByLabelText('Respuesta que obtuviste'), { target: { value: 'Le falta el contexto.' } });
    fireEvent.click(otra.getByLabelText('4 estrellas'));
    fireEvent.change(otra.getByLabelText('Nota'), { target: { value: 'Útil' } });
    fireEvent.click(otra.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect((abierto.e?.repositorio.frontmatter('PRM-0012') as { resultados?: unknown[] })?.resultados).toHaveLength(
        1,
      ),
    );
    const fm = abierto.e?.repositorio.frontmatter('PRM-0012') as unknown as { resultados: { archivo: string }[] };
    const archivo = fm.resultados[0]?.archivo ?? '';
    expect(archivo).toMatch(/^historial\/PRM-0012\/resultado-\d{4}-\d{2}-\d{2}\.md$/);
    expect(await abierto.e?.repositorio.leerHistorial(archivo)).toContain('Le falta el contexto.');
    // La lista y la media lo enseñan ya, sin esperar a que llegue el elemento releído.
    expect(await otra.findByText('Resultados (1)')).toBeTruthy();
    expect(otra.getByText('Valoración media: ★ 4,0 (1 uso)')).toBeTruthy();
    const leido = await abierto.e?.repositorio.leerElemento('PRM-0012');
    if (!leido?.ok) throw new Error('sin leer');
    otra.rerender(montar(leido.valor as typeof el));
    expect(await otra.findByText('Resultados (1)')).toBeTruthy();

    // Si el elemento no se puede actualizar, el archivo del resultado no se queda huérfano en el historial.
    const repo = abierto.e?.repositorio;
    if (!repo) throw new Error('sin repositorio');
    const fallo = vi.spyOn(repo, 'actualizarElemento').mockResolvedValueOnce({
      ok: false,
      error: { codigo: 'almacen.soloLectura' },
    } as never);
    fireEvent.click(otra.getByRole('button', { name: 'Añadir resultado' }));
    fireEvent.click(otra.getByLabelText('2 estrellas'));
    fireEvent.click(otra.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fallo).toHaveBeenCalled());
    await waitFor(async () => expect(await repo.leerHistorial(archivo.replace('.md', '-2.md'))).toBeNull());
    // El formulario sigue abierto para volver a intentarlo (el aviso de fallo va a la cola de avisos).
    expect(otra.getByLabelText('Respuesta que obtuviste')).toBeTruthy();
    expect(otra.getByText('Resultados (1)')).toBeTruthy();
    fallo.mockRestore();

    // En la papelera (la pantalla dice que no se edita), los resultados se ven pero no se añaden.
    otra.rerender(montar(leido.valor as typeof el, false));
    expect(await otra.findByText('Resultados (1)')).toBeTruthy();
    expect(otra.queryByRole('button', { name: 'Añadir resultado' })).toBeNull();
  });
});

describe('vista de Error', () => {
  it('fechas: del mismo mes, «el 2 y el 15 de octubre»; de meses distintos, cada una con su mes', async () => {
    const { textos } = await import('./error/textos');
    const ahora = new Date('2026-10-18T12:00:00+02:00');
    const t = (idioma: 'es' | 'en') =>
      textos.t.bind(textos, idioma) as unknown as (c: string, v?: Record<string, string | number>) => string;
    const mismas = ['2026-10-02T10:00:00+02:00', '2026-10-09T10:00:00+02:00', '2026-10-15T10:00:00+02:00'];
    expect(listaDeFechas(mismas, 'es', t('es'), ahora)).toBe('el 2, el 9 y el 15 de octubre');
    expect(listaDeFechas(mismas.slice(0, 2), 'en', t('en'), ahora)).toBe('on October 2 and 9');
    expect(listaDeFechas(['2026-09-28T10:00:00+02:00', '2026-10-02T10:00:00+02:00'], 'es', t('es'), ahora)).toBe(
      'el 28 sep y el 2 oct',
    );
    expect(listaDeFechas(['2025-10-02T10:00:00+02:00'], 'es', t('es'), ahora)).toBe('el 2 de octubre de 2025');
  });

  it('mensaje, «3.ª vez» con la nota, tus marcos, plegados y «Añadir cómo lo resolví»', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ProveedorAvisos } = await import('../ui/componentes');
    const texto = readFileSync(join(process.cwd(), 'fixtures/trazas/rust/01.txt'), 'utf8');
    const datos = analizarError(texto);
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-error',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const conHuella = (n: number, dia: number, cambios = {}) => {
      const base = elementoFalso(n, `${texto}\n${n}`, 'error');
      return {
        ...base,
        frontmatter: {
          ...base.frontmatter,
          tipo: 'error' as const,
          ref: `ERR-${String(n).padStart(4, '0')}` as const,
          creado: `2026-10-${String(dia).padStart(2, '0')}T10:00:00+02:00`,
          lector: { nombre: 'error', version: 1, resumen: { huella: datos.huella } },
          ...cambios,
        },
      };
    };
    const actual = conHuella(3, 17);
    const abierto: { repo: ReturnType<typeof useEspacioAbierto>['repositorio'] | null } = { repo: null };
    function Montaje({ el, editable }: { el: typeof actual; editable: boolean }) {
      const { repositorio } = useEspacioAbierto();
      abierto.repo = repositorio;
      return <VistaError el={el} datos={datos} editable={editable} />;
    }
    const montar = (el: typeof actual, editable = true, verHilo: (() => void) | null = null) => (
      <ProveedorEspacio dependencias={dependencias}>
        <ProveedorAvisos>
          <ContextoHilo.Provider value={verHilo}>
            <Montaje el={el} editable={editable} />
          </ContextoHilo.Provider>
        </ProveedorAvisos>
      </ProveedorEspacio>
    );
    const { rerender } = render(montar(actual));
    await waitFor(() => expect(abierto.repo).toBeTruthy());
    await act(async () => {
      await abierto.repo?.guardarElemento({ ...conHuella(1, 2), notas: '' });
      // La nota se fecha cuando se escribió (al resolverlo): su `modificado`.
      await abierto.repo?.guardarElemento({
        ...conHuella(2, 15, { estado: 'resuelto', modificado: '2026-10-15T18:00:00+02:00' }),
        notas: 'Pasa cuando la respuesta no trae content-length',
      });
      await abierto.repo?.guardarElemento(actual);
    });
    expect(await screen.findByText('3.ª vez')).toBeTruthy();
    // En la papelera no se ofrece escribir cómo se resolvió.
    rerender(montar(actual, false));
    expect(await screen.findByText('3.ª vez')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir cómo lo resolví' })).toBeNull();
    rerender(montar(actual));
    // Como la pantalla de referencia: «el 2 y el 15 de octubre».
    expect(screen.getByText('Ya te pasó el 2 y el 15 de octubre.')).toBeTruthy();
    expect(screen.getByText('El 15 oct escribiste: «Pasa cuando la respuesta no trae content-length»')).toBeTruthy();
    expect(screen.getByText('struo_gateway::stream::next_chunk')).toBeTruthy();
    expect(screen.getByText('Librerías y sistema (5 marcos)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir cómo lo resolví' }));
    fireEvent.change(screen.getByLabelText('Cómo lo resolviste'), { target: { value: 'Subí el timeout a 60 s' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(abierto.repo?.frontmatter('ERR-0003')?.estado).toBe('resuelto'));
    const leido = await abierto.repo?.leerElemento('ERR-0003');
    expect(leido?.ok && leido.valor.notas.startsWith('Subí el timeout a 60 s')).toBe(true);
    // Ya resuelto, enseña lo que se escribió y no ofrece añadirlo otra vez.
    if (!leido?.ok) throw new Error('sin leer');
    rerender(
      montar({ ...actual, frontmatter: { ...actual.frontmatter, estado: 'resuelto' }, notas: leido.valor.notas }),
    );
    expect(await screen.findByText('Lo resolviste así: «Subí el timeout a 60 s»')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir cómo lo resolví' })).toBeNull();
    // Con hilo, «Ver el hilo» junto al veredicto (como `SC.error`), también ya resuelto.
    const verHilo = vi.fn();
    rerender(
      montar(
        { ...actual, frontmatter: { ...actual.frontmatter, estado: 'resuelto' }, notas: leido.valor.notas },
        true,
        verHilo,
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el hilo' }));
    expect(verHilo).toHaveBeenCalledOnce();
  });
});
