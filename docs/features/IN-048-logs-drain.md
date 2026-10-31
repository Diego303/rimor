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
- Árbol de Drain (He et al., 2017; los parámetros de Drain3): raíz por **nivel y número de palabras** (no se juntan un ERROR y un INFO, ni dos de distinto largo); después, **las 2 primeras palabras** como nodos (una palabra con un marcador o un dígito va por el nodo comodín `<*>`; como mucho 100 hijos por nodo, el resto por el comodín); en la hoja, los grupos.
- Una plantilla entra en el grupo de su hoja **más parecido**, si se parece lo bastante: la fracción de palabras iguales (las `<*>` del grupo no cuentan como iguales) ≥ **0,5**; con empate, el de más comodines. Al entrar, las palabras que difieren pasan a `<*>`. Si no se parece a ninguno, abre un grupo.
- Los marcadores conocidos (`<N>`, `<ID>`…) son palabras como las demás: dos plantillas que solo difieren en uno ya eran la misma.
- Resultado: cada plantilla normalizada → su grupo; la plantilla del grupo es la que se enseña. Lineal en las plantillas distintas (como mucho una hoja por plantilla y unos pocos grupos por hoja).

### En el análisis

- `analizar` agrupa por texto como hoy (rápido) y, al final, pasa las plantillas distintas por Drain: `plantillas` y `lineaPlantilla` salen de los grupos (por frecuencia, como ahora). Se mantiene el presupuesto: 50.000 líneas en menos de 2 s en el Worker.
- El lector `log` sube a la **versión 2**: los derivados guardados (y las comparaciones de logs, que guardan la versión de sus fuentes) se recalculan con las plantillas nuevas.
- `PlantillaPintada` pinta `<*>` como los demás marcadores.

## Tareas

- [ ] Algoritmo tipo Drain (árbol de prefijos con umbral de similitud) en el Worker para campos variables desconocidos.
- [ ] Versión del lector sube y recalcula.
- [ ] Comparación de logs con las nuevas plantillas.

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
