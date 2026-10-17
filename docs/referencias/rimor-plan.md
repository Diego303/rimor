# Rimor: plan del proyecto

> **Documento de referencia y plan de proyecto.** Versión 2 · 17 de octubre de 2026.
> Va junto a `rimor-diseno.md` (la guía de diseño y estilo), `struo.md`, `propuestas-apps-hermanas.md` e `indago.md` (el memorándum con todo el recorrido de la idea, cuando el proyecto aún se llamaba Indago).
> **Pantallas de referencia:** el artefacto «Pantallas de Rimor» (v3, estilo Instrumento, claro y oscuro) muestra cada pantalla con datos de ejemplo, los IDs de funcionalidad y notas de desarrollo (Anexo I).
> **Estado:** plan listo para revisar. Antes de escribir código de producto hay que hacer la **Fase 0** (pruebas técnicas, §19).

**Cambios respecto a la versión 1:**
- **Inicio sustituye a Hoy, Bandeja y Captura:** se captura como en un chat, con un compositor fijo abajo, y Rimor contesta a cada captura con lo que ha entendido (§9.1, CAP-13, CAP-14, P13).
- **Hilos:** lo que va junto se encadena solo, por huella de error o al responder a algo (§9.2, ORG-15).
- **Métricas:** pocas cifras locales y accionables, sin puntuaciones ni rachas (§9.6, MET-01 a MET-07).
- **Interfaz más limpia:** una sola columna de lectura, sin inspector, con lo secundario plegado (§17).
- **Identidad visual decidida:** estilo **Instrumento**, descrito en `rimor-diseno.md` (§17.2, D2).

---

## Índice

1. En una frase
2. Por qué existe
3. Para quién
4. Principios de producto
5. Conceptos
6. Cómo se usa: el ciclo y escenarios reales
7. Catálogo de funcionalidades
8. Lectores en detalle
9. Organización, grupos y visualización
10. Búsqueda
11. Investigación y decisión
12. Documentos: informes y minipapers
13. Datos: almacenamiento, exportación e importación
14. Arquitectura técnica
15. Privacidad y seguridad
16. IA opcional
17. Interfaz y diseño
18. Calidad y pruebas
19. Hoja de ruta
20. Cómo se desarrolla
21. Métricas de éxito
22. Riesgos y mitigaciones
23. Fuera de alcance
24. Relación con Struo
25. Decisiones abiertas
26. Anexos
27. Fuentes

---

## 1. En una frase

**Rimor es una app web, local y privada, para técnicos e investigadores: pegas cualquier cosa (un log, un error, unas mediciones, un enlace, un prompt, un plan en Markdown, una idea) y Rimor entiende qué es, lo analiza, lo ordena con lo demás y te ayuda a convertirlo en conclusiones, decisiones, informes y minipapers.**

### El nombre

*Rimor* es un verbo latino: «rebusco a fondo, exploro hasta en las grietas». Viene de *rima*, grieta. Es hermano de Struo («construyo»), con el mismo formato (verbo latino en primera persona, dos sílabas) y un carácter propio: Struo es para aprender lo que ya existe; Rimor, para rebuscar en lo que encuentras mientras trabajas hasta entenderlo.

Y en español suena a **rumor**, que es justo como llega casi todo lo que guarda la app: a medias, mientras estás con otra cosa. Un log raro, un enlace que alguien menciona, una idea que no puedes atender ahora. *«Tengo un rimor de esto»*: lo echas a Rimor y ya lo rebuscarás.

**Frase guía:** *del rumor a la conclusión.*

**Lo que la hace distinta, en tres líneas:**
1. **Una sola puerta, como un chat:** escribes, pegas o sueltas abajo y Rimor contesta con lo que ha entendido. Sin formularios ni carpetas que elegir.
2. **Cada tipo tiene un lector que trabaja:** normaliza un log, calcula la estadística de unas mediciones, saca la huella de un error, versiona un prompt.
3. **Todo acaba en algo útil:** grupos que se ven, búsquedas que encuentran, investigaciones con evidencia y documentos que se exportan.

---

## 2. Por qué existe

### 2.1. El problema

El trabajo técnico diario deja un rastro desordenado:

- logs y trazas de error en terminales que se cierran;
- mediciones de pruebas que nadie vuelve a comparar bien;
- enlaces en pestañas, marcadores y chats;
- prompts que funcionaron y que no se encuentran cuando hacen falta;
- planes de implementación en Markdown que cambian sin que quede claro qué cambió;
- ideas sueltas a las once de la noche;
- conclusiones que se pierden porque nunca llegan a escribirse.

Cuando hay que responder «¿esto ya me pasó?», «¿qué decidimos y por qué?» o «escríbeme un informe de esto», hay que reconstruirlo todo a mano.

### 2.2. Lo que ya existe y por qué no basta

| Herramienta | Qué hace bien | Por qué no cubre esto |
|---|---|---|
| Obsidian | Archivos locales, enlaces, plugins | Lo organizas tú; no entiende ni procesa lo que pegas |
| Tana | Objetos tipados a partir de lo capturado | Pensada para reuniones y equipos, en la nube, sin instrumentos de cálculo |
| Mem | Conecta notas solo, con IA | No clasifica por tipo ni procesa nada |
| Pieces | Fragmentos de código y memoria a largo plazo para desarrolladores | Captura pasiva de todo lo que ves, con consumo alto de CPU y RAM; sin investigaciones ni informes |
| DEVONthink | Archivo documental potente | Solo Mac, centrado en documentos |
| Heptabase | Tarjetas y pizarras para investigar | Datos dentro de su ecosistema; no procesa logs ni datos |
| Langfuse, PromptHub y similares | Versiones de prompts | Pensadas para equipos y operación de modelos, no para uso personal |
| benchstat, diff, Excel, Jupyter | Cada uno resuelve una pieza | Piezas sueltas, sin memoria ni camino a un informe |

**El hueco:** captura intencional (tú decides qué entra), lectores por tipo que calculan, todo en archivos tuyos y un camino directo hasta un informe. Nadie combina las cuatro cosas.

### 2.3. La trampa y la regla que la evita

«Una app donde echar cualquier cosa» es la categoría más saturada del software de productividad. Si Rimor solo guardara y etiquetara, sería una más.

> **Regla de oro:** un tipo de contenido solo entra en Rimor si Rimor puede **hacer algo con él** además de guardarlo. Si no, cae en el lector genérico de texto y punto.

### 2.4. Cómo se llegó aquí

Resumen del memorándum `indago.md`: se exploraron un cuaderno de diagnóstico con hipótesis, una versión para TFG, un laboratorio de ejecuciones y un equipo de agentes con «cartuchos». Ninguna hacía click porque todas pedían trabajo (formularios) antes de devolver nada, o porque su núcleo era un prompt que cualquiera copia en semanas. El prototipo «banco de instrumentos» sí funcionó: pegas algo y la app trabaja. Este plan parte de ahí.

**Cambio de nombre.** El proyecto se llamó Indago hasta el 17 de octubre de 2026. Se descartó porque Vectorio, una startup de Berlín, presentó en GITEX 2026 un producto llamado Indago con un enfoque muy parecido (motor local de descubrimiento con informes citados). Tras revisar unas treinta alternativas, se eligió Rimor.

---

## 3. Para quién

**Usuario cero: el autor.** Arquitecto de software y desarrollador de Struo, que depura, mide, evalúa tecnologías, trabaja con agentes de IA, escribe planes y documenta. Cada decisión se valida con una pregunta: *¿lo usaría mañana?*

| Perfil | Qué pegará más | Desde qué versión le sirve bien |
|---|---|---|
| Desarrollador o arquitecto | Logs, errores, mediciones, prompts, planes, enlaces a repos y paquetes | v0.1 |
| Ingeniero (sistemas, datos, infraestructura) | Logs, datos CSV o JSON, configuraciones, comandos | v0.2 |
| Investigador de I+D | Enlaces a papers, PDF, datos, mediciones, ideas | v0.2 y v0.3 |
| Estudiante técnico (TFG o TFM de ingeniería o ciencias) | Fuentes, datos, mediciones, borradores | v0.3 y v0.4 |
| Matemático o físico | Fórmulas, cálculos con unidades, minipapers | v0.3 y v0.4 |

Interfaz en español primero, preparada para inglés desde el día uno.

---

## 4. Principios de producto

Si una funcionalidad viola alguno, no entra.

| # | Principio | En la práctica |
|---|---|---|
| P1 | **Una sola puerta** | Pegar, soltar o compartir. La app detecta el tipo; nunca te pide que lo elijas antes. |
| P2 | **Cada tipo, su lector** | Un tipo existe solo si su lector hace trabajo real (regla de oro, §2.3). |
| P3 | **El original es sagrado** | Lo que pegas se guarda íntegro (salvo secretos ocultados, §15). Todo lo calculado se puede regenerar. |
| P4 | **Corriges, no rellenas** | Título, tipo, etiquetas y origen se infieren. Tú solo corriges. Ningún campo es obligatorio. |
| P5 | **Tus datos son archivos tuyos** | Markdown con metadatos, exportable en ZIP y legible sin Rimor (incluso en Obsidian). |
| P6 | **Local y privado** | Nada sale del navegador sin una acción explícita. Sin cuenta, sin servidor, sin telemetría. |
| P7 | **El código calcula; la IA propone** | Todos los números salen de código determinista. La IA es opcional y nunca calcula ni decide. |
| P8 | **Honestidad con los datos** | «No hay diferencia clara» es un resultado válido. Una métrica sin datos suficientes no se muestra. |
| P9 | **Visual para pensar** | Cada vista responde a una pregunta. Nada de gráficos decorativos ni grafos ilegibles. |
| P10 | **Rápido o no sirve** | Capturar y ver el resultado en menos de un segundo para contenidos normales. |
| P11 | **Nada se pierde sin querer** | Papelera, historial de versiones, avisos de copia de seguridad y exportación de un clic. |
| P12 | **Sin burocracia ni culpa** | Cerrar, aparcar o cancelar son salidas válidas. La app orienta; nunca regaña. |
| P13 | **Rimor contesta** | Cada captura recibe una respuesta de una o dos frases con lo que se ha entendido y calculado. Si hay una decisión, se ofrece con botones. Las respuestas salen de plantillas deterministas, no de una IA (P7). |

---

## 5. Conceptos

| Concepto | Qué es |
|---|---|
| **Espacio de trabajo** | Tu «vault»: el conjunto de archivos de Rimor guardado en el navegador. Puede haber varios. |
| **Elemento** | Cualquier cosa capturada: un log, un error, una idea, un enlace… Es un archivo Markdown con metadatos. |
| **Tipo** | La clase de un elemento (log, error, mediciones, prompt…). Lo detecta la app. |
| **Lector** | El módulo que entiende un tipo: lo detecta, lo procesa, calcula datos derivados y lo muestra. |
| **Derivados** | Lo que calcula un lector (plantillas de un log, estadísticas, huella de un error). Se pueden regenerar. |
| **Cifras citables** | Valores con nombre que un lector expone (`mediana`, `cambio`, `p`) y que un documento puede citar en vivo. |
| **Comparación** | Un elemento que relaciona dos o más del mismo tipo y guarda el resultado (dos logs, dos series de mediciones). |
| **Inicio** | La portada: un feed de lo capturado, con un compositor fijo abajo. Sustituye a la antigua bandeja. |
| **Compositor** | La caja de captura de Inicio. Admite indicaciones opcionales: `@colección`, `#etiqueta`, `/tipo`, `?buscar`. |
| **Respuesta de Rimor** | Una o dos frases que el lector genera al capturar: qué es, qué ha calculado y qué recuerda. |
| **Sin clasificar** | Lo capturado que aún no está en ninguna colección, hilo ni investigación. Es un filtro de Inicio, no un sitio aparte. |
| **Hilo** | Una cadena ligera de elementos que van juntos: se forma sola por huella de error o al responder a algo. Puede convertirse en investigación. |
| **Métrica** | Una cifra local sobre tu propio trabajo (qué se repite, cuánto tardas en resolver), visible solo con datos suficientes. |
| **Colección** | Un grupo manual. Un elemento puede estar en varias. |
| **Grupo automático** | Agrupación calculada: por tipo, sesión, huella de error, dominio, paquete, etiqueta. |
| **Vista guardada** | Una búsqueda con filtros que se guarda y funciona como colección inteligente. |
| **Sesión** | Elementos capturados en el mismo rato de trabajo, agrupados solos. |
| **Huella** | Firma estable de un error, para reconocer el mismo error aunque cambien números, rutas o IDs. |
| **Investigación** | Una pregunta con sus elementos vinculados como evidencia, hipótesis opcionales, decisión y cierre. |
| **Evidencia** | Un elemento vinculado a una investigación con un papel: apoya, contradice o da contexto. |
| **Documento** | Un informe, ADR, postmortem o minipaper escrito en Markdown que puede incrustar elementos y citar cifras. |
| **Qué falta** | Reglas que detectan huecos verificables: conclusión sin evidencia, una sola medición, decisión frágil… |

---

## 6. Cómo se usa: el ciclo y escenarios reales

### 6.1. El ciclo

```
  CAPTURA ──▶ LECTURA ──▶ ORDEN ──────────▶ INVESTIGACIÓN ──▶ PUBLICACIÓN
  escribir,   el lector   inicio, hilos,      evidencias,        informe,
  pegar,      detecta,    colecciones,        decisión,          ADR,
  soltar      y contesta  búsqueda, vistas    qué falta          minipaper
     ▲                                                               │
     └────────── lo publicado y lo aprendido vuelven como elementos ─┘
```

