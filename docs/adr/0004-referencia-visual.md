# ADR-0004 · Referencia visual: el CSS de las pantallas

- **Estado:** aceptada
- **Fecha:** 2026-10-18

## Contexto y problema

`rimor-diseno.md` dice que, si la guía y las pantallas no coinciden, manda la guía. El autor ha pedido después (2026-10-18) que la web sea **visualmente igual** a `Pantallas de Rimor.html`. Las dos fuentes coinciden en lo esencial (tokens, tipografía, componentes) y difieren en detalles de medida y en los iconos:

| Detalle | Guía | Pantallas |
|---|---|---|
| Iconos | `lucide-react` con trazo 1,8 | Juego propio de trazados en retícula de 24 px con trazo 1,8, extremos y uniones redondeados |
| Icono de tipo | círculo de 28 px | círculo de 30 px |
| Avatar de Rimor | círculo `--panel` de 20 px | círculo `--panel` de 22 px |
| Aviso efímero | píldora | rectángulo con radio 8 px |
| Símbolo | «Señal» | el antiguo (grieta en un cuadrado) |

## Decisión

- **Medidas, espaciados, radios, colores y composición: los del CSS final de las pantallas** (incluidas sus reglas «Estilo Instrumento», que sobrescriben las anteriores). Se porta a `src/ui/tema/base.css` y `src/ui/componentes/componentes.css` con los mismos nombres de clase (`.card`, `.msg`, `.rimor`, `.cbox`…), para poder comparar regla a regla.
- **Iconos: los trazados de las pantallas**, en un componente `Icono` propio. Es el mismo estilo que pide la guía (retícula de 24 px, trazo 1,8, `currentColor`), da exactamente el dibujo de las pantallas y ahorra la dependencia. Los que falten se dibujan con la misma retícula.
- **Símbolo: «Señal»** (manda el paquete de marca; las pantallas aún llevan el antiguo).
- **Reglas de la guía que no son medidas** (un solo naranja, nada solo por color, foco visible, movimiento reducido, `--faint` solo sobre `--panel`…) siguen mandando.

## Consecuencias

- Fidelidad visual comprobable comparando el CSS de cada componente con el de las pantallas.
- Se aparta de la guía en `lucide-react`; se anota en las desviaciones del seguimiento.
