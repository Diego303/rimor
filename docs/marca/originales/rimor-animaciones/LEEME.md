# Rimor · animaciones del icono Señal

20 animaciones en SVG animado (SMIL), cada una en versión **claro** (para fondo #F6F5F1) y **oscuro** (para fondo #1A1A19). Fondo transparente.
Abre `index.html` para verlas todas.

## Uso
- En web: `<img src="svg/04-cargando-claro.svg" alt="Cargando">` o en línea (inline) para poder cambiar colores con CSS.
- Se repiten en bucle. Para una sola reproducción, cambia `repeatCount="indefinite"` por `repeatCount="1"` y añade `fill="freeze"`.
- Con `prefers-reduced-motion: reduce`, sustituye la animación por el icono fijo (`rimor-icono/svg/rimor-simbolo.svg`).
- Curva: cubic-bezier(.4, 0, .2, 1). Sin rebotes ni escalados bruscos (guía §11).
- «Abrir la web» y «Primer uso» usan Archivo 700 y Roboto Mono: si la fuente no está cargada, caen a Helvetica/Arial y monospace.

## Lista
- **01 Abrir la web** (`01-abrir-la-web-*.svg`): Pantalla de arranque con el nombre. 3,6 s.
- **02 Primer uso** (`02-primer-uso-*.svg`): Bienvenida con la frase guía. 5,5 s.
- **03 Icono de arranque** (`03-icono-arranque-*.svg`): Favicon animado o PWA mientras carga. 3 s.
- **04 Cargando** (`04-cargando-*.svg`): Carga genérica de la app y de pantallas. 1,4 s.
- **05 Esperando** (`05-esperando-*.svg`): Esperas cortas: abrir un elemento, una consulta. 1,8 s.
- **06 Indexando** (`06-indexando-*.svg`): Reconstrucción del índice de búsqueda. 2,4 s.
- **07 Buscando** (`07-buscando-*.svg`): Mientras se filtran resultados. 1,3 s.
- **08 Guardando dato** (`08-guardando-dato-*.svg`): La captura se escribe en el espacio. 2,2 s.
- **09 Guardado** (`09-guardado-*.svg`): Confirmación tras guardar o exportar. 1,8 s.
- **10 Evidencia vinculada** (`10-evidencia-vinculada-*.svg`): Un elemento entra en una investigación. 2,6 s.
- **11 Analizando** (`11-analizando-*.svg`): Un lector calcula derivados. 1,6 s.
- **12 Detectando** (`12-detectando-*.svg`): Huella de error o veredicto. 2,6 s.
- **13 Leyendo datos** (`13-leyendo-datos-*.svg`): CSV, JSON o DuckDB. 0,8 s.
- **14 Copia al día** (`14-copia-al-dia-*.svg`): Copia de seguridad completada. 3 s.
- **15 Error** (`15-error-*.svg`): No se pudo leer o importar. 3,2 s.
- **16 Sin conexión** (`16-sin-conexion-*.svg`): Sin red para enriquecer. 2,4 s.
- **17 Comparando** (`17-comparando-*.svg`): Dos series se alinean y sale el veredicto. 3 s.
- **18 Procesando** (`18-procesando-*.svg`): Pandoc, OCR, tareas largas. 2,2 s.
- **19 Exportando** (`19-exportando-*.svg`): Generación del ZIP o del documento. 2,4 s.
- **20 Rimor contesta** (`20-rimor-contesta-*.svg`): Se compone la respuesta en el feed. 2,4 s.

## Colores
| | Claro | Oscuro |
|---|---|---|
| Tinta (onda) | #191919 | #EDEBE6 |
| Señal (punto) | #EE4F1F | #FF6A3D |
| Error | #B32F27 | #FF7A6B |
