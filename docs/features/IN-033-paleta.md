# IN-033 · Paleta de comandos

## Objetivo y catálogo

Hacerlo todo desde el teclado: `Ctrl+K` abre una paleta que mezcla las acciones de la pantalla y las globales, los elementos (con el buscador) y las colecciones; se navega con flechas y Enter, y lo último que se usó sale primero. Catálogo: **BUS-03** (paleta de comandos). Depende de IN-032 (búsqueda) e IN-008 (carcasa y atajos).

## Estado de partida

- La carcasa tiene un `GestorAtajos` (IN-008) con ámbitos (`global` y uno por pantalla), descripción traducida y acción; `?` abre la ayuda con todos los atajos activos. Inicio (feed) y la pantalla del elemento registran los suyos con `useAtajos`.
- El Anexo H fija `Ctrl+K` para la paleta. El motor de búsqueda (IN-032) devuelve elementos con su ranking.
- La referencia no dibuja la paleta: se compone con lo que ya hay (diálogo `card`, la caja de Buscar y las filas `it`).

## Diseño

### Las acciones son los atajos (`src/ui/atajos/atajos.ts`)

- Un `Atajo` pasa a tener `teclas` opcional: sin teclas, es una acción que solo se lanza desde la paleta. Así hay **un solo registro** por pantalla (`useAtajos`), la ayuda de `?` sigue listando solo los que tienen teclas y la paleta lista los que tienen sentido fuera de su tecla.
- `enPaleta: false` deja fuera los de mover la selección o confirmar (`j`, `k`, `Enter`, `Esc`); `cuando` también vale para la paleta: lo que ahora no se puede hacer no se ofrece (las del feed, sin un mensaje seleccionado).
- Globales nuevas, sin tecla: ir a Ajustes, Papelera y Datos y copias. Con tecla, las de siempre (Buscar, Ir a Inicio, la ayuda, el compositor) más `Ctrl+K`.

### La lógica (`src/ui/paleta/paleta.ts`, TS puro)

- Una **entrada**: id estable, grupo (`accion`, `coleccion`, `elemento`, `buscar`), título, detalle (la ref, el tipo) y las teclas si las tiene.
- **Puntuación** sin acentos ni mayúsculas: empieza igual > empieza una palabra > contiene > las letras en orden (`gb` → «Ir a Buscar»); nada, fuera.
- **Orden**: sin texto, primero las **recientes** (las últimas usadas, como mucho 5, en el orden en que se usaron) y después las acciones de la pantalla, las globales y las colecciones. Con texto, por puntuación (una reciente gana a igualdad) y, debajo, los elementos del buscador y «Buscar «texto»» al final.
- **Recientes**: los ids de las últimas entradas usadas en `localStorage` (es una comodidad de este navegador; si no se puede leer o escribir, la paleta funciona igual).

### La paleta (`src/ui/paleta/Paleta.tsx`)

- Un `dialog` modal arriba (como un buscador), con la caja de Buscar (icono y campo en mono) y debajo la lista: filas `it` con su icono, título (lo que casa, resaltado), detalle y las teclas con `Kbd`; grupos con su etiqueta `lbl` («Acciones», «Colecciones», «Elementos»).
- Teclado: flechas (dan la vuelta), Inicio y Fin, Enter ejecuta, Esc o `Ctrl+K` cierra. Patrón de accesibilidad *combobox* con `aria-activedescendant`. El ratón también elige.
- Ejecutar: cierra la paleta, apunta la entrada como reciente y lanza su acción (un elemento se abre; una colección, su pantalla; «Buscar» lleva a Buscar con el texto).
- Los elementos llegan del motor (como mucho 6) con la última consulta: la de una tecla vieja que llega tarde se descarta.

## Tareas

- [ ] `Ctrl+K` con acciones registradas por pantalla (las de los atajos y las que solo están en la paleta).
- [ ] Elementos (vía búsqueda) y colecciones.
- [ ] Navegación con teclado.
- [ ] Últimas acciones primero.

## Pruebas previstas

- Gestor: atajos sin tecla (no se disparan con teclas, la ayuda no los lista), `enPaleta` y `cuando`.
- Lógica: puntuación, orden con y sin texto, recientes (también con `localStorage` roto).
- Paleta: `Ctrl+K` la abre (también desde un campo) y la cierra, flechas con vuelta, Enter ejecuta una acción de la pantalla, abre un elemento encontrado y una colección, «Buscar …», recientes primero al volver a abrirla, sin resultados.

## Criterios de aceptación

- `pnpm verificar` en verde; todo lo de la paleta se puede hacer sin ratón.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Dos registros (atajos y acciones) se desincronizarían | Uno solo: una acción es un atajo, con teclas o sin ellas. |
| La referencia no tiene la paleta | Se compone con piezas de la referencia (diálogo, caja de Buscar, filas `it`, `lbl`, `kbd`). |
| Recientes que ya no existen (una colección borrada, otra pantalla) | Se guardan ids; solo se enseñan los que están entre las entradas de ahora. |
| `Ctrl+K` dentro de un campo | Se atiende también en los campos (como el compositor), porque lleva modificador. |

## Autorrevisión

Cubre las cuatro tareas de IN-033. Reutiliza el gestor de atajos, el motor de IN-032 (`useBuscar`), el resaltado y los componentes de la referencia; textos por i18n; sin dependencias nuevas.
