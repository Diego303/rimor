# Seguimiento de Rimor

**Estado global:** EN CURSO
**Última actualización:** 2026-10-25 21:32
**Ahora:** IN-045 · JSON, YAML y TOML con comparación estructural · fase implementación
**Siguiente:** IN-046 · Petición HTTP
**Progreso:** F0 9/9 · v0.1 42/42 · v0.2 4/22 · v0.3 0/17 · v0.4 0/9 · total 55/99

## Tablero
| ID | Funcionalidad | Versión | Ola | Estado | Commits | Documento |
|---|---|---|---|---|---|---|
| F0-1 | OPFS a escala | F0 | — | hecha | 589ad61 | docs/f0/F0-1.md |
| F0-2 | ZIP de ida y vuelta | F0 | — | hecha | f501d1a | docs/f0/F0-2.md |
| F0-3 | pandoc-wasm | F0 | — | hecha | 23b903b | docs/f0/F0-3.md |
| F0-4 | typst.ts a PDF | F0 | — | hecha | fe9ad6a | docs/f0/F0-4.md |
| F0-5 | DuckDB-WASM | F0 | — | hecha | 7992596 | docs/f0/F0-5.md |
| F0-6 | Logs grandes | F0 | — | hecha | 1b0d2b2 | docs/f0/F0-6.md |
| F0-7 | CORS de APIs | F0 | — | hecha | f42735a | docs/f0/F0-7.md |
| F0-8 | MiniSearch | F0 | — | hecha | 7eacd39 | docs/f0/F0-8.md |
| F0-9 | Fuentes empaquetadas | F0 | — | hecha | f529c42 | docs/f0/F0-9.md |
| IN-001 | Repositorio, herramientas e integración continua | v0.1 | 0 | hecha | 4088155 b31670c d8ece75 | docs/features/IN-001-repositorio.md |
| IN-002 | Tema Instrumento y componentes base | v0.1 | 0 | hecha | 3f75c99 4b3c27c 63afa3a | docs/features/IN-002-tema-y-componentes.md |
| IN-003 | Textos, idiomas y formatos | v0.1 | 0 | hecha | e4770f8 2001502 d44efd6 | docs/features/IN-003-textos-idiomas-formatos.md |
| IN-004 | Formato de archivos (`paquetes/formato`) | v0.1 | 0 | hecha | eea9cb1 f942aa1 feceb14 | docs/features/IN-004-formato.md |
| IN-089 | Símbolo «Señal», iconos de app y favicon | v0.1 | 0 | hecha | 4177d63 58a44ca 9c0cb34 | docs/features/IN-089-marca.md |
| IN-005 | Almacén OPFS y en memoria | v0.1 | 1 | hecha | 8683837 1212e5a 06512fc | docs/features/IN-005-almacen.md |
| IN-006 | Caché de derivados e índice | v0.1 | 1 | hecha | 07a0baf 74e501c 4b6ee55 | docs/features/IN-006-cache.md |
| IN-008 | Carcasa, navegación, atajos y diseño adaptable | v0.1 | 1 | hecha | bd270d9 f9cda52 daacb69 | docs/features/IN-008-carcasa.md |
| IN-009 | Saneado y política de seguridad de contenido | v0.1 | 1 | hecha | f63fd83 ae2a843 d0c9d58 | docs/features/IN-009-saneado-csp.md |
| IN-010 | Ocultación de secretos | v0.1 | 1 | hecha | a206f2c e8cae1b 34b4ca4 | docs/features/IN-010-secretos.md |
| IN-011 | Paquete de estadística | v0.1 | 1 | hecha | 5838d9a b2ebf4e afb9e32 | docs/features/IN-011-estadistica.md |
| IN-090 | Animaciones del símbolo (núcleo) | v0.1 | 1 | hecha | b9e91ee bdd15f6 69e2ee5 | docs/features/IN-090-animaciones.md |
| IN-007 | Espacio de trabajo y persistencia | v0.1 | 2 | hecha | 39f479a 86e9ce2 d410b16 | docs/features/IN-007-espacio.md |
| IN-012 | Contrato y registro de lectores | v0.1 | 2 | hecha | fa7e527 00d01e5 aa34b1e | docs/features/IN-012-lectores.md |
| IN-013 | Detector de tipo y corpus | v0.1 | 2 | hecha | 9e3e067 6697076 e6f4ac8 | docs/features/IN-013-detector.md |
| IN-014 | Flujo de captura | v0.1 | 3 | hecha | 683703f 9830443 02b7548 | docs/features/IN-014-captura.md |
| IN-015 | Compositor | v0.1 | 3 | hecha | df7d8c3 3531022 871224d | docs/features/IN-015-compositor.md |
| IN-016 | Respuestas de Rimor y contadores locales | v0.1 | 3 | hecha | c521a65 5b52db2 674f816 | docs/features/IN-016-respuestas.md |
| IN-017 | Lector Texto y lector genérico de archivo | v0.1 | 3 | hecha | ecade38 19869f2 d231066 | docs/features/IN-017-texto-archivo.md |
| IN-018 | Lector Idea y resurgimiento mínimo | v0.1 | 4 | hecha | 42c27b3 1f5f2dc 8c171e4 | docs/features/IN-018-idea.md |
| IN-019 | Lector Enlace básico | v0.1 | 4 | hecha | 218e20d bed4c8f d8043f4 | docs/features/IN-019-enlace.md |
| IN-020 | Lector Log | v0.1 | 4 | hecha | 2dc9a36 070d82c 3710ad0 | docs/features/IN-020-log.md |
| IN-021 | Lector Error y huella | v0.1 | 4 | hecha | 40322cb 2ab9520 d363617 | docs/features/IN-021-error.md |
| IN-022 | Lector Mediciones | v0.1 | 4 | hecha | b310e37 6a1cf43 9b9c796 | docs/features/IN-022-mediciones.md |
| IN-023 | Lector Prompt | v0.1 | 4 | hecha | 7b6580a bc9fa85 5498fa1 | docs/features/IN-023-prompt.md |
| IN-024 | Lector Documento Markdown | v0.1 | 4 | hecha | 77638b0 39b2632 5a6c03e | docs/features/IN-024-markdown.md |
| IN-025 | Lector Código | v0.1 | 4 | hecha | 7c063ed 976f145 9926e80 | docs/features/IN-025-codigo.md |
| IN-026 | Inicio: feed y triaje | v0.1 | 5 | hecha | c71fe34 3387a22 3e903c6 | docs/features/IN-026-inicio.md |
| IN-027 | Vista de elemento, estados, fijar y papelera | v0.1 | 5 | hecha | 8e26cc6 e004ba0 52abc20 | docs/features/IN-027-elemento.md |
| IN-028 | Comparaciones de logs y mediciones | v0.1 | 5 | hecha | 6f0e9f7 cd731a1 a9fce8f | docs/features/IN-028-comparaciones.md |
| IN-029 | Versiones e historial | v0.1 | 5 | hecha | 2a73dd9 701dbe2 7eac401 | docs/features/IN-029-versiones.md |
| IN-030 | Hilos | v0.1 | 5 | hecha | f79375a 2fd00eb 7287d9a | docs/features/IN-030-hilos.md |
| IN-031 | Colecciones y etiquetas | v0.1 | 5 | hecha | f7526c7 7134d64 0d00edd | docs/features/IN-031-colecciones.md |
| IN-032 | Búsqueda | v0.1 | 5 | hecha | f797561 e9a801d 7c7f416 6e40ab9 | docs/features/IN-032-busqueda.md |
| IN-033 | Paleta de comandos | v0.1 | 6 | hecha | dd50a0d 5d9fe05 8301765 | docs/features/IN-033-paleta.md |
| IN-034 | Mosaico y lista densa | v0.1 | 6 | hecha | 129a1b1 8ed1999 3338b05 | docs/features/IN-034-vistas.md |
| IN-035 | Exportar ZIP y JSON | v0.1 | 6 | hecha | 2023eae b70ba11 3361b0b | docs/features/IN-035-exportar.md |
| IN-036 | Importar ZIP y JSON | v0.1 | 6 | hecha | 9728e95 cb68c02 9790355 | docs/features/IN-036-importar.md |
| IN-037 | Datos y copias | v0.1 | 6 | hecha | 0479bc1 485e5f9 9eb2973 | docs/features/IN-037-datos-copias.md |
| IN-038 | Ajustes | v0.1 | 6 | hecha | 26f3057 fcf110c 2249ee7 | docs/features/IN-038-ajustes.md |
| IN-039 | Primer uso y espacio de ejemplo | v0.1 | 6 | hecha | fec4ff4 4c0df39 86d1dda | docs/features/IN-039-primer-uso.md |
| IN-040 | Cierre de v0.1 | v0.1 | 7 | hecha | 6dcf500 8ccb01e | docs/features/IN-040-cierre-v0.1.md |
| IN-041 | Enlace enriquecido | v0.2 | 8 | hecha | f2f85db 76c95a1 a78cdaf | docs/features/IN-041-enlace-enriquecido.md |
| IN-042 | Diff y parche | v0.2 | 8 | hecha | d1d8e29 f901a5a b8ff910 | docs/features/IN-042-diff-parche.md |
| IN-043 | Comando con huecos | v0.2 | 8 | hecha | 6073c48 c6eb683 b9ca2c0 | docs/features/IN-043-comando.md |
| IN-044 | Datos tabulares con DuckDB | v0.2 | 8 | hecha | 5e9f8b1 be063ce 42ea221 | docs/features/IN-044-datos-tabulares.md |
| IN-045 | JSON, YAML y TOML con comparación estructural | v0.2 | 8 | en implementación | — | docs/features/IN-045-json-yaml-toml.md |
| IN-046 | Petición HTTP | v0.2 | 8 | pendiente | — | — |
| IN-047 | Mediciones: más formatos y Hodges-Lehmann | v0.2 | 8 | pendiente | — | — |
| IN-048 | Logs: plantillas con Drain | v0.2 | 8 | pendiente | — | — |
| IN-049 | Reglas aprendidas y captura múltiple | v0.2 | 9 | pendiente | — | — |
| IN-050 | PWA, sin conexión y compartir | v0.2 | 9 | pendiente | — | — |
| IN-051 | Sesiones automáticas | v0.2 | 9 | pendiente | — | — |
| IN-052 | Grupos automáticos y pantalla de colección | v0.2 | 9 | pendiente | — | — |
| IN-053 | Enlaces automáticos | v0.2 | 9 | pendiente | — | — |
| IN-054 | Vistas guardadas | v0.2 | 9 | pendiente | — | — |
| IN-055 | Inicio con memoria | v0.2 | 9 | pendiente | — | — |
| IN-056 | Búsqueda: facetas, contenido derivado y parecidos | v0.2 | 9 | pendiente | — | — |
| IN-057 | Línea de tiempo y calendario | v0.2 | 10 | pendiente | — | — |
| IN-058 | Gráficos de datos | v0.2 | 10 | pendiente | — | — |
| IN-059 | Métricas I | v0.2 | 10 | pendiente | — | — |
| IN-060 | Varios espacios y exportación parcial | v0.2 | 10 | pendiente | — | — |
| IN-061 | Modo sin red | v0.2 | 10 | pendiente | — | — |
| IN-062 | Cierre de v0.2 | v0.2 | 10 | pendiente | — | — |
| IN-063 | Sobre de terminal (CLI) | v0.3 | 11 | pendiente | — | — |
| IN-064 | Imagen y OCR | v0.3 | 11 | pendiente | — | — |
| IN-065 | PDF | v0.3 | 11 | pendiente | — | — |
| IN-066 | Fórmula y diagrama | v0.3 | 11 | pendiente | — | — |
| IN-067 | Comparar varias series | v0.3 | 11 | pendiente | — | — |
| IN-070 | Investigación | v0.3 | 11 | pendiente | — | — |
| IN-068 | Resurgimiento completo | v0.3 | 12 | pendiente | — | — |
| IN-069 | Tablero por estado y vecinos | v0.3 | 12 | pendiente | — | — |
| IN-071 | Decisión y sensibilidad | v0.3 | 12 | pendiente | — | — |
| IN-072 | Qué falta | v0.3 | 12 | pendiente | — | — |
| IN-073 | Lienzo | v0.3 | 12 | pendiente | — | — |
| IN-074 | Editor y resolvedor de documentos | v0.3 | 12 | pendiente | — | — |
| IN-075 | Plantillas y documento desde investigación | v0.3 | 13 | pendiente | — | — |
| IN-076 | Exportación Markdown, HTML y PDF por impresión | v0.3 | 13 | pendiente | — | — |
| IN-077 | Métricas II | v0.3 | 13 | pendiente | — | — |
| IN-078 | Importar Obsidian y Markdown suelto | v0.3 | 13 | pendiente | — | — |
| IN-079 | Cierre de v0.3 | v0.3 | 13 | pendiente | — | — |
| IN-080 | Cálculo con unidades | v0.4 | 14 | pendiente | — | — |
| IN-081 | Búsqueda por significado | v0.4 | 14 | pendiente | — | — |
| IN-082 | Mapa afirmación × evidencia | v0.4 | 14 | pendiente | — | — |
| IN-083 | Minipaper y numeración | v0.4 | 14 | pendiente | — | — |
| IN-084 | Word y LaTeX con Pandoc | v0.4 | 15 | pendiente | — | — |
| IN-085 | PDF con Typst | v0.4 | 15 | pendiente | — | — |
| IN-086 | Bibliografía y verificador | v0.4 | 15 | pendiente | — | — |
| IN-087 | Qué falta del documento y anexo reproducible | v0.4 | 15 | pendiente | — | — |
| IN-088 | Cierre de v0.4 | v0.4 | 15 | pendiente | — | — |

