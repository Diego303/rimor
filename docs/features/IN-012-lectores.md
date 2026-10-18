# IN-012 · Contrato y registro de lectores

## Objetivo y catálogo

Que añadir un lector sea rellenar una interfaz, sin tocar el resto de la app. Catálogo: **VIS-01** (la vista de cada lector). Depende de IN-004 (formato del elemento) e IN-006 (caché de derivados); usa también IN-090 (`<Senal estado="analizando">`) e IN-003 (textos).

## Estado de partida

- `@rimor/formato`: `Elemento` (`frontmatter`, `notas`, `original`), `FrontmatterComun` con `lector: { nombre, version, resumen }`, `TipoElemento` y `PREFIJOS`.
- `CacheEspacio`: `derivado(id, lector, version, hash)` y `guardarDerivado(…)`, que ya borra los derivados de otra versión u otro original del mismo lector.
- `ProveedorEspacio` (IN-007) da el repositorio, la caché y el modo de la pestaña.
- No hay aún ningún lector: el primero real es Texto (IN-017).

## Diseño

### Módulos (ADR-0001: `app/src/lectores/` → `src/lectores/`)

```
src/lectores/contrato.ts       ← Entrada, Borrador, Lector<D>, Cifra, Accion, Incrustacion, Contexto (TS puro)
src/lectores/textos.ts         ← catálogos propios de cada lector (es/en) y su `t` tipado
src/lectores/registro.ts       ← LECTORES en el orden del Anexo D y crearRegistro (puro, también en el Worker)
src/lectores/derivados.ts      ← ColaDerivados: prioridad, cancelación, deduplicado y caché (puro)
src/lectores/ejecutor.ts       ← derivar en el Worker (Comlink) o, si no hay Worker, en el hilo principal
src/lectores/vistas.ts         ← Vista.tsx y Tarjeta.tsx de cada carpeta con import.meta.glob + React.lazy
src/lectores/Lectores.tsx      ← ProveedorLectores, useDerivado, VistaElemento y TarjetaElemento
src/lectores/_plantilla/       ← lector de ejemplo completo + README (no registrado)
src/respuestas/tipos.ts        ← Fragmento, Accion y Respuesta (modelo de IN-016)
src/workers/derivados.worker.ts← expone derivar(nombre, elemento) con el registro
```

### El contrato (plan §14.4, separado en núcleo y vistas)

El plan pone `Vista` y `Tarjeta` dentro del objeto `Lector`. Aquí el **núcleo** (`Lector<D>`, TS puro) vive en `<carpeta>/lector.ts` y las vistas en `<carpeta>/Vista.tsx` y `<carpeta>/Tarjeta.tsx` (export por defecto), que `vistas.ts` encuentra por convención con `import.meta.glob`. Así el Worker de derivados importa el registro sin arrastrar React, y las vistas se cargan diferidas sin que nadie más las importe.

```ts
interface Lector<D = unknown> {
  nombre: string;                    // = nombre de su carpeta y `frontmatter.lector.nombre`
  tipo: TipoElemento;                // el prefijo de la ref sale de PREFIJOS[tipo] (una sola fuente)
  version: number;                   // si cambia, se recalculan los derivados
  textos: TextosLector;              // { es: { analizando, … }, en?: {…} }: sus textos, en su carpeta
  detectar(e: Entrada): number;      // 0..1, barata y síncrona
  leer(e: Entrada): Promise<Borrador>;
  derivar(el: Elemento): Promise<D>; // en el Worker; D se copia con structured clone
  resumen(d: D): ResumenLector;      // lo pequeño que va al frontmatter
  resumenLegible?(r: ResumenLector, t): string; // una línea para enseñar mientras se deriva
  respuesta(el, d, ctx: Contexto): Respuesta;   // la frase de Rimor (CAP-14, la completa IN-016)
  acciones?: AccionLector<D>[];
  cifras?: Record<string, (d: D) => Cifra>;
  incrustaciones?: Record<string, Incrustacion<D>>;  // preparadas para v0.3
  textoIndexable?(d: D): string;
}
```

`Respuesta`, `Fragmento` y `Accion` siguen el modelo de IN-016, salvo que la `etiqueta` de una acción llega ya traducida (el lector la compone con sus propios textos, que no están en `es.json`).

`Contexto` lleva el idioma, para que el lector componga la respuesta con sus textos, y frontmatters (no elementos completos), que es lo que el repositorio tiene en memoria: `{ idioma, mismaHuella, versiones, notas, colecciones, respondeA? }`. Lo rellena IN-016.

### Textos de cada lector

Las claves de la app salen de `es.json`, pero un lector no debe tocar ese archivo. Cada lector define `textos = definirTextos({ es: {...}, en: {...} })` en su carpeta, con claves tipadas y la misma interpolación, plurales y formato de números que `traducir` (se extrae un `traducirEn(catalogos, idioma, clave, vars)` común). `es.analizando` es obligatorio: es lo que se enseña junto a `<Senal estado="analizando">`.

### Registro

`registro.ts` importa cada `lector.ts` y los pone en `LECTORES` en el orden del Anexo D (`ORDEN_DETECCION`, con sus 17 nombres). `crearRegistro(lectores)` comprueba nombres únicos, versiones enteras ≥ 1 y nombres válidos de carpeta, y da `lectores`, `porNombre(n)` y `paraElemento(el)` (por `frontmatter.lector.nombre`; si ese lector ya no existe, el del mismo tipo). Una prueba exige que `LECTORES` respete `ORDEN_DETECCION`. Añadir un lector es: copiar `_plantilla/`, rellenarla y añadir una línea a `registro.ts`.

