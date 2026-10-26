import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { elementoFalso } from '../pruebas/falsos';
import { lectorHttp } from './lector';
import VistaHttp from './Vista';

const CURL = `curl -X POST 'https://api.example.org/v1/pagos?page=2' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Request-Id: 42' \\
  -d '{"importe":1250,"moneda":"EUR"}' -L | jq .id`;

async function montar(texto: string) {
  const el = elementoFalso(1, texto, 'http');
  const datos = await lectorHttp.derivar(el);
  return render(<VistaHttp el={el} datos={datos} editable />);
}

describe('vista de una petición HTTP', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('método y URL; consulta, cabeceras y cuerpo en tablas; opciones y lo de después', async () => {
    const { container } = await montar(CURL);
    expect(container.querySelector('.st.acc')?.textContent).toBe('POST');
    expect(container.querySelector('.url-http')?.textContent).toBe('https://api.example.org/v1/pagos?page=2');
    const tabla = (titulo: string) =>
      [...(screen.getByRole('heading', { name: titulo }).closest('section')?.querySelectorAll('tbody tr') ?? [])].map(
        (f) => [...f.querySelectorAll('td')].map((c) => c.textContent),
      );
    expect(tabla('Consulta')).toEqual([['page', '2']]);
    expect(tabla('Cabeceras')).toEqual([
      ['Content-Type', 'application/json'],
      ['X-Request-Id', '42'],
    ]);
    expect(
      within(screen.getByRole('heading', { name: 'Cuerpo' }).closest('section') as HTMLElement).getByText(
        /"importe": 1250/,
      ),
    ).toBeTruthy();
    expect(screen.getByText('-L')).toBeTruthy();
    expect(screen.getByText('| jq .id')).toBeTruthy();
  });

  it('copiar como cURL y como fetch', async () => {
    const escribir = vi.fn(async (_texto: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
    await montar(CURL);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar como cURL' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledTimes(1));
    expect(escribir.mock.calls[0]?.[0]).toMatch(/^curl 'https:\/\/api\.example\.org\/v1\/pagos\?page=2' \\\n/);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar como fetch' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledTimes(2));
    expect(escribir.mock.calls[1]?.[0]).toContain('await fetch("https://api.example.org/v1/pagos?page=2", {');
  });

  it('un original que ya no es un curl: el aviso y el texto tal cual', async () => {
    await montar('esto no es un curl');
    expect(
      screen.getByText('Este texto no se lee como una petición curl. Puedes corregirlo o cambiarle el tipo.'),
    ).toBeTruthy();
  });
});

describe('capturar un curl', () => {
  beforeAll(async () => {
    await import('../../rutas/inicio/Inicio');
  }, 120_000);
  afterEach(async () => {
    cleanup();
    useCompositor.setState({ texto: '' });
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('se guarda como petición, con su token oculto, y Rimor dice qué es', async () => {
    const { espacio } = await montarApp('/');
    const caja = await screen.findByRole('textbox', { name: 'Capturar' }, PRIMERA_CARGA);
    const token = `ghp_${'a1B2c3D4e5'.repeat(4)}`;
    act(() =>
      useCompositor.getState().setTexto(`curl -H 'Authorization: Bearer ${token}' https://api.github.com/user`),
    );
    fireEvent.keyDown(caja, { key: 'Enter' });
    await waitFor(() => expect(espacio.repositorio.elementos()[0]?.lector.nombre).toBe('http'), ESCRITURA);
    const fm = espacio.repositorio.elementos()[0];
    const leido = fm ? await espacio.repositorio.leerElemento(fm.id) : null;
    expect(leido?.ok && leido.valor.original).not.toContain(token);
    await waitFor(
      () =>
        expect(document.querySelector('.rimor p')?.textContent).toBe(
          'GET a api.github.com/user con 1 cabecera. He ocultado un secreto antes de guardar.',
        ),
      { timeout: 20_000 },
    );
  }, 40_000);
});
