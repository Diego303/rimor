# IN-013 · Detector de tipo y corpus

## Objetivo y catálogo

Acertar el tipo sin preguntar, y dudar bien cuando no se sabe. Catálogo: **CAP-04**. Depende de IN-012 (registro y `detectar` de cada lector).

## Estado de partida

- `REGISTRO.lectores` en el orden del Anexo D, cada uno con `detectar(entrada): number` (síncrona, 0..1). Aún está vacío: el primer lector real es Texto (IN-017).
- `Entrada` (`texto`, `archivos`, `mime`, `nombre`) del contrato.
- `TIPOS_ELEMENTO` de `@rimor/formato`.

## Diseño

### Módulos (ADR-0001: `captura/` → `src/captura/`, `fixtures/` igual)

```
src/captura/detector.ts      ← detectar(entrada, registro, opciones): atajos + arbitraje (puro)
src/captura/firmas.ts        ← firma de un binario por sus primeros bytes (PNG, JPEG, GIF, WebP, PDF, Parquet, ZIP)
src/captura/deteccion.ts     ← evaluar(corpus, registro): matriz de confusión, acierto por tipo y total, y su texto
src/captura/deteccion.test.ts← lee fixtures/deteccion/, exige el acierto mínimo e imprime la matriz si se pide
fixtures/deteccion/<tipo>/*.txt
scripts/deteccion.mjs        ← `pnpm deteccion`: lanza esa prueba con el informe activado
```

### Resultado

```ts
type Candidato = { tipo: TipoElemento; lector: string | null; confianza: number };
type Deteccion = Candidato & {
  via: 'atajo' | 'arbitraje' | 'por-defecto';
  alternativa?: Candidato;          // la duda: se ofrecen los dos (CAP-04)
  puntuaciones: Candidato[];        // todas, de mayor a menor (para depurar y para IN-049)
};
```

### Atajos previos (Anexo D, puestos 2 y 3)

Antes de puntuar, y solo si el lector de destino está registrado:

1. **Binarios** por tipo MIME (`entrada.mime` o el del primer archivo) o, si se pasan, por los primeros bytes (`cabecera`): imagen → `imagen`, PDF → `pdf`, cualquier otro binario (Parquet, ZIP, desconocido) → `archivo`. La firma manda sobre el MIME cuando no coinciden (un `.png` que en realidad es PDF).
2. **URL o DOI completos:** el texto, sin espacios alrededor, es una sola URL `http(s)://…` o un DOI (`10.NNNN/…`, con o sin `doi:` o `https://doi.org/`) → `enlace`.

El sobre de terminal (puesto 1) lo detecta su propio lector con la puntuación más alta; no necesita atajo.

### Arbitraje

- Cada lector registrado puntúa; si `detectar` lanza o devuelve algo que no es un número finito, cuenta 0, y se recorta a 0..1.
- Orden: de mayor a menor confianza; a igualdad, el orden del Anexo D (el del registro).
- **Gana** el primero si pasa de `umbral` (0,6). Si el segundo queda a menos de `margen` (0,15) del ganador, va como `alternativa` y la captura ofrecerá los dos.
- **Si nadie pasa de 0,6**, va a Texto (`via: 'por-defecto'`), con el lector `texto` si está registrado (si no, `lector: null` y la captura usará el genérico).
- `umbral` y `margen` son opciones: Ajustes (IN-038) dejará cambiar el margen de duda.

### Corpus y arnés

- `fixtures/deteccion/<tipo>/*.txt`: un ejemplo real por archivo, con el nombre de la carpeta como tipo esperado. Con esta IN entra el de **texto** (25 textos en prosa, en español e inglés, sin rasgos de otros tipos: ni marcas de tiempo, ni listas, ni código, ni URL sueltas, y de más de 280 letras para no confundirse con Idea). Cada lector añade su carpeta con al menos 25 ejemplos en su IN.
- `evaluar` devuelve la matriz `esperado × detectado`, el acierto por tipo y el total, y los fallos con su archivo. `formatear` la pinta como tabla de texto.
- La prueba exige: carpetas con nombre de tipo válido, al menos 25 ejemplos en cada una y un acierto total ≥ `ACIERTO_MINIMO` (0,85 al empezar; IN-040 lo sube a 0,9). Corre en `pnpm test` y, por tanto, en la integración continua.
- `pnpm deteccion` lanza solo esa prueba con `DETECCION_INFORME=1`, que imprime la matriz y el acierto por tipo. Un paso de la integración continua la ejecuta para que el informe quede en el registro.

## Tareas

- [x] Arbitraje: gana el mayor por encima de 0,6; si el segundo queda a menos de 0,15, se ofrecen los dos; si nadie pasa de 0,6, Texto.
- [x] Atajos previos (Anexo D): binarios por tipo MIME o firma; URL o DOI completos.
- [x] Corpus `fixtures/deteccion/<tipo>/*.txt` (texto ahora; cada lector, el suyo).
- [x] Script `pnpm deteccion` con la matriz de confusión y el acierto por tipo, en la integración continua.

