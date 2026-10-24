/**
 * La pantalla del elemento ofrece a la vista de su lector abrir el hilo del elemento, si tiene: Error pone «Ver el
 * hilo» junto a su veredicto y Log, «Ver su hilo» junto a «Comparar con otro log» (como `SC.error` y `SC.log`).
 */
import { createContext } from 'react';

export const ContextoHilo = createContext<(() => void) | null>(null);
