// IndexedDB en memoria para la caché del espacio; sin Worker, el almacén cae a memoria.
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('arranca y muestra el raíl', async () => {
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Rimor' }, { timeout: 5000 })).toBeTruthy();
  });
});