No es obligatorio recorrerlo entero. La mayoría de días bastará con capturar, encontrar y comparar. La investigación y el documento aparecen cuando hace falta una conclusión.

### 6.2. Escenarios

**Depurar un fallo.**
1. Pegas la traza de un error en el compositor. Rimor la reconoce, separa tu código del de las librerías, calcula su huella y contesta: *«Es la tercera vez. El 15 oct escribiste: “Pasa cuando la respuesta no trae content-length”.»* El error entra en el hilo de los anteriores.
2. Pegas el log de la ejecución buena y el de la mala, y pulsas «Comparar»: primera divergencia en la línea 4 y los mensajes que solo aparecen en la mala.
3. Respondes en el hilo con una línea sobre la causa y lo marcas como resuelto. La próxima vez, Rimor te enseñará esa nota.

**Evaluar una tecnología.**
1. Pegas los enlaces a dos repositorios. Rimor crea dos fichas con datos de mantenimiento, licencia y dependencias, con fecha.
2. Lanzas tu benchmark en la terminal, pegas las dos salidas y obtienes el veredicto estadístico.
3. Seleccionas los elementos y pulsas «Crear investigación». La matriz de decisión aparece prellenada; «Qué falta» avisa de que solo hay una medición.
4. Generas el ADR.

**Trabajar con IA.**
1. Pegas un prompt que te funcionó y la respuesta. Rimor detecta las variables `{{archivo}}` y guarda modelo, valoración y respuesta.
2. Una semana después pegas la versión mejorada: queda como versión 2 con el diff respecto a la 1.
3. Cuando lo necesitas, lo buscas, rellenas las variables y lo copias listo para usar.

**Seguir un plan.**
1. Pegas el `plan.md` de una implementación. Rimor extrae el índice y las tareas: 4 de 18 hechas.
2. Días después pegas la versión nueva: ves qué secciones cambiaron y qué tareas se marcaron.

**Una idea a las once de la noche.**
1. Escribes una línea en el compositor y Enter. Rimor contesta: *«Idea guardada. Volverá dentro de 7 días si no haces nada con ella.»*
2. Cuando vuelve, aparece en Inicio con tres botones: más adelante, descartar o convertir en investigación.

**Cerrar con un minipaper.**
1. Desde una investigación, «Nuevo documento» con la plantilla de minipaper. Salen las secciones con los huecos marcados, sin texto inventado.
2. Arrastras la comparación de mediciones: entran la tabla y la gráfica, numeradas.
3. Escribes el texto citando cifras en vivo (`{{MED-0007.cambio}}`).
4. Exportas a PDF o LaTeX. Si los datos cambian después, el documento te avisa.

---

## 7. Catálogo de funcionalidades

**Fases:** `F0` prueba técnica · `v0.1` a `v0.4` versiones · `Desp.` después. **Tamaño:** S pequeño, M medio, L grande.

### 7.1. Captura (CAP)

| ID | Funcionalidad | Descripción | Fase | Tam. |
|---|---|---|---|---|
| CAP-01 | Pegar en cualquier pantalla | `Ctrl+V` fuera de un campo de texto crea un elemento | v0.1 | S |
| CAP-02 | Soltar archivos | Arrastrar uno o varios archivos (texto, CSV, JSON, imágenes, PDF) | v0.1 | S |
| CAP-03 | Compositor | Caja fija abajo en Inicio y en los hilos: escribir o pegar, Enter guarda y Mayús+Enter salta de línea. Un atajo la enfoca desde cualquier pantalla | v0.1 | M |
| CAP-04 | Detector de tipo | Asigna tipo con una confianza; si duda, propone dos; corrección en un clic | v0.1 | M |
| CAP-05 | Ocultar secretos | Detecta claves, tokens y contraseñas y los sustituye antes de guardar (§15) | v0.1 | M |
| CAP-06 | Reglas de detección aprendidas | Si corriges el tipo de algo parecido varias veces, propone una regla | v0.2 | S |
| CAP-07 | Captura múltiple | Un pegado con varias URL o varios bloques se ofrece dividir en varios elementos | v0.2 | S |
| CAP-08 | PWA y compartir | Instalar Rimor y recibir contenido con «Compartir» (Web Share Target) | v0.2 | M |
| CAP-09 | Sobre de terminal | CLI mínima que copia al portapapeles un «sobre» con salida, comando, código de salida, directorio, commit y duración; Rimor lo reconoce al pegar | v0.3 | S |
| CAP-10 | Capturas de pantalla con OCR | Pegar una imagen extrae su texto para poder buscarlo | v0.3 | M |
| CAP-11 | Abrir archivos con Rimor | Asociar `.log`, `.csv`, `.md` o `.zip` a la PWA instalada (Chromium) | Desp. | S |
| CAP-12 | Extensión de navegador | Guardar una página, una selección o metadatos sin problemas de CORS | Desp. | L |
| CAP-13 | Indicaciones del compositor | Opcionales y escritas, nunca campos: `@colección` y `#etiqueta` en la última línea, `/tipo` al principio para forzar el tipo y `?texto` para buscar. Vista previa en vivo de cómo se guardará | v0.1 | S |
| CAP-14 | Respuesta de Rimor | Cada lector genera una o dos frases a partir de sus derivados (qué es, qué calcula, qué recuerda), con hasta dos acciones en botones. Plantillas deterministas, sin IA | v0.1 | M |

### 7.2. Lectores (LEC)

| ID | Lector | Fase | Tam. |
|---|---|---|---|
| LEC-01 | Texto y nota (genérico, red de seguridad) | v0.1 | S |
| LEC-02 | Idea | v0.1 | S |
| LEC-03 | Enlace: básico (normalización y clasificación) | v0.1 | S |
| LEC-03b | Enlace: enriquecido (GitHub, paquetes, DOI, arXiv) | v0.2 | M |
| LEC-04 | Log | v0.1 | M |
| LEC-05 | Error y traza de pila, con huella | v0.1 | M |
| LEC-06 | Mediciones | v0.1 | M |
| LEC-07 | Prompt de IA | v0.1 | M |
| LEC-08 | Documento Markdown (plan, especificación) | v0.1 | M |
| LEC-09 | Código y fragmentos | v0.1 | S |
| LEC-09b | Diff o parche | v0.2 | S |
| LEC-10 | Comando de terminal | v0.2 | S |
| LEC-11 | Datos tabulares (CSV, TSV, Parquet) | v0.2 | L |
| LEC-12 | JSON, YAML y TOML | v0.2 | M |
| LEC-13 | Petición HTTP (cURL) | v0.2 | S |
| LEC-14 | Imagen y captura de pantalla | v0.3 | M |
| LEC-15 | PDF | v0.3 | M |
| LEC-16 | Fórmula (LaTeX) | v0.3 | S |
| LEC-17 | Diagrama como texto (Mermaid, D2) | v0.3 | S |
| LEC-18 | Cálculo con unidades | v0.4 | M |

El detalle de cada lector está en §8.

### 7.3. Comparaciones y versiones (CMP)

| ID | Funcionalidad | Descripción | Fase | Tam. |
|---|---|---|---|---|
| CMP-01 | Comparar dos elementos | Logs y mediciones; el resultado se guarda como elemento Comparación | v0.1 | M |
| CMP-02 | Versiones | Pegar una versión nueva de un prompt, un Markdown o un código la guarda en su historial, con diff | v0.1 | M |
| CMP-03 | Comparar datos y JSON | Diferencias estructurales en JSON; antes y después en datos tabulares | v0.2 | M |
| CMP-04 | Comparar varias series | Más de dos series de mediciones a la vez | v0.3 | S |

### 7.4. Organización (ORG)

| ID | Funcionalidad | Descripción | Fase | Tam. |
|---|---|---|---|---|
| ORG-01 | Inicio | Feed de lo capturado con su respuesta, separado por días, y filtro «Sin clasificar»; triaje con teclado: asignar, archivar, fijar, responder, enviar a una investigación | v0.1 | M |
| ORG-02 | Colecciones | Grupos manuales; un elemento puede estar en varias | v0.1 | S |
| ORG-03 | Etiquetas inferidas y manuales | Se infieren de hashtags, paquetes, dominios, lenguajes y niveles de log | v0.1 | S |
| ORG-04 | Estados ligeros | Nuevo, en uso, resuelto, archivado (más los propios de ideas e investigaciones) | v0.1 | S |
| ORG-05 | Duplicados exactos | Mismo contenido: se avisa y se ofrece no duplicar | v0.1 | S |
| ORG-06 | Mismo error | Misma huella: se agrupa con las ocurrencias anteriores | v0.1 | S |
| ORG-07 | Fijar y papelera | Fijados arriba; papelera con restauración completa | v0.1 | S |
| ORG-08 | Sesiones automáticas | Capturas cercanas en el tiempo forman una sesión con nombre editable | v0.2 | M |
| ORG-09 | Grupos automáticos | Por huella, dominio, repositorio, paquete, etiqueta y tipo | v0.2 | M |
| ORG-10 | Enlaces automáticos | Menciones de refs (`LOG-0042`), paquetes o huellas conectan elementos | v0.2 | M |
| ORG-11 | Vistas guardadas | Una búsqueda con filtros guardada como colección inteligente | v0.2 | S |
| ORG-12 | Inicio con memoria | En el feed aparecen también las sesiones de días anteriores (resumidas en una tarjeta) y lo que vuelve: ideas e investigaciones que conviene revisar | v0.2 | M |
| ORG-13 | Resurgimiento | Ideas e investigaciones abiertas vuelven espaciadas en el tiempo, sin culpa | v0.3 | S |
| ORG-14 | Parecidos por significado | «Esto se parece a…» con búsqueda semántica local | v0.4 | M |
| ORG-15 | Hilos | Cadenas ligeras de elementos: se forman solos por huella de error o al pulsar «Responder». Enseñan «así lo resolviste», se marcan como resueltos con una nota y se convierten en investigación con un clic | v0.1 | M |

### 7.5. Búsqueda (BUS)

| ID | Funcionalidad | Descripción | Fase | Tam. |
|---|---|---|---|---|
| BUS-01 | Búsqueda global instantánea | Texto completo, tolerante a erratas, resultados agrupados por tipo | v0.1 | M |
| BUS-02 | Filtros con sintaxis | `tipo:log`, `en:gateway`, `#ureq`, `desde:2026-10-01`, `nivel:error` (Anexo G) | v0.1 | M |
| BUS-03 | Paleta de comandos | `Ctrl+K` mezcla acciones, elementos y vistas | v0.1 | S |
| BUS-04 | Facetas con recuento | Panel lateral con tipos, colecciones, etiquetas, fechas y su número de resultados | v0.2 | M |
| BUS-05 | Buscar en el contenido derivado | Dentro de las líneas de logs, celdas de datos y texto de OCR | v0.2 | M |
| BUS-06 | Buscar parecidos | Desde un elemento: por huella y etiquetas (v0.2); por significado (v0.4) | v0.2 / v0.4 | M |

### 7.6. Visualización (VIS)

| ID | Vista | Pregunta que responde | Fase | Tam. |
|---|---|---|---|---|
| VIS-01 | Vista de cada lector | ¿Qué hay en esto? | v0.1 | — |
| VIS-02 | Mosaico agrupado | ¿Qué tengo, ordenado por grupos? | v0.1 | M |
| VIS-03 | Lista densa | Recorrer muchos elementos rápido | v0.1 | S |
| VIS-04 | Panel de grupo | ¿Cómo es este grupo? (recuentos por tipo, evolución, errores más frecuentes, etiquetas) | v0.2 | M |
| VIS-05 | Línea de tiempo | ¿Qué pasó y en qué orden? (carriles por tipo, sesiones marcadas) | v0.2 | M |
| VIS-06 | Calendario de actividad | ¿Cuándo trabajé en esto? | v0.2 | S |
| VIS-07 | Gráficos de datos | Líneas, barras, dispersión e histograma desde datos y mediciones | v0.2 | M |
| VIS-08 | Tablero por estado | ¿En qué punto están mis ideas e investigaciones? | v0.3 | S |
| VIS-09 | Vecinos de un elemento | ¿Con qué está relacionado esto? (solo vecinos directos) | v0.3 | S |
| VIS-10 | Lienzo de investigación | Ordenar a mano tarjetas y flechas en el espacio | v0.3 | L |
| VIS-11 | Matriz de decisión y sensibilidad | ¿Qué opción gana y cuánto depende de cada peso? | v0.3 | M |
| VIS-12 | Mapa afirmación × evidencia | ¿Qué está respaldado y qué no? | v0.4 | M |

### 7.7. Investigación (INV)

| ID | Funcionalidad | Fase | Tam. |
|---|---|---|---|
| INV-01 | Investigación: pregunta, estado y elementos vinculados con papel (apoya, contradice, contexto) | v0.3 | M |
| INV-02 | Crear investigación desde una selección, un grupo o una búsqueda | v0.3 | S |
| INV-03 | Cronología automática con las fechas de captura | v0.3 | S |
| INV-04 | Interpretación por evidencia (una línea, opcional) | v0.3 | S |
| INV-05 | Hipótesis ligeras y opcionales, con estado | v0.3 | S |
| INV-06 | Matriz de decisión prellenada con sensibilidad | v0.3 | M |
| INV-07 | «Qué falta» (Anexo E) | v0.3 | M |
| INV-08 | Cierre: concluida, cancelada o aparcada, con una conclusión breve | v0.3 | S |

