/**
 * La pantalla del elemento ofrece a la vista de su lector abrir «Comparar con…» (CMP-01): las vistas de Log y de
 * Mediciones ponen el botón si la hay (fuera de la pantalla, o sin poder escribir, no).
 */
import { createContext } from 'react';

export const ContextoComparar = createContext<(() => void) | null>(null);
