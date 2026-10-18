import 'fake-indexeddb/auto';
import type { Elemento } from '@rimor/formato';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { escribirTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { RUTA_AJUSTES } from '../espacio/ajustes';
import { type DependenciasProveedor, ProveedorEspacio } from '../espacio/Espacio';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { ProveedorLectores } from '../lectores/Lectores';
import { elementoFalso, lectorFalso } from '../lectores/pruebas/falsos';
import { crearRegistro } from '../lectores/registro';
import { RespuestaRimor } from './RespuestaRimor';
import { useRespuesta } from './useRespuesta';

describe('RespuestaRimor', () => {
  it('pinta cada fragmento y la ref pulsable', () => {
    const alAbrir = vi.fn();
    const { container } = render(
      <RespuestaRimor
        alAbrir={alAbrir}
        respuesta={{
          texto: [
            { t: 'texto', v: 'Es la ' },
            { t: 'fuerte', v: 'tercera vez' },
            { t: 'texto', v: ': ' },
            { t: 'cifra', v: '16' },
            { t: 'texto', v: ' errores, como en ' },
            { t: 'ref', ref: 'ERR-0015' },
            { t: 'texto', v: '. Escribiste: ' },
            { t: 'cita', v: 'Pasa cuando…', fecha: '2026-10-15T10:00:00+02:00' },
            { t: 'mono', v: ' pool' },
          ],
        }}
      />,
    );
    expect(container.querySelector('.rimor .av svg.simbolo.mono')).toBeTruthy();
    expect(container.querySelector('b')?.textContent).toBe('tercera vez');
    expect(container.querySelector('b.dato')?.textContent).toBe('16');
    expect(container.querySelector('q')?.textContent).toBe('Pasa cuando…');
    expect(container.querySelector('p span.mono')?.textContent).toBe(' pool');
    fireEvent.click(screen.getByRole('button', { name: 'ERR-0015' }));
    expect(alAbrir).toHaveBeenCalledWith('ERR-0015');
  });

  it('mientras se compone: «contestando» y «Leyendo…»', () => {
    const { container } = render(<RespuestaRimor respuesta={null} />);
    expect(container.querySelector('.senal-contestando')).toBeTruthy();
    expect(container.querySelector('p')?.textContent).toBe('Leyendo…');
  });
});

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };

function Prueba({ el, derivados }: { el: Elemento; derivados?: Promise<unknown> }) {
  const r = useRespuesta(el, derivados ? { derivados } : {});
  if (r === 'desactivada') return <p>desactivada</p>;
  return <RespuestaRimor respuesta={r} />;
}

async function montar(el: Elemento, ajustes?: string, derivados?: Promise<unknown>) {
  const almacen = new AlmacenMemoria();
  if (ajustes) await escribirTexto(almacen, RUTA_AJUSTES, ajustes);
  const registro = crearRegistro([
    lectorFalso({ respuesta: (_e, d) => ({ texto: [{ t: 'texto', v: `Largo ${d.largo}.` }] }) }),
  ]);
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: 'respuestas',
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos,
    canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
    enMemoria: false,
  });
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={registro} ejecutar={ejecutorEnHilo(registro)}>
        <Prueba el={el} {...(derivados ? { derivados } : {})} />
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
}

describe('useRespuesta', () => {
  it('compone con los derivados y la frase de secretos', async () => {
    const el = elementoFalso(1, 'abcd');
    await montar({ ...el, frontmatter: { ...el.frontmatter, ocultados: 2 } });
    expect(await screen.findByText('Largo 4. He ocultado 2 secretos antes de guardar.')).toBeTruthy();
  });

  it('si los derivados fallan, una respuesta honesta sin datos', async () => {
    const fallo = Promise.reject(new Error('roto'));
    fallo.catch(() => undefined);
    await montar(elementoFalso(2), undefined, fallo);
    expect(await screen.findByText('Guardado como Texto. No pude analizarlo: se ve el original.')).toBeTruthy();
  });

  it('con las respuestas de su tipo desactivadas (D14), nada', async () => {
    await montar(elementoFalso(3), '{"respuestas":{"desactivadas":["texto"]}}');
    expect(await screen.findByText('desactivada')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('.rimor')).toBeNull());
  });
});