### 7.8. Documentos y publicación (DOC)

| ID | Funcionalidad | Fase | Tam. |
|---|---|---|---|
| DOC-01 | Editor Markdown (CodeMirror 6) con vista previa | v0.3 | M |
| DOC-02 | Insertar elementos: referencias e incrustaciones (tabla, gráfico, fragmento de log) | v0.3 | M |
| DOC-03 | Cifras vivas con aviso de desfase | v0.3 | M |
| DOC-04 | Plantillas: informe técnico, ADR, postmortem, comparativa, informe de cancelación, nota de investigación | v0.3 | S |
| DOC-05 | Documento desde investigación: estructura con huecos marcados, sin texto inventado | v0.3 | S |
| DOC-06 | Exportar Markdown (con figuras) y HTML autocontenido | v0.3 | M |
| DOC-07 | PDF mediante la impresión del navegador, con estilos de impresión cuidados | v0.3 | S |
| DOC-08 | Plantilla de minipaper | v0.4 | S |
| DOC-09 | Exportar Word y LaTeX con Pandoc en el navegador | v0.4 | M |
| DOC-10 | PDF tipográfico con Typst en el navegador (si la Fase 0 lo confirma) | v0.4 | M |
| DOC-11 | Bibliografía: BibTeX y estilos CSL desde los enlaces y papers capturados | v0.4 | M |
| DOC-12 | Verificador de referencias antes de exportar | v0.4 | S |
| DOC-13 | Numeración de ecuaciones, figuras y tablas con referencias cruzadas | v0.4 | M |
| DOC-14 | «Qué falta» del documento: cifras escritas a mano sin origen, referencias rotas, secciones vacías | v0.4 | S |
| DOC-15 | Anexo reproducible: ZIP con el documento, sus datos y sus comandos | v0.4 | S |

### 7.9. Datos y almacenamiento (DAT)

| ID | Funcionalidad | Fase | Tam. |
|---|---|---|---|
| DAT-01 | Espacio de trabajo como archivos `.md` en el almacenamiento privado del navegador (OPFS) | v0.1 | M |
| DAT-02 | Índice y derivados en caché (IndexedDB), regenerables desde los archivos | v0.1 | M |
| DAT-03 | Exportar el espacio completo en ZIP | v0.1 | S |
| DAT-04 | Importar ZIP con validación, vista previa y tres modos (fusionar, reemplazar, espacio nuevo) | v0.1 | M |
| DAT-05 | Exportar e importar un JSON único | v0.1 | S |
| DAT-06 | Pedir almacenamiento persistente; indicador de espacio y de la última copia | v0.1 | S |
| DAT-07 | Recordatorio de copia de seguridad | v0.1 | S |
| DAT-08 | Historial de versiones por elemento | v0.1 | M |
| DAT-09 | Varios espacios de trabajo | v0.2 | S |
| DAT-10 | Exportar una selección, colección o investigación como ZIP | v0.2 | S |
| DAT-11 | Importar una carpeta de Obsidian o de Markdown suelto | v0.3 | M |
| DAT-12 | Copia automática a una carpeta del disco (solo Chromium) | Desp. | M |
| DAT-13 | Espejo en una carpeta del disco como almacenamiento principal (solo Chromium) | Desp. | L |

### 7.10. Seguridad, IA e interfaz

| ID | Funcionalidad | Fase | Tam. |
|---|---|---|---|
| SEG-01 | Saneado de todo lo que se renderiza (nada pegado se ejecuta) | v0.1 | S |
| SEG-02 | Política de seguridad de contenido estricta; red solo para enriquecer, con dominios visibles | v0.1 | S |
| SEG-03 | Modo sin red | v0.2 | S |
| SEG-04 | Importación de ZIP segura (rutas, tamaños, tipos) | v0.1 | S |
| IA-01 a IA-07 | IA opcional (§16) | Desp. | — |
| APP-01 | Atajos de teclado (Anexo H) | v0.1 | S |
| APP-02 | Tema claro y oscuro | v0.1 | S |
| APP-03 | Primer uso con un espacio de ejemplo | v0.1 | S |
| APP-04 | Ajustes: detección, secretos, red y copias | v0.1 | S |
| APP-05 | Diseño adaptable (capturar y consultar en el móvil) | v0.1 | M |
| APP-06 | Funcionamiento sin conexión (PWA) | v0.2 | M |
| APP-07 | Internacionalización (español primero, inglés preparado) | v0.1 | S |

### 7.11. Métricas (MET)

| ID | Métrica | Pregunta que responde | Fase | Tam. |
|---|---|---|---|---|
| MET-01 | Cifras que sigues | ¿Cómo evoluciona este número? Una cifra citable vista a lo largo de varias mediciones | v0.2 | M |
| MET-02 | Lo que más se repite | ¿Qué errores vuelven y cuáles no tienen nota de solución? | v0.2 | S |
| MET-03 | Tiempo hasta resolver | ¿Cuánto tardo en cerrar un hilo? Mediana y reparto por tramos | v0.3 | S |
| MET-04 | Qué capturas | ¿En qué se me va el trabajo? Capturas por semana y tipo | v0.2 | S |
| MET-05 | Pendiente, sin prisa | Ideas sin tocar, investigaciones paradas y elementos sin clasificar, con una acción para cada uno | v0.3 | S |
| MET-06 | Lo que te ha ahorrado Rimor | Errores reconocidos, duplicados evitados, prompts copiados con valores y búsquedas útiles | v0.2 | S |
| MET-07 | Resumen de la semana | Las métricas de la semana convertidas en un documento editable | v0.3 | S |

---

## 8. Lectores en detalle

Todos los lectores siguen la misma interfaz (§14.4): **detectar → leer → derivar → mostrar → acciones → cifras citables.** Los derivados se calculan en un Web Worker para no bloquear la interfaz.

### 8.1. Log (LEC-04)

