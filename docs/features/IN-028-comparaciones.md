# IN-028 · Comparaciones de logs y mediciones

## Objetivo y catálogo

Comparar dos logs (dónde se separa la ejecución mala de la buena y qué mensajes aparecen, faltan o cambian de frecuencia) o dos series de mediciones (veredicto con el cambio de la mediana y Mann-Whitney, gráfico de las dos series, tabla de dos filas y avisos de método), y guardar el resultado como una **Comparación** citable (`CMP-0004`). Catálogo: **CMP-01**. Depende de IN-020 (Log) e IN-022 (Mediciones).

## Estado de partida

- `@rimor/formato` tiene `comparacionSchema` (`id`, `ref`, `tipo: comparacion`, `titulo`, `creado`, `modificado`, `clase`, `fuentes` con al menos dos refs, `resultado`, `colecciones`, `investigaciones`), `rutaEntidad` (`comparaciones/CMP-0005--titulo.md`), el prefijo `CMP` y `asignarRef`. No hay lectura ni escritura de entidades: el repositorio solo conoce `elementos/` y `papelera/elementos/`.
- `@rimor/estadistica` tiene `comparar(a, b)` (cambio de las medianas, Mann-Whitney con empates y continuidad, `significativo`, `sentido`), `describir`, `icMediana` y `avisosDeMetodo`.
- Los derivados del lector Log (`DatosLog`) ya traen las plantillas con su recuento y `lineaPlantilla` (la plantilla de cada línea, alineada con las líneas del original): la comparación de logs sale de ellos sin volver a analizar. Los de Mediciones traen cada serie con sus valores, su descriptiva y sus avisos. Los dos están en la caché de derivados (IN-006) y se piden con `cola.pedir`.
- La vista de Mediciones ya dibuja varias series (`GraficoPuntos`, una fila y una banda por serie) y redacta los avisos de método.
- Pantallas de referencia: `SC.medic` (CMP-0004) y `SC.clogs` (CMP-0005), con `head`, veredicto, gráfico o tabla, plegados de avisos o «Cambian de frecuencia» y «Detalles» con las cifras. Calculado con el código de la propia referencia sobre sus datos:
  - CMP-0004 (reqwest frente a ureq, 20 y 20): cambio **−4,5 %**, **p < 0,001**, significativo; medianas 38,535 y 36,795 ms.
  - CMP-0005 (buena, 10 líneas; mala, 11): se separan en la **línea 4**; **4** mensajes nuevos en la mala, faltan **4** de la buena y **2** cambian de frecuencia.

## Diseño

### Entidades en el espacio (`src/almacen/entidades.ts`)

Las comparaciones (y después los hilos, IN-030; las investigaciones y los documentos, v0.2 y v0.3) no son elementos: tienen su carpeta, su esquema y no llevan original ni lector. Un **repositorio de entidades** genérico:

- `@rimor/formato` suma `leerEntidad(texto)` y `escribirEntidad(entidad, previo?)`: frontmatter validado con el esquema de su `tipo` (el de comparación ahora; los demás ya existen) y el cuerpo (notas) tal cual, conservando el YAML previo como `escribirElemento`.
- `RepositorioEntidades` carga al abrir el espacio las carpetas de los tipos que se le dan (`comparaciones/` en IN-028), con el índice id/ref → ruta y el frontmatter en memoria; `guardar` (en turno por id, renombra si cambia el título, con el diario de operaciones del repositorio), `actualizar(refOId, cambio)` en turno, `leer`, `lista(tipo)`, `buscar` y `refs()` para asignar la siguiente sin repetir. Escribe solo la pestaña que escribe y avisa de cada cambio como el repositorio de elementos (cuenta para el recordatorio de copia y llega a la otra pestaña, que relee).
- Son pocas y pequeñas: se leen enteras al abrir, sin caché en IndexedDB (si un día son miles, se añade como la de elementos).
- `EspacioAbierto.entidades`.

### Calcular (`src/comparaciones/`, TS puro)

