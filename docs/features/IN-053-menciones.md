# IN-053 · Enlaces automáticos

## Objetivo y catálogo

Que lo que un elemento menciona lo conecte con otros: una ref (`LOG-0042`) en unas notas, o un enlace a un paquete, hace que el mencionado sepa quién lo menciona.

- **Catálogo:** ORG-10, enlaces automáticos: «Menciones de refs (`LOG-0042`), paquetes o huellas conectan elementos», v0.2. Depende de IN-012.
- **Plan §7:** la vista de vecinos (IN-074) usará «mencionado por».

## Estado de partida

- El lector Texto saca las refs de su original (`mencionesDe`) y las enseña en su respuesta. Nadie guarda quién menciona a quién.
- `reescribirRefs` (de la importación) cambia refs como palabras enteras, de una pasada.
- **Cambiar el tipo** da otra ref (`TXT-0002` → `IDE-0001`) y deja la vieja en `alias`, que sigue llevando al elemento.
- **La caché del espacio** (IndexedDB) guarda el frontmatter de cada archivo y se rehace leyendo solo lo nuevo o cambiado. El repositorio arma su índice en memoria desde ella, sin abrir los archivos. Las notas y el original no están en el frontmatter.
- **Las huellas** ya conectan: los errores con la misma huella forman un hilo (IN-030) y un grupo (IN-052, «mismo error» en sus detalles).

## Diseño

### Términos de un elemento (`src/almacen/menciones.ts`, TS puro)

- Los términos de un elemento son lo que menciona:
  - las refs de sus notas y de su original (los primeros 512 KB), sin la suya ni sus alias;
  - los paquetes de los enlaces que contienen (`paquete:crates.io/ureq`).
- Como mucho 200 por elemento.
- `refsEn` (la de siempre del lector Texto, que ahora la importa de aquí), `paqueteDe` (el mismo de los grupos) y `reescribirRefs` (la de la importación, aquí y reexportada).

### El índice inverso (repositorio y caché)

- Se guarda en la caché, junto al frontmatter de cada entrada (`menciones`): se calcula al leer el archivo (al reconciliar o al guardarlo), así que abrir el espacio no relee nada. Una entrada sin `menciones` (de antes) se vuelve a leer al reconciliar (sin subir la versión de la caché, que tiraría también derivados e índice de búsqueda).
- **El repositorio** mantiene los términos de cada elemento y, al revés, quién menciona cada término. Se actualiza al guardar, al indexar y al borrar.
- **`mencionadoPor(ref)`** devuelve los que mencionan su ref o un alias suyo y, si es un enlace a un paquete, los que enlazan ese paquete. No cuenta él mismo ni lo de la papelera, y van de lo más reciente a lo más antiguo.
- **Las huellas** conectan por su grupo y su hilo, que ya existen: no se repiten aquí. Una huella no aparece escrita en un texto.

### Renombrar una ref

- Cuando cambiar el tipo da otra ref, las **notas** de quien mencionaba la vieja pasan a la nueva (con su `modificado`, para que al importar cuente como cambio). Cada nota se reescribe en su turno.
- El **original** capturado no se toca: la ref vieja sigue llevando al elemento como alias, y su mención cuenta.

### En los detalles del elemento

- La fila «Mencionado por», con las refs de quien lo menciona (que llevan a él): como mucho 6 y «y N más». Si no hay, «Nadie todavía».

## Tareas

- [x] Índice inverso de menciones (refs, paquetes y huellas) actualizado al guardar.
- [x] «Mencionado por» en los detalles del elemento.
- [x] Renombrar una ref actualiza sus menciones.

## Pruebas previstas

- `menciones.ts`:
  - los términos: refs de notas y original, sin las suyas, paquetes y límite;
  - `refsEn`, `paqueteDe` y `reescribirRefs`.
- Repositorio:
  - `mencionadoPor` por ref, por alias y por paquete;
  - al editar, deja de mencionarlo;
  - la papelera;
  - rehecho desde la caché sin abrir los archivos.
- `cambiarTipo` con otra ref:
  - las notas pasan a la nueva y su `modificado` cambia;
  - el original no se toca y sigue contando por el alias.
- Detalles: «Mencionado por» con sus refs, que llevan a ellos, y «Nadie todavía».

## Criterios de aceptación

- `pnpm verificar` en verde.
- Escribir `LOG-0042` en unas notas hace que LOG-0042 diga quién lo menciona.
- Cambiar el tipo de LOG-0042 actualiza esas notas.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Releer todos los archivos para el índice | Va en la caché: se calcula una vez por archivo, al leerlo. |
| Reescribir el original al renombrar | No: es lo capturado (su hash). La vieja sigue como alias. |
| Huellas «mencionadas» | Ya conectan por su hilo y su grupo; no se escriben en el texto. |

