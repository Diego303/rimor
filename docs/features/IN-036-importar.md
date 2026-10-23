# IN-036 · Importar ZIP y JSON

## Objetivo y catálogo

Traer un espacio exportado (de otro equipo o de una copia) sin miedo: se valida todo antes de escribir nada, se enseña qué va a pasar y se elige cómo importarlo con una sola decisión. Catálogo: **DAT-04** (importar con validación, vista previa y tres modos) y **SEG-04** (ZIP seguros: rutas, tamaños, número de archivos). Depende de IN-035 (exportar y el lector de ZIP) e IN-029 (historial de versiones).

## Estado de partida

- IN-035 exporta el ZIP y el JSON único con su `manifest.json` (recuentos y hashes SHA-256) y trae `leerZip` (directorio central validado: rutas seguras, sin repetir ni solapar, límites de 50.000 archivos y 2 GB, inflado con tope y CRC-32). La copia previa es `useExportar()('zip', motivo)`.
- `@rimor/formato`: `leerManifest`, `leerElemento` (frontmatter con esquema), `leerEntidad`, `leerColecciones`, `migrar` (hoy solo el esquema 1: identidad), `asignarRef`, `rutaElemento`, `rutaHistorial`.
- El espacio sabe releerlo todo de sus archivos (lo que hace al recibir un cambio de otra pestaña). El índice de búsqueda se pone al día solo tras cada cambio.
- La referencia (`SC.importar`): cabecera «Importar» con el nombre del archivo y «162 MB · exportado desde otro equipo el 10 oct»; una tarjeta con «✓ ZIP válido: esquema 1, 412 archivos, ninguna ruta fuera del espacio.», cuatro cifras (nuevos, idénticos, actualizados, en conflicto, este en ámbar) y «Ver los 2 conflictos» plegado; otra, «Cómo importar», con tres opciones (fusionar, reemplazar, espacio nuevo) y «Cancelar» e «Importar».

## Diseño

### Leer y validar (`src/datos/importar/paquete.ts`)

`leerPaquete(archivo)` acepta un `.zip` o un `.json` (el JSON único de IN-035, que se convierte en los mismos archivos: `yaml` + `cuerpo`, base64, texto). **Antes de escribir nada**, en este orden, y el primer fallo para con su regla y su archivo:

1. **ZIP:** lo de `leerZip` (rutas fuera del espacio o absolutas, repetidas, solapadas, número, tamaño, bomba, CRC) y además **enlaces simbólicos** (atributos de Unix) rechazados. Se ignoran las carpetas y lo que nunca se importa (`.rimor/cache/`, `.rimor/operacion.json`).
2. **`manifest.json`:** existe, es de Rimor y su esquema no es más nuevo que el de la app.
3. **Hashes:** cada archivo del manifest está y su SHA-256 casa; un archivo que no está en el manifest se rechaza (salvo un manifest sin hashes, hecho a mano: se avisa).
4. **Esquemas:** cada `.md` de `elementos/` y `papelera/` se lee con su esquema; `colecciones.json` y las entidades (`comparaciones/`, `hilos/`), con los suyos.
5. **Migración** si el esquema es antiguo (`migrar`; hoy, identidad).

### Vista previa (`src/datos/importar/plan.ts`, TS puro)

Compara el paquete con el espacio, elemento a elemento **por `id`** (en `elementos/` y en la papelera):

- **nuevo:** el `id` no está aquí;
- **idéntico:** los mismos bytes;
- **actualizado:** distinto, y aquí no ha cambiado desde que se exportó el paquete (el del paquete gana);
- **en conflicto:** distinto, y aquí sí ha cambiado después de la exportación: **gana el más reciente** (`modificado`) y el otro va a `historial/`. El detalle de cada conflicto dice cuál se queda.
- **refs que chocan:** un nuevo cuya ref ya usa otro elemento de aquí recibe la siguiente libre; se reescriben sus menciones en lo importado y la vieja queda en `alias`.

El resto: los adjuntos (por hash) y el historial se suman sin pisar; `colecciones.json` se junta (las del paquete que falten, al final); las entidades nuevas se añaden y las que ya están se quedan (aviso en la vista previa si difieren); `manifest.json` y `.rimor/` (estado, ajustes, contadores) son de este navegador y se quedan.

### Modos (`src/datos/importar/aplicar.ts`)

- **Fusionar:** escribe lo nuevo, lo actualizado y el ganador de cada conflicto (el perdedor, a `historial/` con su fecha), y lo demás según arriba; después el espacio lo relee todo.
- **Reemplazar:** primero el **ZIP automático** de lo que hay (`antes de reemplazar`); si no se pudo, no se toca nada. Después se borran los archivos del espacio (menos `manifest.json` y `.rimor/`) y se escriben los del paquete; el espacio lo relee.
- **Espacio nuevo:** se escribe en otra carpeta de OPFS con su manifest (id nuevo, «<nombre> (importado)») y se ofrece abrirlo (la app se recarga en él). Sin OPFS (espacio en memoria), no se ofrece.
- El índice de búsqueda y las colecciones se ponen al día en segundo plano (al releer).

### Pantalla Importar (`/importar`)

- «Importar…» de Datos y copias abre el selector de archivos (`.zip`, `.json`) y lleva a `/importar` con el archivo elegido.
- Mientras se comprueba, la señal «analizando» con «Comprobando el ZIP…». Si se rechaza: `ErrorTarjeta` («No se puede importar este archivo») con el archivo y la regla («elementos/../x.md: una ruta sale del espacio»).
- Si vale: como la referencia (cabecera, tarjeta con la comprobación, las cuatro cifras, conflictos y refs reasignadas plegados; «Cómo importar» con los tres modos, «Cancelar» e «Importar»).
- Al terminar: `<Senal estado="guardado" veces={1}>` con «Importado: 23 nuevos, 18 actualizados, 2 conflictos resueltos · reindexando», y el enlace a Inicio (o «Abrir el espacio nuevo»).

