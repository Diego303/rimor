# IN-054 · Vistas guardadas

## Objetivo y catálogo

Guardar una búsqueda con nombre para volver a ella como a una colección que se llena sola.

- **Catálogo:** ORG-11, vistas guardadas («Una búsqueda con filtros guardada como colección inteligente», v0.2). Depende de IN-032 (la búsqueda).
- **Plan §4:** «Vista guardada: una búsqueda con filtros que se guarda y funciona como colección inteligente».
- **Anexo A:** `vistas.json`, en la raíz del espacio.
- **La pantalla «Colección»** de la referencia (VIS-04, ORG-09 y ORG-11) es la de una vista.

## Estado de partida

- Buscar (`/buscar?q=…`) entiende palabras, `tipo:`, `en:` (colección), `#etiqueta`, `estado:` y exclusiones (IN-032). `useBuscar(texto)` da los resultados y su total, al día con el espacio y con el índice.
- El raíl lista las colecciones con su recuento bajo «Colecciones», desde el estado de la carcasa (`useEspacio`).
- El panel común de grupo (IN-052, `CuerpoGrupo`) pinta qué hay, cuándo, qué se repite y los elementos de cualquier lista.
- Los registros del espacio en la raíz se guardan como los nombres de las sesiones (IN-051, `sesiones.json`): en orden, solo desde la pestaña que escribe, releídos con la otra, y juntados al importar.

## Diseño

### `vistas.json` (`src/espacio/vistas.ts`, TS puro)

- `{ "esquema": 1, "vistas": [{ "id": "errores-de-ureq", "nombre": "Errores de ureq", "consulta": "tipo:error ureq", "creada": "…" }] }`.
- El id sale del nombre (sin acentos, en minúsculas, con guiones) y no se repite (`-2`…).
- **Lectura tolerante:** lo que no se entiende se ignora; un archivo roto o de un esquema más nuevo no se sobrescribe.
- **Operaciones:** crear, renombrar (el id no cambia) y borrar.
- **Importar:** se juntan; ante el mismo id, la de aquí.

### En el espacio

- `vistas()` y `guardarVistas(cambio)`, como `sesiones()`: con los tres estados de lectura (leídas, ilegibles y sin leer).

### Crear una vista

- **En Buscar**, con una consulta escrita: «Guardar como vista». Abre un diálogo con su nombre (propuesto: la consulta) y la crea.
- Si ya hay una vista con esa consulta, en lugar del botón se dice «Guardada como «nombre»», con un enlace a ella.

### La pantalla de una vista (`/v/$vista`)

- **Cabecera:** el icono de buscar, «Vista», el nombre (se edita en el sitio, como el de una colección) y la meta «N elementos · desde el …». La consulta va en monoespaciada debajo del título, con «Editar la búsqueda» (lleva a Buscar con ella).
- **Cuerpo:** el panel común de grupo con los resultados de la búsqueda (al día con el espacio).
- **«Exportar ZIP»**, como un grupo.
- **Plegado al final:** «Borrar la vista», con confirmación. Los elementos se quedan.
- Una vista que no existe dice que no se encuentra.

### En el raíl

- Bajo «Colecciones», después de las colecciones: cada vista con el icono de buscar, su nombre y su **recuento vivo** (el total de su búsqueda, que se rehace con cada cambio). Si solo hay vistas, la etiqueta «Colecciones» también sale.

## Tareas

- [ ] Guardar una búsqueda con nombre en `vistas.json`.
- [ ] Aparece en el raíl bajo Colecciones con su recuento vivo.

## Pruebas previstas

- `vistas.ts`: el id y su sufijo; crear, renombrar y borrar; lectura tolerante y escritura; juntar al importar.
- Espacio: guarda y relee; un archivo ilegible no se toca; la pestaña que solo lee no escribe.
- Buscar: «Guardar como vista» crea la vista; con la misma consulta, «Guardada como…».
- Pantalla de vista: los resultados con el panel, renombrar en el sitio, «Editar la búsqueda» y borrar con confirmación; una que no existe.
- Raíl: la vista con su recuento, que cambia al capturar algo que casa.
- Importar: `vistas.json` se junta, y uno roto se rechaza.

## Criterios de aceptación

- `pnpm verificar` en verde.
- Guardar «tipo:error» como vista la pone en el raíl con su recuento; capturar un error lo sube.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Recuento vivo con muchas vistas (una búsqueda por vista a cada cambio) | `useBuscar` ya espera al tecleo y corta la anterior. Las vistas son pocas. |
| Una consulta que deja de casar con nada | La vista se queda, con 0: es una búsqueda, no una lista fija. |

## Autorrevisión

Cubre las dos tareas. Reutiliza `useBuscar`, el panel común de grupo, el título en el sitio de la colección, el patrón de los registros del espacio (IN-051) y la importación por juntado.
