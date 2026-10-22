# IN-035 · Exportar ZIP y JSON

## Objetivo y catálogo

Sacar el espacio entero del navegador en un clic: un **ZIP** con todos sus archivos (la copia de verdad) y un **JSON único** para otras herramientas, con lo que no cabe dicho explícitamente. Catálogo: **DAT-03** (ZIP completo) y **DAT-05** (JSON único). Depende de IN-005 (almacén) y F0-2 (ZIP de ida y vuelta).

## Estado de partida

- Los archivos del espacio viven en OPFS, leídos y escritos por el Worker del almacén (IN-005); su `leer` usa `getFile()`, que no toma el cerrojo exclusivo. En las pruebas, `AlmacenMemoria`.
- `.rimor/estado.json` guarda la última copia y los cambios desde entonces (IN-007); el piloto del raíl se pone verde con una copia reciente. Datos y copias enseña la tarjeta de cuidado.
- Vaciar la papelera (IN-027) prepara un ZIP en memoria con `zipSync` de lo que hay en ella.
- F0-2 decidió: `Zip` de fflate en streaming en un Worker, `ZipDeflate` para texto y `ZipPassThrough` para adjuntos, trozos de 256 KB cediendo el hilo; y para leer, el directorio central (no `Unzip` en streaming).
- La referencia (`SC.copias`): en la tarjeta de cuidado, «Exportar ZIP» (botón principal) e «Importar…»; plegados, «Otras exportaciones» (el JSON único: «Los adjuntos de más de 1 MB se excluyen y el archivo lo indica») y «Qué contiene el ZIP» (el árbol de carpetas).

## Diseño

### El ZIP (`src/datos/exportar.ts`, TS puro sobre un almacén)

- Todos los archivos del espacio en orden de ruta, en la raíz del ZIP, menos `.rimor/cache/` y el diario de operación (`.rimor/operacion.json`, que solo sirve para terminar una operación cortada en este navegador). `ZipDeflate` (nivel 6) para el texto; `ZipPassThrough` para `adjuntos/` (a menudo ya comprimidos). La fecha de cada entrada es la de la exportación: dos exportaciones iguales dan entradas iguales.
- `manifest.json` va al final: el del espacio con `exportado`, la versión de la app, los **recuentos** (elementos, comparaciones, hilos, investigaciones, documentos, adjuntos, en la papelera) y los **hashes SHA-256** de cada archivo; `adjuntos_excluidos` vacío.
- Progreso por bytes leídos (`hechos`, `total`), cediendo el hilo entre trozos de 256 KB. Se puede cancelar.
- Nombre: `rimor-<espacio>-<AAAA-MM-DD>.zip` (el espacio, en *slug*).

### El JSON único (en el mismo módulo)

`{ manifest, elementos: [{ ruta, frontmatter, yaml, cuerpo }], adjuntos: [{ ruta, base64 }], archivos: [{ ruta, texto | base64 }] }`:

- `elementos`: los `.md` de `elementos/`, con el frontmatter leído (objeto) y además su YAML tal cual (`yaml`) y el cuerpo, para que importar dé el mismo archivo byte a byte.
- `adjuntos`: los de 1 MB o menos, en base64. Los mayores **no van** y se listan en `manifest.adjuntos_excluidos`.
- `archivos`: todo lo demás (comparaciones, hilos, colecciones, historial, papelera, `.rimor/`): texto si es UTF-8; si no, base64.
- Una exportación JSON con adjuntos excluidos **no cuenta como copia** (no actualiza la última copia): nunca se presenta como completa si no lo es.

### Leer un ZIP (`src/datos/leerZip.ts`)

Para la prueba de ida y vuelta (y la base de IN-036): el directorio central del final del archivo, cada entrada con su tamaño declarado, y se infla una a una cortando si pasa de lo declarado. Sin ZIP64 (se rechaza).

### El Worker (`src/workers/exportar.worker.ts`)

Abre el mismo directorio de OPFS del espacio solo para leer y genera el ZIP o el JSON; el hilo principal recibe el progreso y el resultado (un `Blob`). Sin Worker (pruebas, espacio en memoria), lo mismo en el hilo con el almacén del espacio. Antes de exportar se espera a que se escriba lo pendiente.

### En la interfaz

- `useExportacion` (estado global: ninguna o una en marcha, tipo y porcentaje) y `exportar(espacio, 'zip' | 'json')`.
- Datos y copias: en la tarjeta de cuidado, «Exportar ZIP» e «Importar…» (deshabilitado hasta IN-036); mientras se exporta, `<Senal estado="exportando">` con el porcentaje en lugar de los botones. Plegados, «Otras exportaciones» con el JSON único y «Qué contiene el ZIP».
- `Ctrl+E` (también en la paleta) exporta el ZIP desde cualquier pantalla.
- Al terminar: se descarga, el aviso dice «Exportado rimor-trabajo-2026-10-22.zip (148 MB)» con `<Senal estado="copia-al-dia" veces={1}>`, y se apunta la copia (`conCopia`): el piloto del raíl pasa a verde. Si falla: «No se pudo exportar» y no se apunta nada.

### ZIP antes de lo destructivo

`copiaPrevia(espacio, motivo)` exporta y descarga el ZIP completo con el motivo en el nombre (`rimor-trabajo-2026-10-22-antes-de-vaciar.zip`) y devuelve si se hizo; la llamarán IN-036 (reemplazar) e IN-060. Vaciar la papelera (IN-027) sigue con su copia de la papelera (descargar y luego vaciar en dos pasos, sin cambio de comportamiento).

## Tareas