- `clases.ts`: qué se compara con qué. `claseDe(tipo)`: `log` → `logs`, `mediciones` → `mediciones`, el resto `null`. `comparables(a, b)`: `{ clase }` o el motivo por el que no (`mismo` elemento, `distintoTipo`, `sinComparacion` para tipos que aún no se comparan), que la interfaz explica con una frase.
- `logs.ts`: `compararLogs(a, b)` sobre los `DatosLog` de las dos: la plantilla de cada línea (`lineaPlantilla`) para la **primera divergencia** (la primera línea cuya plantilla difiere; `null` si siguen el mismo camino hasta el final de la más corta y tienen el mismo largo), y los recuentos por plantilla para los mensajes **solo en la mala**, los que **faltan** y los que **cambian de frecuencia** (×2 o ÷2), como la referencia. Lineal en líneas.
- `mediciones.ts`: `compararMediciones(a, b)` con la primera serie de cada una (como las cifras del lector), en la misma unidad: `comparar` de `@rimor/estadistica`, las descriptivas con su IC 95 %, los avisos de cada serie (atípicos, pocas, ruido) y los dos de método que la referencia pone siempre (misma máquina; decidir las repeticiones antes de medir).
- `resultado.ts`: lo que se guarda en `resultado` (pequeño, para citar sin recalcular) y las **cifras**: mediciones `cambio`, `p`, `mediana_a`, `mediana_b`; logs `divergencia`, `nuevos`, `ausentes`. Lleva también la **huella de las fuentes** (`fuentes_hash`: el hash del original de cada una) y la versión del cálculo.

### Crear (`src/comparaciones/crear.ts`)

`crearComparacion(refA, refB)`: comprueba que son comparables, pide sus derivados a la cola (de la caché si están), calcula, asigna `CMP-NNNN`, título («reqwest frente a ureq» con las etiquetas de las series; con los títulos de los elementos si no las hay) y guarda la entidad. La primera fuente es la de referencia («buena», la base) y la segunda la que se compara («mala», la nueva); en la pantalla se pueden **intercambiar** con un clic.

Cómo se crea:

- **Inicio**: seleccionar dos con `x` y `Ctrl+Mayús+C` (y un botón «Comparar» en la barra de selección cuando hay dos). Con otra cantidad o tipos que no se comparan, un aviso dice por qué.
- **Desde un elemento**: la vista de Log («Comparar con otro log», como la referencia) y la de Mediciones («Comparar con otras mediciones») piden a la pantalla, por un contexto, que abra **«Comparar con…»**: un diálogo con un campo para filtrar y la lista de los del mismo tipo (lo más reciente arriba, `FilaElemento`); uno se elige con un clic o con el teclado.
- Al crearla se va a su pantalla.

### Pantalla (`src/rutas/comparacion/`)

En `/e/CMP-0004` (las refs `[[CMP-0004]]` y los enlaces van a la misma ruta que los elementos; la pantalla de elemento delega por el prefijo).

- **Cabecera** (como `head`): chip «Comparación», título editable en el sitio, meta «Ayer, 18:21 · MED-0007 frente a MED-0008» (logs: «LOG-0041 buena · LOG-0042 mala») con las refs pulsables; a la derecha, «Intercambiar».
- **Mediciones**: tarjeta con el `Veredicto` (cifra `−4,5 %` o `≈`; «ureq es un 4,5 % más rápido» / «más lento» / «Sin diferencia clara»; «Diferencia significativa · Mann-Whitney, p < 0,001 · 20 repeticiones cada uno»), el gráfico de las dos series con su leyenda y la tabla de dos filas (Mediana, IC 95 %, Variación). Plegado «Avisos de método (N)».
- **Logs**: tarjeta con el `Veredicto` en rojo («línea 4», «Aquí se separan», «4 mensajes nuevos en la mala · faltan 4 de la buena») y la tabla de dos filas con la línea de cada una en ese punto (la de la mala, resaltada); dos tarjetas en `split`: «Solo en la mala» y «Faltan en la mala» con las plantillas (marcadores resaltados como en la vista de Log); plegado «Cambian de frecuencia» («Ninguno.» si no hay). Si siguen el mismo camino, el veredicto lo dice en verde.
- **Detalles**: fuentes, referencia y las cifras citables.
- **Recalcular**: al abrirla se compara la huella guardada de cada fuente con la de ahora; si alguna cambió, se recalcula, se guarda (si la pestaña escribe) y un aviso dice «La comparación ha cambiado: LOG-0042 cambió desde que se hizo. Está recalculada.». Si una fuente ya no existe, se enseña lo guardado y se dice cuál falta.
- Mientras se piden los derivados y se calcula, si pasa de 400 ms, `<Senal estado="comparando">` (una vez, como pide la guía).

