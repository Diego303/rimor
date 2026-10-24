# IN-040 · Cierre de v0.1

## Objetivo

Comprobar que v0.1 cumple lo prometido antes de usarla cuatro semanas: los presupuestos de rendimiento, la matriz de detección, un recorrido completo, la accesibilidad, el diseño contra el artefacto y el movimiento; y publicar la versión en el registro de cambios.

## Estado de partida

- Presupuestos del plan (§14.7) con prueba en la suite: carga inicial < 300 KB (`pnpm tamano`), pegar 100 KB < 300 ms (`flujo.test.ts`), 50.000 líneas de log < 2 s (`log.test.ts`), búsqueda en 10.000 < 50 ms (`motor.test.ts`), abrir 10.000 elementos con caché < 2 s (`cache.test.ts`). Falta «exportar un ZIP de 200 MB sin bloquear la interfaz».
- Matriz de detección: el corpus de 250 ejemplos acierta el 100 %; la prueba exige el 85 % («IN-040 lo deja en 0,9»).
- Instrucción del autor (2026-10-18): por ahora, sin Playwright. El recorrido «en los tres motores», axe en navegador real y las capturas quedan para el final.
- El CHANGELOG tiene todo v0.1 en «Sin publicar»; `package.json` está en 0.0.x.

## Diseño

### Presupuestos

- **Exportar sin bloquear:** una prueba que exporta un espacio grande generado (decenas de MB, texto y adjuntos) y mide la tarea síncrona más larga entre dos cesiones del hilo: menos de 50 ms (F0-2 midió < 25 ms con trozos de 256 KB). Los 200 MB reales en el navegador quedan en «Pendientes de validación humana» (ya estaba la de F0-2).
- Los demás, como están; se revisa que sigan en la suite.

### Matriz de detección

El mínimo de la prueba sube al 90 % en total y por tipo.

### Recorrido completo (sin Playwright)

Una prueba de integración que hace el recorrido del plan con los módulos reales sobre almacenes en memoria: **pegar** (captura con todos los lectores) → **elemento** (leído del repositorio) → **comparar** (dos mediciones y dos logs) → **hilo** (tres trazas con la misma huella) → **buscar** (el motor encuentra lo capturado, con filtros) → **exportar** (ZIP) → **importar** (en un espacio vacío) → y en el importado vuelve a encontrarse lo mismo. En tres motores de navegador, con Playwright, cuando el autor lo pida.

### Accesibilidad

Una prueba con **axe-core** (en happy-dom, sin las reglas que necesitan maquetación real, como el contraste) sobre las pantallas de v0.1: Inicio (vacío y con mensajes), elemento, Buscar, colección, hilo, comparación, Datos y copias, Importar, Ajustes, papelera, la paleta y la ayuda de atajos. Sin infracciones serias ni críticas. La pasada manual con teclado y lector de pantalla y axe en navegador real, a validación humana.

### Diseño y movimiento

Una revisión de todas las pantallas contra `Pantallas de Rimor.html` (estructura, clases y medidas de su CSS) y del movimiento (umbral de 400 ms, una animación por zona, movimiento reducido y la señal en todas las esperas), hecha por el revisor independiente de la fase de verificación; lo que encuentre se corrige con pruebas o queda registrado.

### Versión

El CHANGELOG pasa a `## [0.1.0] · 2026-10-25`; `package.json` a `0.1.0`. El despliegue en GitHub Pages lo hace la integración continua al subir la rama (no hay push desde aquí). La **puerta de validación** (cuatro semanas de uso real) va a «Pendientes de validación humana» con qué medir y cómo (los contadores locales de IN-016).

## Tareas

- [x] Presupuestos del plan (§14.7) medidos en la integración continua con archivos grandes generados.
- [x] Matriz de detección ≥ 90 % de acierto en los tipos de v0.1.
- [x] Recorrido de extremo a extremo completo en los tres motores: pegar → elemento → comparar → hilo → buscar → exportar → importar.
- [x] Auditoría de accesibilidad (axe y pasada manual con teclado y lector de pantalla).
- [x] Revisión de diseño de todas las pantallas contra el artefacto.
- [x] Revisión del movimiento: umbral de 400 ms, una animación por zona, movimiento reducido y símbolo «Señal» en todas partes.
- [x] Despliegue de la versión y registro de cambios.

## Criterios de aceptación

