# IN-052 · Grupos automáticos y pantalla de colección

## Objetivo y catálogo

Que cualquier grupo de elementos se vea de un vistazo: qué hay, cuándo se trabajó y qué se repite; lo demás es la lista.

- **ORG-09** (grupos automáticos): por huella, dominio, repositorio, paquete, etiqueta, tipo y mes. El plan (§7) también cita la sesión.
- **VIS-04** (panel común de grupo), como la pantalla «Colección» de la referencia (`SC.coleccion`).
- **Acciones de grupo**: crear investigación (desde v0.3), exportar ZIP y comparar los seleccionados.

Depende de IN-031 (la huella de los errores) e IN-051 (las sesiones).

## Estado de partida

- `/c/$coleccion` (IN-034) pinta la cabecera de la colección (renombrar, subir, bajar y borrar), el selector de vista y los elementos en lista, mosaico o densa. Su ficha dice: «el panel visual llega con IN-052».
- Lo que da cada clase de grupo, en el frontmatter:
  - la huella de un error está en `lector.resumen.huella`;
  - un enlace guarda `resumen.url` (`urls.clasificar` da su clase: repositorio, issue o PR con su `nombre`, y paquete con su registro y su nombre);
  - una petición HTTP guarda `resumen.host`;
  - las etiquetas, el tipo y la fecha (`creado`) son comunes.
- Exportar (`exportarEspacio`, en un Worker) hace el ZIP del espacio entero y, si está completo, lo apunta como copia.
- `useComparar(refA, refB)` crea la comparación de dos elementos. Inicio la ofrece con dos seleccionados.
- Los hilos se forman por huella (IN-030): `hiloDe` encuentra el de un error.
- **Referencia `SC.coleccion`:**
  - cabecera con icono, etiqueta, título, meta («N elementos · desde el 2 oct») y botones;
  - `split` con «Qué hay» (barras `.hb` por tipo, del color de cada tipo) y «Cuándo» (SVG de barras de las dos últimas semanas, con la del día en `--accent`);
  - «Se repite» (`.gap.hi`: la huella que más se repite, «N veces · última hoy» y «Ver hilo»);
  - «Elementos» (los 8 primeros y «Ver los N»).

## Diseño

### Grupos (`src/espacio/grupos.ts`, TS puro)

- `ClaseGrupo` = `coleccion | sesion | huella | dominio | repositorio | paquete | etiqueta | tipo | mes`.
- `clavesDe(fm)` da las claves de grupo de un elemento:
  - su colección y su sesión;
  - la huella si es un error;
  - el dominio, de la URL de un enlace o del host de una petición, sin `www.`;
  - el repositorio, `sitio/nombre`, si un enlace apunta a un repositorio, una issue o un PR;
  - el paquete, `registro/nombre`;
  - sus etiquetas, su tipo y su mes (`AAAA-MM` local).
- `elementosDe(clase, valor, elementos)`: los del grupo, de lo más reciente a lo más antiguo.
- `panelDe(elementos, ahora)`:
  - los recuentos por tipo, de más a menos;
  - las barras de los 14 días hasta hoy y el día del pico;
  - la fecha del más antiguo;
  - la huella que más se repite (al menos 2), con cuántas veces, la última fecha y un error de ejemplo.

### La pantalla de grupo (`/g/$clase/$valor`) y la de colección

- **Un panel común** (`rutas/grupo/PanelGrupo.tsx`), que usan las dos:
  - **Cabecera**: el icono de su clase, la etiqueta («Colección», «Etiqueta», «Dominio»…), el nombre (en la colección, el de siempre: renombrar en el sitio) y la meta «N elementos · desde el 2 oct». A la derecha, «Exportar ZIP».
  - **«Qué hay»**: una barra por tipo, del color del tipo (`--k-*`), con su recuento.
  - **«Cuándo»**: las barras de los 14 días; pie con el mes y «el pico es el día 16», o «sin actividad en las dos últimas semanas».
  - **«Se repite»** (solo si hay una huella repetida): su título, «N veces · última hoy» y «Ver hilo» si tiene hilo; si no, «Ver grupo» (el grupo de esa huella).
  - **«Elementos»**: el selector de vista (lista, mosaico o densa) y, en la lista, la casilla de cada uno para comparar. Con dos seleccionados comparables, «Comparar».
- **«Crear investigación»** no se pinta hasta v0.3 (IN-064): la referencia lo marca como de esa versión.
- **La colección** mantiene su cabecera editable y lo plegado (subir, bajar y borrar), con el panel entre medias.

### Exportar un grupo

- `exportarEspacio(espacio, 'zip', { motivo: nombreDelGrupo, solo })`, donde `solo` es la lista de rutas: los `.md` de sus elementos, sus adjuntos y su historial (prefijo `historial/REF/`). Llega hasta `exportarZip` (también en el Worker), que exporta solo eso con su manifest y sus hashes, así que se importa como cualquier ZIP.
- **No se apunta como copia del espacio**, porque no lo es.

### Cómo se llega a un grupo

- Desde los detalles del elemento: «Grupos», con un enlace por cada clave (la etiqueta, el dominio, el repositorio, el paquete, la huella, el tipo, el mes y la sesión).
- La colección, desde el raíl, como siempre.
- Las facetas de Buscar llegan con IN-056.

## Tareas

- [ ] Grupos por huella, dominio, repositorio, paquete, etiqueta, tipo y mes.
- [ ] Panel común de grupo (qué hay, cuándo, qué se repite y elementos) como en la pantalla «Colección».
- [ ] Acciones de grupo: exportar ZIP y comparar seleccionados (crear investigación, en v0.3).

## Pruebas previstas

- `grupos.ts`:
  - las claves de cada clase (un error, un enlace a un repositorio, a un paquete o a una web cualquiera, una petición, las etiquetas, el tipo y el mes);
  - los elementos de un grupo;
  - el panel: tipos, 14 días con el pico, desde cuándo y la huella repetida.
- Exportar con `solo`: solo esos archivos y el manifest con sus hashes; se importa; no se apunta como copia.
- Pantalla de grupo:
  - una etiqueta con su panel;
  - «Se repite» con «Ver hilo»;
  - la selección de dos y «Comparar»;
  - «Exportar ZIP»;
  - una clase o un valor que no existe dicen que está vacío.
- Pantalla de colección: el panel, y sigue renombrando y borrando.
- Detalles del elemento: los enlaces a sus grupos.

## Criterios de aceptación

- `pnpm verificar` en verde.
- La colección `gateway` del espacio de ejemplo se ve como en la referencia: qué hay, cuándo, qué se repite y elementos.
- Un ZIP de grupo se importa en otro espacio.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Coste de calcular grupos con miles de elementos | Al abrir el grupo, una pasada; las claves de un elemento, solo en sus detalles. |
| El ZIP de un grupo como copia | No: no se apunta (no es el espacio entero). |
| «Crear investigación» antes de v0.3 | No se pinta. |

## Autorrevisión

Cubre las tres tareas (crear investigación queda para v0.3, como dice la especificación). Reutiliza:

- las vistas de grupo de IN-034;
- `useComparar`;
- la exportación en su Worker;
- `hiloDe`;
- la clasificación de URL del lector Enlace;
- la pantalla y las reglas CSS de la referencia (`.split`, `.hb`, `.gap.hi`, `.list`).