## Tareas

- [x] Elemento `Comparacion` (`comparaciones/CMP-NNNN--….md`) con las refs de las fuentes y el resultado en el resumen.
- [x] Logs: primera divergencia (por plantilla), mensajes solo en una, ausentes y con frecuencia distinta (×2 o ÷2).
- [x] Mediciones: veredicto, gráfico de las dos series, tabla de dos filas y avisos plegados.
- [x] Cómo se crea: seleccionar dos (`x`) y `Ctrl+Shift+C`; desde un elemento, «Comparar con…» y elegir; si los tipos no coinciden, se explica por qué no se puede.
- [x] Recalcular si cambia una fuente, con aviso «la comparación ha cambiado».
- [x] Si el cálculo pasa de 400 ms, `<Senal estado="comparando" veces={1}>` mientras se calcula (opcional).
- [x] Cifras: `cambio`, `p`, `divergencia`, `nuevos`, `ausentes`.

## Pruebas previstas

- Formato: leer y escribir una comparación (y conservar el YAML previo); un `tipo` o un esquema que no cuadra se rechaza.
- Repositorio de entidades: guardar, renombrar al cambiar el título, refs sin repetir, cargar desde los archivos, solo lectura, actualizar en turno.
- Cálculo, con los datos de la referencia en `fixtures/comparaciones/` (los dos logs) y `fixtures/mediciones/` (reqwest y ureq): CMP-0004 da −4,5 % y p < 0,001; CMP-0005 da la línea 4, 4 nuevos, 4 ausentes y 2 que cambian. Casos límite: logs iguales, uno vacío, uno más largo que sigue igual; series con una sola medida o sin valores; unidades distintas (ms y s).
- Creación: tipos distintos o no comparables con su motivo; con los derivados de la caché; título y ref.
- Pantalla: las dos clases como la referencia; intercambiar; recalcular al cambiar una fuente con su aviso; fuente que falta; solo lectura.
- Inicio: `x`, `x`, `Ctrl+Mayús+C` crea y abre; con uno o tres, el aviso. Desde un log: «Comparar con otro log» → diálogo filtrado → crea y abre.

## Criterios de aceptación

