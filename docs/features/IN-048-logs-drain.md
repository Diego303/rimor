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

- `src/lectores/log/drain.ts` (`agrupar`, `juntarPlantillas`, `COMODIN`, `pareceVariable`), llamado al final del agrupamiento por texto de `analizar`: `plantillas` y `lineaPlantilla` salen de los grupos.
- Lector `log` en la versión 2; `PlantillaPintada` pinta `<*>`.
- Pruebas: `drain.test.ts`, `drain.rendimiento.test.ts`, `PlantillaPintada.test.tsx`. Los ejemplos de `fixtures/logs/` dan las mismas plantillas que antes (ninguno tenía campos variables desconocidos).

La primera versión era un Drain incremental (árbol por nivel, largo y primera palabra; umbral de parecido 0,6). La revisión de la verificación la cambió por la de abajo (ver «Verificación»).

### Algoritmo final

- **Pasada 1, identificadores**: una palabra con dígitos o `@` (`ana_92`, `worker7`, `ana@x.es`) es variable; las plantillas de la misma clase (nivel) que coinciden en todo lo demás se juntan, con `<*>` donde difieren.
- **Pasada 2, huecos**: para cada posición, las que coinciden en todo salvo en ella (por el hash de su prefijo y su sufijo, comprobando la igualdad) la pasan a `<*>` si toma al menos **5** valores distintos o si alguna ya la tiene variable. Se repite hasta que no cambia nada. Nunca la primera palabra del mensaje, el nivel (solo la primera palabra de nivel), una ruta, las claves `{…}` de un log estructurado ni un marcador; y nunca si quedaran fijas menos de la mitad de las palabras. Las plantillas de más de 40 palabras no pasan por aquí.
- Antes de la pasada 2, fuera las plantillas que no comparten con ninguna otra su esqueleto (lo que no puede ser hueco): en un log de accesos, con una ruta por plantilla, son todas.
- Determinista e independiente del orden; dos grupos de niveles distintos que acaban con el mismo texto son uno (como ya pasaba con dos plantillas iguales).
- **Comparación de logs**: vuelve a juntar la unión de las plantillas de los dos logs, así que un campo variable que en cada uno tiene pocos valores (3 usuarios en uno y 3 en otro) se encuentra con los de ambos.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Sin parecido: solo identificadores o huecos con 5 valores | Con un umbral de parecido se juntaban mensajes con otro sentido: «cache hit» y «cache miss», «Job <N> started» y «finished», «feature enabled» y «disabled», y cabeceras largas (Spring) que hacían parecidos a dos mensajes cualesquiera. Es mejor una plantilla de más que esconder un fallo. |
| 5 valores distintos para un hueco de palabras corrientes | Con 2, 3 o 4 son a menudo estados (iniciado, en curso, terminado, fallido) o verbos HTTP; con 5 o más, casi siempre un campo variable (usuarios, colas). Dos usuarios sin dígitos no se juntan: limitación aceptada. |
| La primera palabra corriente no se generaliza | Como Drain: suele ser el verbo («Accepted», «Failed»). |
| Una ruta se compara entera | En un log de peticiones es lo que interesa; sus partes numéricas ya llegan normalizadas (`/api/items/<N>`). `/users/alice/profile` y `/users/bob/profile` siguen separadas: limitación aceptada. |
| Las claves `{…}` y el nivel no se generalizan | Las claves dicen qué es el mensaje; el nivel es la clase. |
| Arrays normales, hashes de 30 bits y esqueletos | Con typed arrays pequeños y claves de 53 bits, 50.000 plantillas distintas tardaban 700 ms solo en agrupar; ahora unos 350. |

## Verificación

- `pnpm verificar` en verde (ver `docs/seguimiento.md`).
- Revisión independiente (11 hallazgos), todos atendidos:
  1. **Coste cuadrático** con muchas plantillas en una hoja (10.000 líneas de accesos con rutas distintas, 14 s): ahora lineal; pruebas de rendimiento con 50.000 rutas distintas y con 20.000 plantillas de 40 palabras.
  2. **La comparación separaba** dos logs porque Drain corría por separado en cada uno: ahora junta la unión de sus plantillas (prueba con 3 usuarios en cada log).
  3. **Dependía del orden** de llegada: ahora no (prueba con el mismo conjunto barajado con cuatro semillas).
  4. **Juntaba mensajes con otro sentido** (sshd Accepted/Failed, Job started/finished, cache hit/miss, enabled/disabled, cabeceras de Spring y Python, excepciones distintas): sin parecido, con pruebas negativas de todos.
  5. **Dos plantillas con el mismo texto** y distinto nivel (clave de React duplicada en la vista, fusión en la comparación): ahora son una.
  6. El nivel excluía todas las palabras de nivel del mensaje: ahora solo la primera.
  7. El desbordamiento de hijos (100) juntaba primeras palabras distintas: ya no hay árbol.
  8. Las líneas de solo nivel y `[ERROR]` frente a `ERROR` acababan en `<*>`: el nivel no se generaliza nunca.
  9. **Accesibilidad**: el marcador «*» se lee como «campo variable» (texto para lectores de pantalla).
  10. Las claves `{…}` podían pasar a `<*>`: ya no; las rutas enteras y los mensajes de dos palabras quedan documentados arriba.
  11. La ficha decía «lineal» sin serlo: ahora lo es, con pruebas.