Estados: pendiente · en análisis y diseño · en implementación · en verificación · hecha · bloqueada

## Decisiones
| Fecha | Decisión | Dónde |
|---|---|---|
| 2026-10-18 | Monorepo pnpm: la web Astro es la app en la raíz; `paquetes/*` y `cli/` son paquetes del workspace | [ADR-0001](adr/0001-estructura-del-repositorio.md) |
| 2026-10-18 | Rimor es una sola isla React (`client:only`) en `/`, con salida estática, enrutado por hash y despliegue en GitHub Pages | [ADR-0002](adr/0002-la-app-dentro-de-astro.md) |
| 2026-10-18 | Lo visual (medidas, clases e iconos) sigue el CSS de las pantallas; símbolo «Señal» | [ADR-0004](adr/0004-referencia-visual.md) |
| 2026-10-18 | CSP en `<meta>` con hashes de scripts en línea; estilos en línea permitidos; `connect-src` fijo | [ADR-0005](adr/0005-politica-de-seguridad-de-contenido.md) |
| 2026-10-18 | Decisiones abiertas del plan adoptadas con su propuesta (D6, D13–D18); D5 queda para el autor | [ADR-0003](adr/0003-decisiones-abiertas-adoptadas.md) |

## Desviaciones del plan
- **Astro en lugar de Vite + React a secas.** El repositorio ya tenía una web base de Astro (plantilla vacía). La app vive dentro de ella como una isla React (ADR-0001, ADR-0002). Las rutas del plan `app/src/…` pasan a `src/…`.
- **Commits del agente y autorrevisión.** Se hace un commit por fase (nunca push) y la aprobación humana (GATE#1) se sustituye por la autorrevisión documentada en cada ficha (prompt maestro §6).
- **Lectores con núcleo y vistas separados** (IN-012): el plan pone `Vista` y `Tarjeta` dentro del objeto `Lector`; aquí van en `Vista.tsx` y `Tarjeta.tsx` de su carpeta, que se encuentran por convención, para que el Worker de derivados no cargue React. El prefijo de la ref sale de `PREFIJOS[tipo]`, el contexto de la respuesta lleva frontmatters y el idioma, cada lector trae sus textos y la etiqueta de sus acciones llega traducida.
- **Datos y copias adelanta su primera tarjeta** (IN-007): espacio usado, persistencia y última copia, como en la pantalla de referencia, para que la persistencia concedida «se muestre». IN-037 completa la pantalla.
- **Despliegue en GitHub Pages** (instrucción del autor del 2026-10-18). Sin cabeceras HTTP propias: la CSP va solo en `<meta>` y la ruta base es configurable (`BASE_URL`).
- **Sin Playwright por ahora** (instrucción del autor del 2026-10-18: «por ahora no testees con Playwright, cuando esté todo hecho ya vemos»). `pnpm verificar` ejecuta tipos, lint, unidades y construcción. Las pruebas de extremo a extremo, visuales, de axe y de fidelidad de animaciones del plan se sustituyen, mientras tanto, por pruebas de componentes con Vitest y happy-dom donde aportan, y quedan apuntadas en «Pendientes de validación humana».
- **`docs/olas/`** no se crea: el estado de cada funcionalidad vive en el tablero de este archivo.
- **Símbolo:** `Pantallas de Rimor.html` dibuja el símbolo antiguo; se usa «Señal» (paquete `rimor-icono`).
- **Fichas que cambia la Fase 0** (`docs/referencias/` es de solo lectura, así que el cambio se anota aquí y en la ficha de cada IN):
  - IN-036: la importación lee el directorio central del ZIP en vez de usar `Unzip` en streaming (F0-2).
  - IN-044: perfil completo hasta 50 MB y por muestra por encima (F0-5).
  - IN-041: arXiv sin CORS, se enriquece por DataCite; Maven solo por deps.dev (F0-7).
  - IN-032: índice comprimido en IndexedDB y carga asíncrona en el Worker (F0-8).
  - IN-085: se hace (F0-4 positiva).
- **Iconos:** los trazados propios de las pantallas en vez de `lucide-react` (mismo estilo: retícula 24 px, trazo 1,8), para que la web sea igual al HTML de referencia (ADR-0004).
- **`--muted` claro `#66635D`** en lugar de `#67645E`: el de la guía da 4,47:1 sobre `--panel-2` y no llega a AA (IN-002).
- **Tipo `archivo` (prefijo `ARC`)** para el lector genérico de archivo de IN-017, que el plan no nombra (IN-004).
- **Botón «Ajustes» en el raíl**, que las pantallas no dibujan, para que la ruta de la ficha se alcance sin teclado (IN-008).
- **Referencias estadísticas solo de NumPy y SciPy**, sin benchstat (no hay Go en el entorno y su prueba usa la distribución exacta de U con muestras pequeñas) (IN-011).
- **Versiones:** se mantiene Astro 5 (Vite 6) con Vitest 3.2 y TypeScript 5.9, aunque ya existen Astro 7, Vitest 5 y TypeScript 7 (IN-001).

## Notas para funcionalidades futuras
- **Lectores de imagen y PDF (v0.3, IN-017):** `releerPendientes` (IN-044) ya relee al abrir el espacio los elementos con `pendiente_lector: true` que un lector de binarios nuevo reconoce (y les quita la marca); basta con registrar el lector y que su `leer` devuelva `original: null`.
- **IN-026 e IN-049 (IN-016):** contar `respuestasDescartadas` («No» o archivar sin actuar) en el triaje y `correccionesDeTipo` cuando se corrija el tipo (también un `/tipo` que contradice al detector) con `espacio.contadores.contar(…)`. IN-021, IN-023 e IN-032 cuentan `erroresReconocidos`, `copiasConValores` y `busquedasConResultado`.
- **IN-029 (IN-016):** rellenar `Contexto.versiones` desde `historial/` y `version`.
- **IN-014/IN-016/IN-026 (IN-012):** `VistaElemento` y `TarjetaElemento` aún no están en ninguna pantalla; la pantalla Elemento (IN-016/IN-026) y el feed deben usarlas para que un lector nuevo «aparezca en la app». La captura pide los derivados con prioridad de fondo y pasa los primeros bytes de los archivos al detector (`cabecera`).
- **IN-050:** las rutas de `public/marca/manifest-iconos.json` son relativas a `marca/`; al copiar el bloque `icons` al manifest de la PWA, hay que anteponer `marca/` (revisión de IN-089).
- **IN-008 e IN-016:** el raíl usa `Logotipo` de 18 px y el avatar de `RespuestaRimor`, `SimboloRimor` mono de 13 px (IN-089).

## Pendientes de validación humana
- **Licencia (D5):** no se ha añadido archivo de licencia. La propuesta del plan es «la misma que Struo». Ojo: pandoc-wasm (IN-084) es GPL-2.0-or-later (F0-3).
- **Pruebas en navegador real** (Playwright en Chromium, Firefox y WebKit, capturas en claro, oscuro y 400 px, axe y fidelidad de animaciones): aplazadas por instrucción del autor hasta el final.
- **Token `--muted` (claro):** se usa `#66635D` porque `#67645E` no llega a AA sobre `--panel-2` (4,47:1). Confirmar o elegir otro valor.
- **F0-1 (OPFS):** ejecutar el script del anexo de `docs/f0/F0-1.md` en Chrome, Firefox y Safari, con y sin la PWA instalada, y anotar tiempos y resultado de `persist()`.
- **F0-2 (ZIP):** exportar 200 MB en la app publicada con el panel de rendimiento abierto y comprobar que no hay tareas largas en el hilo principal.
- **F0-3 (Pandoc):** medir descarga y compilación de `pandoc.wasm` en los tres navegadores; abrir el `.docx` en Word y compilar el `.tex` en Overleaf.
- **F0-4 (Typst):** abrir en un lector de PDF el PDF que genere la app publicada.
- **F0-5 (DuckDB):** medir en los tres navegadores la instanciación y el perfil de un CSV de 50 MB.
- **IN-044 (navegador real):** en la app publicada, soltar un Parquet y comprobar en el panel de red que la extensión sale de `<base>/duckdb/v1.5.4/…` (ninguna petición a extensions.duckdb.org) y que, ya descargada, funciona sin red; abrir un CSV exportado de Excel (Latin-1) y la consulta SQL con `⌘+Intro` en Safari.
- **F0-7 (CORS):** confirmar en la app publicada que el enriquecimiento de IN-041 no lo bloquea el navegador.
- **F0-8 (MiniSearch):** medir en el navegador la búsqueda por pulsación y la carga del índice con un espacio real grande.
- **F0-9 (fuentes):** comprobar en la app publicada que las fuentes salen del propio sitio y que la CSP no bloquea nada.
- **IN-014 (rendimiento):** pegar 100 KB en el portátil de referencia y comprobar que el elemento se ve en menos de 300 ms (p95) con OPFS.
- **IN-007 (persistencia):** en Chrome con la PWA instalada, «Proteger los datos» queda concedido y Datos y copias lo enseña como «Protegido».
- **IN-007 (ventana privada):** abrir la app publicada en incógnito de Chrome, privada de Firefox y de Safari y comprobar que aparece el aviso (la heurística de cuota está probada solo con dobles).
- **IN-007 (dos pestañas):** abrir dos pestañas, comprobar que la segunda avisa de solo lectura y que, al cerrar la primera, la segunda pasa a escribir con lo último guardado.
- **Puerta de validación de v0.1 (IN-040, plan §19):** cuatro semanas de uso real de la app publicada. Se cumple con ≥ 5 capturas por día laborable, ≥ 1 «esto ya te pasó» útil por semana, lo buscado encontrado en < 10 s y menos de 1 de cada 10 respuestas corregida o descartada. Se mide con los contadores locales de `.rimor/contadores.json` (IN-016: `erroresReconocidos`, `busquedasConResultado`, `correccionesDeTipo`, `respuestasDescartadas`) y el recuento de elementos por día; el tiempo de búsqueda, a mano.
- **IN-040 (navegador real):** el recorrido pegar → elemento → comparar → hilo → buscar → exportar → importar con Playwright en Chromium, Firefox y WebKit; axe en navegador real (con contraste) y una pasada manual con teclado y lector de pantalla; exportar 200 MB con el panel de rendimiento abierto (ver F0-2); y repasar a ojo cada pantalla contra `Pantallas de Rimor.html` en claro, oscuro y 400 px.

## Bloqueos
(ninguno)

## Registro
| Fecha | ID | Fase | Resultado | Commit |
|---|---|---|---|---|
| 2026-10-25 | IN-045 | análisis y diseño | lector json (puesto 7) con JSON, YAML (yaml) y TOML (smol-toml 1.9.1), YAML/TOML solo con forma de configuración, árbol plegable con ruta, esquema inferido, versiones (TIPOS_CON_VERSIONES y respuestaVersion en el mensaje del feed), comparación estructural como clase json | … |
| 2026-10-25 | IN-044 | verificación | revisión independiente (15 hallazgos) corregida con pruebas: bytes transferidos, extensión de Parquet servida por el sitio, valores de Arrow por tipo, muestra de Parquet, plazo propio y perfil en 7 consultas, consulta en su conexión y recortada, unidades, señal leyendo-datos, escalas de la muestra, CSV en Latin-1/UTF-16, detección (GFM corta, asctime, comillas multilínea), infinitos, resultado validado, releer pendientes y accesibilidad; pruebas de rendimiento en su proyecto; verificar en verde: 113 archivos, 1462 pruebas, 259,8 KB | 42ea221 |
| 2026-10-25 | IN-044 | implementación | lector datos con DuckDB-WASM (eh/mvp) diferido, perfil por columna con muestra, consulta SQL con CodeMirror, gráfico rápido, comparación de datos, Parquet por firma, leyendo-datos en la señal, wasm-unsafe-eval en la CSP; verificar en verde: 113 archivos, 1437 pruebas, 259,8 KB | be063ce |
| 2026-10-25 | IN-044 | análisis y diseño | lector datos (puesto 8), DuckDB-WASM diferido (1.33.1-dev57.0, eh/mvp), perfil por columna con muestra por encima de 50 MB, SQL con CodeMirror, comparación por perfiles, leyendo-datos en la señal, wasm-unsafe-eval en la CSP | 5e9f8b1 |
| 2026-10-25 | IN-043 | verificación | revisión independiente (10 hallazgos) corregida con pruebas: prompts y prosa, sudo/env/time, plantillas de Go, heredocs y sesiones, tarjeta desde el original, segunda frase, Copiar con respaldo, abrir en solo lectura y en el hilo; verificar en verde: 109 archivos, 1414 pruebas, 255,2 KB | b9ca2c0 |
| 2026-10-25 | IN-043 | implementación | lector comando (puesto 13) con huecos {{x}}, chuleta, Copiar con valores común con el Prompt y la acción abrir en Inicio; verificar en verde: 109 archivos, 1407 pruebas, 254,2 KB | c6eb683 |
| 2026-10-25 | IN-043 | análisis y diseño | lector comando (puesto 13), huecos {{x}}, chuleta con resaltado, Copiar con valores compartido con el Prompt, acción abrir en Inicio | 6073c48 |
| 2026-10-25 | IN-042 | verificación | revisión independiente (12 hallazgos) corregida con pruebas: .patch soltado, unificado en estrecho, rutas de git y Subversion, RFC 2047, sin versiones, plegados perezosos, más formatos, series, ref al cambiar tipo, lector de pantalla, modos; verificar en verde: 107 archivos, 1394 pruebas, 252,6 KB | b8ff910 |
| 2026-10-25 | IN-042 | implementación | lector diff (código) con análisis por cuentas, vista lado a lado en tabla, Registro.deTipo, etiqueta del lector, duda entre tipos distintos y versiones por lector; verificar en verde: 107 archivos, 1384 pruebas, 251,5 KB | f901a5a |
| 2026-10-25 | IN-042 | análisis y diseño | lector diff de tipo código (puesto 10), lado a lado con el estilo .diff, Registro.deTipo, etiqueta del lector, duda entre tipos distintos y versiones del mismo lector | d1d8e29 |
| 2026-10-25 | IN-041 | verificación | revisión independiente (15 hallazgos) corregida con pruebas: no reactivar dominios, foco, plazo de 15 s, fallos al capturar, token, Go, DOI de DataCite, importar sin dominios, redirecciones; verificar en verde: 105 archivos, 1370 pruebas, 249,1 KB | a78cdaf |
| 2026-10-25 | IN-041 | implementación | proveedores (GitHub, GitLab, deps.dev con OSV, Crossref, DataCite), ficha con la anterior y sus cambios, Ajustes | 76c95a1 |
| 2026-10-25 | IN-041 | análisis y diseño | proveedores de F0-7 (GitHub, GitLab, paquetes con OSV, Crossref, arXiv por DataCite), ficha en el frontmatter con la anterior, dominios en Ajustes, token solo en el navegador, sin-conexion en la señal | f2f85db |
| 2026-10-25 | IN-040 | verificación | revisión de diseño y movimiento (23 hallazgos) y segunda revisión (9), corregidos con pruebas; v0.1.0 en el CHANGELOG y package.json; verificar en verde: 103 archivos, 1332 pruebas, 245,9 KB | 8ccb01e |
| 2026-10-24 | IN-040 | análisis y diseño | presupuesto de exportar sin bloquear, matriz al 90 %, recorrido de integración completo, axe sobre las pantallas, revisión de diseño y movimiento, CHANGELOG 0.1.0 | 6dcf500 |
| 2026-10-24 | IN-039 | verificación | pnpm verificar OK (1310 pruebas, 244,8 KB); revisión independiente con 8 hallazgos atendidos (borrar con cerrojo y copia previa, carpetas huérfanas) | 86d1dda |
| 2026-10-24 | IN-039 | implementación | bienvenida con la señal y tres ejemplos, espacio de ejemplo generado con la captura e importado como nuevo, borrar espacios, instalar | 4c0df39 |
| 2026-10-24 | IN-039 | análisis y diseño | bienvenida con la señal de primer uso y tres ejemplos, espacio de ejemplo generado con la captura real e importado como espacio nuevo, borrar espacios, instalar si el navegador lo ofrece | fec4ff4 |
| 2026-10-24 | IN-038 | verificación | pnpm verificar OK (1300 pruebas, 244,1 KB); revisión independiente con 9 hallazgos atendidos | 2249ee7 |
| 2026-10-24 | IN-038 | implementación | ajustes normalizados, opciones de captura en la captura y la vista previa (también el Worker), tema e idioma del espacio, pantalla de tarjetas | fcf110c |
| 2026-10-23 | IN-038 | análisis y diseño | ajustes normalizados con opciones de captura (reglas y duda) también en el Worker, tema e idioma en el espacio y el navegador, pantalla de tarjetas | 26f3057 |
| 2026-10-23 | IN-037 | verificación | pnpm verificar OK (1290 pruebas, 242,3 KB); revisión independiente con 9 hallazgos atendidos | 9eb2973 |
| 2026-10-23 | IN-037 | implementación | ajustes de copia con guardarAjustes, recordatorio en Inicio con aplazamiento, piloto animado, plegado del recordatorio y ZIP previo opcional | 485e5f9 |
| 2026-10-23 | IN-037 | análisis y diseño | ajustes de copia con guardarAjustes, recordatorio en Inicio que se pospone, animación del piloto, plegado del recordatorio y ZIP previo opcional | 0479bc1 |
| 2026-10-23 | IN-036 | verificación | pnpm verificar OK (1277 pruebas, 241,3 KB); revisión independiente con 13 hallazgos atendidos (refs al reimportar, rutas, repetidos, relectura, espacios conocidos) | 9790355 |
| 2026-10-23 | IN-036 | implementación | leerPaquete con corpus malicioso rechazado, plan por id con conflictos y refs reasignadas, tres modos con copia previa y relectura, pantalla Importar | cb68c02 |
| 2026-10-23 | IN-036 | análisis y diseño | validar todo antes de escribir (ZIP, enlaces, manifest, hashes, esquemas), plan por id con conflictos según la fecha de exportación y refs reasignadas, tres modos con ZIP previo y relectura, pantalla como la referencia | 9728e95 |
| 2026-10-23 | IN-035 | verificación | pnpm verificar OK (1255 pruebas, 238,6 KB); revisión independiente con 13 hallazgos atendidos (bombas, validación del directorio, ZIP64, copia exacta, cancelar) | 3361b0b |
| 2026-10-23 | IN-035 | implementación | ZIP en streaming en Worker con manifest de recuentos y hashes, JSON con excluidos declarados, lector por directorio central, propiedad de ida y vuelta, Datos y copias y Ctrl+E | b70ba11 |
| 2026-10-23 | IN-035 | análisis y diseño | ZIP en streaming en un Worker sobre OPFS con manifest de recuentos y hashes, JSON con adjuntos ≤ 1 MB y excluidos declarados, lector por directorio central para la ida y vuelta, Ctrl+E y copia previa | 2023eae |
| 2026-10-23 | IN-034 | verificación | pnpm verificar OK (1227 pruebas, 236,6 KB); revisión independiente con 5 hallazgos atendidos con pruebas | 3338b05 |
| 2026-10-23 | IN-034 | implementación | selector de vista en la dirección, mosaico por tipo o día con tarjetas en tandas, lista densa ordenable y virtual, en colecciones y Buscar | 8ed1999 |
| 2026-10-22 | IN-034 | análisis y diseño | selector Lista, Mosaico y Densa en la dirección; mosaico por tipo o fecha con tarjetas de cada lector en tandas; lista densa ordenable y virtual | 129a1b1 |
| 2026-10-22 | IN-033 | verificación | pnpm verificar OK (1212 pruebas, 235,3 KB); revisión independiente con 8 hallazgos atendidos con pruebas | 8301765 |
| 2026-10-22 | IN-033 | implementación | acciones = atajos con o sin tecla, lógica de puntuación y recientes, paleta con combobox, Ctrl+K en la carcasa | 5d9fe05 |
| 2026-10-22 | IN-033 | análisis y diseño | las acciones son los atajos (con o sin tecla), lógica pura de puntuación y orden con recientes, paleta modal con la caja de Buscar y elementos del motor | dd50a0d |
| 2026-10-22 | IN-032 | verificación | pnpm verificar OK (1194 pruebas, 232,5 KB); revisión independiente con 12 hallazgos atendidos con pruebas | 7c7f416 |
| 2026-10-22 | IN-032 | implementación | consulta del Anexo G, índice MiniSearch en Worker con claves y gzip, motor con ranking y facetas, pantalla Buscar, ? del compositor y contador | e9a801d |
| 2026-10-20 | IN-032 | análisis y diseño | MiniSearch en Worker con claves por elemento y gzip en la caché, analizador del Anexo G sobre el frontmatter, motor con ranking, pantalla como la referencia y el ? del compositor | f797561 |
| 2026-10-20 | IN-031 | verificación | pnpm verificar OK (1103 pruebas, 227,1 KB); revisión independiente con 12 hallazgos atendidos con pruebas | 0d00edd |
| 2026-10-20 | IN-031 | implementación | registro colecciones.json sincronizado, raíl en su orden, pantalla con renombrar, mover y borrar, etiquetas inferidas al capturar, sugerencia en la respuesta | 7134d64 |
| 2026-10-20 | IN-031 | análisis y diseño | registro colecciones.json sincronizado con los elementos, raíl en su orden, pantalla de lista, etiquetas inferidas al capturar y sugerencia en la respuesta | f7526c7 |
| 2026-10-20 | IN-030 | verificación | pnpm verificar OK (1087 pruebas, 224,3 KB); revisión independiente con 12 hallazgos atendidos con pruebas | 7287d9a |
| 2026-10-20 | IN-030 | implementación | hilos con el hilo en cada elemento, formación por huella en cola, responder y «a su hilo», pantalla con resolver y reabrir, mover desde el elemento | 2fd00eb |
| 2026-10-19 | IN-030 | análisis y diseño | el hilo en cada elemento (D13), formación por huella y al responder, pantalla como la referencia, resolver con la nota en el último elemento | f79375a |
| 2026-10-19 | IN-029 | verificación | pnpm verificar OK (1076 pruebas, 222,1 KB); revisión independiente con 13 hallazgos atendidos con pruebas | … |
| 2026-10-19 | IN-029 | implementación | diff Myers y por secciones, historial en turno, versión nueva al capturar con deshacer y guardar aparte, versiones y restaurar en la pantalla, índice de Markdown marcado | 7eac401 |
| 2026-10-19 | IN-029 | implementación (a medias) | hecho: diff Myers y por secciones, parecido, historial del repositorio, versión al capturar, fila del feed, versiones en la pantalla y en Markdown; falta: pruebas de pantalla (Versiones.test.tsx), CHANGELOG, pnpm verificar y commit | 701dbe2 |
| 2026-10-19 | IN-029 | análisis y diseño | historial en turno con copia entera, versión nueva al capturar por título o shingles, Myers y diff por secciones, lista y restaurar | 2a73dd9 |
| 2026-10-19 | IN-028 | verificación | pnpm verificar OK (1058 pruebas, 219,7 KB); aceptación confirmada por la revisión independiente y 11 hallazgos atendidos con pruebas | a9fce8f |
| 2026-10-19 | IN-028 | implementación | entidades en su carpeta, cálculo de logs y mediciones desde los derivados, pantalla como la referencia, crear desde el elemento o Inicio y recálculo con aviso | cd731a1 |
| 2026-10-19 | IN-028 | análisis y diseño | entidades en su carpeta con repositorio genérico, cálculo desde los derivados, pantalla como la referencia y recálculo por huella de las fuentes | 6f0e9f7 |
| 2026-10-19 | IN-027 | verificación | pnpm verificar OK (1030 pruebas, 216,0 KB); revisión independiente con 10 hallazgos corregidos con pruebas | 52abc20 |
| 2026-10-19 | IN-027 | implementación | cabecera editable, «Detalles» común en las once vistas, estados, notas, cambiar tipo, fijar y papelera con ZIP previo | e004ba0 |
| 2026-10-19 | IN-027 | análisis y diseño | cabecera editable, un solo «Detalles» con lo común, estados, notas, cambiar tipo, fijar y papelera con ZIP previo | 8e26cc6 |
| 2026-10-19 | IN-026 | verificación | OK (995 pruebas; 10 grupos de hallazgos de la revisión corregidos) | 3e903c6 |
| 2026-10-19 | IN-026 | implementación | OK (987 pruebas; triaje completo con teclado; 5.000 elementos) | 3387a22 |
| 2026-10-19 | IN-026 | análisis y diseño | feed por días con lista virtual, mensajes, búsquedas, ideas y triaje con teclado | c71fe34 |
| 2026-10-19 | IN-025 | verificación | OK (964 pruebas; 11 grupos de hallazgos de la revisión corregidos) | 9926e80 |
| 2026-10-19 | IN-025 | implementación | OK (951 pruebas; matriz 250/250; 12 lenguajes, resaltado Lezer en 8) | 976f145 |
| 2026-10-19 | IN-025 | análisis y diseño | 12 lenguajes por densidad y extensión, resaltado con Lezer bajo demanda | 7c063ed |
| 2026-10-19 | IN-024 | verificación | OK (898 pruebas; 13 hallazgos de la revisión corregidos) | 5a6c03e |
| 2026-10-18 | IN-024 | implementación | OK (883 pruebas; matriz 225/225) | 39b2632 |
| 2026-10-18 | IN-024 | análisis y diseño | índice con anclas estables, palabras, tareas por sección, enlaces y código; vista como la referencia | 77638b0 |
| 2026-10-18 | IN-023 | verificación | OK (858 pruebas; 13 grupos de hallazgos de la revisión corregidos) | 5498fa1 |
| 2026-10-18 | IN-023 | implementación | OK (829 pruebas; matriz 200/200) | bc9fa85 |
| 2026-10-18 | IN-023 | análisis y diseño | variables en tres sintaxis, copiar con valores, resultados en historial/ | 7b6580a |
| 2026-10-18 | IN-022 | verificación | OK (798 pruebas; 13 hallazgos de la revisión corregidos) | 9b9c796 |
| 2026-10-18 | IN-022 | implementación | OK (774 pruebas; 3 formatos; matriz 175/175) | 6a1cf43 |
| 2026-10-18 | IN-022 | análisis y diseño | tres formatos, estadísticas de IN-011, gráfico de puntos como la referencia, avisos plegados | b310e37 |
| 2026-10-18 | IN-021 | verificación | OK (724 pruebas; 18 hallazgos de la revisión corregidos) | d363617 |
| 2026-10-18 | IN-021 | implementación | OK (684 pruebas; 30 trazas; matriz 150/150) | 2ab9520 |
| 2026-10-18 | IN-021 | análisis y diseño | trazas de 6 lenguajes, marcos propios, huella versionada, ocurrencias y «así lo resolví» | 40322cb |
| 2026-10-18 | IN-020 | verificación | OK (646 pruebas; 15 hallazgos de la revisión corregidos) | 3710ad0 |
| 2026-10-18 | IN-020 | implementación | OK (632 pruebas; 8 formatos; 50.000 líneas en 0,7 s) | 070d82c |
| 2026-10-18 | IN-020 | análisis y diseño | marcas y niveles de 8 formatos, plantillas, pares, histograma, bloques con progreso y carga de adjuntos | 2dc9a36 |
| 2026-10-18 | IN-019 | verificación | OK (608 pruebas; 14 hallazgos de la revisión corregidos) | d8043f4 |
| 2026-10-18 | IN-019 | implementación | OK (603 pruebas; 60/60 URL; matriz 100/100) | bed4c8f |
| 2026-10-18 | IN-019 | análisis y diseño | normalización sin seguimiento, clasificación por destino, título y huella por URL | 218e20d |
| 2026-10-18 | IN-018 | verificación | OK (592 pruebas; 11 hallazgos de la revisión corregidos) | 8c171e4 |
| 2026-10-18 | IN-018 | implementación | OK (589 pruebas; matriz 75/75) | 1f5f2dc |
| 2026-10-18 | IN-018 | análisis y diseño | detección de ideas cortas, estados, vuelta a los 7 y 30 días | 42c27b3 |
| 2026-10-18 | IN-017 | verificación | OK (581 pruebas; 7 hallazgos de la revisión corregidos) | d231066 |
| 2026-10-18 | IN-017 | implementación | OK (577 pruebas; matriz 50/50) | 19869f2 |
| 2026-10-18 | IN-017 | análisis y diseño | Texto con enlaces y menciones, Archivo con descarga y marca de pendiente, corpus de binarios | ecade38 |
| 2026-10-18 | IN-016 | verificación | OK (567 pruebas; 11 hallazgos de la revisión corregidos) | 674f816 |
| 2026-10-18 | IN-016 | implementación | OK (563 pruebas) | 5b52db2 |
| 2026-10-18 | IN-016 | análisis y diseño | contexto, composición con frase de secretos, reglas de estilo, RespuestaRimor y contadores | c521a65 |
| 2026-10-18 | IN-015 | verificación | OK (548 pruebas; 10 hallazgos de la revisión corregidos) | 871224d |
| 2026-10-18 | IN-015 | implementación | OK (537 pruebas) | 3531022 |
| 2026-10-18 | IN-015 | análisis y diseño | indicaciones con exclusiones, vista previa con debounce, autocompletar, adjuntos y atajo global | df7d8c3 |
| 2026-10-18 | IN-014 | verificación | OK (485 pruebas; 9 hallazgos de la revisión corregidos) | 02b7548 |
| 2026-10-18 | IN-014 | implementación | OK (479 pruebas; 100 KB en < 300 ms p95 en memoria) | 9830443 |
| 2026-10-18 | IN-014 | análisis y diseño | ocho pasos con efectos inyectados, pegar al compositor, soltar, límite y deshacer | 683703f |
| 2026-10-18 | IN-013 | verificación | OK (457 pruebas; 5 hallazgos de la revisión corregidos) | e6f4ac8 |
| 2026-10-18 | IN-013 | implementación | OK (452 pruebas; matriz 100 % con Texto por defecto) | 6697076 |
| 2026-10-18 | IN-013 | análisis y diseño | atajos, arbitraje con duda, corpus por carpeta y matriz | 9e3e067 |
| 2026-10-18 | IN-012 | verificación | OK (439 pruebas; 8 hallazgos de la revisión corregidos) | aa34b1e |
| 2026-10-18 | IN-012 | implementación | OK (431 pruebas) | 00d01e5 |
| 2026-10-18 | IN-012 | análisis y diseño | núcleo y vistas por carpeta, cola de derivados en Worker, contenedores y plantilla | fa7e527 |
| 2026-10-18 | IN-007 | verificación | OK (412 pruebas; 11 hallazgos de la revisión corregidos) | d410b16 |
| 2026-10-18 | IN-007 | implementación | OK (402 pruebas) | 86e9ce2 |
| 2026-10-18 | IN-007 | análisis y diseño | abrir o crear, persistencia, última copia y arranque | 39f479a |
| 2026-10-18 | IN-090 | verificación | pnpm verificar OK; 4 hallazgos de la revisión corregidos | 69e2ee5 |
| 2026-10-18 | IN-090 | implementación | pnpm verificar OK (361 pruebas) | bdd15f6 |
| 2026-10-18 | IN-090 | análisis y diseño | SMIL portado a @keyframes, reposo y umbrales | b9e91ee |
| 2026-10-18 | IN-011 | verificación | pnpm verificar OK; 7 hallazgos de la revisión corregidos | afb9e32 |
| 2026-10-18 | IN-011 | implementación | pnpm verificar OK (30 referencias de SciPy) | b2ebf4e |
| 2026-10-18 | IN-011 | análisis y diseño | métodos documentados y referencias de SciPy | 5838d9a |
| 2026-10-18 | IN-010 | verificación | pnpm verificar OK; 10 hallazgos de seguridad corregidos | 34b4ca4 |
| 2026-10-18 | IN-010 | implementación | pnpm verificar OK (272 pruebas) | e8cae1b |
| 2026-10-18 | IN-010 | análisis y diseño | reglas de gitleaks, ocultar puro e idempotente | a206f2c |
| 2026-10-18 | IN-009 | verificación | pnpm verificar OK; 4 hallazgos de seguridad corregidos | d0c9d58 |
| 2026-10-18 | IN-009 | implementación | pnpm verificar OK (219 pruebas) | ae2a843 |
| 2026-10-18 | IN-009 | análisis y diseño | rehype-sanitize con esquema propio y CSP con hashes | f63fd83 |
| 2026-10-18 | IN-008 | verificación | pnpm verificar OK; 5 hallazgos de la revisión corregidos | daacb69 |
| 2026-10-18 | IN-008 | implementación | pnpm verificar OK (182 pruebas, 112,7 KB) | f9cda52 |
| 2026-10-18 | IN-008 | análisis y diseño | router por hash, raíl, atajos y límite de errores | bd270d9 |
| 2026-10-18 | IN-006 | verificación | pnpm verificar OK; 4 hallazgos de la revisión corregidos | 4b6ee55 |
| 2026-10-18 | IN-006 | implementación | pnpm verificar OK (165 pruebas) | 74e501c |
| 2026-10-18 | IN-006 | análisis y diseño | IndexedDB con frontmatter, derivados, índice y reconciliación | 07a0baf |
| 2026-10-18 | IN-005 | verificación | pnpm verificar OK; 6 hallazgos de la revisión corregidos | 06512fc |
| 2026-10-18 | IN-005 | implementación | pnpm verificar OK (149 pruebas) | 1212e5a |
| 2026-10-18 | IN-005 | análisis y diseño | contrato, OPFS en Worker, cola, repositorio y pestañas | 8683837 |
| 2026-10-18 | IN-089 | verificación | pnpm verificar OK; 4 hallazgos de la revisión corregidos | 9c0cb34 |
| 2026-10-18 | IN-089 | implementación | pnpm verificar OK (112 pruebas) | 58a44ca |
| 2026-10-18 | IN-089 | análisis y diseño | SVGO, publicación, componentes y contornos | 4177d63 |
| 2026-10-18 | IN-004 | verificación | pnpm verificar OK; 5 hallazgos de la revisión corregidos | feceb14 |
| 2026-10-18 | IN-004 | implementación | pnpm verificar OK (84 pruebas) | f942aa1 |
| 2026-10-18 | IN-004 | análisis y diseño | modelo, formato del .md y migraciones | eea9cb1 |
| 2026-10-18 | IN-003 | verificación | pnpm verificar OK; 4 hallazgos de la revisión corregidos | d44efd6 |
| 2026-10-18 | IN-003 | implementación | pnpm verificar OK (61 pruebas, 76,2 KB) | 2001502 |
| 2026-10-18 | IN-003 | análisis y diseño | librería propia mínima y regla de textos | e4770f8 |
| 2026-10-18 | IN-002 | verificación | pnpm verificar OK; 9 hallazgos de la revisión corregidos | 63afa3a |
| 2026-10-18 | IN-002 | implementación | pnpm verificar OK (34 pruebas, 76,9 KB) | 4b3c27c |
| 2026-10-18 | IN-002 | análisis y diseño | diseño y ADR-0004 | 3f75c99 |
| 2026-10-18 | IN-001 | verificación | pnpm verificar OK; 4 hallazgos de la revisión corregidos | d8ece75 |
| 2026-10-18 | IN-001 | implementación | pnpm verificar OK (31 s, carga inicial 68,6 KB) | b31670c |
| 2026-10-18 | IN-001 | análisis y diseño | diseño escrito y autorrevisado | 4088155 |
| 2026-10-18 | F0-9 | informe | 182 KB sin peticiones externas | f529c42 |
| 2026-10-18 | F0-8 | informe | 29 ms realista; índice 4,4 MB comprimido | 7eacd39 |
| 2026-10-18 | F0-7 | informe | todo con CORS salvo arXiv y Maven (alternativas) | f42735a |
| 2026-10-18 | F0-6 | informe | 50.000 líneas en 0,43–0,53 s | 1b0d2b2 |
| 2026-10-18 | F0-5 | informe | 100 MB en 8,6 s (no cumple); límite de 50 MB y muestra | 7992596 |
| 2026-10-18 | F0-4 | informe | PDF sin red correcto; IN-085 se hace | fe9ad6a |
| 2026-10-18 | F0-3 | informe | tres salidas correctas; 15,5 MB gzip; carga diferida | 23b903b |
| 2026-10-18 | F0-2 | informe | 5.030/5.030 idénticos; importar por directorio central | f501d1a |
| 2026-10-18 | F0-1 | informe | parcial: medición en navegador pendiente | 589ad61 |

## Cómo retomar
- IN-020 hecha. Siguiente: IN-021 (diseño escrito en docs/features/IN-021-error.md, sin commit; corpus de 30 trazas en el scratchpad in021/trazas).
