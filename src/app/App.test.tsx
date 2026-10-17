import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('arranca y muestra el raíl', () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeTruthy();
  });
});
