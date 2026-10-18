import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('arranca y muestra el raíl', async () => {
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Rimor' })).toBeTruthy();
  });
});
