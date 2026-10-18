# IN-004 · Formato de archivos (`paquetes/formato`)

## Objetivo y catálogo

Que todo lo que se guarda tenga un esquema, se lea y se escriba sin perder nada, y se pueda migrar. Catálogo: **DAT-01** (formato), plan §13.3, §13.4, §13.8 y Anexos A y B. Depende de IN-001.

## Estado de partida

- `paquetes/formato` existe como esqueleto (IN-001): `ESQUEMA_ACTUAL = 1`, `tsconfig` con `lib: ES2023` y sin tipos de DOM ni de Node, así que el compilador impide depender del navegador.
- Los nombres de tipo de `src/ui/iconos/tipos.ts` (IN-002) son los del plan; aquí se definen como `TipoElemento`.

## Diseño

### Dependencias

- **Valibot** (esquemas pequeños, plan §14.1) y **`yaml`** (lectura y escritura fieles, con `Document` para conservar orden y comentarios). Ninguna depende de DOM ni de Node.
- **ULID y SHA-256 propios**, en TS puro y síncronos: funcionan igual en Node, en el navegador y en un Worker, sin `crypto.subtle` (asíncrono y ausente de `lib: ES2023`). El ULID recibe el reloj y el azar inyectados para probarlo.

### Módulos

```
paquetes/formato/src/
├── resultado.ts      ← Resultado<T, ErrorRimor>, ok(), fallo()
├── tipos.ts          ← TipoElemento, prefijos (tabla del plan §13.3, con HIL), lenguaje del bloque original
├── ulid.ts           ← crearUlid(reloj, azar) monotónico; esUlid()
├── sha256.ts         ← sha256Hex(bytes | texto)
├── refs.ts           ← asignarRef(tipo, existentes), analizarRef()
├── nombres.ts        ← slug(titulo), nombreArchivo(ref, titulo), rutaElemento(ref, titulo, creado), rutaAdjunto(hash, ext)
├── original.ts       ← normalizarOriginal(), hashOriginal(), cercaPara(texto)
├── esquemas.ts       ← esquemas Valibot y tipos derivados
├── frontmatter.ts    ← separar(texto), unir(); leerYaml/escribirYaml conservando orden, comentarios y claves desconocidas
├── elemento.ts       ← leerElemento(texto), escribirElemento(el, previo?)
├── migraciones.ts    ← migrar(espacio, desde, hasta)
└── index.ts
```

### Modelo

```ts
type TipoElemento = 'texto' | 'idea' | 'enlace' | 'log' | 'error' | 'mediciones' | 'prompt' | 'markdown'
  | 'codigo' | 'comando' | 'datos' | 'json' | 'http' | 'imagen' | 'pdf' | 'formula' | 'diagrama' | 'calculo'
  | 'archivo';                                         // lector genérico de archivo (IN-017)
type TipoEntidad = 'comparacion' | 'investigacion' | 'documento' | 'hilo';
type Ref = `${string}-${string}`;                      // LOG-0042, DOC-MD-0004, HIL-0007
type IsoFecha = string;                                // ISO 8601 con zona: 2026-10-16T18:44:03+02:00

interface FrontmatterComun {                           // Anexo B; claves desconocidas se conservan
  id: Ulid; ref: Ref; tipo: TipoElemento; titulo: string;
  creado: IsoFecha; modificado: IsoFecha;
  origen: 'pegado' | 'soltado' | 'compartido' | 'terminal' | 'importado';
  estado?: string; colecciones?: string[]; investigaciones?: Ref[]; etiquetas?: string[];
  sesion?: string; hilo?: Ref; hash: `sha256:${string}`; ocultados: number;
  lector: { nombre: string; version: number; resumen: Record<string, unknown> };
  fijado?: boolean; alias?: Ref[]; version?: number;
  adjunto?: { hash: string; ruta: string; nombre?: string; mime?: string; tam: number };
}

interface Elemento {
  frontmatter: FrontmatterComun & Record<string, unknown>;
  notas: string;                // cuerpo del usuario (Markdown), puede estar vacío
  original: string | null;      // null si el original va como adjunto (frontmatter.adjunto)
}
```

Más esquemas para `Comparacion`, `Investigacion` (Anexo B), `Documento`, `Hilo`, `Manifest` (Anexo A), `Colecciones` (`colecciones.json`), `Vistas` (`vistas.json`) y `Ajustes` (`.rimor/ajustes.json`), todos con `esquema: 1` donde son archivos JSON y con claves desconocidas permitidas.

