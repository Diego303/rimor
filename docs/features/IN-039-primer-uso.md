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

- [ ] Bienvenida en el feed con `<Senal estado="primer-uso" veces={1}>` (logotipo y «del rumor a la conclusión»), qué es Rimor en dos frases y tres botones de ejemplo («Pega este log», «esta traza», «estas mediciones») que rellenan el compositor.
- [ ] Espacio de ejemplo (la colección `gateway` del plan) como ZIP empaquetado, importable en modo «espacio nuevo» y que se puede borrar.
- [ ] Petición de persistencia y sugerencia de instalar la PWA (cuando exista).

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