- **Detecta:** varias líneas con marcas de tiempo, niveles (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`) o formatos conocidos (JSON por línea, syslog, logfmt).
- **Lee:** guarda el log original íntegro. Si pasa de un tamaño (propuesta: 2 MB), va como adjunto y el `.md` guarda el resumen.
- **Calcula:**
  - número de líneas, rango temporal y recuento por nivel;
  - **plantillas**: cada línea normalizada quitando fechas, UUID, IP, hexadecimales y números (como en el prototipo), con su recuento. En v0.2, un algoritmo de agrupación de plantillas tipo Drain para detectar campos variables que no sigan patrones conocidos;
  - pares `clave=valor` extraídos;
  - primer y último error.
- **Muestra:** histograma de líneas por minuto y nivel, tabla de plantillas, lector del log con niveles coloreados y filtro por plantilla.
- **Acciones:** comparar con otro log (CMP-01: primera divergencia, mensajes nuevos, ausentes y con frecuencia distinta), buscar dentro, guardar como evidencia.
- **Cifras citables:** `lineas`, `errores`, `avisos`, `duracion`, `plantillas`.
- **Límites:** objetivo de 50.000 líneas en menos de 2 segundos (§14.7). Más allá, se analiza en bloques.

### 8.2. Error y traza de pila (LEC-05)

- **Detecta:** patrones de trazas de Rust (`panicked at`, backtrace), Python (`Traceback (most recent call last)`), JavaScript y Node (`at función (archivo:línea:col)`), Java y Kotlin (`at paquete.Clase.método`), Go (`goroutine N [running]`) y .NET.
- **Calcula:**
  - tipo de error y mensaje;
  - **marcos de pila**, separando los de tu código de los de librerías o del sistema con heurísticas de ruta (`node_modules`, `site-packages`, `.cargo/registry`, `/rustc/`, `java.`, `System.`);
  - **huella**: hash del tipo de error, el mensaje normalizado y los primeros marcos de tu código. Dos errores iguales con números o rutas distintas comparten huella.
- **Muestra:** mensaje destacado, marcos plegables (los de librerías plegados por defecto) y **ocurrencias anteriores** con la misma huella, con las notas que escribiste.
- **Acciones:** «así lo resolví» (una nota que se mostrará la próxima vez), agrupar ocurrencias, guardar como evidencia.
- **Cifras citables:** `ocurrencias`, `primera_vez`, `ultima_vez`.

### 8.3. Mediciones (LEC-06)

- **Detecta:**
  - v0.1: una medida por línea, con o sin unidad (`ns`, `µs`, `us`, `ms`, `s`); salida de `go test -bench`; JSON exportado por hyperfine;
  - v0.2: JSON de pytest-benchmark, JSON de JMH, `estimates.json` de criterion, columnas CSV.
- **Calcula:** n, mediana, intervalo de confianza del 95 % de la mediana (estadísticos de orden), media, desviación típica, coeficiente de variación, mínimo, máximo, percentiles 5 y 95.
- **Al comparar dos series:**
  - cambio porcentual de las medianas;
  - prueba de Mann-Whitney con corrección por empates (la misma que usa benchstat);
  - en v0.2, el estimador de Hodges-Lehmann de la diferencia con su intervalo;
  - veredicto: «B es un 4,6 % más rápido, diferencia significativa» o «sin diferencia clara».
- **Avisos de método:** menos de 10 repeticiones (benchstat recomienda al menos 10, y 20 como ideal), ruido alto (coeficiente de variación por encima del 5 %), valores atípicos, y recordatorio de decidir el número de repeticiones antes de medir.
- **Muestra:** gráfico de puntos con la mediana y la banda del intervalo, y tabla de estadísticos.
- **Cifras citables:** `mediana`, `ic_bajo`, `ic_alto`, `n`, `cv`; en comparaciones, `cambio` y `p`.
- **Validación:** los cálculos se contrastan con valores de referencia (benchstat y SciPy) en pruebas automáticas (§18).

### 8.4. Prompt de IA (LEC-07)

- **Detecta:** texto largo en imperativo o segunda persona dirigido a un modelo, variables (`{{x}}`, `{x}`, `<x>`), bloques de rol (`system:`, `user:`), y formatos de configuración de agentes: `CLAUDE.md`, skills con `name` y `description` en el frontmatter, definiciones de agentes. Si duda, pregunta en un clic.
- **Guarda:**
  - el texto del prompt;
  - destino o modelo (opcional, inferido si se menciona);
  - variables detectadas;
  - **resultados**: respuestas pegadas al lado, cada una con valoración de 1 a 5 y una nota.
- **Calcula:** estimación de tokens, variables, longitud y estructura de secciones.
- **Versiones:** pegar un prompt muy parecido a uno existente propone guardarlo como versión nueva, con diff por líneas.
- **Acciones:** **copiar con valores** (rellenas las variables y se copia listo), comparar versiones, ver qué versión tuvo mejores valoraciones.
- **Por qué es valioso:** las herramientas de gestión de prompts del mercado están pensadas para equipos y para operar modelos en producción; para uso personal solo hay extensiones de navegador sencillas.

### 8.5. Documento Markdown (LEC-08)

- **Detecta:** encabezados, listas de tareas, bloques de código, tablas.
- **Calcula:** índice de secciones, recuento de palabras, **tareas** con su progreso (`4/18`), enlaces y bloques de código.
- **Versiones:** al pegar una versión nueva del mismo documento (mismo título o alta similitud), diff **por secciones**: qué secciones cambiaron, se añadieron o se quitaron, y qué tareas se marcaron.
- **Muestra:** documento renderizado, índice lateral y barra de progreso de tareas.
- **Cifras citables:** `tareas_hechas`, `tareas_total`, `palabras`.

### 8.6. Enlace (LEC-03 y LEC-03b)

- **Normaliza:** quita parámetros de seguimiento (`utm_*`, `fbclid`…) y fragmentos irrelevantes.
- **Clasifica por destino:** repositorio (GitHub, GitLab), paquete (npm, crates.io, PyPI, pkg.go.dev, Maven), paper (arXiv, DOI), documentación (`docs.*`, docs.rs, Read the Docs), issue o pull request, pregunta de Stack Overflow, vídeo u otro.
- **Enriquece (v0.2), según destino y si la API lo permite desde el navegador:**
  - repositorio: actividad reciente, último lanzamiento, issues abiertas, licencia y estrellas, con token opcional de GitHub para no chocar con el límite de peticiones;
  - paquete: última versión, fecha, dependencias y vulnerabilidades (deps.dev ofrece gratis y sin clave grafo de dependencias, licencias, avisos de seguridad y OpenSSF Scorecard de Go, Maven, PyPI, npm y Cargo);
  - paper: título, autores, año, revista y BibTeX (Crossref y arXiv; en OpenAlex, buscar por DOI sigue siendo gratis aunque desde febrero de 2026 exige clave).
- **Instantánea con fecha** y acción «volver a consultar»: muestra qué cambió desde la última vez.
- **Límite honesto:** una app web no puede descargar cualquier página por las restricciones del navegador (CORS). Sin extensión ni proxy, de una web genérica solo se guarda la URL y lo que pegues. La Fase 0 comprueba qué APIs admiten peticiones desde el navegador.

### 8.7. Datos tabulares (LEC-11) y JSON (LEC-12)

- **Datos:** con DuckDB-WASM en un Worker.
  - Perfil por columna: tipo, nulos, valores únicos, mínimo, máximo, media e histograma.
  - Vista previa, consulta SQL y gráfico rápido.
  - Comparación antes y después entre dos conjuntos.
  - Límite: DuckDB-WASM trabaja en memoria; según el equipo, el techo práctico va de unos cientos de megas a un par de gigas.
- **JSON, YAML y TOML:** árbol plegable, esquema inferido, ruta al valor seleccionado y **comparación estructural** (claves añadidas, quitadas y cambiadas). Ideal para comparar configuraciones.

### 8.8. Idea (LEC-02)

- **Detecta:** texto corto sin otro patrón, o una captura marcada con `/idea` en el compositor.
- **Guarda:** título (la primera línea) y cuerpo opcional.
- **Estados:** semilla, explorando, aparcada, descartada, convertida.
- **Acciones:** convertir en investigación, enlazar a elementos, programar que vuelva (ORG-13).
- **Avisos:** «se parece a una idea del 2 de septiembre» (por palabras clave en v0.2, por significado en v0.4).

### 8.9. Resto de lectores, en resumen

| Lector | Qué hace |
|---|---|
| Texto (LEC-01) | Guarda, renderiza Markdown, extrae enlaces y menciones. Es la red de seguridad. |
| Código (LEC-09) | Detecta el lenguaje, resalta la sintaxis y compara versiones. |
| Diff (LEC-09b) | Archivos afectados, líneas añadidas y quitadas, vista lado a lado. |
| Comando (LEC-10) | Tarjeta reutilizable con huecos (`{{host}}`) y «copiar con valores». Tu chuleta personal. |
| Petición HTTP (LEC-13) | Separa método, URL, cabeceras y cuerpo, con secretos ocultos. |
| Imagen (LEC-14) | Miniatura y texto extraído con Tesseract.js, que va bien con capturas de texto limpias y regular con imágenes complejas. |
| PDF (LEC-15) | Texto y metadatos con pdf.js, DOI detectado y fragmentos seleccionados como evidencia con página. |
| Fórmula (LEC-16) | Renderizado con KaTeX y reutilización en documentos. Pasar una imagen de fórmula a LaTeX no tiene hoy una solución fiable en el navegador: queda para la IA opcional. |
| Diagrama (LEC-17) | Mermaid y D2 renderizados a SVG en el navegador (D2 funciona con WebAssembly). |
| Cálculo (LEC-18) | Expresiones con unidades y comprobación de dimensiones. Candidato: Numbat (Rust); hay que verificar su empaquetado para web. |

---

## 9. Organización, grupos y visualización

### 9.1. Inicio: capturar como en un chat

Inicio es la portada y sustituye a lo que en la versión 1 eran tres pantallas (Hoy, Bandeja y Captura). Funciona como un chat, pero quien contesta es Rimor con datos calculados, no una IA:

1. **Compositor abajo (CAP-03):** escribes o pegas. Enter guarda; Mayús+Enter salta de línea. Pegar con `Ctrl+V` fuera de un campo de texto también lleva el contenido al compositor.
2. **Indicaciones opcionales (CAP-13):** `@colección` y `#etiqueta` en la última línea, `/tipo` al principio y `?texto` para buscar. Bajo la caja se ve en vivo cómo se guardará: tipo y confianza, colección, etiquetas y secretos que se ocultarán. Si el detector duda entre dos tipos, lo dice ahí.
3. **Respuesta de Rimor (CAP-14):** al guardar, la captura aparece en el feed con una o dos frases del lector: *«Log de 1042 líneas. 16 errores entre 17:40 y 17:43, a la vez que ERR-0015. ¿Lo añado a su hilo?»* Si hay una decisión, va en botones.
4. **El feed:** separado por días. Cada mensaje lleva icono de tipo, título, hora, una línea de vista previa, la respuesta y las acciones «Responder» y «Archivar».
5. **Filtro «Sin clasificar»:** lo que aún no está en ninguna colección, hilo ni investigación. Es lo que antes era la bandeja.
6. **Lo que vuelve (ORG-12, ORG-13):** ideas e investigaciones que conviene revisar y la tarjeta de la sesión del día anterior.

Atajos del feed:

| Tecla | Acción |
|---|---|
| `j` / `k` | Siguiente / anterior |
| `Enter` | Abrir |
| `r` | Responder (lleva al hilo) |
| `c` | Añadir a colección |
| `i` | Enviar a investigación |
| `e` | Archivar (sale de «Sin clasificar») |
| `f` | Fijar |
| `t` | Cambiar tipo |
| `x` | Seleccionar (para comparar o agrupar) |

Clasificar no es obligatorio (P12): un elemento puede quedarse sin clasificar y encontrarse igual por búsqueda.

**Cómo se generan las respuestas.** Cada lector expone una función `respuesta` (§14.4) que recibe sus derivados y un contexto pequeño: elementos con la misma huella, versiones previas, colecciones que encajan y notas de solución. Devuelve una frase, con las cifras siempre calculadas por código, y hasta dos acciones. Ejemplos de plantillas:

| Lector | Respuesta |
|---|---|
| Error | «Es la {n}.ª vez. El {fecha} escribiste: “{nota}”.» o «Error de {lenguaje} nuevo. {k} marcos de tu código.» |
| Log | «Log de {n} líneas, {p} plantillas y {e} errores; el primero en la línea {l}.» |
| Mediciones | «{n} mediciones · mediana {m} ms (IC 95 %: {a} – {b}).» Si son menos de 10, lo advierte. |
| Prompt | «Prompt con {k} variables. Lo puedes copiar con valores.» Si se parece a otro: «Lo he guardado como su versión {v}.» |
| Idea | «Idea guardada. Volverá dentro de 7 días si no haces nada con ella.» |
| Secretos | Se añade: «He ocultado {n} secretos ({tipos}) antes de guardar.» |

El tono y las reglas de estas frases están en `rimor-diseno.md` §9.

### 9.2. Hilos (ORG-15)

Un hilo encadena lo que va junto sin crear nada formal. Es más ligero que una investigación: no tiene pregunta, matriz ni papeles de evidencia.

- **Se forma solo:** con los errores que comparten huella, y cuando pulsas «Responder» en un mensaje (la nueva captura entra en su hilo).
- **Enseña lo aprendido:** si un elemento del hilo tiene una nota de solución, Rimor la cita cuando el problema vuelve. Es el «esto ya te pasó» del plan, llevado a la conversación.
- **Se cierra:** «Marcar resuelto» con una línea de nota. El tiempo hasta resolver alimenta MET-03.
- **Crece:** «Convertir en investigación» crea una investigación con todos sus elementos como evidencia de contexto, para que les asignes papel.
- **Formato:** un archivo pequeño en `hilos/` (título, estado, nota de solución y fechas). Los elementos llevan `hilo: HIL-0007` en el frontmatter.

### 9.3. Grupos

Tres formas de agrupar, que conviven:

1. **Manuales:** colecciones e investigaciones.
2. **Automáticos:** por tipo, sesión, huella de error, dominio, repositorio, paquete, etiqueta y mes.
3. **Por búsqueda:** cualquier búsqueda con filtros es un grupo, y se puede guardar como vista.

### 9.4. Panel de grupo (VIS-04)

Es la respuesta a «visualizar grupos de datos». Cualquier grupo (colección, sesión, búsqueda, huella, investigación) se abre con un panel común:

- recuento por tipo, en barras;
- evolución en el tiempo: capturas por día;
- lo más frecuente según el contenido: errores más repetidos, dominios, paquetes, etiquetas;
- estado: abiertos, resueltos, archivados;
- elementos más recientes y fijados;
- acciones de grupo: crear investigación, exportar como ZIP, comparar seleccionados.

### 9.5. Vistas

| Vista | Uso |
|---|---|
| Mosaico agrupado | Tarjetas con vista previa del lector, agrupadas con cabeceras y recuentos |
| Lista densa | Columnas (tipo, título, fecha, grupos, estado), ordenable, para recorrer cientos de elementos |
| Línea de tiempo | Carriles por tipo, sesiones sombreadas, zoom de horas a meses |
| Calendario de actividad | Mapa de calor de capturas por día, filtrable por grupo |
| Tablero por estado | Columnas por estado para ideas e investigaciones |
| Vecinos | Un elemento en el centro y sus relaciones directas: misma huella, mencionado por, en la misma sesión, versiones |
| Lienzo | Tarjetas de elementos colocadas a mano, con flechas y notas; la posición se guarda |

**Lo que no se hará:** un grafo global de todo. Es vistoso y casi nunca ayuda a decidir nada (P9).

### 9.6. Métricas (MET)

Una pantalla con seis tarjetas, todas sobre tu propio trabajo y todas con una acción posible. Se calculan en local y no salen del equipo.

- **Cifras que sigues (MET-01):** cualquier cifra citable (por ejemplo, la mediana de latencia de reqwest con 64 KB) vista a lo largo de sus mediciones. *«−4,4 % desde el 2 oct.»*
- **Lo que más se repite (MET-02):** errores por número de apariciones, con la última fecha y si tienen nota de solución. Un error repetido sin nota es el mejor candidato para escribirla.
- **Tiempo hasta resolver (MET-03):** mediana de los hilos resueltos y reparto por tramos (menos de una hora, de un día, de una semana, más).
- **Qué capturas (MET-04):** barras apiladas por semana y tipo.
- **Pendiente, sin prisa (MET-05):** ideas sin tocar en 30 días, investigaciones paradas y elementos sin clasificar, cada uno con su acción (revisar, aparcar, ver).
- **Lo que te ha ahorrado Rimor (MET-06):** errores reconocidos, duplicados evitados, prompts copiados con valores y búsquedas que encontraron algo.
- **Resumen de la semana (MET-07):** un botón que convierte las métricas en un documento editable.

**Reglas:**
- sin puntuaciones, rachas ni rankings;
- una métrica sin datos suficientes no se dibuja: dice cuántos faltan (P8). Por ejemplo: «La gráfica aparece con 3 mediciones»;
- cada tarjeta lleva a los elementos que la forman.

---

## 10. Búsqueda

- **Motor:** MiniSearch (texto completo con tolerancia a erratas y prefijos) en un Worker; índice guardado en IndexedDB y regenerable desde los archivos.
- **Qué se indexa:** título, cuerpo, notas, etiquetas, metadatos y **contenido derivado** (plantillas de logs, mensajes de error, texto de OCR, nombres de columnas).
- **Resultados:** agrupados por tipo, con el fragmento coincidente resaltado y la vista previa del lector.
- **Ranking:** relevancia de texto, con un empujón a lo fijado, lo reciente y lo que está en la investigación activa.
- **Sintaxis:** Anexo G.
- **Semántica (v0.4):** embeddings pequeños calculados en el navegador con transformers.js (WebGPU o WASM), sin enviar nada fuera, para «buscar por significado» y «parecidos a esto».

---

## 11. Investigación y decisión

### 11.1. Modelo

Una investigación es un archivo Markdown con metadatos (Anexo B):

- pregunta y estado (abierta, concluida, cancelada, aparcada);
- elementos vinculados, cada uno con papel (apoya, contradice, contexto) e interpretación opcional;
- hipótesis opcionales con estado (pendiente, apoyada, descartada);
- decisión opcional: opciones, criterios con peso y puntuaciones, y la evidencia de cada criterio;
- conclusión y motivo de cierre.

### 11.2. Matriz de decisión y sensibilidad

- **Total de cada opción:** suma de peso × puntuación por criterio.
- **Sensibilidad exacta, sin simulación:** para cada criterio *i*, con diferencia de totales *D* entre la opción ganadora y la segunda y diferencia de puntuaciones *dᵢ*, el peso que produce empate es *wᵢ − D / dᵢ*. Si cae entre 0 y 10, se muestra «si este peso pasa de X a Y, gana la otra opción». El cambio relativo más pequeño indica lo frágil que es la decisión.
- Con más de dos opciones, se calcula frente a la segunda clasificada y se avisa si hay empates cercanos.
- Los criterios muestran su evidencia vinculada; uno sin evidencia se marca.

### 11.3. Qué falta

Reglas deterministas, nunca juicios de calidad. Catálogo completo en el Anexo E. Ejemplos:

- conclusión escrita sin ninguna evidencia vinculada;
- rendimiento apoyado en una sola comparación de mediciones;
- criterio de decisión puntuado sin evidencia;
- decisión frágil (un cambio menor del 50 % en un solo peso la invierte);
- evidencia que contradice sin interpretación;
- ficha de enlace con datos de hace más de 90 días.

Cada aviso lleva una acción («medir otra vez», «interpretar», «volver a consultar»). Debajo, siempre: *«Que no falte nada de lo que Rimor sabe comprobar no garantiza que la investigación sea buena.»*

---

## 12. Documentos: informes y minipapers

### 12.1. Editor

CodeMirror 6 con Markdown, vista previa al lado y un menú `/` para insertar elementos, plantillas, fórmulas y diagramas. Es el mismo editor que usa Struo, así que el conocimiento se reutiliza.

### 12.2. Sintaxis propia, mínima y legible fuera de Rimor

| Sintaxis | Qué hace | Cómo se ve sin Rimor |
|---|---|---|
| `[[MED-0007]]` | Referencia a un elemento | Un wikilink, como en Obsidian |
| `![[MED-0007\|grafico]]` | Incrusta una vista del elemento (`grafico`, `tabla`, `resumen`, `lineas:4-9`) | Un wikilink de incrustación |
| `![[MED-0007\|grafico]]{#fig:latencia}` | Incrustación con etiqueta, para citarla con `@fig:latencia` | Wikilink seguido de la etiqueta |
| `{{MED-0007.cambio}}` | Cifra viva | El texto entre llaves; al exportar se sustituye por el valor |
| `@fig:latencia`, `@tab:resumen`, `@eq:carga` | Referencias cruzadas numeradas («figura 1») | Texto plano |

Las referencias cruzadas las numera Rimor antes de convertir, porque pandoc-wasm solo admite filtros en Lua y no puede ejecutar filtros externos como pandoc-crossref.

### 12.3. Cifras vivas y desfase

Cada cifra viva guarda el valor que tenía al escribirla. Si el elemento cambia (por ejemplo, añades mediciones), el documento marca la cifra: *«antes 4,6 %, ahora 3,9 %»*, y puedes aceptar el valor nuevo o mantener el anterior con una nota.

### 12.4. Plantillas

Estructura completa en el Anexo F.

| Plantilla | Para qué |
|---|---|
| Informe técnico | Explicar un problema, lo que se hizo y lo que se concluye |
| ADR | Registrar una decisión de arquitectura (formato MADR) |
| Postmortem / causa raíz | Incidente: cronología, impacto, causa, acciones |
| Comparativa | Opciones, criterios, datos y recomendación |
| Informe de cancelación | Por qué se abandona algo y qué se aprendió |
| Nota de investigación | Breve: pregunta, hallazgos y siguiente paso |
| Minipaper (v0.4) | Resumen, introducción, método, resultados, discusión, limitaciones y referencias |

**Generar desde una investigación** rellena lo que sale de los datos (pregunta, evidencias, tablas, matriz, cronología) y deja **huecos marcados** en lo que debes escribir tú. Nunca inventa texto.

### 12.5. Exportación

```
Documento (.md con sintaxis propia)
   │
   ▼  resolver: incrustaciones → tablas y SVG, cifras → valores,
   │           referencias → citas, numeración → figuras y ecuaciones
   ▼
Markdown estándar + recursos (figuras SVG/PNG, .bib)
   ├──▶ Markdown (ZIP con figuras)                         v0.3
   ├──▶ HTML autocontenido                                 v0.3
   ├──▶ PDF por impresión del navegador (CSS de impresión) v0.3
   ├──▶ pandoc-wasm ──▶ Word (.docx) · LaTeX (+ .bib)      v0.4
   └──▶ pandoc-wasm ──▶ Typst ──▶ typst.ts ──▶ PDF         v0.4 (sujeto a F0)
```

- **pandoc-wasm** usa el binario oficial de Pandoc 3.9 compilado a WebAssembly e incluye citas con citeproc. No genera PDF, no hace peticiones de red y solo admite filtros en Lua.
- **typst.ts** (Apache-2.0) compila Typst en el navegador. Por defecto descarga las fuentes desde GitHub, así que hay que empaquetarlas para trabajar sin conexión. La exportación a PDF debe confirmarse en la Fase 0.
- **Plan B para PDF:** la impresión del navegador con una hoja de estilos de impresión bien hecha. Es fiable y está disponible desde v0.3.

### 12.6. Bibliografía y verificación (v0.4)

- Cada enlace a un paper o DOI capturado genera su entrada BibTeX.
- Estilos de cita CSL (IEEE, APA, ACM…).
- **Verificador:** antes de exportar comprueba que cada DOI existe (Crossref) y marca las referencias que no se pueden comprobar. Es más necesario que nunca: una auditoría de casi 2,5 millones de artículos de PubMed encontró que 1 de cada 277 artículos de principios de 2026 citaba trabajos inexistentes, frente a 1 de cada 2.828 en 2023.

---

## 13. Datos: almacenamiento, exportación e importación

### 13.1. Decisión

> **Los archivos Markdown son la fuente de verdad**, guardados en el almacenamiento privado del navegador (*Origin Private File System*, OPFS). El ZIP es la copia completa y portable. El JSON único es una alternativa de exportación e intercambio.

**Por qué Markdown y no JSON como formato principal:**
- se lee y se edita sin Rimor;
- al descomprimir el ZIP, la carpeta se abre tal cual en Obsidian, VS Code o Struo;
- se compara bien con git;
- los metadatos estructurados van en el frontmatter YAML, y los datos grandes o binarios, como adjuntos.

**Por qué OPFS:** es un sistema de archivos real dentro del navegador, disponible en Chrome, Edge, Firefox y Safari actuales, rápido desde Workers y con cuotas grandes.

**Lo que no es:** OPFS no se ve desde el explorador de archivos. Por eso existen la exportación ZIP y, más adelante en Chromium, la copia automática a una carpeta (DAT-12).

### 13.2. Estructura del espacio de trabajo

```
rimor/                                    ← raíz del espacio (en OPFS y en el ZIP)
├── manifest.json                          ← versión de esquema, nombre, fechas, recuentos y hashes
├── elementos/
│   └── 2026/10/
│       ├── LOG-0042--timeout-streaming-ureq.md
│       ├── ERR-0013--read-timeout.md
│       ├── MED-0007--reqwest-vs-ureq.md
│       ├── PRM-0012--revisor-de-adr.md
│       ├── DOC-MD-0004--plan-gateway.md
│       └── IDE-0031--cache-de-embeddings.md
├── comparaciones/
│   └── CMP-0005--logs-buena-vs-mala.md
├── investigaciones/
│   └── INV-0003--cliente-http-gateway.md
├── documentos/
│   └── DOC-0002--adr-cliente-http.md
├── hilos/
│   └── HIL-0007--read-timeout-next-chunk.md
├── adjuntos/
│   └── 3f/3fa2c9….log                     ← por hash de contenido (sin duplicados)
├── historial/
│   └── PRM-0012/2026-10-17T18-05-12.md    ← versiones anteriores
├── colecciones.json
├── vistas.json                            ← vistas guardadas
├── papelera/
└── .rimor/                               ← NO se exporta por defecto
    ├── ajustes.json
    ├── reglas-deteccion.json
    └── cache/                             ← índice de búsqueda y derivados (regenerables)
```

### 13.3. Identificadores

- `id`: **ULID**, único y ordenable por fecha. Es el que usan los enlaces internos y el que permite fusionar espacios sin choques.
- `ref`: identificador corto y legible por tipo (`LOG-0042`, `MED-0007`, `INV-0003`), el que ves y escribes en `[[…]]`.
- Si al importar dos refs chocan, se reasigna la del elemento importado y se reescriben sus menciones. La ref antigua queda en `alias` para no romper nada.
- Nombre de archivo: `REF--titulo-en-minusculas.md`. Si el título cambia, el archivo se renombra; el `id` no cambia nunca.

Prefijos: `TXT` texto · `IDE` idea · `URL` enlace · `LOG` log · `ERR` error · `MED` mediciones · `PRM` prompt · `DOC-MD` documento pegado · `COD` código · `CMD` comando · `DAT` datos · `JSN` JSON/YAML/TOML · `HTP` petición HTTP · `IMG` imagen · `PDF` PDF · `FOR` fórmula · `DIA` diagrama · `CAL` cálculo · `CMP` comparación · `INV` investigación · `DOC` documento · `HIL` hilo.

### 13.4. Formato de un elemento

Frontmatter común más un bloque `lector` propio de cada tipo. El cuerpo contiene tus notas (opcionales) y el original en un bloque de código o como adjunto. Ejemplos completos en el Anexo B.

Campos comunes:

| Campo | Descripción |
|---|---|
| `id`, `ref`, `tipo`, `titulo` | Identidad |
| `creado`, `modificado` | Fechas ISO 8601 con zona horaria |
| `origen` | `pegado`, `soltado`, `compartido`, `terminal`, `importado` |
| `estado` | Estado ligero o propio del tipo |
| `colecciones`, `investigaciones`, `etiquetas` | Grupos |
| `sesion` | Sesión automática |
| `hilo` | Hilo al que pertenece, si lo hay |
| `hash` | Hash del contenido original (duplicados e integridad) |
| `ocultados` | Número de secretos ocultados al capturar |
| `lector` | `{nombre, version, resumen}`: datos pequeños del lector útiles sin recalcular |
| `fijado`, `alias` | Opcionales |

### 13.5. Exportación

- **ZIP completo (DAT-03):** toda la raíz menos `.rimor/cache/`. Comprimido en streaming con fflate, en un Worker. Nombre: `rimor-<espacio>-<fecha>.zip`.
- **ZIP parcial (DAT-10):** una selección, colección o investigación, con sus adjuntos y lo que referencian.
- **JSON único (DAT-05):** `{manifest, elementos: [{ruta, frontmatter, cuerpo}], adjuntos: [...]}`.
  - Los adjuntos pequeños van en base64.
  - Los grandes se excluyen y **el JSON lo dice explícitamente** en `manifest.adjuntos_excluidos`. Nunca se presenta como copia completa si no lo es.

### 13.6. Importación

1. **Validar:** estructura, `manifest.json`, versión de esquema, frontmatter con esquema (Valibot), rutas seguras, tamaños (§15).
2. **Migrar** si el esquema es antiguo (migraciones versionadas).
3. **Vista previa:** nuevos, idénticos, actualizados y en conflicto, con recuentos.
4. **Elegir modo:**
   - **Fusionar:** por `id`; si ambos cambiaron, gana el más reciente y el otro queda en `historial/`;
   - **Reemplazar:** borra el espacio actual (con un ZIP automático previo) y carga el importado;
   - **Espacio nuevo:** importa al lado, sin tocar nada.
5. **Reindexar** en segundo plano.

**Prueba obligatoria (§18):** exportar e importar debe dar exactamente los mismos archivos. Es una propiedad que se comprueba en cada cambio.

### 13.7. Persistencia y copias: el riesgo principal

Los navegadores tratan este almacenamiento como «mejor esfuerzo» salvo que concedan el modo persistente. WebKit, por ejemplo, puede borrar los datos de un sitio por presión de espacio o por falta de uso, y concede el modo persistente según sus propias heurísticas (como tener la app instalada en la pantalla de inicio). Medidas:

1. **Pedir almacenamiento persistente** (`navigator.storage.persist()`) al crear el primer espacio, explicando por qué, y mostrar si se concedió.
2. **Indicador permanente** del espacio usado y de la última copia: *«Última copia: hace 6 días»*.
3. **Recordatorio de copia** tras N cambios o N días (configurable), con exportación de un clic. Sin culpa: un aviso, no un bloqueo.
4. **Antes de operaciones destructivas** (reemplazar, vaciar la papelera, borrar un espacio), ZIP automático.
5. **En Chromium (DAT-12):** copia automática diaria a una carpeta elegida, mientras la app esté abierta. El permiso de escritura puede tener que renovarse en cada sesión.
6. **Instalar como PWA** aumenta la probabilidad de obtener persistencia; se sugiere en el primer uso.
7. **Ventana privada:** se detecta y se avisa de que todo se perderá al cerrarla.

### 13.8. Migraciones

`manifest.json` lleva `esquema: N`. Cada cambio de formato añade una migración pura `N → N+1`, probada con espacios de ejemplo de cada versión. Los lectores llevan su propia `version`: si cambia, los derivados se recalculan (están en caché) sin tocar los archivos.

---

## 14. Arquitectura técnica

### 14.1. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Construcción | Vite + TypeScript estricto | Rápido, estándar, mismo conocimiento que en Struo |
| Interfaz | React 19 | Experiencia previa con Struo y ecosistema |
| Estilos | Tailwind v4 con tokens propios | Igual que Struo |
| Rutas | TanStack Router (propuesta) | Rutas tipadas; alternativa: React Router |
| Estado | Zustand | Simple; la fuente de verdad son los archivos |
| Validación | Valibot | Esquemas pequeños para frontmatter, manifest e importación |
| Frontmatter | `yaml` | Lectura y escritura fieles |
| Markdown | unified (remark y rehype) + rehype-sanitize | El árbol de sintaxis sirve para el resolvedor de documentos |
| Editor | CodeMirror 6 | Mismo editor que Struo |
| ZIP | fflate | Pequeño, rápido, en streaming |
| Búsqueda | MiniSearch | Texto completo en el navegador, serializable |
| Gráficos | Observable Plot + SVG propio | Gráficos de datos con poco código; SVG para las vistas de cada lector |
| Lienzo | React Flow (xyflow) | Nodos y conexiones con posiciones guardadas |
| Datos | DuckDB-WASM | SQL analítico local (carga diferida) |
| Conversión | pandoc-wasm, typst.ts | Word, LaTeX y PDF en el navegador (carga diferida) |
| Matemáticas | KaTeX | Rápido y sin dependencias |
| Diagramas | Mermaid, D2.js | Diagramas como texto (carga diferida) |
| OCR | Tesseract.js | Texto de capturas (carga diferida) |
| PDF | pdf.js | Lectura de PDF |
| Semántica | transformers.js | Embeddings locales (v0.4, carga diferida) |
| Workers | Comlink | Llamadas a Workers con tipos |
| PWA | vite-plugin-pwa (Workbox) | Sin conexión, instalación y compartir |
| Pruebas | Vitest, fast-check, Playwright | Unidades, propiedades y de extremo a extremo |
| Calidad | Biome | Igual que Struo |
| Despliegue | Hosting estático (Cloudflare Pages o GitHub Pages) | Sin servidor |

### 14.2. Capas

```
┌──────────────────────────────────────────────────────────────┐
│ Interfaz (React)  · inicio · hilos · vistas · editor · ajustes  │
├──────────────────────────────────────────────────────────────┤
│ Estado (Zustand)  · selección · filtros · espacio activo        │
├──────────────────────────────────────────────────────────────┤
│ Dominio (TS puro, sin React)                                   │
│  elementos · lectores · comparaciones · grupos · investigación │
│  qué falta · documentos (resolvedor) · exportación/importación │
├──────────────────────────────────────────────────────────────┤
│ Almacén                    │ Caché           │ Workers           │
│  Adaptador OPFS (v0.1)     │  IndexedDB:      │  lectores pesados │
│  Adaptador memoria (tests) │  índice,         │  índice           │
│  Adaptador carpeta (desp.) │  derivados       │  DuckDB · Pandoc  │
│                            │                  │  Typst · OCR · ZIP│
└──────────────────────────────────────────────────────────────┘
```

El dominio no conoce React ni el almacenamiento concreto. Eso permite probarlo con el adaptador en memoria y, en el futuro, empaquetar la misma app con Tauri o añadir una CLI que reutilice `dominio/` y `formato/`.

### 14.3. Estructura del repositorio

```
rimor/
├── app/                         ← la app web (Vite)
│   └── src/
│       ├── rutas/  ui/  estado/
│       ├── dominio/             ← modelo, reglas, qué falta, sensibilidad
│       ├── lectores/
│       │   ├── log/             ← detectar.ts · leer.ts · derivar.ts · Vista.tsx · fixtures/
│       │   ├── error/  mediciones/  prompt/  markdown/  enlace/  idea/  texto/  …
│       │   └── registro.ts      ← lista ordenada de lectores
│       ├── almacen/             ← opfs.ts · memoria.ts · zip.ts · json.ts · frontmatter.ts · migraciones/
│       ├── busqueda/
│       ├── documentos/          ← editor · resolvedor · exportadores/
│       ├── seguridad/           ← secretos/ · sanear.ts · importacion-segura.ts
│       └── workers/
├── paquetes/
│   ├── estadistica/             ← TS puro: mediana, IC, Mann-Whitney, Hodges-Lehmann (con tests contra referencias)
│   └── formato/                 ← esquemas, manifest, migraciones (reutilizable por la CLI)
├── cli/                         ← «sobre de terminal» (v0.3)
└── docs/                        ← diseño, ADR, planes (método SDD, §20)
```

### 14.4. Interfaz de un lector

```ts
type Entrada = { texto?: string; archivos?: File[]; mime?: string; nombre?: string };

interface Lector<D = unknown> {
  tipo: TipoElemento;              // 'log' | 'error' | 'mediciones' | …
  version: number;                 // si cambia, se recalculan los derivados
  prefijo: string;                 // 'LOG', 'ERR', …

  detectar(e: Entrada): number;    // confianza 0..1, barata y síncrona
  leer(e: Entrada): Promise<Borrador>;            // título, metadatos, original
  derivar(el: Elemento): Promise<D>;              // en Worker, regenerable
  resumen(d: D): ResumenLector;                   // lo pequeño que va al frontmatter

  Vista: React.FC<{ el: Elemento; datos: D }>;    // vista completa
  Tarjeta: React.FC<{ el: Elemento }>;            // vista previa en mosaico

  acciones?: Accion<D>[];                         // comparar, copiar con valores…
  cifras?: Record<string, (d: D) => Cifra>;       // cifras citables
  incrustaciones?: Record<string, Incrustacion<D>>; // 'grafico', 'tabla'… para documentos
  textoIndexable?(d: D): string;                  // contenido derivado para la búsqueda
  respuesta(el: Elemento, d: D, ctx: Contexto): Respuesta; // la frase de Rimor en Inicio (CAP-14)
}

type Contexto = { mismaHuella: Elemento[]; versiones: Elemento[]; notas: Nota[]; colecciones: string[] };
type Respuesta = { texto: Fragmento[]; acciones?: [Accion, Accion?] };   // texto con cifras y refs marcadas
```

### 14.5. Flujo de captura

```
Pegar / soltar / compartir
  → normalizar entrada (texto, archivos, imagen)
  → ocultar secretos (antes de cualquier otra cosa)
  → detectar: cada lector puntúa; gana el mayor por encima de 0,6;
              si dos quedan a menos de 0,15, se ofrecen ambos
  → comprobar duplicado exacto (hash)
  → aplicar indicaciones del compositor (@colección, #etiqueta, /tipo)
  → leer → escribir el .md (y el adjunto) en OPFS
  → mostrar al instante en el feed con el resumen
  → derivar en Worker → componer la respuesta de Rimor → actualizar feed, caché e índice
```

Orden de detección orientativo en el Anexo D.

### 14.6. Workers y carga diferida

- **Siempre cargados:** núcleo, lectores ligeros y MiniSearch.
- **Bajo demanda:** DuckDB-WASM, pandoc-wasm, typst.ts con fuentes, Mermaid, D2, Tesseract.js, pdf.js y transformers.js. Se cargan la primera vez que hacen falta, se cachean y se avisa con un indicador si tardan.

### 14.7. Presupuestos de rendimiento

| Métrica | Objetivo |
|---|---|
| Carga inicial de la app (JS comprimido) | < 300 KB |
| Pegar un texto de menos de 100 KB → elemento visible | < 300 ms |
| Log de 50.000 líneas → plantillas calculadas | < 2 s (en Worker) |
| Búsqueda en 10.000 elementos | < 50 ms por pulsación |
| Exportar ZIP de 200 MB | Sin bloquear la interfaz, con progreso |
| Apertura de un espacio de 10.000 elementos | < 2 s con el índice en caché |

---

## 15. Privacidad y seguridad

- **Local por defecto:** sin servidor, sin cuenta, sin telemetría. Los datos solo salen si exportas o si un lector consulta una API para enriquecer, y en ese caso la app muestra qué dominio se consulta. Hay un modo sin red (SEG-03).
- **Ocultación de secretos al capturar (CAP-05):**
  - reglas para claves de AWS, GCP y Azure, tokens de GitHub, GitLab y Slack, claves de OpenAI y Anthropic, JWT, claves privadas PEM, cadenas de conexión con contraseña y cabeceras `Authorization`, adaptadas de proyectos abiertos como gitleaks;
  - el secreto se sustituye por `‹oculto:tipo›` antes de escribir nada en disco;
  - la app enseña qué ocultó y permite desactivar la regla para ese pegado;
  - **nunca se guarda el valor original.**
- **Saneado (SEG-01):** todo Markdown o HTML pegado se renderiza saneado. Nada pegado se ejecuta. Los SVG de diagramas pasan por el mismo saneado.
- **Política de seguridad de contenido (SEG-02):** sin scripts de terceros en tiempo de ejecución; conexiones solo a la lista de APIs de enriquecimiento activadas y al endpoint de IA configurado.
- **Importación segura (SEG-04):** rechazo de rutas con `..` o absolutas (*zip slip*), límites de tamaño descomprimido y de número de archivos (contra bombas ZIP), y validación de esquema antes de escribir nada.

---

## 16. IA opcional

La app funciona entera sin IA (P7). Si el usuario la activa:

- **Conexión:** cualquier endpoint compatible con la API de OpenAI (Ollama, LM Studio, OpenRouter, OpenAI…), con la clave guardada localmente.
  - Aviso técnico: para usar Ollama desde una app web hay que configurar `OLLAMA_ORIGINS`; si no, el navegador bloquea las peticiones.
  - La IA integrada de Chrome (Gemini Nano) no sirve como base: su estado está en transición, pide unos 16 GB de RAM o 4 GB de memoria de vídeo, tiene un contexto de unos 8.000 tokens y no existe en Safari ni Firefox. Como mucho, una opción adicional.
- **Reglas:**
  - la IA **nunca calcula** cifras ni decide;
  - todo lo que produce va marcado visualmente como suyo;
  - vista previa de lo que se envía antes de enviarlo;
  - registro local de cada uso.

| ID | Uso |
|---|---|
| IA-01 | Proponer cómo leer un formato desconocido; si lo aceptas, queda como regla determinista |
| IA-02 | Proponer título y tipo cuando la detección duda |
| IA-03 | Explicar un resultado en lenguaje llano |
| IA-04 | Resumir una comparación larga de logs y sugerir qué mirar primero |
| IA-05 | Extraer afirmaciones de un PDF con su cita textual exacta, para que las aceptes |
| IA-06 | Preguntar a tus elementos, con citas a cada uno (búsqueda local más el modelo) |
| IA-07 | Revisar un documento: esquema inverso, saltos lógicos, afirmaciones sin respaldo. Nunca reescribe |

---

## 17. Interfaz y diseño

La referencia completa es **`rimor-diseno.md`**. Aquí va el resumen que afecta al plan.

### 17.1. Estructura

```
┌─────────┬────────────────────────────────────────────┐
│ Raíl    │        Columna de lectura (≤ 780 px)        │
│ Inicio  │  Título · meta                    [control] │
│ Buscar  │  Lo que responde (veredicto o resumen)      │
│ Métricas│  Lo siguiente más útil                       │
│ ─────── │  › Detalles (plegado)                        │
│ Colecc. │                                              │
│ Invest. │                                              │
│ Docs    │                                              │
│ ● Espac.│  [ compositor fijo abajo en Inicio e hilos ] │
└─────────┴────────────────────────────────────────────┘
```

- **Sin inspector:** metadatos, cifras citables, avisos de método y originales viven en «Detalles», plegados, dentro de cada pantalla.
- **Una pregunta por pantalla y un veredicto:** una cifra grande y una frase.
- **Pegar funciona en cualquier pantalla** y lleva el contenido al compositor.
- **Teclado primero:** paleta `Ctrl+K`, atajos del feed y navegación (Anexo H).
- **En el móvil:** el raíl pasa a barra inferior (Inicio, Buscar, Métricas) y el compositor queda encima. Prioridad a capturar y consultar; el trabajo pesado (documentos, lienzo) es para escritorio.

### 17.2. Identidad visual: Instrumento

Elegida el 17 de octubre de 2026 entre diez direcciones. Su referencia es el diseño industrial alemán de los años sesenta: aparatos de medida que se entienden al mirarlos, «menos, pero mejor».

- **Color:** neutros cálidos, tinta casi negra y **un solo naranja** (`#EE4F1F` en claro, `#FF6A3D` en oscuro) para enviar, la serie destacada de una gráfica, los pilotos y el símbolo. Los colores de estado (correcto, aviso, error) van aparte.
- **Tipografía:** Archivo para títulos y texto; Roboto Mono para logs, código y cifras. Las dos van empaquetadas en la app, sin Google Fonts (P6).
- **Forma:** tarjetas sin borde, separadas por el tono y una sombra mínima; píldora para lo que se pulsa y círculo para lo que identifica.
- **Tipos en neutro:** icono y nombre. Solo Error lleva color, porque además es un estado.
- **Símbolo «Señal»:** una onda en tinta, el punto naranja donde se adelanta el resultado y un guion: del rumor a la conclusión. Con iconos de app (claro, oscuro, señal y maskable), favicon y un repertorio corto de animaciones para esperas y momentos clave (`rimor-diseno.md` §6.2 y §11.1).
- **Dos temas diseñados por igual:** claro y oscuro. El oscuro no lleva sombras.

### 17.3. Estados y accesibilidad

- Estados vacíos que enseñan qué pegar; estados de carga para los módulos pesados; errores que dicen qué pasó y cómo arreglarlo.
- Contraste AA medido en los dos temas (tabla en `rimor-diseno.md` §13), foco visible, navegación completa por teclado, información nunca solo por color, gráficas con descripción textual y movimiento reducido respetado.

---

## 18. Calidad y pruebas

| Nivel | Qué se prueba | Herramienta |
|---|---|---|
| Unidades | Cada lector con un **corpus de ejemplos reales** (`fixtures/`): logs de varios formatos, trazas de 6 lenguajes, salidas de benchmarks, prompts, planes | Vitest |
| Estadística | Resultados contra valores de referencia calculados con benchmark tools y SciPy | Vitest |
| Propiedades | Exportar e importar da los mismos archivos; leer y escribir frontmatter conserva los datos; las migraciones son idempotentes; la normalización de logs es estable | fast-check |
| Seguridad | Corpus de secretos falsos que deben ocultarse; ZIP maliciosos que deben rechazarse; HTML con scripts que debe sanearse | Vitest |
| Extremo a extremo | Pegar → elemento → comparar → investigación → documento → exportar → importar, en Chromium, Firefox y WebKit | Playwright |
| Rendimiento | Presupuestos del §14.7 con archivos grandes generados | Playwright + scripts |

**Detección:** una matriz de confusión del detector sobre el corpus, con un objetivo inicial de más del 90 % de aciertos en los tipos de v0.1.

---

## 19. Hoja de ruta

Las fases no son un calendario: el tiempo del autor está compartido con Struo. Cada versión termina con una **puerta de validación**: si no se cumple, se corrige el rumbo antes de seguir.

### Fase 0: pruebas técnicas (de 1 a 3 días)

| # | Prueba | Criterio de éxito |
|---|---|---|
| F0-1 | OPFS: escribir y leer 5.000 elementos en Chrome, Firefox y Safari; resultado de `persist()` en cada uno | Lectura completa < 2 s; persistencia concedida al menos en Chrome con PWA instalada |
| F0-2 | ZIP de ida y vuelta con 200 MB | Idéntico byte a byte, sin bloquear la interfaz |
| F0-3 | pandoc-wasm: Markdown → Word, LaTeX y Typst con citas | Las tres salidas correctas; peso y tiempo de carga medidos |
| F0-4 | typst.ts: Typst → PDF en el navegador, con fuentes empaquetadas y sin conexión | PDF correcto. Si falla: el PDF va por impresión del navegador y LaTeX |
| F0-5 | DuckDB-WASM: perfil de un CSV de 100 MB | < 5 s en un portátil normal |
| F0-6 | Normalizar y agrupar un log de 50.000 líneas en un Worker | < 2 s |
| F0-7 | CORS de las APIs: GitHub, Crossref, arXiv, npm, crates.io, PyPI, deps.dev, OSV | Tabla de cuáles funcionan desde el navegador; las demás quedan para proxy o extensión |
| F0-8 | MiniSearch con 10.000 elementos | Índice < 20 MB; búsqueda < 50 ms |

### v0.1 «La puerta y los lectores»

**Objetivo:** usar Rimor a diario para capturar, encontrar y comparar.

- **Incluye:**
  - CAP-01 a CAP-05, CAP-13 y CAP-14 (Inicio como chat);
  - lectores LEC-01 a LEC-09 (enlace básico);
  - CMP-01 y CMP-02;
  - ORG-01 a ORG-07 y ORG-15 (hilos);
  - BUS-01 a BUS-03;
  - VIS-01 a VIS-03;
  - DAT-01 a DAT-08;
  - SEG-01, SEG-02 y SEG-04;
  - APP-01 a APP-05 y APP-07.
- **Terminado cuando:**
  - los siete lectores principales superan su corpus;
  - exportar e importar ZIP es idéntico;
  - los presupuestos de rendimiento se cumplen;
  - el autor la usa como herramienta principal de captura durante una semana.
- **Puerta de validación (4 semanas de uso real):**
  - al menos 5 capturas por día laborable;
  - las respuestas de Rimor aciertan lo bastante como para no ignorarlas: menos de 1 de cada 10 se corrige o se descarta;
  - al menos un «esto ya lo tienes» o «este error ya te pasó» útil por semana;
  - se encuentra lo buscado en menos de 10 segundos.

### v0.2 «Ver y agrupar»

**Objetivo:** que el caos se vea ordenado y se puedan explorar grupos y datos.

- **Incluye:**
  - CAP-06 a CAP-08;
  - LEC-03b (enlaces enriquecidos), LEC-09b y LEC-10 a LEC-13;
  - CMP-03;
  - ORG-08 a ORG-12;
  - BUS-04 a BUS-06 (parecidos por huella y etiquetas);
  - VIS-04 a VIS-07;
  - DAT-09 y DAT-10;
  - MET-01, MET-02, MET-04 y MET-06;
  - SEG-03 y APP-06.
- **Terminado cuando:**
  - cualquier grupo tiene panel visual;
  - los datos CSV y JSON se exploran y comparan;
  - la app funciona sin conexión e instalada.
- **Puerta:** el autor resuelve al menos dos preguntas reales («¿cuántas veces y cuándo falló X?», «¿qué cambió en esta configuración?») solo con las vistas.

### v0.3 «Investigar y escribir»

**Objetivo:** pasar de los elementos a una conclusión documentada.

- **Incluye:**
  - CAP-09 y CAP-10;
  - LEC-14 a LEC-17;
  - CMP-04;
  - ORG-13;
  - VIS-08 a VIS-11;
  - INV-01 a INV-08;
  - DOC-01 a DOC-07;
  - MET-03, MET-05 y MET-07;
  - DAT-11.
- **Terminado cuando:** de una investigación real sale un ADR y un informe técnico exportados a Markdown, HTML y PDF por impresión, con cifras vivas.
- **Puerta:** un informe real cuesta claramente menos tiempo que con el flujo actual (objetivo: menos de 30 minutos desde la investigación hasta el documento exportado).

### v0.4 «Publicar»

**Objetivo:** minipapers y documentos con calidad de publicación.

- **Incluye:**
  - LEC-18;
  - ORG-14 y BUS-06 (semántica);
  - VIS-12;
  - DOC-08 a DOC-15.
- **Terminado cuando:** un minipaper con ecuaciones, figuras numeradas, bibliografía verificada y anexo reproducible se exporta a PDF y LaTeX.

### Después

IA opcional (IA-01 a IA-07), extensión de navegador (CAP-12), abrir archivos con Rimor (CAP-11), carpeta en disco (DAT-12 y DAT-13), integridad tipo cuaderno de laboratorio (historial de solo añadir y sellos de tiempo RFC 3161, como hace eLabFTW) y empaquetado de escritorio con Tauri si hace falta.

---

## 20. Cómo se desarrolla

Mismo método que Struo, para aprovechar el harness ya probado:

- funcionalidades con ID `IN-NNN` (cada una agrupa uno o varios IDs de este catálogo);
- ciclo SDD: exploración → diseño → **aprobación humana (GATE#1)** → implementación con pruebas → revisión;
- olas de varias funcionalidades en paralelo, cada una en su worktree;
- los agentes nunca hacen commit, push ni cambian de rama: eso lo hace siempre el autor;
- `docs/` con este plan, el diseño técnico, los ADR y el estado de las olas.

**Primeras funcionalidades sugeridas tras la Fase 0:** formato y almacén (DAT-01, DAT-02, `paquetes/formato`), captura y detector (CAP-01 a CAP-04), paquete de estadística, y después los lectores en paralelo (cada lector es independiente, ideal para olas).

---

## 21. Métricas de éxito

**Personales (las que importan primero):**

| Métrica | Objetivo |
|---|---|
| Capturas por día laborable | ≥ 5 durante 4 semanas seguidas |
| Reencuentros útiles («ya lo tienes», «ya te pasó») | ≥ 1 por semana |
| Tiempo para encontrar algo | < 10 s |
| Informe desde una investigación | < 30 min |
| Elementos sin clasificar que se encuentran por búsqueda | «Sin clasificar» no estorba, aunque crezca |

**De producto (si se publica):** retención a 30 días, tipos más pegados (para priorizar lectores), errores de detección corregidos por los usuarios y espacios con copia reciente.

Rimor no tiene telemetría (P6): estas métricas son locales, se ven en la pantalla Métricas (§9.6) y se comparten solo si el usuario quiere.

---

## 22. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El navegador borra los datos | Media | Muy alto | Persistencia solicitada, indicador de última copia, recordatorios, ZIP antes de operaciones destructivas, copia automática en Chromium (§13.7) |
| Alcance infinito («cualquier cosa») | Alta | Alto | Regla de oro, lector genérico, priorizar por tipos pegados de verdad |
| Convertirse en otra app de notas | Media | Alto | Cada lector debe hacer trabajo; las notas son opcionales |
| Detección errónea | Media | Medio | Corrección en un clic, dos candidatos si duda, reglas aprendidas, corpus de pruebas |
| Las respuestas de Rimor se vuelven ruido | Media | Medio | Una o dos frases como máximo, solo datos calculados, desactivables por tipo (D14) y medidas en la puerta de v0.1 |
| Archivos grandes bloquean la interfaz | Media | Medio | Workers, límites, adjuntos, análisis por bloques |
| APIs sin CORS | Alta | Medio | Fase 0; enlaces sin enriquecer; proxy o extensión más adelante |
| WebAssembly pesado | Media | Medio | Carga diferida, caché e indicadores |
| PDF con Typst no viable | Media | Medio | Impresión del navegador y LaTeX como alternativas |
| Diferencias entre navegadores (Safari) | Media | Medio | Pruebas de extremo a extremo en los tres motores |
| Secretos que se cuelan | Baja | Alto | Reglas amplias, corpus de pruebas, aviso visible de lo ocultado |
| XSS al renderizar lo pegado | Baja | Alto | Saneado obligatorio, política de seguridad de contenido estricta |
| Tiempo del autor compartido con Struo | Alta | Alto | Fase 0 corta, v0.1 acotada, olas en paralelo, puertas de validación |

---

## 23. Fuera de alcance

- **Captura pasiva** de pantalla, portapapeles o actividad (tipo Pieces).
- **Cuadernos ejecutables** con intérpretes (tipo Jupyter).
- **Organización «mágica» con IA** que esconde dónde está cada cosa.
- **Grafo global** de todo el espacio.
- **Colaboración** en tiempo real, cuentas y sincronización propia en la nube.
- **App móvil nativa** (la PWA cubre capturar y consultar).
- **Plugins de terceros.**
- **Gestión de tareas o proyectos** completa.
- **Editor científico** que intente sustituir a LaTeX u Overleaf.
- **Puntuaciones de «calidad» o «verdad»** de una investigación.
- **Un chat con IA en Inicio.** El compositor parece un chat, pero las respuestas son plantillas deterministas. La IA opcional (§16) nunca contesta en el feed por su cuenta.
- **Rachas, puntuaciones de productividad o rankings** en Métricas.

---

## 24. Relación con Struo

| Aspecto | Struo | Rimor |
|---|---|---|
| Para qué | Aprender lo que ya existe | Ordenar y entender lo que encuentras trabajando |
| Plataforma | Escritorio (Tauri, Rust) | Web (PWA), local en el navegador |
| Fuente de verdad | Carpeta de Markdown en disco | Markdown en OPFS, exportable en ZIP |
| IA | Opcional, entrenador | Opcional, auxiliar; nunca calcula |
| Comparten | Editor CodeMirror, componentes de interfaz, convenciones de archivos (Markdown + frontmatter, wikilinks), método de desarrollo y principios (archivos tuyos, sin culpa, evidencia antes que moda) |

**Compatibilidad:** un ZIP de Rimor descomprimido se puede abrir como vault en Struo u Obsidian. Más adelante, Struo podría importar fuentes y fórmulas de Rimor, y Rimor podría enlazar apuntes de Struo.

---

## 25. Decisiones abiertas

| # | Decisión | Propuesta |
|---|---|---|
| D1 | Nombre definitivo | **Rimor** (elegido el 17 oct 2026). Pendiente: comprobar marcas en EUIPO y OEPM, y dominio |
| D2 | Identidad visual | **Instrumento** (decidido el 17 oct 2026). Referencia completa en `rimor-diseno.md` |
| D12 | Portada de v0.1 | **Inicio** como chat de captura (decidido); en v0.2 gana memoria: sesiones anteriores y lo que vuelve (ORG-12) |
| D13 | Hilos | Entidad propia y ligera (`hilos/`, prefijo `HIL`), distinta de la investigación. Pendiente: si un elemento puede estar en varios hilos (propuesta: no, solo en uno) |
| D14 | Respuestas de Rimor | Plantillas por lector, en español e inglés desde v0.1. Pendiente: si el usuario puede desactivarlas por tipo (propuesta: sí, en Ajustes) |
| D3 | Formato principal | Markdown en OPFS (decidido en §13.1); JSON como exportación alternativa |
| D4 | Formato de ID | ULID interno + ref corta por tipo (§13.3) |
| D5 | Licencia | La misma que Struo |
| D6 | Router | TanStack Router (alternativa: React Router) |
| D7 | Enriquecimiento de enlaces en v0.1 | No: en v0.2, tras la prueba F0-7 |
| D8 | Tamaño máximo de un original dentro del `.md` | 2 MB; por encima, adjunto |
| D9 | Proxy para URLs | Ninguno hasta tener datos; si hace falta, uno mínimo que pueda alojar el propio usuario |
| D10 | Idioma de las plantillas | Español e inglés desde v0.3 |
| D11 | Dominio y despliegue | Hosting estático; dominio cuando haya versión pública |

---

## 26. Anexos

### Anexo A. `manifest.json`

```json
{
  "formato": "rimor",
  "esquema": 1,
  "espacio": { "id": "01JAB3K9Q2X8M5N7P0R4S6T8V0", "nombre": "Trabajo" },
  "exportado": "2026-10-17T18:05:12+02:00",
  "app": { "version": "0.1.0" },
  "recuentos": { "elementos": 412, "investigaciones": 3, "documentos": 2, "adjuntos": 37 },
  "adjuntos_excluidos": [],
  "hashes": { "algoritmo": "SHA-256", "archivos": { "elementos/2026/10/LOG-0042--timeout-streaming-ureq.md": "9b1c…" } }
}
```

### Anexo B. Ejemplos de archivos

**Log**

````markdown
---
id: 01JAB4C2…
ref: LOG-0042
tipo: log
titulo: Timeout en streaming con ureq
creado: 2026-10-16T18:44:03+02:00
modificado: 2026-10-16T18:51:40+02:00
origen: pegado
estado: resuelto
colecciones: [gateway]
investigaciones: [INV-0003]
etiquetas: [ureq, streaming]
sesion: 2026-10-16-tarde
hash: sha256:3fa2c9…
ocultados: 0
lector:
  nombre: log
  version: 1
  resumen: { lineas: 11, errores: 3, avisos: 3, plantillas: 9, desde: "18:40:51", hasta: "18:41:51" }
---

El cliente lee el cuerpo entero porque la respuesta no trae content-length. Ver [[CMP-0005]].

```log
2026-10-16T18:40:51.007Z INFO  gateway: request id=c19e0b77-… model=llama3.1:8b
2026-10-16T18:40:51.013Z WARN  http: response has no content-length, reading body to end
2026-10-16T18:41:21.014Z ERROR stream: read timeout after 30000ms
…
```
````

**Prompt**

````markdown
---
id: 01JAB5D7…
ref: PRM-0012
tipo: prompt
titulo: Revisor de ADR
creado: 2026-10-17T18:05:12+02:00
version: 2
colecciones: [prompts-revision]
lector:
  nombre: prompt
  version: 1
  resumen: { variables: [adr, contexto], tokens_aprox: 410, destino: "Claude" }
resultados:
  - fecha: 2026-10-17
    valoracion: 4
    nota: Detectó la falta de consecuencias negativas.
    archivo: historial/PRM-0012/resultado-2026-10-17.md
---

```prompt
Actúa como revisor de decisiones de arquitectura. Lee el ADR {{adr}} en el contexto {{contexto}}…
```
````

**Investigación**

```markdown
---
id: 01JAB6E1…
ref: INV-0003
tipo: investigacion
titulo: Cliente HTTP del gateway de IA
pregunta: ¿Cambiamos reqwest por ureq para reducir dependencias sin perder fiabilidad?
estado: abierta
creado: 2026-10-16T17:00:00+02:00
elementos:
  - { ref: URL-0101, papel: contexto }
  - { ref: CMP-0004, papel: apoya, interpretacion: "ureq es algo más rápido en peticiones de 64 KB" }
  - { ref: CMP-0005, papel: contradice, interpretacion: "" }
hipotesis:
  - { texto: "El timeout se debe a leer el cuerpo entero", estado: pendiente }
decision:
  opciones: [reqwest, ureq]
  criterios:
    - { nombre: Streaming fiable, peso: 4, puntuaciones: [5, 2], evidencia: [CMP-0005] }
    - { nombre: Dependencias y compilación, peso: 3, puntuaciones: [2, 5], evidencia: [URL-0101] }
    - { nombre: Rendimiento, peso: 3, puntuaciones: [3, 4], evidencia: [CMP-0004] }
conclusion: ""
---

Notas libres de la investigación.
```

**Documento**

```markdown
---
id: 01JAB7F3…
ref: DOC-0002
tipo: documento
plantilla: adr
titulo: "ADR-0012: Cliente HTTP del gateway de IA"
investigacion: INV-0003
estado: borrador
cifras:
  CMP-0004.cambio: { valor: "-4,6 %", fijado: 2026-10-17T19:10:00+02:00 }
---

## Contexto

…

## Evidencias

En peticiones de 64 KB, ureq cambia la latencia un {{CMP-0004.cambio}} (@fig:latencia).

![[CMP-0004|grafico]]
```

### Anexo C. Interfaz de lector

Ver §14.4.

### Anexo D. Orden orientativo de detección

| Orden | Lector | Señales principales |
|---|---|---|
| 1 | Sobre de terminal | Cabecera propia de la CLI |
| 2 | Archivo binario | Imagen, PDF, Parquet por tipo MIME o firma (Magika es una opción para detección por contenido) |
| 3 | Enlace | El texto entero es una URL o un DOI |
| 4 | Error o traza | Patrones de traza de lenguajes conocidos |
| 5 | Log | ≥ 3 líneas, la mayoría con marca de tiempo o nivel |
| 6 | Mediciones | ≥ 3 valores numéricos con o sin unidad, `Benchmark…ns/op`, JSON de hyperfine |
| 7 | JSON, YAML, TOML | Se analiza sin errores |
| 8 | Datos tabulares | Separador consistente en todas las filas |
| 9 | Petición HTTP | Empieza por `curl` |
| 10 | Diff | `diff --git`, `@@ -a,b +c,d @@` |
| 11 | Prompt | Imperativo dirigido a un modelo, variables, frontmatter de skill, `CLAUDE.md` |
| 12 | Documento Markdown | Varios encabezados o listas de tareas |
| 13 | Comando | Una línea que empieza por `$` o por un programa conocido |
| 14 | Fórmula, diagrama | `$$…$$`, `\begin{`, `graph TD`, sintaxis D2 |
| 15 | Código | Densidad de sintaxis de un lenguaje |
| 16 | Idea | Texto corto (menos de unas 280 letras) sin otras señales |
| 17 | Texto | Todo lo demás |

### Anexo E. Catálogo de reglas «Qué falta»

| Regla | Condición | Acción sugerida |
|---|---|---|
| QF-01 | La investigación tiene conclusión y ninguna evidencia | Vincular evidencias |
| QF-02 | Una afirmación de rendimiento se apoya en una sola comparación de mediciones | Medir otra vez, en otra máquina |
| QF-03 | Un criterio de decisión no tiene evidencia | Vincular o capturar evidencia |
| QF-04 | Un cambio de menos del 50 % en un solo peso invierte la decisión | Revisar ese criterio |
| QF-05 | Una evidencia que contradice no tiene interpretación | Interpretar |
| QF-06 | Un resultado de comparación vinculado no tiene interpretación | Interpretar |
| QF-07 | Una ficha de enlace tiene más de 90 días | Volver a consultar |
| QF-08 | Hipótesis pendiente sin ningún elemento vinculado | Vincular o descartar |
| QF-09 | Investigación abierta sin actividad en 30 días | ¿Aparcar? (sin culpa) |
| QF-10 | Mediciones con menos de 10 repeticiones usadas como evidencia | Repetir con más muestras |
| QF-11 | Documento con cifras escritas a mano que existen como cifra citable | Convertir en cifra viva |
| QF-12 | Documento con referencias rotas o DOI no verificados | Revisar referencias |

### Anexo F. Estructura de las plantillas

- **Informe técnico:** resumen · contexto y problema · alcance · qué se hizo (método) · resultados · conclusión · limitaciones · siguientes pasos · anexos.
- **ADR (MADR 4.0):** título · estado · contexto y problema · factores de decisión · opciones consideradas · decisión y justificación · consecuencias (positivas y negativas) · sensibilidad · enlaces.
- **Postmortem / causa raíz:** resumen · impacto · cronología · detección · causa raíz · factores contribuyentes · qué funcionó · acciones (con responsable y fecha) · lecciones.
- **Comparativa:** objetivo · opciones · criterios y pesos · datos por criterio · matriz · sensibilidad · recomendación · riesgos.
- **Informe de cancelación:** qué se intentaba · qué se probó · por qué se cancela · qué se aprendió · qué haría falta para retomarlo.
- **Nota de investigación:** pregunta · hallazgos · evidencias · siguiente paso.
- **Minipaper:** título · resumen · introducción · trabajo relacionado · método · resultados · discusión · limitaciones y amenazas a la validez · conclusión · referencias · anexo reproducible.

### Anexo G. Sintaxis de búsqueda

| Sintaxis | Significado |
|---|---|
| `timeout streaming` | Texto (todas las palabras) |
| `"read timeout"` | Frase exacta |
| `tipo:log` / `tipo:error,mediciones` | Por tipo |
| `en:gateway` | En la colección o investigación |
| `#ureq` | Etiqueta |
| `desde:2026-10-01` `hasta:2026-10-15` / `hoy` / `semana` | Fechas |
| `estado:abierto` | Estado |
| `nivel:error` | Logs con líneas de error |
| `huella:3fa2` | Errores con esa huella |
| `dominio:github.com` | Enlaces de un dominio |
| `-palabra` | Excluir |

### Anexo H. Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+V` (fuera de un campo) | Capturar lo pegado |
| `Ctrl+Shift+Espacio` | Ir al compositor desde cualquier pantalla |
| `Enter` / `Mayús+Enter` (en el compositor) | Guardar / nueva línea |
| `Ctrl+K` | Paleta de comandos |
| `/` | Buscar |
| `g` y luego `h` / `m` / `i` / `d` | Ir a Inicio / Métricas / Investigaciones / Documentos |
| `j` `k` `Enter` `r` `c` `i` `e` `f` `t` `x` | Feed de Inicio (§9.1) |
| `Ctrl+Shift+C` | Comparar los seleccionados |
| `Ctrl+E` | Exportar el espacio en ZIP |

### Anexo I. Pantallas de referencia

El artefacto «Pantallas de Rimor» (v3, estilo Instrumento) es la referencia visual para el desarrollo. La guía `rimor-diseno.md` manda si hay diferencias. El artefacto «Estilos de Rimor» guarda las diez direcciones exploradas antes de elegir Instrumento.

**Cómo usarlo:**
- Cada pantalla trae debajo sus **notas de desarrollo**: fase, IDs, datos que usa, interacciones, estados que hay que diseñar y decisiones pendientes.
- El interruptor **IDs** marca cada bloque con las funcionalidades que implementa.
- **Escritorio / Móvil** muestra el diseño adaptable, hecho con consultas de contenedor.
- **Sistema, Claro y Oscuro** muestran los dos temas.

Los datos de ejemplo son coherentes en todas las pantallas (colección `gateway`, `INV-0003`, `CMP-0004`…). Los cálculos que el plan define como deterministas son reales en el prototipo: estadística de mediciones, plantillas y comparación de logs, huella de error, detección de tipo, ocultación de secretos, indicaciones y respuestas del compositor, búsqueda con filtros, perfil de datos, matriz y sensibilidad, cifras vivas con desfase y lienzo con tarjetas que se arrastran.

| Pantalla | Fase | Funcionalidades principales |
|---|---|---|
| Inicio | v0.1 | ORG-01, CAP-01, CAP-03 a CAP-05, CAP-13, CAP-14, ORG-08, ORG-12, ORG-13 |
| Hilo | v0.1 | ORG-15, ORG-06, INV-02 |
| Log | v0.1 | LEC-04, BUS-05 |
| Error | v0.1 | LEC-05, ORG-06 |
| Prompt | v0.1 | LEC-07, CMP-02 |
| Documento Markdown | v0.1 | LEC-08, CMP-02 |
| Datos tabulares | v0.2 | LEC-11, VIS-07 |
| Comparación de mediciones | v0.1 | LEC-06, CMP-01 |
| Comparación de logs | v0.1 | CMP-01, LEC-04 |
| Búsqueda | v0.1 / v0.2 | BUS-01, BUS-02, BUS-04, BUS-05 |
| Colección | v0.2 | VIS-04, ORG-09, ORG-11 |
| Línea de tiempo | v0.2 | VIS-05, VIS-06, ORG-08 |
| Lienzo | v0.3 | VIS-10 |
| Métricas | v0.2 / v0.3 | MET-01 a MET-07 |
| Investigación | v0.3 | INV-01 a INV-08 |
| Decisión | v0.3 | INV-06, VIS-11 |
| Documento | v0.3 / v0.4 | DOC-01 a DOC-07, DOC-14 |
| Datos y copias | v0.1 | DAT-03, DAT-05 a DAT-09 |
| Importar ZIP | v0.1 | DAT-04, SEG-04 |
| Sistema de diseño | — | §17 y `rimor-diseno.md` |

---

## 27. Fuentes

**Competencia y contexto**
- [Tana: mejores apps de segundo cerebro en 2026](https://tana.inc/blog/best-second-brain-apps-2026)
- [Fabric: comparativa de apps de segundo cerebro](https://fabric.so/comparison/best-second-brain-app)
- [Análisis de Pieces for Developers en 2026](https://baeseokjae.github.io/posts/pieces-for-developers-review-2026/)
- [AlternativeTo: DEVONthink 4.2](https://alternativeto.net/news/2026/1/devonthink-4-2-updates-the-design-adds-ai-search-choices-and-upgrades-the-ai-assistant)
- [AI Indigo: Heptabase en 2026](https://aiindigo.com/blog/heptabase-review-2026-the-visual-knowledge-base-for-deep-thinkers)
- [Techsy: herramientas de gestión de prompts](https://techsy.io/en/blog/best-prompt-management-tools)
- [Retraction Watch: referencias inventadas en PubMed en 2026](https://retractionwatch.com/2026/05/07/one-in-277-pubmed-indexed-papers-in-2026-shows-fabricated-references-says-analysis/)

**Plataforma web**
- [WebKit: política de almacenamiento](https://webkit.org/?p=14403)
- [MDN: límites de almacenamiento y criterios de desalojo](https://developer.mozilla.org/fr/docs/Web/API/API_IndexedDB/Browser_storage_limits_and_eviction_criteria)
- [MDN: Storage API](https://developer.mozilla.org/docs/Web/API/Storage_API)
- [Chrome: File System Observer API](https://developer.chrome.com/blog/file-system-observer)
- [Chrome: Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)
- [Gemini Nano en Chrome (2026)](https://pasqualepillitteri.it/en/news/3145/gemini-nano-chrome-built-in-ai-client-side-en)
- [Configurar Ollama con CORS](https://api.onlyoffice.com/docs/ai/guides/configuring-ollama-with-cors/)

**Librerías y motores**
- [pandoc-wasm](https://github.com/pandoc/pandoc-wasm)
- [typst.ts](https://github.com/myriad-dreamin/typst.ts)
- [Foro de Typst: typst-wasm](https://forum.typst.app/t/typst-wasm-compile-typst-in-browsers-node-and-serverless-runtimes/9399)
- [DuckDB-Wasm](https://duckdb.org/2021/10/29/duckdb-wasm.html)
- [DuckDB-WASM en el navegador (2026)](https://noqta.tn/en/tutorials/duckdb-wasm-browser-analytics-nextjs-2026)
- [transformers.js con WebGPU (2026)](https://noqta.tn/en/tutorials/transformers-js-webgpu-browser-ai-nextjs-2026)
- [D2.js](https://cdn.jsdelivr.net/npm/@terrastruct/d2@0.1.33/README.md)
- [Tesseract.js en el navegador](https://transloadit.com/devtips/integrating-ocr-in-the-browser-with-tesseract-js/)
- [Magika (npm)](https://npmjs.com/package/magika)
- [Numbat](https://github.com/Bzero/numbat)
- [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat)

**Datos externos**
- [Google Security Blog: API de deps.dev](https://security.googleblog.com/2023/04/announcing-depsdev-api-critical.html?m=1)
- [CASRAI: OpenAlex exige clave en 2026](https://casrai.org/news/openalex-api-keys-mandatory-usage-based-pricing-2026)

**Cuadernos de laboratorio**
- [eLabFTW: trazabilidad y auditoría](https://doc.elabftw.net/docs/usage/traceability-and-auditability)
