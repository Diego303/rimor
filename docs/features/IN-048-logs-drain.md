# IN-048 · Logs: plantillas con Drain

## Objetivo y catálogo

Que las plantillas de un log agrupen también las líneas que solo se distinguen por campos variables **que no tienen una forma conocida** (un usuario, un host, una ruta de archivo, un nombre de cola): «user ana logged in» y «user luis logged in» son la misma plantilla, `user <*> logged in`. Con un algoritmo tipo **Drain** (árbol de prefijos con umbral de similitud), en el Worker. Catálogo: **LEC-04 (v0.2)** (plan §8.1: «En v0.2, un algoritmo de agrupación de plantillas tipo Drain para detectar campos variables que no sigan patrones conocidos»). Depende de IN-020.

## Estado de partida

- `lectores/log/analisis.ts` normaliza cada línea quitando las marcas de tiempo y sustituyendo UUID, IP, hexadecimales y números por `<ID>`, `<IP>`, `<HEX>` y `<N>`; las líneas con el mismo texto normalizado comparten plantilla (`indice` por texto). Los logs estructurados (JSON, logfmt) hacen su plantilla con el nivel, el mensaje y las claves.
- `DatosLog.plantillas` (por frecuencia) y `lineaPlantilla` (la plantilla de cada línea) alimentan la vista (la tabla, el filtro de líneas), la respuesta («{p} plantillas»), la cifra `plantillas` y la comparación de logs (CMP-01: divergencia y mensajes por plantilla).
- `PlantillaPintada` pinta los marcadores como píldoras.
- El lector `log` está en la versión 1; su derivado va en la caché por versión.

## Diseño

### Drain (`src/lectores/log/drain.ts`, TS puro)

- Sobre las plantillas normalizadas (no sobre las líneas: miles de líneas comparten la misma), cada una con su recuento y su nivel, en el orden en que aparecen.
- Árbol de Drain (He et al., 2017): raíz por **nivel y número de palabras** (no se juntan un ERROR y un INFO, ni dos de distinto largo); después, **la primera palabra que no es el nivel** como nodo (una palabra con un marcador o un dígito va por el nodo comodín `<*>`; como mucho 100 hijos por nodo, el resto por el comodín); en la hoja, los grupos.
- Una plantilla entra en el grupo de su hoja **más parecido**, si se parece lo bastante: la fracción de palabras iguales sin contar el nivel (las `<*>` del grupo no cuentan como iguales) ≥ **0,6**; con empate, el de más comodines; una **ruta** (`/api/items`) distinta no se junta nunca. Al entrar, las palabras que difieren pasan a `<*>`. Si no se parece a ninguno, abre un grupo.
- Los marcadores conocidos (`<N>`, `<ID>`…) son palabras como las demás: dos plantillas que solo difieren en uno ya eran la misma.
- Resultado: cada plantilla normalizada → su grupo; la plantilla del grupo es la que se enseña. Lineal en las plantillas distintas (como mucho una hoja por plantilla y unos pocos grupos por hoja).

### En el análisis

- `analizar` agrupa por texto como hoy (rápido) y, al final, pasa las plantillas distintas por Drain: `plantillas` y `lineaPlantilla` salen de los grupos (por frecuencia, como ahora). Se mantiene el presupuesto: 50.000 líneas en menos de 2 s en el Worker.
- El lector `log` sube a la **versión 2**: los derivados guardados (y las comparaciones de logs, que guardan la versión de sus fuentes) se recalculan con las plantillas nuevas.
- `PlantillaPintada` pinta `<*>` como los demás marcadores.

## Tareas

- [x] Algoritmo tipo Drain (árbol de prefijos con umbral de similitud) en el Worker para campos variables desconocidos.
- [x] Versión del lector sube y recalcula.
- [x] Comparación de logs con las nuevas plantillas.

## Pruebas previstas

- Drain: junta lo que solo difiere en un campo (usuarios, hosts, rutas, colas), no junta mensajes distintos del mismo largo ni de niveles distintos, ni palabras iniciales distintas; el comodín en su sitio; el orden de llegada no cambia el resultado de los casos claros; idempotente con plantillas ya generalizadas.
- Análisis: las cifras de los ejemplos de `fixtures/logs/` (con sus plantillas revisadas a mano), `lineaPlantilla` coherente con las plantillas, la respuesta y la cifra.
- Comparación de logs: dos logs que solo difieren en los usuarios ya no divergen.
- Rendimiento: 50.000 líneas con muchos campos variables por debajo de 2 s (en el proyecto `rendimiento`).

## Criterios de aceptación

- `pnpm verificar` en verde; un log con campos variables desconocidos se resume en menos plantillas, con `<*>` donde varía; la versión del lector sube y la comparación usa las plantillas nuevas.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Juntar de más (dos mensajes distintos que se parecen) | Umbral 0,5 con las 2 primeras palabras exactas y el mismo largo y nivel; las pruebas fijan casos que no deben juntarse. |
| El orden de llegada cambia los grupos (Drain es incremental) | Se procesan en el orden del log, determinista; las plantillas del grupo solo se generalizan. |
| Coste | Drain va sobre las plantillas distintas (pocas), no sobre las líneas. |

## Autorrevisión

Cubre las tres tareas. Reutiliza la normalización, el orden por frecuencia, la vista, la comparación y la caché por versión; lo nuevo es un paso puro después del agrupamiento por texto.

## Implementación

- `src/lectores/log/drain.ts` (`agrupar`, `COMODIN`) y `juntarConDrain` en `analisis.ts`, al final del agrupamiento por texto: `plantillas` y `lineaPlantilla` salen de los grupos.
- Lector `log` en la versión 2; `PlantillaPintada` pinta `<*>`.
- Pruebas: `drain.test.ts` (lo que se junta y lo que no, determinismo, análisis y comparación), `drain.rendimiento.test.ts` (50.000 líneas con 5.000 usuarios en menos de 2 s), `PlantillaPintada.test.tsx`. Los ejemplos de `fixtures/logs/` dan las mismas plantillas que antes (ninguno tenía campos variables desconocidos).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Una sola palabra de prefijo, la primera que no es el nivel (Drain3 usa dos) | Con dos, un campo variable en la segunda palabra («user ana logged in») nunca se juntaba; y en los logs de texto la primera palabra suele ser el nivel, que no distingue nada. |
| Umbral 0,6 sin contar el nivel (Drain3: 0,4) | Con una sola palabra de prefijo hace falta parecerse más: «failed to open file» y «failed to parse json» no son la misma plantilla. |
| Una ruta distinta no se junta | En un log de peticiones la ruta es lo que interesa; con Drain sin más, `GET /api/salud` y `GET /api/items` quedaban en `GET <*>` (pasaba en `go.log`). |
