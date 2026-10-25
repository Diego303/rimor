import { type Elemento, isoConZona } from '@rimor/formato';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { elementoFalso } from '../pruebas/falsos';
import { analizarComando } from './analisis';
import TarjetaComando from './Tarjeta';
import VistaComando from './Vista';

const COMANDO = 'cargo bench --bench http -- --save-baseline {{baseline}}';

function comando(n: number, texto: string): Elemento {
  const base = elementoFalso(n, texto, 'comando');
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo: 'comando',
      ref: `CMD-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      titulo: texto,
      lector: { nombre: 'comando', version: 1, resumen: { programa: 'cargo', huecos: 1 } },
    },
  };
}

describe('vista de Comando', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('la chuleta con el hueco resaltado y copiar con valores', async () => {
    const escribir = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escribir } });
    const { container } = render(<VistaComando el={comando(9, COMANDO)} datos={analizarComando(COMANDO)} />);
    expect(container.querySelector('pre.comando-texto .var')?.textContent).toBe('{{baseline}}');
    // El `$` no se lee ni se copia.
    expect(container.querySelector('.prompt-comando')?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.change(screen.getByLabelText('{{baseline}}'), { target: { value: 'antes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('cargo bench --bench http -- --save-baseline antes'));
    // El valor se recuerda en este navegador para este comando.
    cleanup();
    render(<VistaComando el={comando(9, COMANDO)} datos={analizarComando(COMANDO)} />);
    expect((screen.getByLabelText('{{baseline}}') as HTMLInputElement).value).toBe('antes');
  });

  it('sin huecos, «Copiar» copia el comando tal cual', async () => {
    const escribir = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escribir } });
    const texto = '$ git log --oneline\n$ git status';
    render(<VistaComando el={comando(10, texto)} datos={analizarComando(texto)} />);
    expect(screen.queryByText('Copiar con valores')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('git log --oneline\ngit status'));
  });
});

describe('tarjeta y respaldo de «Copiar»', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('la tarjeta enseña los comandos del original, aunque el título se haya cambiado', () => {
    const el = comando(12, `$ ${COMANDO}\n$ cargo test`);
    el.frontmatter = { ...el.frontmatter, titulo: 'Benchmark del gateway' };
    const { container } = render(<TarjetaComando el={el} />);
    expect(container.textContent).toBe(`${COMANDO}\ncargo test\n`);
    expect(container.querySelector('.var')?.textContent).toBe('{{baseline}}');
  });

  it('sin huecos, si el navegador no deja copiar, el texto queda listo para Ctrl+C', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<VistaComando el={comando(13, 'git log --oneline')} datos={analizarComando('git log --oneline')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(((await screen.findByLabelText('Comando con los valores')) as HTMLTextAreaElement).value).toBe(
      'git log --oneline',
    );
  });
});

describe('Inicio: «Copiar con valores» de la respuesta', () => {
  beforeAll(async () => {
    await import('../../rutas/inicio/Inicio');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('lleva al elemento', async () => {
    const hoy = comando(11, COMANDO);
    hoy.frontmatter = { ...hoy.frontmatter, creado: isoConZona(new Date()) };
    const { router } = await montarApp('/', [hoy]);
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar con valores' }, PRIMERA_CARGA));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/CMD-0011'), ESCRITURA);
  }, 30_000);
});
