import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LimiteErrores } from './LimiteErrores';

function Falla({ fallar }: { fallar: { si: boolean } }) {
  if (fallar.si) throw new Error('roto');
  return <p>bien</p>;
}

describe('LimiteErrores', () => {
  it('muestra ErrorTarjeta sin tumbar lo de fuera y permite reintentar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallar = { si: true };
    render(
      <div>
        <nav>raíl</nav>
        <LimiteErrores clave="/">
          <Falla fallar={fallar} />
        </LimiteErrores>
      </div>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Esta pantalla ha fallado');
    expect(screen.getByText('raíl')).toBeTruthy();
    fallar.si = false;
    fireEvent.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(screen.getByText('bien')).toBeTruthy();
  });
});
