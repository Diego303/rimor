import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChipTipo } from '../ui/componentes/Marcas';
import { cambiarIdioma } from './i18n';

describe('useT', () => {
  afterEach(() => cambiarIdioma('es'));

  it('vuelve a pintar los textos al cambiar de idioma', () => {
    render(<ChipTipo tipo="hilo" />);
    expect(screen.getByText('Hilo')).toBeTruthy();
    act(() => cambiarIdioma('en'));
    expect(screen.getByText('Thread')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
  });
});