### Derivados: `ColaDerivados`

`pedir(el, { prioridad: 'visible' | 'fondo', senal })`:

1. Clave `id · lector · versión vigente del registro · hash`. Si está en la caché, se devuelve sin trabajar.
2. Si ya hay un trabajo con esa clave (en cola o en marcha), se comparte; una petición visible sube el trabajo a visible.
3. La cola atiende primero lo visible y, dentro de cada prioridad, por orden de llegada; de uno en uno (el Worker es uno).
4. **Cancelación:** si todas las peticiones de un trabajo en cola se cancelan, sale de la cola. Si ya estaba en marcha, quien canceló recibe `AbortError` y el resultado se guarda igualmente en la caché.
5. Al terminar: `guardarDerivado` y `alDerivar(el, lector, datos)`. Los errores no se guardan.

Como la versión forma parte de la clave, subir `version` de un lector hace que todo lo suyo se recalcule al pedirse, y `guardarDerivado` borra lo de la versión vieja.

`ProveedorLectores` crea la cola con la caché del espacio y el ejecutor del Worker. En `alDerivar`, si la pestaña escribe y el frontmatter tiene otra versión del lector u otro resumen, se guarda el elemento con el resumen nuevo (sin tocar `modificado`).

### Contenedores

- **`VistaElemento({ el })`** pide los derivados con prioridad visible (y los cancela al desmontarse). Mientras tanto pinta `resumenLegible` del frontmatter y, pasados 400 ms (`useEsperaVisible`), `<Senal estado="analizando">` con el texto `analizando` del lector. Con los datos, la `Vista` del lector en diferido (`Suspense` con el mismo resumen de reserva). Sin lector o sin vista: el original en un bloque `pre`. Si `derivar` falla: `ErrorTarjeta` y el original.
- **`TarjetaElemento({ el })`**: tarjeta (`.card`) con el icono del tipo, el título y la ref; dentro, la `Tarjeta` del lector en diferido o, si no tiene, su `resumenLegible`.

### Plantilla `src/lectores/_plantilla/`

`lector.ts` (núcleo comentado, tipo `texto`, deriva el número de líneas y palabras), `textos.ts`, `Vista.tsx`, `Tarjeta.tsx`, `fixtures/ejemplo.txt`, `plantilla.test.ts` y `README.md` con los pasos: copiar a `src/lectores/<nombre>/`, cambiar `nombre`, `tipo` y textos, rellenar, añadir a `registro.ts` en su sitio del Anexo D y añadir fixtures de detección (IN-013). Su carpeta empieza por `_`: no se registra y `vistas.ts` la acepta igual (las vistas se buscan por el nombre del lector).

## Tareas

- [ ] Interfaz `Lector<D>` del plan (§14.4), con `respuesta` (CAP-14), `cifras`, `incrustaciones` (preparadas para v0.3) y `textoIndexable`.
- [ ] Registro ordenado según el Anexo D del plan.
- [ ] Worker de derivados: cola con prioridad (lo visible primero), cancelación y caché (IN-006).
- [ ] `VistaElemento` y `TarjetaElemento` con la vista del lector diferida (`React.lazy`); mientras `derivar` no termina, resumen del frontmatter y `<Senal estado="analizando">`.
- [ ] Plantilla de lector (`lectores/_plantilla/`) con todos los archivos y un README.

## Pruebas previstas

- `crearRegistro`: nombres duplicados, versión no válida, búsqueda por nombre y caída al tipo; `LECTORES` en el orden del Anexo D.
- `ColaDerivados` (con un ejecutor falso y `fake-indexeddb`): caché, deduplicado, lo visible adelanta a lo de fondo, cancelación en cola y en marcha, errores sin guardar, **cambio de versión que recalcula** y borra la vieja.
- `textos`: interpolación, plurales y caída al español.
- **Lector falso de punta a punta** (happy-dom): se registra, `leer` da el borrador, se guarda en el repositorio, `VistaElemento` enseña la Senal «analizando» con su texto y después su `Vista` con los datos derivados; `TarjetaElemento` enseña su tarjeta. La plantilla, registrada en una prueba tal cual, funciona igual.

## Criterios de aceptación

- La plantilla se copia, se rellena y aparece en la app sin tocar código fuera de su carpeta y de `registro.ts` (prueba con la plantilla registrada y sus vistas encontradas por convención).
- `pnpm verificar` en verde; la carga inicial no crece por las vistas (van en trozos aparte).

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `Vista` dentro del objeto lector arrastra React al Worker | Núcleo y vistas separados por convención de carpeta |
| Textos de un lector fuera de `es.json` | Catálogo propio por lector con el mismo motor de `traducir` |
| Un derivado no clonable rompe el Worker | Contrato: `D` debe poder copiarse con structured clone; el error llega como fallo de `derivar` |
| Trabajo largo en marcha que ya nadie quiere | Se deja terminar (Comlink no interrumpe) y se guarda en la caché |
| Sin Worker (pruebas, navegadores raros) | Ejecutor en el hilo principal con la misma interfaz |

## Autorrevisión

Cubre las cinco tareas y la aceptación de la ficha. Las desviaciones del plan (núcleo y vistas separados, prefijo desde `PREFIJOS`, contexto con frontmatters, textos por lector) quedan explicadas arriba y se anotan en «Desviaciones del plan» del seguimiento. Deja a IN-013 el detector (usa `lectores` y `detectar`), a IN-014 la captura (usa `leer` y la cola con prioridad de fondo) y a IN-016 el contexto y el pintado de respuestas.