### Formato del `.md`

```
---
<frontmatter YAML>
---

<notas del usuario, opcionales>

```<lenguaje del tipo>
<original, intacto>
```
```

- **El original es el último bloque de código del archivo**, salvo que el frontmatter tenga `adjunto` (entonces no hay bloque). Así unas notas que acaban en un bloque de código no se confunden con el original.
- **La cerca se alarga** si el original contiene acentos graves seguidos: siempre una más que la racha más larga (mínimo tres).
- **Más de 2 MB** (D8): el original va a `adjuntos/xx/<hash>.<ext>` y el frontmatter guarda `adjunto`.
- **Hash:** SHA-256 del original normalizado (finales de línea `\n` y sin espacios al final de cada línea ni del texto), con prefijo `sha256:`.

### Frontmatter fiel

`escribirElemento(el, previo?)`:

- sin `previo`, genera el YAML en el **orden canónico** del Anexo B (`id, ref, tipo, titulo, creado, modificado, origen, estado, …, lector`, y después las claves propias del tipo y las desconocidas);
- con `previo` (el texto anterior del archivo), **edita su documento YAML**: cambia solo las claves que cambiaron, borra las que ya no están y añade las nuevas al final, conservando orden, comentarios y estilo (`[gateway]` en línea).

### Identificadores y nombres

- `crearUlid()`: 48 bits de tiempo + 80 de azar en Crockford base 32; si dos se piden en el mismo milisegundo, el segundo incrementa el azar (monotónico).
- `asignarRef(tipo, existentes)`: prefijo + siguiente número tras el mayor existente de ese prefijo, con 4 cifras (`LOG-0043`); `DOC` y `DOC-MD` no se mezclan.
- `slug(titulo)`: minúsculas, sin tildes (NFD), solo `[a-z0-9]` y guiones, sin emojis, cortado a 60 caracteres sin partir palabra cuando se puede; vacío → `sin-titulo`.
- `nombreArchivo(ref, titulo)` → `REF--slug.md`; `rutaElemento(ref, titulo, creado)` → `elementos/AAAA/MM/REF--slug.md`, con año y mes **del propio texto ISO** (su zona), no de UTC.

### Migraciones

```ts
interface EspacioMigrable { manifest: Manifest; archivos: Map<string, string> }
type Migracion = (e: EspacioMigrable) => EspacioMigrable;   // pura, N → N+1
function migrar(e: EspacioMigrable, desde: number, hasta: number): Resultado<EspacioMigrable>;
```

`MIGRACIONES` es una lista indexada por versión de origen; hoy solo hay la identidad para el esquema 1. Pedir una versión futura o un salto hacia atrás devuelve un error (`formato.esquemaDesconocido`).

## Tareas

- [ ] Esquemas Valibot de todo el modelo con versión de esquema 1.
- [ ] Frontmatter con `yaml` conservando orden, comentarios y claves desconocidas; el cuerpo, intacto.
- [ ] `ulid()` monotónico, `asignarRef()` y tabla de prefijos (con `HIL`).
- [ ] Nombre de archivo y ruta por fecha.
- [ ] Original en bloque de código o como adjunto por hash a partir de 2 MB.
- [ ] Hash SHA-256 del original normalizado.
- [ ] Marco de migraciones.

## Pruebas previstas

- Propiedad: `leerElemento(escribirElemento(x)) ≡ x` con elementos generados por fast-check (títulos con tildes y emojis, notas con bloques de código, originales con acentos graves, adjuntos).
- Los ejemplos del Anexo B (log, prompt, investigación, documento) validan con sus esquemas.
- Un frontmatter con claves desconocidas y comentarios se conserva al reescribir.
- Nombres de archivo con tildes, emojis, títulos vacíos y muy largos.
- `sha256Hex` contra los vectores de prueba de FIPS 180-2; `hashOriginal` iguala `\r\n` y `\n`.
- ULID: orden monotónico en el mismo milisegundo; formato válido.
- `asignarRef` con huecos y con `DOC` frente a `DOC-MD`.
- `migrar` con la identidad y con una versión desconocida.

## Criterios de aceptación

- El paquete se usa desde Node (pruebas) y desde el navegador sin cambios; cero dependencias de DOM (lo garantiza su `tsconfig`).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Distinguir notas y original | El original es el último bloque, salvo `adjunto` en el frontmatter |
| El lector genérico de archivo no tiene prefijo en el plan | Tipo `archivo`, prefijo `ARC` (se anota como desviación) |
| `crypto.subtle` es asíncrono y no está en `lib: ES2023` | SHA-256 y ULID propios, síncronos y probados con vectores |
| Fechas: ¿mes de la ruta en UTC o local? | El del texto ISO, que lleva la zona del usuario |

