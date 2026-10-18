# IN-008 · Carcasa, navegación, atajos y diseño adaptable

## Objetivo y catálogo

La estructura de la app tal como la fija `rimor-diseno.md` §8. Catálogo: **APP-01** (atajos) y **APP-05** (diseño adaptable). Depende de IN-002, IN-003 y D6.

## Estado de partida

- IN-002: componentes base, `ProveedorAvisos`, `ErrorTarjeta`, `Rejilla`, `Piloto`, `IconoTipo`; CSS portado de las pantallas.
- IN-003: `useT`, catálogos `es` y `en`.
- IN-089: `Logotipo` (18 px en el raíl).
- `App.tsx` es un esqueleto con `nav.rail` y `main.amain`; `#/muestras` se resuelve a mano.
- Referencia: el raíl de las pantallas (`rail()` y el CSS de `.shell`, `.rail`, `.rb`, `.space`, `.amain`, `.col`), con la consulta de contenedor a 720 px.

## Diseño

### Router (D6, ADR-0002)

TanStack Router con `createHashHistory()` y rutas definidas en código (sin generador):

| Ruta | Pantalla | La completa |
|---|---|---|
| `/` | Inicio | IN-026 |
| `/e/$ref` | Elemento | IN-027 |
| `/hilo/$ref` | Hilo | IN-030 |
| `/buscar` (`?q=`) | Buscar | IN-032 |
| `/c/$coleccion` | Colección | IN-031 |
| `/datos` | Datos y copias | IN-037 |
| `/ajustes` | Ajustes | IN-038 |
| `/muestras` | Muestras (solo en desarrollo) | IN-002 |

Cada pantalla llega como `React.lazy` (carga diferida) y, mientras su IN no existe, muestra su título y un estado vacío que dice qué aparecerá.

### Carcasa

```
src/rutas/rutas.tsx          ← árbol de rutas, historial por hash, router
src/rutas/Carcasa.tsx        ← marco (contenedor «app»), raíl, área principal y proveedores
src/rutas/Rail.tsx           ← raíl: logotipo, Inicio (recuento sin clasificar), Buscar, colecciones, Ajustes y pie del espacio
src/rutas/carcasa.css        ← CSS de .shell, .rail, .rb, .space, .amain, .col de las pantallas
src/rutas/LimiteErrores.tsx  ← límite de errores por pantalla con ErrorTarjeta
src/rutas/Pantalla.tsx       ← columna de lectura (780 px) o ancha, con cabecera opcional
src/rutas/<pantalla>/        ← una carpeta por pantalla (inicio, elemento, hilo, buscar, coleccion, datos, ajustes)
src/estado/espacio.ts        ← store de Zustand con lo que pinta el raíl (nombre del espacio, recuento sin clasificar, colecciones, estado de la copia); lo llena IN-007
src/ui/atajos/atajos.ts      ← gestor de atajos (puro): registro global y por pantalla, secuencias «g + letra», sin conflicto con campos de texto
src/ui/atajos/useAtajos.ts   ← hook para registrar atajos de una pantalla
src/ui/atajos/AyudaAtajos.tsx← diálogo con «?»
```

**Medidas** (las del CSS de las pantallas): raíl de 212 px en `--panel` con borde derecho `--line`; botones `.rb` de 7 × 9 px, 13,5 px de letra, icono de 17 px; activo con `--accent-soft`, negrita y recuento en `--key-text`; pie `.space` con la rejilla de 38 px (`::before`), el nombre del espacio con su piloto y «Última copia…» en 12 px; área principal con 22 × 24 px de margen y columna de hasta 780 px (`.col`, `.col.wide` para las pantallas anchas).

**Pantalla completa:** la carcasa ocupa `100dvh`; el raíl no se desplaza y el área principal sí. El marco con borde y esquinas de las pantallas es el del documento de referencia, no de la app: no se dibuja.

**Por debajo de 720 px** (consulta de contenedor sobre el marco): el raíl pasa a barra inferior fija con Inicio y Buscar (y Métricas cuando exista, IN-059); se ocultan el logotipo, los títulos de sección, las colecciones y el pie; rejillas a una columna; márgenes de 16 × 14 px.

