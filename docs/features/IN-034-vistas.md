# IN-034 · Mosaico y lista densa

## Objetivo y catálogo

Ver un grupo de elementos de dos formas más que la lista: un **mosaico** con la tarjeta de cada lector, agrupado con cabeceras y recuentos, y una **lista densa** en columnas, ordenable, para recorrer cientos de elementos. Las dos en las colecciones y en los resultados de Buscar. Catálogo: **VIS-02** (mosaico agrupado) y **VIS-03** (lista densa). Depende de IN-027 (pantalla del elemento) e IN-012 (tarjetas de los lectores).

## Estado de partida

- Cada lector tiene su `Tarjeta` (vista previa) y `TarjetaElemento` la pinta con el tipo, el título y la ref (IN-012); ninguna pantalla la usa todavía. Necesita el elemento completo: `useElemento` (Inicio) lo lee y lo recuerda.
- La colección (`/c/$coleccion`, IN-031) y Buscar (IN-032) pintan listas de filas `it`. El feed ya usa `@tanstack/react-virtual`.
- La referencia no dibuja estas vistas: se componen con sus piezas (`seg`, `card`, tablas con `th` en mayúsculas pequeñas, `st` para el estado, `ti` para el tipo).

## Diseño

### Elegir la vista

Un `Segmentado` «Lista · Mosaico · Densa» arriba a la derecha de la pantalla (en la colección, junto a sus botones; en Buscar, en la línea de «N resultados»). La vista va en la dirección (`?vista=mosaico`), así que se comparte y vuelve con «Atrás»; sin ella, la lista de siempre.

### Mosaico (`src/ui/vistas/Mosaico.tsx`)

- Grupos con cabecera y recuento («Log · 12»): por **tipo** (en el orden del primero de cada uno) o por **fecha** (hoy, ayer, el día…), con un segundo `Segmentado` pequeño «Tipo · Fecha».
- Una rejilla adaptable de `TarjetaElemento`: cada tarjeta lee su elemento al montarse (`useElemento`, que pasa a `src/lectores/useElemento.ts` para usarlo fuera de Inicio) y, mientras, enseña el resumen del frontmatter. El título es el botón que abre el elemento; toda la tarjeta se puede pulsar.
- Para no leer cientos de archivos de golpe: se pintan 60 y «Ver más» añade otros 60.

### Lista densa (`src/ui/vistas/ListaDensa.tsx`)

- Tabla con columnas **tipo**, **título** (con la ref), **fecha**, **colecciones** y **estado** (el visible, con su nombre y tono, como en el elemento).
- Ordenable pulsando la cabecera (`aria-sort`; otra vez, al revés); por defecto, la fecha de lo más reciente a lo más antiguo. El orden es TS puro (`ordenarDensa`, comparando sin acentos y con el idioma).
- **Lista virtual**: solo se montan las filas visibles (con un margen) dentro de un contenedor con la cabecera fija; cada fila se abre con un clic o con Enter, y las flechas pasan de una a otra.

## Tareas

- [x] La `Tarjeta` de cada lector en mosaico, agrupada con cabeceras y recuentos.
- [x] Lista densa ordenable (tipo, título, fecha, colecciones, estado) con lista virtual.
- [x] Las dos disponibles en colecciones y en los resultados de búsqueda.

## Pruebas previstas

- `ordenarDensa` por cada columna y sentido (acentos, sin colecciones, estados propios) y la agrupación del mosaico (tipo y fecha).
- Mosaico: grupos con recuento, la tarjeta del lector cuando llega el elemento, abrir, «Ver más».
- Lista densa: columnas, ordenar con `aria-sort`, solo se montan las filas visibles con muchas, abrir con clic y con Enter, flechas.
- Colección y Buscar: el selector, la vista en la dirección y volver a la lista.

## Criterios de aceptación

- `pnpm verificar` en verde; la lista densa con 1.000 elementos solo monta las filas que se ven.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| La referencia no tiene estas vistas | Se componen con `seg`, `card`, la tabla y los chips de la referencia. |
| El mosaico lee un archivo por tarjeta | En tandas de 60 con «Ver más»; los leídos se recuerdan (`useElemento`). |
| ¿Recordar la vista elegida? | En la dirección: se comparte y vuelve con «Atrás»; sin ella, la lista. |
| Buscar devuelve como mucho 50 | Las vistas pintan esos 50; el recuento de arriba sigue diciendo el total. |

