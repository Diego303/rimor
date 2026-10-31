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

- [x] Grupos por huella, dominio, repositorio, paquete, etiqueta, tipo y mes.
- [x] Panel común de grupo (qué hay, cuándo, qué se repite y elementos) como en la pantalla «Colección».
- [x] Acciones de grupo: exportar ZIP y comparar seleccionados (crear investigación, en v0.3).

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

## Implementación

- `src/espacio/grupos.ts`: `clavesDe`, `enGrupo`, `elementosDe`, `panelDe` y `rutasDeGrupo`.
- `src/rutas/grupo/PanelGrupo.tsx`: `CuerpoGrupo` (qué hay, cuándo, se repite y elementos, con la selección para comparar) y `ExportarGrupo`.
- `src/rutas/grupo/Grupo.tsx`: la pantalla y la ruta `/g/$clase/$valor`, con `?vista`.
- Colección: el panel en lugar de la lista, y «Exportar ZIP».
- Exportar: `OpcionesExportar.solo` (rutas y prefijos), en el hilo y en el Worker. `exportarEspacio({ solo })` no apunta la copia, y `useExportar` acepta `solo`.
- Detalles del elemento: la fila «Grupos», con un enlace por clave.
- `BarraH` acepta el color del tipo.
- Pruebas: `grupos.test.ts`, el ZIP y el JSON con `solo`, y `Grupo.test.tsx` (panel, se repite, comparar, vacío, colección y detalles).

## Verificación

- `pnpm verificar` en verde (ver `docs/seguimiento.md`).
- La revisión independiente encontró 14 hallazgos, atendidos con pruebas salvo donde se dice:
  1. **El ZIP de un grupo no llevaba los hilos de sus errores**: al importarlo, su `hilo` apuntaba al HIL-NNNN de aquí. Ahora lleva las entidades de hilo que citan sus elementos, y la ref se reasigna como con el ZIP completo (prueba de ida y vuelta).
  2. El pie de «Cuándo» decía el mes de hoy: ahora, el del pico.
  3. **La selección para comparar sobrevivía al cambiar de grupo** (TanStack no vuelve a montar la ruta): ahora el panel va por `key`, y lo marcado que sale del grupo se poda.
  4. **«Comparar»**:
     - ya no sale en una pestaña que solo lee;
     - se deshabilita con el motivo si los dos no se comparan;
     - es el botón primario de Inicio;
     - con dos marcados, los demás esperan (no se desmarca uno en silencio).
  5. **Coste**:
     - `panelDe` es lineal;
     - `enGrupo` solo analiza URL de enlaces y peticiones;
     - la lista enseña los 8 más recientes y «Ver los N» (como la referencia), con los resúmenes en un `useMemo`;
     - el nombre propuesto de sesión, solo en las sesiones;
     - la exportación mira cada carpeta en un conjunto.
  6. Las fechas se comparan por su instante, no como texto (desfases distintos en el cambio de hora).
  7. **El ZIP de un grupo**:
     - lleva el historial de sus alias, `colecciones.json` y `sesiones.json` (que se juntan al importar);
     - el manifest lo marca como `parcial`, e Importar deshabilita «Reemplazar» con su motivo.
  8. Dominios sin `www.` ni `m.`, legibles (punycode), sin puerto ni credenciales. Repositorios y paquetes sin `.git`, en minúsculas donde no distinguen. Etiquetas sin duplicar por mayúsculas.
  9. En el grupo de una huella, «Se repite» no se pinta (sería ella misma).
  10. Los elementos del grupo se calculan al pintar: sin un instante «vacío» ni el grupo anterior.
  11. **Textos y rutas**:
      - el de vacío ya no dice «archivado»;
      - `/g/tipo/foo` da vacío;
      - «N veces · última hoy», como en la referencia;
      - `/g/coleccion/x` lleva a `/c/x`;
      - «hoy» se pone al día cada minuto.
  12. **Accesibilidad y aspecto**:
      - el gráfico tiene su texto para lectores de pantalla (los días con algo);
      - la pista va unida a las casillas;
      - las casillas, con el acento;
      - en la cabecera, solo «Exportar ZIP» (como la referencia): el selector de vista pasa a la tarjeta «Elementos»;
      - la fila «Grupos» ya no repite las colecciones y enseña como mucho 6 grupos («y N más»).
  13. Código muerto de `Coleccion.tsx` fuera.
  14. **Pruebas añadidas**:
      - ida y vuelta con un hilo;
      - manifest parcial;
      - Importar con un ZIP parcial;
      - motivo de comparación y selección al cambiar de grupo;
      - «Ver los N» y `/g/tipo/foo`;
      - `/g/coleccion` a la colección;
      - normalización y orden con desfases.
      - **Sin prueba:** el mes del pico a principios de mes (haría falta falsear la fecha en la interfaz). Es una línea, revisada a mano.

**Decisión.** VIS-04 (plan §9.4) cita también el estado (abiertos, resueltos y archivados), los fijados entre los recientes y lo más frecuente (dominios, paquetes y etiquetas). La especificación de IN-052 limita el panel a qué hay, cuándo, qué se repite y elementos, como la pantalla de referencia: lo demás queda para las facetas de Buscar (IN-056).