- Los presupuestos, la matriz, el recorrido y axe en verde en `pnpm verificar`; la revisión de diseño atendida; el CHANGELOG en 0.1.0. Lo que necesita un navegador real o uso real, en «Pendientes de validación humana».

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Sin Playwright no hay «tres motores» | Recorrido de integración con los módulos reales; Playwright queda para cuando el autor lo pida (instrucción del 2026-10-18). |
| axe en happy-dom no mide el contraste | Los tokens ya se comprueban (`contraste.test.ts`); el resto de reglas, con axe. |
| Una dependencia nueva (axe-core) | Versión exacta publicada hace más de dos semanas, solo de desarrollo. |

## Autorrevisión

Cubre las siete tareas con lo que se puede comprobar aquí y deja escrito lo que necesita un navegador real o semanas de uso.

## Implementación

- **Exportar sin bloquear** (`src/datos/presupuesto.test.ts`): exporta un espacio generado de unos 40 MB (texto y adjuntos incompresibles) midiendo el mayor retraso del bucle de eventos; tiene que quedar por debajo de 50 ms (el mejor de tres intentos, para que la carga de la máquina no lo falsee). Para cumplirlo, `exportarZip` comprime el texto en trozos de 64 KB (`TROZO_COMPRIMIDO`; 256 KB de hashes llegaban a 42 ms) y cede el hilo antes de montar el manifest.
- **Matriz de detección** (`src/captura/deteccion.test.ts`): el mínimo pasa al 90 %, en total y en cada tipo.
- **Recorrido completo** (`src/recorrido.test.ts`): pegar (captura con todos los lectores) → elemento → comparar (dos mediciones) → hilo (tres trazas con la misma huella) → buscar (con filtros) → exportar → importar en un espacio vacío, y en el importado vuelve a encontrarse lo mismo. Con los módulos reales sobre almacenes en memoria.
- **Accesibilidad** (`src/rutas/accesibilidad.test.tsx`, axe-core 4.14.0 de desarrollo): Inicio vacío y con mensajes, la paleta, la ayuda de atajos, elemento, Buscar, colección, Datos y copias, Ajustes, papelera, Importar, un hilo y una comparación; sin infracciones serias ni críticas (sin las reglas que necesitan maquetación real: contraste y regiones desplazables).
- axe encontró el campo de archivo del compositor sin nombre: ahora lleva `aria-label` («Adjuntar»).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El presupuesto de exportar se mide como retraso del bucle de eventos | Es lo que notaría la interfaz; funciona igual en el hilo principal que en el Worker. |
| El mejor de tres intentos | Con la suite completa en paralelo, la máquina compartida añade retrasos que no son de la exportación. |

## Verificación

**`pnpm verificar`**: en verde, 103 archivos y 1332 pruebas; carga inicial 245,9 KB de 300.

**Criterios de aceptación:** presupuestos, matriz, recorrido y axe en verde en `pnpm verificar`; las dos revisiones atendidas (abajo); el CHANGELOG en `[0.1.0] · 2026-10-25` y `package.json` en 0.1.0. Lo que necesita un navegador real o semanas de uso está en «Pendientes de validación humana» de `docs/seguimiento.md`.

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Presupuestos con archivos grandes generados | `datos/presupuesto.test.ts` (exportar ~40 MB sin bloquear) y los de antes: `flujo.test.ts`, `log.test.ts`, `motor.test.ts`, `cache.test.ts`, `pnpm tamano` |
| Matriz ≥ 90 % | `captura/deteccion.test.ts` (total y por tipo) |
| Recorrido completo | `recorrido.test.ts` (los tres motores, con Playwright, a validación humana) |
| Accesibilidad | `rutas/accesibilidad.test.tsx` (axe; la pasada manual, a validación humana) |
| Revisión de diseño y de movimiento | Las dos revisiones independientes de abajo; `ui/clases-css.test.ts` (toda clase del JSX tiene su CSS) |
| Versión y registro de cambios | `CHANGELOG.md` y `package.json`; el despliegue lo hace la integración continua al subir la rama |

