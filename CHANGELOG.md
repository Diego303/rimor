# Registro de cambios

Todos los cambios visibles de Rimor. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]
### Añadido
- Esqueleto del proyecto: Astro con una isla React, paquetes `@rimor/formato` y `@rimor/estadistica`, Vitest, Biome, comprobación de colores fuera de los tokens, presupuesto de carga inicial e integración continua con despliegue en GitHub Pages (IN-001).
- Tema Instrumento claro y oscuro con selector (sistema, claro u oscuro), fuentes Archivo y Roboto Mono empaquetadas, iconos y componentes base (botones, segmentados, chips, tarjetas, plegables, tablas, veredicto, estados y avisos) y página de muestras en desarrollo (IN-002).
- Textos en español e inglés con cambio de idioma en caliente, y formatos de números, cifras con unidad, p-valores, duraciones, tamaños, fechas relativas y ordinales al estilo de la guía (IN-003).
- Formato de archivos del espacio en `@rimor/formato`: esquemas de elementos, comparaciones, hilos, investigaciones, documentos, manifest, colecciones, vistas y ajustes; frontmatter que conserva orden, comentarios y claves desconocidas; ULID, refs, nombres de archivo, hash SHA-256 del original y migraciones (IN-004).
- Símbolo «Señal» y logotipo como componentes que siguen al tema, favicon que cambia con el modo claro u oscuro, iconos de app y `theme-color`; `pnpm marca` optimiza los SVG de marca y genera el logotipo en contornos (IN-089).
- Almacén de archivos del espacio en OPFS (en un Worker) y en memoria, con escritura atómica, cola de escrituras por archivo, repositorio de elementos con papelera y adjuntos sin duplicados, y coordinación para que solo una pestaña escriba (IN-005).
- Caché del espacio en IndexedDB (frontmatter, derivados de los lectores e índice de búsqueda comprimido) que se pone al día con los archivos al abrir, leyendo solo lo nuevo o cambiado (IN-006).
- Carcasa de la app: raíl con Inicio, Buscar, colecciones, Ajustes y el pie del espacio con su piloto de copia; rutas por hash para GitHub Pages; barra inferior por debajo de 720 px; atajos de teclado con ayuda en «?»; avisos efímeros y límite de errores por pantalla (IN-008).
- Todo lo pegado se pinta saneado (sin scripts, estilos, formularios ni protocolos peligrosos; las imágenes remotas no se cargan) y la web lleva una política de seguridad de contenido estricta con los hashes de sus scripts (IN-009).
- Ocultación de secretos antes de guardar: claves de AWS, GCP y Azure, tokens de GitHub, GitLab y Slack, claves de OpenAI, Anthropic y OpenRouter, JWT, claves privadas, cabeceras `Authorization` y contraseñas en URL y cadenas de conexión, sustituidos por `‹oculto:tipo›` (IN-010).
### Cambiado
### Corregido