## Autorrevisión

Cubre las tareas y pruebas de la ficha. Las decisiones nuevas (tipo `archivo`, último bloque como original) no contradicen el plan y se registran.

## Cambios durante la implementación

- **Sin escalares de bloque en el YAML** (`blockQuote: false`): la propiedad de ida y vuelta encontró que `yaml` pierde el espacio inicial de un texto como `" \n"` cuando lo escribe como bloque `|+`. Con comillas dobles todo texto vuelve idéntico. Consecuencia: si alguien escribe a mano un bloque `|` en el frontmatter, al reescribirlo Rimor lo pasa a comillas (el valor no cambia).
- Listas y mapas en línea sin relleno (`[gateway]`, `{lineas: 11}`), como el `colecciones: [gateway]` del Anexo B.
- `MIGRACIONES` es una tabla vacía: con un solo esquema, migrar de 1 a 1 no aplica ningún paso (la identidad) y no hace falta una función que no haga nada.
- `ESQUEMA_ACTUAL` vive en `version.ts` para que `migraciones.ts` no importe el índice.

## Verificación

**`pnpm verificar`** (2026-10-18 04:00): `astro check` y tipos del paquete, 0 errores; Biome, colores y textos, OK; Vitest 11 archivos y 89 pruebas (26 del paquete), OK; construcción, OK; carga inicial 76,2 KB.

| Criterio | Evidencia |
|---|---|
| Esquemas Valibot de todo el modelo, versión de esquema 1 | `esquemas.ts`: elemento, comparación, hilo, investigación, documento, manifest, colecciones, vistas y ajustes, con claves desconocidas permitidas |
| `leer(escribir(x)) ≡ x` (propiedad) | Dos propiedades de fast-check (300 y 400 casos): textos con acentos graves, `\r`, emojis, cadenas que confunden a YAML, adjuntos y reescritura sobre el archivo previo |
| Los ejemplos del Anexo B validan | Log, prompt (incompleto: se completan `modificado`, `origen`, `hash` y `ocultados`), investigación, documento (sin `creado`), comparación y manifest |
| Claves desconocidas y comentarios se conservan | Pruebas de reescritura: comentario del título, de la lista y del mapa `lector`, estilo en bloque intacto, clave futura conservada |
| Nombres con tildes, emojis y títulos vacíos | `slug` y rutas, con el año y mes del texto ISO |
| ULID monotónico, refs, prefijos con `HIL` | Pruebas de `crearGeneradorUlid` (mismo milisegundo y reloj que retrocede) y `asignarRef` |
| Original en el `.md` o como adjunto (> 2 MB) | `cabeEnMd`, `adjunto` en el frontmatter y prueba con notas que acaban en código |
| Hash SHA-256 del original normalizado | Vectores FIPS 180-2; `\r\n` y `\n` dan el mismo hash; surrogates sueltos como U+FFFD |
| Migraciones | `migrar` de 1 a 1 y rechazo de esquemas futuros o no válidos |
| Cero dependencias de DOM; se usa desde Node | `tsconfig` del paquete con `lib: ES2023` y sin tipos; las pruebas corren en Node |

### Revisión independiente

Hallazgos, todos corregidos con prueba:

1. El prompt del Anexo B (sin `modificado`, `origen`, `hash` ni `ocultados`) y el documento (sin `creado`) no validaban: esos campos son opcionales al leer y `leerElemento` los completa (`completarFrontmatter`); el tipo que usa la app (`FrontmatterComun`) los tiene siempre.
2. Reescribir con `previo` sustituía nodos enteros y perdía sus comentarios: ahora se fusiona (un escalar cambia su valor y conserva comentario y estilo; un mapa, clave a clave).
3. El estilo compacto se aplicaba a todo el documento previo: ahora solo a los nodos nuevos.
4. Un surrogate suelto se codificaba distinto que con `TextEncoder`, y el hash no coincidiría con los bytes guardados: ahora es U+FFFD.
5. Se aceptaban fechas imposibles (`2026-13-45T99:99:99Z`) y sin segundos, que rompían `rutaElemento` y `rutaHistorial`: la fecha debe existir y llevar segundos, y `rutaHistorial` ya no depende de la forma exacta.
