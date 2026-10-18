import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIMITE_BUCLE_MS, MINIMO_VISIBLE_MS, UMBRAL_ESPERA_MS } from './estadosSenal';
import { Senal } from './Senal';
import { useEsperaVisible } from './useEsperaVisible';

afterEach(() => vi.useRealTimers());

describe('Senal', () => {
  it('es un estado anunciado con su texto al lado y la clase de su estado', () => {
    render(<Senal estado="indexando" etiqueta="Indexando 4.210 de 10.000" />);
    const zona = screen.getByRole('status');
    expect(zona.getAttribute('aria-live')).toBe('polite');
    expect(zona.className).toBe('senal senal-indexando');
    expect(zona.textContent).toBe('Indexando 4.210 de 10.000');
    expect(zona.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('en bucle se detiene en el reposo a los 20 s', () => {
    vi.useFakeTimers();
    render(<Senal estado="cargando" etiqueta="Cargando" />);
    const zona = screen.getByRole('status');
    expect(zona.style.getPropertyValue('--senal-veces')).toBe('infinite');
    act(() => vi.advanceTimersByTime(LIMITE_BUCLE_MS));
    expect(zona.className).toContain('reposo');
  });

  it('una vez se detiene en la fracción del ciclo de su reposo', () => {
    render(<Senal estado="copia-al-dia" etiqueta="Copia al día" />);
    expect(screen.getByRole('status').style.getPropertyValue('--senal-veces')).toBe('0.88');
  });

  it('con texto oculto, el texto queda solo para el lector de pantalla', () => {
    render(<Senal estado="contestando" etiqueta="Leyendo…" textoOculto />);
    expect(screen.getByText('Leyendo…').className).toBe('solo-lector');
  });

  it('arranque y primer uso dibujan el nombre en un lienzo ancho', () => {
    const { container } = render(
      <Senal estado="primer-uso" etiqueta="Bienvenida" frase="del rumor a la conclusión" tamano={48} />,
    );
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 156 48');
    expect(container.querySelector('.nombre')?.textContent).toBe('Rimor');
    expect(container.querySelector('.frase')?.textContent).toBe('del rumor a la conclusión');
  });
});

describe('useEsperaVisible', () => {
  it('una espera de 300 ms no muestra nada', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ activo }) => useEsperaVisible(activo), {
      initialProps: { activo: true },
    });
    act(() => vi.advanceTimersByTime(300));
    rerender({ activo: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it('una de 450 ms se ve al menos 600 ms', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ activo }) => useEsperaVisible(activo), {
      initialProps: { activo: true },
    });
    act(() => vi.advanceTimersByTime(UMBRAL_ESPERA_MS));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(50));
    rerender({ activo: false });
    act(() => vi.advanceTimersByTime(MINIMO_VISIBLE_MS - 100));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(false);
  });
});

describe('Senal decorativa y esperas', () => {
  it('decorativa: sin rol ni texto, oculta al lector (el contenedor ya lo anuncia)', async () => {
    const { container } = render(<Senal estado="error" veces={1} decorativa etiqueta="" />);
    const zona = container.querySelector('.senal');
    expect(zona?.getAttribute('role')).toBeNull();
    expect(zona?.getAttribute('aria-hidden')).toBe('true');
    expect(zona?.textContent).toBe('');
  });

  it('ErrorTarjeta lleva la señal de error y Cargando indeterminado la de cargando', async () => {
    const { Cargando, ErrorTarjeta } = await import('../componentes/Estados');
    const { container } = render(
      <>
        <ErrorTarjeta titulo="No se pudo leer el ZIP">Exporta de nuevo.</ErrorTarjeta>
        <Cargando texto="DuckDB" />
      </>,
    );
    expect(container.querySelector('.card.error .senal-error')).toBeTruthy();
    expect(screen.getByRole('status').className).toContain('senal-cargando');
  });

  it('veces={1} en un estado de bucle acaba en su reposo (sin congelar el último fotograma)', () => {
    render(<Senal estado="cargando" veces={1} etiqueta="Cargando" />);
    expect(screen.getByRole('status').style.getPropertyValue('--senal-relleno')).toBe('none');
  });

  it('Espera dentro de ProveedorEsperas se mantiene hasta los 600 ms aunque se desmonte', async () => {
    vi.useFakeTimers();
    const { Espera, ProveedorEsperas } = await import('../componentes/Estados');
    const { rerender } = render(
      <ProveedorEsperas>
        <Espera texto="Abriendo" />
      </ProveedorEsperas>,
    );
    act(() => vi.advanceTimersByTime(UMBRAL_ESPERA_MS + 50));
    expect(screen.getByText('Abriendo')).toBeTruthy();
    rerender(<ProveedorEsperas>{null}</ProveedorEsperas>);
    // Se vio desde los 400 ms y se desmontó a los 450: sigue hasta cumplir 600 ms visible (a los 1000).
    expect(screen.getByText('Abriendo')).toBeTruthy();
    act(() => vi.advanceTimersByTime(MINIMO_VISIBLE_MS - 100));
    expect(screen.getByText('Abriendo')).toBeTruthy();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByText('Abriendo')).toBeNull();
  });

  it('Espera no aparece antes de 400 ms', async () => {
    vi.useFakeTimers();
    const { Espera } = await import('../componentes/Estados');
    render(<Espera texto="Abriendo" />);
    expect(screen.queryByText('Abriendo')).toBeNull();
    act(() => vi.advanceTimersByTime(UMBRAL_ESPERA_MS));
    expect(screen.getByText('Abriendo')).toBeTruthy();
  });
});
