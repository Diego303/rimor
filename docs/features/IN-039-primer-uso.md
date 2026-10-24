# IN-039 · Primer uso y espacio de ejemplo

## Objetivo y catálogo

Que la primera vez se entienda qué es Rimor y se pueda probar en segundos: una bienvenida con ejemplos que llenan el compositor, un espacio de ejemplo para explorar sin tocar el propio, y lo necesario para no perder lo que se guarde (persistencia e instalar la app). Catálogo: **APP-03**. Depende de IN-026 (Inicio), IN-036 (importar) e IN-090 (la señal).

## Estado de partida

- Inicio, con el espacio vacío, pinta `PrimerUso`: un título, una frase y cinco botones de ejemplo (log, error, enlace, mediciones, idea) que llenan el compositor sin guardar. Encima, la tarjeta que pide el almacenamiento persistente (IN-007).
- La `Senal` tiene el estado `primer-uso` (logotipo, nombre y la frase debajo).
- Importar en «espacio nuevo» escribe otra carpeta de OPFS y la apunta entre los espacios conocidos; Datos y copias los lista para abrirlos (IN-036). No hay forma de borrar uno.
- Los fixtures del repositorio traen logs del gateway (`comparaciones/buena.log`, `mala.log`), mediciones de `reqwest` y `ureq`, trazas y prompts.
- La PWA llega en IN-050: aún no hay manifiesto ni evento de instalación.

## Diseño

### Bienvenida (`PrimerUso`)

- Arriba, `<Senal estado="primer-uso" veces={1}>` con el logotipo y «Del rumor a la conclusión».
- Qué es Rimor en dos frases: «Pega lo que tengas a mano: un log, una traza, unas mediciones. Rimor lo entiende, te contesta con lo que ha visto y lo recuerda la próxima vez.»
- Tres botones que llenan el compositor: «Pega este log», «esta traza», «estas mediciones» (no guardan: se ve cómo se guardaría y se decide).
- «Abrir un espacio de ejemplo» (la colección `gateway`) y, si el navegador lo ofrece, «Instalar Rimor».

### El espacio de ejemplo (`src/datos/ejemplo/`)

- Se genera al pedirlo, con el flujo de captura real (los mismos lectores y el mismo formato) en un almacén en memoria: dos logs del gateway, una traza de Rust, mediciones de `reqwest` y de `ureq`, el enlace a `ureq`, un prompt de revisión y una idea; todo en la colección `gateway`, con sus etiquetas. Se exporta a ZIP (IN-035) y se importa como **espacio nuevo** «Ejemplo · gateway» (IN-036). Así siempre está en el formato de la versión que lo abre.
- Al terminar: «Abrir el ejemplo» (la app se recarga en él); para volver, Datos y copias lista los espacios.
- **Borrar un espacio** que no es el abierto: en «Espacios y papelera», «Borrar» con confirmación borra su carpeta de OPFS, su caché y lo quita de la lista.

### Persistencia e instalación

La tarjeta de persistencia sigue arriba en Inicio. La sugerencia de instalar la app escucha `beforeinstallprompt` y, si llega (cuando haya PWA, IN-050), ofrece «Instalar Rimor» en la bienvenida.

## Tareas

- [x] Bienvenida en el feed con `<Senal estado="primer-uso" veces={1}>` (logotipo y «del rumor a la conclusión»), qué es Rimor en dos frases y tres botones de ejemplo («Pega este log», «esta traza», «estas mediciones») que rellenan el compositor.
- [x] Espacio de ejemplo (la colección `gateway` del plan) como ZIP empaquetado, importable en modo «espacio nuevo» y que se puede borrar.
- [x] Petición de persistencia y sugerencia de instalar la PWA (cuando exista).

## Pruebas previstas

- El ZIP de ejemplo: pasa la validación de importar, trae lo previsto (tipos, la colección `gateway`, refs) y es el mismo en dos generaciones con el mismo reloj.
- Bienvenida: la señal, los tres botones llenan el compositor con su texto, «Abrir un espacio de ejemplo» crea el espacio nuevo y lo apunta, «Instalar Rimor» solo si llegó el evento.
- Borrar un espacio: borra su carpeta y lo quita de la lista; el abierto no se puede borrar.

## Criterios de aceptación