**Raíl en v0.1** (incoherencia 3): Inicio, Buscar, Colecciones y el pie del espacio (lleva a Datos y copias). Investigaciones y Documentos no se muestran hasta v0.3. Se añade **Ajustes** como último botón de la lista: las pantallas no lo dibujan, pero la ficha pide la ruta y debe poder alcanzarse sin teclado.

### Atajos (Anexo H)

```ts
interface Atajo { teclas: string; descripcion: Clave; accion: () => void; enCampos?: boolean }
// teclas: 'j', '?', '/', 'g h', 'ctrl+e', 'ctrl+shift+c', 'ctrl+shift+space'
class GestorAtajos {
  registrar(ambito: 'global' | string, atajos: Atajo[]): () => void;   // devuelve la baja
  pulsar(e: TeclaPulsada): boolean;                                    // true si la consumió
  lista(): { ambito: string; atajos: Atajo[] }[];                       // para la ayuda
}
```

- Las secuencias («g» y luego «h») esperan la segunda tecla 1 s.
- Con el foco en un campo de texto (`input`, `textarea`, `select`, `contenteditable`) solo se atienden atajos con `Ctrl`/`Meta` y los marcados `enCampos`.
- Un atajo de pantalla gana al global con las mismas teclas.
- Globales en v0.1: `/` (Buscar), `g h` (Inicio), `g b` (Buscar), `?` (ayuda). `Ctrl+E` lo conecta IN-035, `Ctrl+Shift+Espacio` IN-015 y `Ctrl+K` IN-033; `g m`, `g i` y `g d` llegan con Métricas, Investigaciones y Documentos.

### Avisos y errores

- `ProveedorAvisos` envuelve toda la carcasa (cola global).
- Cada pantalla va dentro de `LimiteErrores`: si falla al pintar, muestra `ErrorTarjeta` con «Esta pantalla ha fallado» y un botón para volver a intentarlo; el resto de la app sigue funcionando.

## Tareas

- [ ] Rutas con historial por hash y pantallas en carga diferida.
- [ ] Raíl de 212 px con recuento de «Sin clasificar», Buscar, colecciones y pie con espacio, rejilla y piloto.
- [ ] Columna de lectura de 780 px y modo ancho.
- [ ] Consulta de contenedor a 720 px: barra inferior.
- [ ] Gestor de atajos con ayuda en `?`.
- [ ] Atajos globales del Anexo H que existen en v0.1.
- [ ] Aviso efímero global y cola.
- [ ] Límite de errores por pantalla.

## Pruebas previstas

- Gestor de atajos (puro): teclas simples y con modificadores, secuencias con espera, campos de texto, prioridad de pantalla sobre global, baja.
- Carcasa (happy-dom): el raíl marca la sección activa con `aria-current="page"`; pulsar Buscar navega; `/` y `g h` navegan; `?` abre la ayuda; un error en una pantalla muestra `ErrorTarjeta` sin tumbar el raíl.
- CSS: las reglas de `.rail`, `.rb`, `.space`, `.amain`, `.col` y la consulta de contenedor coinciden con las de las pantallas (prueba que compara las declaraciones clave).
- Las capturas a 1440 y 400 px y la navegación con Playwright quedan pendientes.

## Criterios de aceptación

- La carcasa coincide con «Pantallas de Rimor» en los dos temas y anchos (mismo CSS; confirmación visual pendiente de Playwright).
- Todo se puede recorrer con teclado.
- `pnpm verificar` en verde y carga inicial < 300 KB.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Peso de TanStack Router en la carga inicial | Pantallas en carga diferida; se mide con `pnpm tamano` |
| El raíl de las pantallas no tiene Ajustes | Botón «Ajustes» al final de la lista (desviación anotada) |
| `/muestras` en producción | Ruta registrada solo con `import.meta.env.DEV` |

## Autorrevisión

Cubre la ficha. Las pantallas son marcadores hasta su IN, con su título y un vacío útil.