- Los ejemplos del plan (CMP-0004 y CMP-0005) dan los resultados de «Pantallas de Rimor». `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Comparaciones como elementos o como entidades | Entidades en su carpeta, con un repositorio genérico que reutilizarán hilos, investigaciones y documentos; el esquema ya lo separa. |
| Logs enormes | La comparación sale de los derivados (plantilla por línea y recuentos), que se calculan en el Worker y se guardan en caché: comparar es lineal y barato. |
| Qué fuente es la «buena» | La primera elegida es la de referencia; «Intercambiar» lo arregla con un clic. |
| Series en unidades distintas | Se pasan a la misma (ms) antes de comparar. |
| Una medición con varias series | Se compara la primera de cada una (como las cifras del lector); varias a la vez es CMP-04 (v0.3). |
| Borrar una comparación | Fuera de esta funcionalidad: la papelera de entidades llega con la primera que la necesite. |
| Buscar comparaciones | IN-032 decide qué entra en la búsqueda. |

## Autorrevisión

Cubre las siete tareas y la aceptación con datos de la propia referencia. Lo aprendido que aplica: las escrituras van en turno; los atajos leen el estado del momento; los diálogos son listas de botones sin formularios largos; las pruebas de pantalla precargan los módulos y las pantallas a las que llevan; un solo «Detalles» por pantalla; la descarga o el guardado no se dan por hechos sin comprobarlos.

## Implementación

- **Formato**: `paquetes/formato/src/entidad.ts` (`leerEntidad`, `escribirEntidad`, `FrontmatterEntidades`), con el esquema de cada tipo y el YAML previo conservado.
- **Repositorio de entidades**: `src/almacen/entidades.ts` (`RepositorioEntidades`), con su propio diario (`.rimor/operacion-entidades.json`); los turnos por clave y el diario pasan a `src/almacen/turnos.ts`, que comparte con el de elementos. `abrirEspacio` lo crea, lo carga (también al releer lo de otra pestaña) y lo expone como `entidades`; sus fallos de lectura se suman a `fallidos()`.
- **Cálculo** (`src/comparaciones/`): `clases.ts`, `logs.ts` (`compararLogs` sobre `lineaPlantilla` y los recuentos; las líneas vacías del final no cuentan), `mediciones.ts` (`compararMediciones`, pasando a ms si las unidades no coinciden), `resultado.ts` (lo guardado con `fuentes_hash` y `nombres`, `leerResultado`, `fuentesCambiadas`, las cifras y `textoCambio`) y `crear.ts` (`calcular`, `resultadoDe`, `crearComparacion`). `partirLineas` del análisis de logs alinea las líneas con `lineaPlantilla`.
- **Pantalla** (`src/rutas/comparacion/`): `Comparacion.tsx` (en `/e/CMP-…`, desde `Elemento.tsx` por el prefijo), `useComparacion.ts` (relee entidad y fuentes, calcula, guarda el resultado nuevo si cambió y recuerda qué fuente cambió), `VistaMediciones.tsx` (con `VeredictoMediciones`, que sirve también para lo guardado), `VistaLogs.tsx`, `DialogoComparar.tsx` y `useComparar.ts` (crear con su motivo si no se puede, y abrirla).
- **Desde las vistas**: `ContextoComparar` (como `ContextoDetalles`): la de Log pone «Comparar con otro log» debajo de «Qué dice» (como la referencia) y la de Mediciones «Comparar con otras mediciones». `PlantillaPintada` (log) y `textoAviso` (mediciones) pasan a sus propios módulos para reutilizarlos.
- **Inicio**: `Ctrl+Mayús+C` y «Comparar» en la barra de selección con dos marcados; el primero que se marcó es la referencia.
- **Pruebas**: `paquetes/formato/src/entidad.test.ts`, `src/almacen/entidades.test.ts`, `src/comparaciones/comparaciones.test.ts` (CMP-0004 y CMP-0005 con los datos de la referencia en `fixtures/comparaciones/` y `fixtures/mediciones/`), `src/rutas/comparacion/Comparacion.test.tsx` (desde el elemento con el diálogo filtrado, desde Inicio con el teclado, tipos distintos, recalcular con aviso, fuente que falta, intercambiar) y `src/espacio/espacio.test.ts` (las entidades al reabrir). `src/pruebas/app.tsx` monta la app entera para las pruebas de pantalla.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Mientras se calcula se ve lo guardado (con los nombres guardados en el resultado) | La cifra no salta a «—» ni el nombre de la ref al de la serie. |
| Al intercambiar, el resultado se vacía y se recalcula sin avisar | El aviso «ha cambiado» es para cuando cambió una fuente, no para lo que acaba de hacer el usuario. |
| El título se da la vuelta al intercambiar solo si es el automático | Uno escrito a mano es del usuario. |
| Los avisos de método de la comparación incluyen siempre los dos generales de la referencia | Como `SC.medic`; el de la máquina, en condicional («si se midieron en la misma máquina»), porque Rimor no lo sabe. |
| `Ctrl+Mayús+C` como pide el plan, y también el botón «Comparar» | Algunos navegadores se reservan ese atajo (inspeccionar en Chrome): el botón no depende de él. |

## Verificación

**`pnpm verificar`**: en verde, 69 archivos y 1058 pruebas; carga inicial 219,7 KB de 300.

**Criterios y tareas, con su evidencia:**

| Tarea o criterio | Evidencia |
|---|---|
| CMP-0004 y CMP-0005 dan lo de la referencia | `comparaciones.test.ts` y `Comparacion.test.tsx` con los datos de la referencia (idénticos byte a byte, según la revisión): −4,5 %, p < 0,001, medianas, IC y variación; línea 4, 4 nuevos, 4 ausentes y 2 que cambian, con las líneas de cada una |
| Entidad `Comparacion` en `comparaciones/` | `entidad.test.ts`, `entidades.test.ts`, `espacio.test.ts` (al reabrir) |
| Logs: divergencia, solo en una, ausentes, frecuencia | `comparaciones.test.ts` (también iguales, prefijo, vacío); `VistaLogs.test.tsx` (donde una se acaba) |
| Mediciones: veredicto, gráfico, tabla, avisos | `Comparacion.test.tsx` (frases, tabla de dos filas, «Avisos de método»), unidades distintas en `comparaciones.test.ts` |
| Cómo se crea | `Comparacion.test.tsx`: «Comparar con…» filtrado desde el elemento; `x`, `x`, `Ctrl+Mayús+C` (dos veces: una sola) y el botón; tipos distintos con su motivo; uno solo |
| Recalcular con aviso | `Comparacion.test.tsx`: una fuente cambia → aviso y resultado guardado nuevo; fuente borrada → lo guardado; más de dos fuentes → motivo |
| «Comparando» pasados 400 ms | `useEsperaVisible` (probado en IN-090) sobre `calculando` |
| Cifras citables | `comparaciones.test.ts` y «Detalles» en `Comparacion.test.tsx` |

**Revisión independiente** (subagente con contexto limpio). Confirmó la aceptación. Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Dos creaciones a la vez se llevaban la misma ref (y una pisaba a la otra) | `RepositorioEntidades.crear` asigna la ref y guarda en un mismo turno; `guardar` rechaza una ref de otra entidad o una ruta ocupada; `useComparar` ignora la orden mientras crea. `entidades.test.ts`, `comparaciones.test.ts`, `Comparacion.test.tsx` (doble `Ctrl+Mayús+C`) |
| 2 | `refs()` olvidaba los archivos ilegibles y podía sobrescribirlos | La ref del nombre de cada `.md` cuenta aunque no se lea; no se escribe una nueva sobre una ruta que existe. `entidades.test.ts` |
| 3 | El diario de entidades no se terminaba al heredar la escritura | `cargar({ recuperar })` con `escribe()` al abrir y al releer; entre duplicados en su sitio, el modificado más tarde. `entidades.test.ts` |
| 4 | Tras intercambiar se veía un momento el cálculo de las fuentes anteriores; un segundo clic dejaba el título mal | El cálculo anterior solo se conserva si es de las mismas fuentes (ref, hash y versión de lector); «Intercambiar» se oculta mientras se recalcula; el intercambio se hace sobre lo leído en el turno |
| 5 | Una lectura fallida dejaba la pantalla en «cargando» | La siguiente relectura lo vuelve a intentar |
| 6 | Con más de dos fuentes se quedaba en «Comparando» | Motivo propio. `Comparacion.test.tsx` |
| 7 | Celda vacía donde una se acaba (líneas vacías al final) | «(se acaba aquí)» según el largo sin las vacías del final. `VistaLogs.test.tsx` |
| 8 | El guardado del recálculo no miraba si las fuentes seguían siendo las calculadas | Si cambiaron (un intercambio entró antes), no se guarda |
| 9 | Motivo engañoso con un log que leyó otro lector | `comparacion.otroLector` con su frase. `comparaciones.test.ts` |
| 10 | Lo guardado podía quedarse viejo si sube la versión del lector de una fuente | `versiones_lector` en el resultado; si difiere, se recalcula y se guarda sin aviso. `comparaciones.test.ts` |
| 11 | Una línea vacía de más en medio cuenta como divergencia | Se deja como la referencia (`CLOG` hace lo mismo); solo las del final no cuentan |
| 12 | (Fuera de IN-028) El aviso de atípicos nombra todos los atípicos; la referencia, el más lento | Es de `avisosDeMetodo` (IN-022): el recuento de avisos coincide con la referencia; se anota para cuando se revise Mediciones |