## Pruebas previstas

- Arbitraje con lectores falsos: ganador claro, duda dentro del margen, nadie por encima del umbral, empate resuelto por el orden del Anexo D, `detectar` que lanza o devuelve `NaN`, valores fuera de 0..1, umbral y margen cambiados.
- Atajos: imagen por MIME, PDF por firma con un MIME engañoso, binario desconocido a `archivo`, URL y DOI (con y sin prefijo) frente a textos que solo contienen una URL; sin el lector de destino, no hay atajo.
- Firmas: cada formato y bytes cortos o vacíos.
- `evaluar` y `formatear` con un corpus pequeño inventado.
- La matriz del corpus real como prueba, con el registro real.

## Criterios de aceptación

- El arnés funciona con el lector de Texto solo (hoy, con el registro vacío: todo va a Texto por defecto) y no hay que cambiarlo al añadir lectores: lee las carpetas que haya y usa `REGISTRO`.
- `pnpm deteccion` imprime la matriz; `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| «Por encima de 0,6»: ¿estricto? | Sí: 0,6 justo no gana (y «nadie pasa de 0,6» va a Texto) |
| ¿La alternativa tiene que pasar el umbral? | No: basta con quedar a menos de 0,15 del ganador; así se duda entre 0,65 y 0,55 |
| La firma necesita bytes y `detectar` es síncrona | Quien captura (IN-014) lee los primeros bytes y los pasa como `cabecera` |
| Un lector que lanza en `detectar` | Cuenta 0; nunca rompe la captura |
| El corpus de texto podría chocar con lectores futuros (Idea, Markdown) | Textos largos y sin rasgos de otros tipos; si un lector nuevo los reclama, su IN ajusta su `detectar` |

## Autorrevisión

Cubre las cuatro tareas y la aceptación. El detector no conoce ningún lector concreto: los atajos se activan por tipo y solo si su lector existe, así que el arnés no cambia al entrar lectores. Deja a IN-014 leer la cabecera de los archivos y presentar la duda, y a IN-038 el ajuste del margen.

## Cambios durante la implementación

- La distancia entre ganador y segundo se redondea a 9 decimales antes de compararla con el margen: en coma flotante, 0,70 − 0,55 da 0,1499… y se dudaba donde no tocaba.
- Un archivo con MIME de texto (`text/*`, JSON, XML, YAML, CSV, JavaScript) no se trata como binario: decide el arbitraje.
- `pnpm deteccion` es `scripts/deteccion.mjs`, que lanza la prueba del corpus con `DETECCION_INFORME=1` (la app y sus lectores son TypeScript con alias del workspace: Vitest ya sabe cargarlos). La integración continua tiene un paso «Matriz de detección» tras `pnpm verificar`.
- Los porcentajes del informe van con coma decimal.

## Verificación

**`pnpm verificar`** (2026-10-18 16:35): tipos 0 errores; Biome, colores y textos, OK; Vitest 36 archivos y 457 pruebas, OK; construcción OK; carga inicial 165,0 KB. **`pnpm deteccion`**: texto 25/25, acierto total 100,0 %.

| Criterio | Evidencia |
|---|---|
| Arbitraje: > 0,6 gana, < 0,15 duda, si no Texto | Pruebas de `detector.test.ts` (umbral estricto, distancia redondeada, empate por el orden del Anexo D, lectores que lanzan o devuelven NaN) |
| Atajos: binarios por MIME o firma; URL o DOI completos | Pruebas de atajos y de firmas |
| Corpus `fixtures/deteccion/<tipo>/` | 25 textos; la prueba exige 25 por carpeta y una carpeta por cada lector registrado |
| `pnpm deteccion` con matriz y acierto por tipo, en la integración continua | Salida arriba; paso «Matriz de detección» en `ci.yml` |
| El arnés funciona con Texto solo y no cambia al añadir lectores | Lee las carpetas que haya (texto pegado o archivos) y usa `REGISTRO` |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Una imagen o un PDF sin su lector iban a Texto**: un binario nunca entra al arbitraje; va a su lector, al genérico de archivo si no lo hay (como en v0.1) o, sin ninguno, sin lector.
2. **Archivos de texto con MIME raro (`.ts` como `video/mp2t`, `.sh`, `.toml`) se trataban como binarios**: decide el contenido (`pareceTexto`: UTF-8 válido y sin bytes nulos en los primeros 1.024 bytes) y, sin cabecera, el MIME o la extensión.
3. **Un binario sin MIME (SQLite, Parquet) no iba a `archivo`**, y un MIME vacío no caía al del archivo: corregidos.
4. **El arnés solo medía texto pegado**: un ejemplo con otra extensión que `.txt` entra como archivo soltado, con `entradaDeArchivo` (la misma que usará la captura), así que los lectores de archivo pueden traer su corpus sin cambiar el arnés.
5. **Nada obligaba a un lector nuevo a traer su corpus**: la prueba exige una carpeta por cada tipo con lector registrado.