## Tareas

- [x] Validación antes de escribir nada: rutas sin `..` ni absolutas; límites de tamaño descomprimido (2 GB) y de número de archivos (50.000); `manifest` y esquemas; hashes.
- [x] Migración si el esquema es antiguo.
- [x] Vista previa: nuevos, idénticos, actualizados y en conflicto, con el detalle de cada conflicto.
- [x] Modos: fusionar (por `id`; gana el más reciente y el otro va a `historial/`), reemplazar (con ZIP previo automático) y espacio nuevo.
- [x] Choque de refs: reasignar la del importado, reescribir sus menciones y guardar `alias`.
- [x] Reindexado en segundo plano.
- [x] Final con `<Senal estado="guardado" veces={1}>`; un rechazo usa `ErrorTarjeta` y dice qué archivo y qué regla.

## Pruebas previstas

- **Corpus de ZIP maliciosos** (zip slip, bomba, rutas absolutas, enlaces simbólicos, repetidos, solapados, hashes que no casan, archivo de más, manifest de otro formato o de un esquema futuro, elemento sin esquema): se rechazan **sin escribir nada** (el almacén queda igual byte a byte).
- Plan: cada categoría, conflictos en los dos sentidos, refs que chocan (con sus menciones y `alias`), adjuntos, historial, colecciones y entidades.
- Los tres modos con espacios de ejemplo: lo que queda en el espacio, el historial de los perdedores, el ZIP previo de reemplazar (y que sin él no se toca nada), el espacio nuevo en su carpeta.
- JSON único: se importa igual que su ZIP.
- Pantalla: elegir el archivo, comprobar, rechazo con su archivo y regla, vista previa, modos, importar y el final.

## Criterios de aceptación

- El corpus malicioso se rechaza sin escribir nada y los tres modos dejan los espacios esperados; `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| «Si los dos cambiaron» sin saber la versión común | Se mira `manifest.exportado`: si aquí se modificó después, los dos cambiaron (conflicto); si no, el del paquete es una versión posterior (actualizado). |
| Memoria con paquetes grandes | Se lee entero tras validar el directorio (límite de 2 GB); los adjuntos se escriben de uno en uno. Para lo que el navegador no aguante, el límite se puede bajar. |
| Reemplazar sin copia | El ZIP previo es obligatorio: si no se descarga, no se toca nada. |
| ¿El estado y los ajustes del paquete? | Son de este navegador (persistencia, última copia): se quedan los de aquí en todos los modos menos en el espacio nuevo, que empieza con los suyos. |
| Varios espacios es DAT-09 (v0.2) | «Espacio nuevo» crea la carpeta y abre ese espacio recargando la app; cambiar entre espacios llega con IN-060. |

## Autorrevisión

Cubre las siete tareas y las dos pruebas del plan. Reutiliza el lector de ZIP y la copia previa de IN-035, los esquemas y migraciones de `@rimor/formato`, el historial de IN-029 y la relectura del espacio. Nada se escribe antes de validar el paquete entero.

## Implementación

- `src/datos/importar/paquete.ts`: `leerPaquete` (ZIP o JSON) y `ErrorImportar` (regla y archivo): el ZIP con `leerZip` y además los enlaces simbólicos (`leerZip` los marca por sus atributos de Unix), el manifest, los hashes (falta, no casa, sobra), la migración y los esquemas.
- `src/datos/importar/plan.ts`: `planear` (categorías por `id`, ganador por `modificado`, perdedor al historial, refs reasignadas con `alias` y menciones reescritas en notas y entidades, historial movido a la ref nueva, adjuntos e historial sumados, colecciones juntadas, entidades y archivos de aquí que se quedan con aviso) y `reescribirRefs`.
- `src/datos/importar/aplicar.ts`: `fusionar`, `reemplazar` (escribe primero y borra después), `enEspacioNuevo` y `manifestNuevo`.
- `src/datos/importar/importacion.ts`: `comprobar`, `importar` (el plan se rehace con lo de ahora antes de fusionar; reemplazar exige la copia previa) y el archivo elegido (`useArchivoImportar`).
- `EspacioAbierto.recargar()` (la relectura completa, avisando a la otra pestaña); `RepositorioEntidades.entradas()`; `cambiarDeEspacio(id)` en `Espacio.tsx`.
- `src/rutas/importar/Importar.tsx` (ruta `/importar`) como `SC.importar`, y «Importar…» en Datos y copias.
- Pruebas: `datos/importar/importar.test.ts` (corpus malicioso, ZIP y JSON iguales, plan, refs, modos) y `rutas/importar/Importar.test.tsx` (rechazo sin escribir nada, vista previa y fusionar, reemplazar con su copia previa, el selector de Datos y copias).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Las entidades nuevas cuya ref ya se usa aquí también reciben otra (sin `alias`, que su esquema no tiene) | Una comparación o un hilo del paquete no debe pisar ni esconder uno de aquí. |
| Un archivo que ya está aquí y es distinto (que no sea un elemento) se queda el de aquí, con aviso en la vista previa | Solo los elementos tienen fecha de modificación para decidir. |
| Los elementos se escriben al final (los adjuntos primero) | Si se corta, ningún elemento apunta a un adjunto que falta. |
| Importar está deshabilitado en la pestaña que solo lee | Solo la que escribe puede escribir. |