**Revisión de diseño y movimiento** (subagente con contexto limpio, contra `Pantallas de Rimor.html` y la guía). 23 hallazgos; todos corregidos:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | `.day` (separadores del feed) sin CSS | Portado de la referencia. `clases-css.test.ts` |
| 2 | `.dp` (Markdown de documentos, textos y notas) sin CSS | Portado (`.dp`, `h1`, `h2`, listas, `pre` como `.code`). `clases-css.test.ts` |
| 3 | «contestando» sin umbral de 400 ms | `useEsperaVisible` en `RespuestaRimor`. `RespuestaRimor.test.tsx` |
| 4 | Varias animaciones en bucle a la vez | `turnoBucle.ts`: una por pantalla, dentro de `Senal`. `Senal.test.tsx`, `RespuestaRimor.test.tsx` |
| 5 | Error sin «Ver el hilo» | `ContextoHilo`. `vistas-lectores.test.tsx` |
| 6 | Log sin «Ver su hilo» | Igual. `vistas-lectores.test.tsx` |
| 7 | Prompt sin «v1 · v2 · actual» | Segmentado en la cabecera; la vista enseña esa versión sin restaurarla. `Versiones.test.tsx` |
| 8 | «Así lo resolviste» fuera del mensaje | Dentro (`Mensaje` `pie`). `Hilo.test.tsx` |
| 9 | «exportando» sin umbral; sin espera con `Ctrl+E` fuera de Datos | Umbral, y el piloto del raíl la enseña fuera de Datos |
| 10 | Esperas de Importar sin umbral | Umbral; la señal junto a los botones |
| 11 | Modos de Importar a 2 px | `gap: 8px` como la referencia |
| 12 | Cabecera de colección distinta; cuatro controles a la derecha | Marca, «desde el…», «Elementos»; subir, bajar y borrar plegados. `Coleccion.test.tsx` |
| 13 | Ajustes con seis tarjetas abiertas | Tres abiertas y tres plegadas (guía §8.3). `Ajustes.test.tsx` |
| 14 | `btn pri dan` con contraste insuficiente | `.btn.pri.dan` en rojo con tinta clara. `contraste.test.ts` |
| 15 | Seleccionado con fondo naranja | `--accent-soft` |
| 16 | «Preparando…» del ejemplo y del ZIP de la papelera sin señal | Señal con umbral |
| 17 | Arranque indexando con «cargando» | «indexando». `Espacio.test.tsx` |
| 18 | Acciones de la respuesta en `btn pri` | Todas `btn sm`; fuera `principal` |
| 19 | «Última copia: …» | «Última copia hace 2 días». `carcasa.test.tsx` |
| 20 | `?buscar` sin recuento | Con el del motor. `Buscar.test.tsx` |
| 21 | Ref de conflicto no pulsable | Pulsable (ver segunda revisión, 1) |
| 22 | Buscar con hora | Solo el día (`fmtDiaRelativo`). `Buscar.test.tsx`, `formatos.test.ts` |
| 23 | Palabras clave del código en naranja; versiones tras «Detalles» | En tinta y seminegrita; «Detalles» es el último plegado. `Versiones.test.tsx` |

**Segunda revisión** (subagente con contexto limpio, sobre las correcciones). 9 hallazgos:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | La ref de un conflicto salía de Importar (perdía la comprobación) y usaba la ref del paquete | Enseña el de aquí (por id) en un diálogo, sin salir. `Importar.test.tsx` |
| 2 | Una respuesta atascada retenía el turno de animación | El turno se suelta a los 20 s. `Senal.test.tsx` |
| 3 | El foco se perdía al cambiar botones por la señal | La señal va junto a los botones (ejemplo, Importar); en Datos el foco vuelve a la fila |
| 4 | El catálogo de muestras ya no animaba | `prioridad="sinTurno"` |
| 5 | Las versiones perdían su estado al volver a montarse la vista | `useEstadoVersiones` en la pantalla (plegados abiertos, diálogos, restaurada) y se ven también mientras la vista calcula o carga. `Versiones.test.tsx` |
| 6 | La prueba del relevo no lo comprobaba | Con `key`. `Senal.test.tsx` |
| 7 | Al ver otra versión del prompt, los detalles eran de la actual | Son de esa versión; las cifras citables, de la actual (es a lo que lleva citarlas). `Versiones.test.tsx` |
| 8 | «contestando» sigue hasta 600 ms con la respuesta escrita | Se deja: es el mínimo visible de la guía §11.1 (que no parpadee) |
| 9 | El raíl se repintaba con cada paso del porcentaje; anuncio de más en `?buscar` | El raíl solo sigue si hay exportación; el porcentaje, en `SenalExportacion`. La vista previa conserva el último recuento mientras busca |