## Autorrevisión

Cubre las tres tareas de IN-034. Reutiliza `TarjetaElemento`, `useElemento`, `Segmentado`, `estadoVisible` y `nombreDeEstado`, y la lista virtual que ya usa el feed; textos por i18n; sin dependencias nuevas.

## Implementación

- `src/rutas/vistas/orden.ts`: `vistaDe`, `ordenarDensa` (Intl.Collator sin acentos y numérico; vacío al final; a igualdad, lo reciente), `siguienteOrden` y `agruparMosaico`.
- `src/rutas/vistas/Vistas.tsx`: `SelectorVista`, `Mosaico` (agrupar por tipo o por día, tandas de 60 con «Ver más») y `ListaDensa` (tabla con cabecera fija, `aria-sort`, lista virtual con `@tanstack/react-virtual` y espaciadores, foco con flechas, Inicio y Fin, Enter abre).
- `TarjetaElemento` acepta solo el frontmatter (pinta el resumen mientras se lee) y `alAbrir` (el título es el botón y cubre la tarjeta). `useElemento` pasa a `src/lectores/useElemento.ts`.
- Rutas: `?vista=` en `/buscar` y `/c/$coleccion` (la lista no se escribe); escribir en Buscar y renombrar la colección la conservan.
- Colección y Buscar: el selector y las tres vistas (en Buscar, sobre los resultados devueltos).
- CSS: `.mosaico`, `.grupo-mosaico`, `.tarjeta-elemento.pulsable`, `.tarjeta-abrir`, `.lista-densa`, `.th-orden`, `.cabeza-resultados`.
- Pruebas: `orden.test.ts` y `Vistas.test.tsx` (selector y dirección, mosaico por tipo y fecha con la tarjeta del lector, «Ver más», lista densa con orden y teclado, 1.000 elementos montando solo las visibles, Buscar con la vista y la consulta).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Las vistas viven en `src/rutas/vistas/` | Las usan pantallas y reutilizan el día de Inicio (`claveDia`, `etiquetaDia`). |
| La lista densa se desplaza en su propio contenedor (hasta el 70 % del alto) | La cabecera queda fija y la lista virtual mide su propio desplazamiento. |
| La prueba de 1.000 elementos monta la lista densa sola | Guardar 1.000 archivos por la app entera tardaba y ralentizaba el resto de la suite. |
| `Inicio.test.tsx` precarga sus pantallas en `beforeAll` | Como las demás pruebas de pantalla: en la suite completa su primera prueba se pasaba del plazo de la carga en frío. |

## Verificación

**`pnpm verificar`**: en verde, 88 archivos y 1227 pruebas; carga inicial 236,6 KB de 300.

**Criterios de aceptación:** la lista densa con 1.000 elementos solo monta las filas que se ven y un margen (`Vistas.test.tsx`, «lista densa con muchos elementos»).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Mosaico con la tarjeta de cada lector, agrupado con cabeceras y recuentos | `orden.test.ts` (`agruparMosaico`) y `Vistas.test.tsx` (grupos por tipo y fecha, tarjeta del lector, «Ver más», abrir) |
| Lista densa ordenable con lista virtual | `orden.test.ts` (`ordenarDensa`, `siguienteOrden`) y `Vistas.test.tsx` (columnas, `aria-sort`, teclado, 1.000 elementos) |
| En colecciones y en los resultados de búsqueda | `Vistas.test.tsx` (colección y Buscar, la vista en la dirección, Atrás) y `Paleta.test.tsx` |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Fin (o una flecha hacia una fila sin montar) perdía el foco: se buscaba la fila antes del desplazamiento | Se sigue intentando hasta que la fila está montada. `Vistas.test.tsx` |
| 2 | Podía no quedar ninguna fila a la que llegar con Tab (lista que encoge, fila del foco desmontada) | La tabulable es la del foco si está montada y existe; si no, la primera visible; una lista nueva empieza arriba. `Vistas.test.tsx` |
| 3 | Las vistas estaban dentro de `aria-live`: el lector de pantalla leía las filas al desplazarse | Solo el recuento se anuncia |
| 4 | «Buscar…» de la paleta perdía la vista de Buscar | La conserva. `Paleta.test.tsx` |
| 5 | Una fecha ilegible salía la primera en orden ascendente | Va al final en los dos sentidos. `orden.test.ts` |

