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
- Paquete de estadística de mediciones: mediana, media, desviación, coeficiente de variación, percentiles, intervalo de confianza de la mediana, Mann-Whitney con corrección por empates y de continuidad, atípicos, avisos de método y veredicto, verificados contra NumPy y SciPy (IN-011).
- Animaciones del símbolo «Señal» para las esperas y los momentos clave (arranque, primer uso, cargando, analizando, indexando, Rimor contesta, exportando, copia al día, guardado, error y comparando), con umbral de 400 ms, bucles que paran a los 20 s y movimiento reducido respetado (IN-090).
- Espacio de trabajo: al entrar se abre (o se crea) el espacio «Trabajo» guardado en el navegador, con pantalla de arranque si tarda; Inicio ofrece proteger los datos con el almacenamiento persistente, y la carcasa avisa si es una ventana privada, si el navegador no deja guardar o si Rimor está abierto en otra pestaña. Se cuentan los cambios desde la última copia, y Datos y copias enseña cuánto ocupa el espacio, si está protegido y la última copia (IN-007).
- Contrato y registro de lectores: cada tipo de captura tendrá su lector con detección, lectura, derivados calculados en segundo plano (con caché, prioridad para lo que se está viendo y cancelación) y su vista cargada bajo demanda; mientras calcula, se enseña el resumen y la animación «analizando». Incluye una plantilla para crear lectores nuevos (IN-012).
- Detección del tipo de lo que se pega: atajos para imágenes, PDF y otros binarios (por su contenido, no solo por su tipo MIME), URL y DOI, y arbitraje entre lectores que duda entre dos cuando están cerca o va a Texto si nadie convence; `pnpm deteccion` imprime la matriz de acierto sobre el corpus de ejemplos (IN-013).
- Captura: pegar fuera de un campo de texto, en cualquier pantalla, lleva lo pegado al compositor; soltar archivos sobre la app los guarda uno a uno con su lector, con «Guardado. Deshacer» durante 10 s. Los secretos se ocultan antes de nada, un duplicado exacto no se crea (se avisa con su ref) y los archivos de más de 50 MB se rechazan explicando por qué (IN-014).
### Cambiado
### Corregido
