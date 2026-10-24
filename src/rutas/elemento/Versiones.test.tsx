import { type Elemento, hashOriginal, isoConZona } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { VersionGuardada } from '../../almacen/repositorio';
import { useCompositor } from '../../captura/compositor';
import { crearCapturador } from '../../captura/flujo';
import { tituloDePrompt } from '../../lectores/prompt/lector';
import { REGISTRO } from '../../lectores/registro';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { haceMinutos } from '../../pruebas/fechas';
import { construirContexto } from '../../respuestas/contexto';
import { versionesParaVer } from './Versiones';

const PREFIJO = { prompt: 'PRM', markdown: 'DOC-MD' } as const;

function capturado(n: number, tipo: 'prompt' | 'markdown', original: string, titulo: string): Elemento {
  const creado = isoConZona(haceMinutos(60));
  return {
    frontmatter: {
      id: `01JAB4C2Q2X8M5N7P0R4S6T8${String(n).padStart(2, '0')}`,
      ref: `${PREFIJO[tipo]}-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      tipo,
      titulo,
      creado,
      modificado: creado,
      origen: 'pegado',
      hash: hashOriginal(original),
      ocultados: 0,
      lector: { nombre: tipo, version: 1, resumen: {} },
    },
    notas: '',
    original,
  };
}

const V1 = 'Eres un revisor de ADR.\nSeñala riesgos y alternativas.\nADR: {{adr}}';
const V2 = 'Eres un revisor de ADR.\nSeñala riesgos, alternativas y consecuencias.\nADR: {{adr}}';
const dialogoDe = (titulo: RegExp) =>
  within(screen.getByRole('heading', { name: titulo }).closest('dialog') as HTMLElement);
const sin = (s: string | null | undefined) => (s ?? '').replaceAll('\u00a0', ' ');

describe('Versiones en la pantalla', () => {
  beforeAll(async () => {
    await import('./Elemento');
    await import('../inicio/Inicio');
    await import('../ajustes/Ajustes');
    await import('../../lectores/prompt/Vista');
    await import('../../lectores/markdown/Vista');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    useCompositor.setState({ versiones: [], busquedas: [] });
  });

  it('prompt: meta, cambios de la 1 a la 2, la lista, restaurar y una edición que deja copia', async () => {
    const { espacio, router } = await montarApp('/ajustes', [capturado(12, 'prompt', V1, 'Revisor de ADR')]);
    await act(async () => {
      await espacio.repositorio.guardarConHistorial(
        'PRM-0012',
        (el) => ({ ...el, original: V2, frontmatter: { ...el.frontmatter, hash: hashOriginal(V2) } }),
        'version',
      );
    });
    // Las versiones anteriores llegan también al contexto de la respuesta de Rimor.
    const leido = await espacio.repositorio.leerElemento('PRM-0012');
    if (!leido.ok) throw new Error('sin leer');
    expect((await construirContexto(leido.valor, espacio.repositorio, 'es')).versiones).toHaveLength(1);

    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'PRM-0012' } }));
    expect(await screen.findByText('Cambios de la versión 1 a la 2', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(sin(document.querySelector('.ah .meta')?.textContent)).toMatch(/^Versión 2, pegada hoy a las \d\d:\d\d/);
    const cambios = screen.getByText('Cambios de la versión 1 a la 2').closest('details') as HTMLElement;
    expect([...cambios.querySelectorAll('.diff .a')].map((d) => d.textContent)).toEqual([
      '+ Señala riesgos, alternativas y consecuencias.',
    ]);
    expect([...cambios.querySelectorAll('.diff .r')].map((d) => d.textContent)).toEqual([
      '− Señala riesgos y alternativas.',
    ]);
    expect(await screen.findByText('Versiones', { selector: 'summary' }, ESCRITURA)).toBeTruthy();
    // Los metadatos («Detalles») son el último plegado (guía §8.2): las versiones, justo antes.
    await screen.findByText('Detalles', { selector: 'summary' }, ESCRITURA);
    const plegados = [...document.querySelectorAll('details.more > summary')].map((s) => s.textContent);
    expect(plegados.slice(-3)).toEqual(['Cambios de la versión 1 a la 2', 'Versiones', 'Detalles']);

    // «v1 · v2 · actual» en la cabecera (como `SC.prompt`): la v1 se ve sin restaurarla, y se vuelve a la actual.
    const texto = () => document.querySelector('pre.prompt-texto')?.textContent;
    const tokens = () => screen.getByText('Tokens (aprox.)').nextElementSibling?.querySelector('.mono')?.textContent;
    expect(texto()).toBe(V2);
    const tokensV2 = tokens();
    fireEvent.click(screen.getByRole('button', { name: 'v1' }));
    expect(texto()).toBe(V1);
    // Sus detalles son los de la v1 (más corta).
    expect(Number(tokens())).toBeLessThan(Number(tokensV2));
    expect(screen.getByRole('button', { name: 'v1' }).getAttribute('aria-pressed')).toBe('true');
    expect(espacio.repositorio.frontmatter('PRM-0012')?.version).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'v2 · actual' }));
    expect(texto()).toBe(V2);

    // Ver cambios de la v1 hasta ahora (con la lista abierta, como se haría).
    fireEvent.click(screen.getByText('Versiones', { selector: 'summary' }));
    fireEvent.click(screen.getByText('Cambios de la versión 1 a la 2', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver los cambios desde v1' }));
    expect(dialogoDe(/Cambios desde v1 hasta ahora/).getAllByText(/Señala riesgos/).length).toBe(2);
    fireEvent.click(dialogoDe(/Cambios desde v1 hasta ahora/).getByRole('button', { name: 'Cerrar' }));

    // Restaurar la v1: con confirmación; vuelve su texto como versión 3 y lo de ahora queda en el historial.
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar v1' }));
    fireEvent.click(dialogoDe(/¿Restaurar v1\?/).getByRole('button', { name: 'Restaurar esta versión' }));
    // La señal «guardado» se ve en la lista, abierta aunque se vuelva a montar al recalcular la vista.
    await waitFor(() => expect(document.querySelector('.senal-guardado')).toBeTruthy(), ESCRITURA);
    expect(document.querySelector('.senal-guardado')?.closest('details')?.open).toBe(true);
    // Los cambios, también abiertos como estaban (ahora de la 2 a la 3).
    expect(
      (await screen.findByText(/^Cambios de la versión 2 a la 3/, { selector: 'summary' }, ESCRITURA)).closest(
        'details',
      )?.open,
    ).toBe(true);
    await waitFor(() => expect(espacio.repositorio.frontmatter('PRM-0012')?.version).toBe(3), ESCRITURA);
    const restaurado = await espacio.repositorio.leerElemento('PRM-0012');
    expect(restaurado.ok && restaurado.valor.original).toBe(V1);
    expect((await screen.findAllByText('Restaurada como versión 3', {}, ESCRITURA)).length).toBeGreaterThan(0);
    await waitFor(async () => expect(await espacio.repositorio.versiones('PRM-0012')).toHaveLength(2), ESCRITURA);

    // Una nota nueva es una edición: deja copia con la misma versión.
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir una nota' }));
    const campo = screen.getByRole('textbox', { name: 'Tus notas' });
    fireEvent.change(campo, { target: { value: 'Mejor la v1.' } });
    fireEvent.keyDown(campo, { key: 'Enter', ctrlKey: true });
    await waitFor(async () => {
      const lista = await espacio.repositorio.versiones('PRM-0012');
      expect(lista.map((v) => [v.version, v.motivo])).toEqual([
        [3, 'edicion'],
        [2, 'restaurar'],
        [1, 'version'],
      ]);
    }, ESCRITURA);
    expect(espacio.repositorio.frontmatter('PRM-0012')?.version).toBe(3);
  }, 60_000);

  it('Markdown: el índice marca lo añadido, lo modificado y lo eliminado, con el resumen', async () => {
    const v1 = `# Plan del gateway

## 1. Objetivo
Reenviar los fragmentos.

## 2. Cliente HTTP
- [x] Elegir cliente
- [ ] Medir 64 KB

## 4. Dependencias
- reqwest

## 6. Fallback con curl
Si todo falla.
`;
    const v2 = `# Plan del gateway

## 1. Objetivo
Reenviar los fragmentos.

## 2. Cliente HTTP
- [x] Elegir cliente
- [x] Medir 64 KB

## 3. Streaming
- [ ] Leer la respuesta como flujo

## 4. Dependencias
- reqwest
- ureq
`;
    const { espacio, router } = await montarApp('/ajustes', [capturado(4, 'markdown', v1, 'Plan del gateway')]);
    await act(async () => {
      await espacio.repositorio.guardarConHistorial(
        'DOC-MD-0004',
        (el) => ({ ...el, original: v2, frontmatter: { ...el.frontmatter, hash: hashOriginal(v2) } }),
        'version',
      );
    });
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'DOC-MD-0004' } }));
    expect(
      await screen.findByText(
        'Desde la versión 1: 1 sección añadida, 1 modificada, 1 eliminada y 1 tarea marcada.',
        {},
        PRIMERA_CARGA,
      ),
    ).toBeTruthy();
    const marcas = (texto: string) =>
      [...document.querySelectorAll('.lista-secciones .st')].filter((s) => s.textContent === texto).length;
    expect(marcas('añadida')).toBe(1);
    expect(marcas('modificada')).toBe(1);
    expect(marcas('eliminada')).toBe(1);
    expect(screen.getByText('6. Fallback con curl').className).toContain('seccion-eliminada');
  }, 60_000);

  it('Inicio: la versión capturada es un mensaje; «Guardar aparte» la deshace y crea otro elemento', async () => {
    // Con el título que le daría el lector (así es «el mismo título» que la captura nueva).
    const titulo = tituloDePrompt(V1);
    const { espacio } = await montarApp('/', [capturado(12, 'prompt', V1, titulo)]);
    await screen.findByRole('button', { name: titulo }, PRIMERA_CARGA);
    const capturador = crearCapturador({ repositorio: espacio.repositorio, registro: REGISTRO });
    await act(async () => {
      const r = await capturador.capturar({ texto: V2, origen: 'pegado', tipo: 'prompt' });
      if (!r.ok || r.valor.tipo !== 'version') throw new Error('esperaba una versión');
      useCompositor.getState().anotarVersion({ ...r.valor, en: isoConZona(new Date()) });
    });
    expect(await screen.findByText('Lo he guardado como su versión 2.', {}, ESCRITURA)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar aparte' }));
    await waitFor(() => expect(espacio.repositorio.elementos()).toHaveLength(2), ESCRITURA);
    const anterior = await espacio.repositorio.leerElemento('PRM-0012');
    expect(anterior.ok && anterior.valor.original).toBe(V1);
    expect(espacio.repositorio.frontmatter('PRM-0013')?.tipo).toBe('prompt');
    await waitFor(() => expect(screen.queryByText('Lo he guardado como su versión 2.')).toBeNull());
  }, 60_000);
});

describe('versionesParaVer', () => {
  const copia = (version: number, reemplazado: string, original: string | null = `v${version}`) =>
    ({
      ruta: `h/${version}-${reemplazado}`,
      version,
      reemplazado,
      motivo: 'version',
      elemento: { frontmatter: {}, original, notas: '' },
    }) as unknown as VersionGuardada;

  it('una por número (la última copia), solo las anteriores a la actual, las tres más recientes en orden', () => {
    const lista = [
      copia(1, '2026-10-01T10:00:00+02:00', 'primera'),
      copia(1, '2026-10-02T10:00:00+02:00', 'primera editada'),
      copia(2, '2026-10-03T10:00:00+02:00'),
      copia(3, '2026-10-04T10:00:00+02:00'),
      copia(4, '2026-10-05T10:00:00+02:00'),
      copia(5, '2026-10-06T10:00:00+02:00', null),
      copia(6, '2026-10-07T10:00:00+02:00'),
    ];
    expect(versionesParaVer(lista, 6).map((v) => v.version)).toEqual([2, 3, 4]);
    expect(versionesParaVer(lista, 3).map((v) => [v.version, v.elemento.original])).toEqual([
      [1, 'primera editada'],
      [2, 'v2'],
    ]);
  });
});