- `pnpm verificar` en verde; el ejemplo se importa y se puede borrar.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Un ZIP estático en `public/` o generado? | Generado en la app con su propio flujo de captura: va empaquetado en la app (en un trozo aparte) y nunca queda en un formato viejo. |
| Borrar un espacio abierto en otra pestaña | Se avisa si no se puede borrar (sus archivos están en uso); el abierto en esta no se ofrece. |
| La PWA aún no existe | El botón de instalar aparece solo si el navegador lo ofrece; IN-050 pone el manifiesto. |

## Autorrevisión

Cubre las tres tareas. Reutiliza la captura, la exportación y la importación en espacio nuevo, la lista de espacios de IN-036, la caché del espacio (`CacheEspacio.borrar`) y la señal.

## Implementación

- `src/rutas/inicio/PrimerUso.tsx`: la señal `primer-uso` (40 px, con «Del rumor a la conclusión»), las dos frases, «Pega este log», «Esta traza» y «Estas mediciones», «Abrir un espacio de ejemplo» (y después «Abrir «Ejemplo · gateway»») e «Instalar Rimor» si el navegador lo ofrece.
- `src/datos/ejemplo/ejemplo.ts`: `zipDeEjemplo` (ocho capturas reales con fechas e ids fijos a partir del reloj, la colección `gateway`, exportado con IN-035); `src/datos/ejemplo/crear.ts`: `crearEspacioDeEjemplo` (lo valida e importa como espacio nuevo con su nombre).
- `importar` admite el `nombre` del espacio nuevo.
- `src/espacio/Espacio.tsx`: `borrarEspacio` (carpeta de OPFS, caché y lista; el abierto no) y `olvidarEspacioConocido`; Datos y copias lo ofrece con confirmación.
- `src/espacio/instalar.ts`: guarda `beforeinstallprompt` y `instalar()`.
- Pruebas: `datos/ejemplo/ejemplo.test.ts` (valida, contenido, determinista), `rutas/inicio/PrimerUso.test.tsx` (señal, ejemplos, espacio de ejemplo, instalar), `espacio/espacios.test.ts` (borrar) e `Inicio.test.tsx` (textos nuevos).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| La traza y el prompt del ejemplo están escritos para él (no son los fixtures) | Los fixtures llevan rutas de una máquina concreta; el ejemplo se reparte a todo el mundo. |
| Lo capturado del ejemplo queda «ayer» | Así el feed del espacio de ejemplo tiene su día y el de hoy queda libre para probar. |

## Verificación

**`pnpm verificar`**: en verde, 99 archivos y 1310 pruebas; carga inicial 244,8 KB de 300 (el generador, sus fixtures y la importación se cargan al pedir el ejemplo).

**Criterios de aceptación:** el ejemplo se importa (`ejemplo.test.ts`, `PrimerUso.test.tsx`) y se puede borrar (`espacios.test.ts`, `Datos.tsx`).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Bienvenida con la señal, dos frases y tres ejemplos | `PrimerUso.test.tsx` e `Inicio.test.tsx` |
| Espacio de ejemplo como ZIP empaquetado, importable como espacio nuevo y borrable | `ejemplo.test.ts` (valida, contenido, determinista, fallo a medias), `PrimerUso.test.tsx` (crear, no repetir) y `espacios.test.ts` (borrar con cerrojo y copia previa) |
| Persistencia e instalar la PWA | La tarjeta de persistencia (IN-007) sigue en Inicio; `PrimerUso.test.tsx` («Instalar Rimor» solo si llega el aviso) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Se podía borrar un espacio abierto en otra pestaña | Se borra con su cerrojo de escritura cogido; si no está libre, `espacio.enUso`; y deja de ser el que se abre por defecto. `espacios.test.ts` |
| 2 | Borrar un espacio no hacía antes el ZIP automático (§13.7) | Primero se descarga su ZIP (salvo que se desactive el ZIP previo); si falla, no se borra. `espacios.test.ts` |
| 3 | El aviso de instalar se escuchaba desde una pantalla diferida | Se escucha desde el arranque (`App.tsx`) |
| 4 | Un espacio nuevo que fallaba a medias dejaba una carpeta huérfana | Se borra lo escrito y no se apunta. `ejemplo.test.ts` |
| 5 | Se podía crear el ejemplo dos veces | Si ya existe, se ofrece abrirlo. `PrimerUso.test.tsx` |
| 6 | Una carpeta que ya no estaba hacía fallar el borrado | `NotFoundError` cuenta como borrado |
| 7 | La importación entraba en la carga de Inicio | `crear.ts` se carga al pedir el ejemplo (comprobado en `dist/`) |
| 8 | El nombre del ejemplo solo en español | Del idioma de la interfaz («Example · gateway») |