- [x] ZIP completo en streaming con fflate en un Worker, con progreso (`<Senal estado="exportando">` y el porcentaje); sin `.rimor/cache/`; nombre `rimor-<espacio>-<fecha>.zip`.
- [x] Al terminar una exportación completa, `<Senal estado="copia-al-dia" veces={1}>` en el aviso y el piloto del raíl pasa a verde.
- [x] `manifest.json` con recuentos y hashes SHA-256 de cada archivo.
- [x] JSON único `{manifest, elementos, adjuntos}`: adjuntos ≤ 1 MB en base64; los demás, excluidos y listados en `manifest.adjuntos_excluidos`.
- [x] `Ctrl+E` y botón en Datos y copias; actualiza «última copia».
- [x] ZIP automático antes de operaciones destructivas (lo llaman IN-027, IN-036 e IN-060).

## Pruebas previstas

- **Propiedad** (fast-check): espacios al azar (texto, Unicode, binarios, rutas en varias carpetas) → exportar → leer el ZIP en un almacén vacío → exportar otra vez: los mismos archivos byte a byte y el mismo `manifest.json`.
- ZIP: lo excluido, el orden, los métodos (comprimido el texto, tal cual los adjuntos), el manifest (recuentos, hashes que casan con cada archivo), el progreso, cancelar.
- JSON: el límite de 1 MB, `adjuntos_excluidos`, elementos con frontmatter y cuerpo, archivos de texto y binarios; reconstruir los `.md` desde `yaml` y `cuerpo` da el mismo archivo.
- Leer un ZIP: tamaños, métodos, ZIP64 y un ZIP roto o truncado.
- Interfaz: el botón y `Ctrl+E` descargan, la señal y el porcentaje, el aviso, la última copia y el piloto; un fallo no apunta copia; el JSON con excluidos no cuenta como copia.

## Criterios de aceptación

- La prueba de propiedad de ida y vuelta pasa; `pnpm verificar` en verde; ninguna tarea del Worker pasa de 25 ms por trozo (F0-2; la medida en el navegador queda para la validación humana).

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Leer OPFS desde otro Worker mientras el del almacén escribe | `getFile()` no toma el cerrojo; antes se espera lo pendiente. Un archivo a medio escribir se reintenta una vez. |
| ¿Carpeta `rimor/` dentro del ZIP (como el árbol de la referencia)? | No: los archivos en la raíz del ZIP, como en el espacio («toda la raíz», plan §13.5). El árbol de la referencia nombra el ZIP. |
| JSON reconstruible | Además del frontmatter leído, su YAML tal cual: importar no depende de volver a escribir el YAML. |
| La exportación ocupa memoria | Los trozos del ZIP se juntan en un `Blob`, no en un solo `Uint8Array`. |
| `copia-al-dia` solo si la copia es completa | El JSON con adjuntos excluidos no apunta la copia. |

## Autorrevisión

Cubre las seis tareas y la prueba de propiedad del plan. Aplica F0-2 (Worker, streaming, métodos por tipo, lectura por el directorio central) y lo ya hecho (estado de cuidado, piloto, avisos, `Senal`, descarga). La copia previa la usarán quienes la necesiten; vaciar la papelera mantiene la suya (decisión registrada).

## Implementación

- `src/datos/exportar.ts`: `exportarZip` (fflate `Zip` con `ZipDeflate` y `ZipPassThrough`, trozos de 256 KB cediendo el hilo, progreso por bytes, cancelación), `exportarJson`, `manifestExportado` (en orden canónico), `recuentosDe`, `sha256`, `aBase64`, `nombreExportacion` y `fueraDeLaExportacion`.
- `src/datos/leerZip.ts`: `entradasZip` (directorio central), `leerEntrada` (infla con el tamaño declarado como tope y comprueba el CRC-32), `crc32` y `trozosDe` (bytes o `Blob`).
- `src/workers/exportar.worker.ts`: abre la carpeta del espacio en OPFS y exporta; `src/datos/exportacion.ts`: `exportarEspacio` (Worker o, sin él o si falla, el hilo; descarga; apunta la copia si es completa) y `useExportacion` (tipo y porcentaje); `src/datos/useExportar.tsx`: el gancho con los avisos (con la señal de copia al día) y el motivo para la copia previa.
- `EspacioAbierto` expone `id`, `almacen` y `esperarEscrituras`. `descargarBlob` en `lectores/descargar.ts`.
- Datos y copias: «Exportar ZIP» (botón señal) e «Importar…» (deshabilitado hasta IN-036) en la tarjeta de cuidado, la señal «exportando» con el porcentaje mientras tanto, «Otras exportaciones» (JSON único) y «Qué contiene el ZIP».
- `Ctrl+E` (también en la paleta) desde la carcasa, en un ámbito `global-exportar`; el gestor de atajos trata `global-…` como global.
- Pruebas: `datos/exportar.test.ts` (ZIP, manifest, progreso, cancelar, JSON, lector de ZIP y la **propiedad de ida y vuelta** con fast-check) y `rutas/datos/Datos.test.tsx` (botón, `Ctrl+E`, aviso, copia y piloto, JSON con excluidos, fallo, una a la vez, copia previa).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El `manifest.json` exportado va en un orden de claves fijo | Leer un manifest con su esquema reordena las claves: sin orden fijo, la segunda exportación no daba el mismo archivo. |
| Un `.md` de `elementos/` que no se reconstruye exacto (sin frontmatter, saltos `\r\n`) va en `archivos` con su texto | El JSON nunca pierde un byte. |
| El módulo exportador se carga al exportar | `Ctrl+E` está en la carcasa: si no, fflate iría en la carga inicial. |
| La copia previa es `useExportar()('zip', motivo)`; vaciar la papelera sigue con su copia propia | Quien la necesite (IN-036, IN-060) la llama; la papelera ya descargaba su ZIP antes de borrar. |