## Autorrevisión

Cubre las tres tareas; las huellas, con lo que ya hay (hilo y grupo). Reutiliza:

- la extracción de refs del lector Texto;
- `reescribirRefs` de la importación;
- la clasificación de URL de los grupos;
- la caché y su reconciliación;
- `alias`.

## Implementación

- `src/almacen/menciones.ts`: `refsEn`, `paqueteDe`, `nombreComparable`, `terminoPaquete`, `terminosDe` y `reescribirRefs`. La importación, los grupos y el lector Texto los usan de aquí.
- Caché: `EntradaFrontmatter.menciones` y `VERSION_CACHE` 2. `reconciliar` y `refrescarCache` guardan los términos.
- `Repositorio`: `terminos` y `mencionadoEn` (el índice inverso), `anotarTerminos`, `mencionadoPor` y `mencionanRef`.
- `reprocesar.ts`: `renombrarMenciones` desde `cambiarTipo`.
- `Comunes.tsx`: la fila «Mencionado por».
- Pruebas: `menciones.test.ts` (términos, índice y caché), `reprocesar.test.ts` (renombrar) y `Elemento.test.tsx` (la fila).

Nota de proceso: el código se escribió antes que esta ficha, que se commiteó sola antes que él (2feedcf) y recoge lo decidido. Queda registrado en «Desviaciones».

## Verificación

- `pnpm verificar` en verde (ver `docs/seguimiento.md`).
- La revisión independiente encontró 15 hallazgos; quedan así:
  1. **Renombrar reescribía notas ajenas también dentro de URLs y de código, sin historial ni aviso.** Ahora reescribe solo el texto corriente, con su copia en el historial (`guardarConHistorial(…, 'edicion')`), y no toca lo que está en la papelera. Va en segundo plano y avisa «N notas que lo mencionaban, actualizadas».
  2. Un alias que ya es la ref vigente de otro elemento (tras importar) no se lleva sus menciones.
  3. **Sin cambio:** una ref que se reutiliza tras vaciar la papelera hereda las menciones del borrado. Ya pasaba antes (`asignarRef` toma el máximo más uno); evitarlo pide un registro de refs retiradas, apuntado en «Notas para funcionalidades futuras».
  4. **La caché:** no sube de versión (subirla tiraba también los derivados y el índice de búsqueda). Una entrada sin `menciones` se vuelve a leer al reconciliar, también si la escribió una pestaña con el código anterior.
  5. `releerPendientes` también actualiza las menciones de la ref de archivo que cambia.
  6. **Huellas:** las de 16 hexadecimales copiadas en unas notas o un texto conectan con el error de esa huella.
  7. `cambiarTipo` vuelve ya y renombra en segundo plano. Cada nota tocada es un cambio, con su copia, como cualquier edición.
  8. Detectar y reescribir usan la misma frontera: ni letra, ni cifra, ni guion, ni subrayado.
  9. Sin menciones falsas:
     - fuera de URLs y de código;
     - en el índice, solo refs de elementos (no `HIL-`, `INV-` ni `CMP-`: los lectores sí las siguen enseñando como mención);
     - de los originales, solo los de prosa (texto, idea, Markdown y prompt): en un log, `ERR-1001` es de otro sistema.
  10. Como mucho 150 refs y, aparte, 50 paquetes o huellas. Los originales que van como adjunto (más de 2 MB) no se miran.
  11. Un enlace no se menciona a sí mismo por su paquete: su original no es prosa.
  12. **Sin cambio:** las menciones en entidades (la nota de un hilo, las fuentes de una comparación) no se indexan. Siguen funcionando por el alias; IN-069 e IN-074 las tendrán en cuenta.
  13. «Mencionado por» son enlaces con «ref: título» como nombre (se pueden abrir en otra pestaña), y «Ver los N».
  14. **Pruebas añadidas:**
      - el camino por alias, con uno que menciona solo en su original;
      - restaurar de la papelera;
      - la caché al guardar, y las entradas sin menciones;
      - el alias que choca;
      - las huellas;
      - URLs, código, entidades y fronteras;
      - la papelera al renombrar;
      - el historial;
      - que no salga quien no menciona.
      - **Sin prueba propia:** `releerPendientes`, que usa la misma función ya probada.
  15. `delEnlace` clasifica cada URL una vez (`paqueteDeDestino`).
