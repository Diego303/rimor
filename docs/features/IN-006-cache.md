# IN-006 · Caché de derivados e índice

## Objetivo y catálogo

Abrir un espacio grande al instante sin releer ni recalcular todo. Catálogo: **DAT-02**. Depende de IN-004.

## Estado de partida

- IN-004: `leerElemento` y el frontmatter completo de cada elemento.
- IN-005: `Almacen` (memoria y OPFS) con `listar` que da `tam` y `modificado`; `Repositorio` arma hoy su índice leyendo todos los archivos.
- F0-8: el índice de MiniSearch se guarda comprimido (≈ 4–5 MB para 10.000 elementos).

## Diseño

### Almacenes de IndexedDB (con `idb`)

Una base por espacio: `rimor-cache-<espacio>`.

| Almacén | Clave | Valor |
|---|---|---|
| `frontmatter` | `id` | `{ id, ref, ruta, tam, modificado, frontmatter }` (lo que hace falta para pintar listas sin abrir archivos) |
| `derivados` | `[id, lector, version, hash]` | lo que devolvió `derivar` (IN-012) |
| `indice` | `'busqueda'` | índice de MiniSearch serializado y comprimido (IN-032) |
| `meta` | `'version'` | versión de la caché |

`VERSION_CACHE = 1`. Si la base trae otra versión, se vacía entera.

### Módulos

```
src/almacen/cache/cache.ts         ← CacheEspacio: abrir, leer y escribir cada almacén, vaciar
src/almacen/cache/reconciliar.ts   ← reconciliar(almacen, cache, alProgreso): pone la caché al día con los archivos
src/almacen/cache/comprimir.ts     ← gzip con CompressionStream (para el índice)
```

```ts
interface EntradaFrontmatter { id: string; ref: string; ruta: string; tam: number; modificado: number; frontmatter: FrontmatterComun }
class CacheEspacio {
  static abrir(espacio: string, fabrica?: IDBFactory): Promise<CacheEspacio>;
  frontmatters(): Promise<EntradaFrontmatter[]>;
  guardarFrontmatters(entradas: EntradaFrontmatter[]): Promise<void>;   // en una transacción
  borrarElementos(ids: string[]): Promise<void>;                        // frontmatter y derivados
  derivado<D>(id: string, lector: string, version: number, hash: string): Promise<D | undefined>;
  guardarDerivado(id: string, lector: string, version: number, hash: string, datos: unknown): Promise<void>; // borra los demás del id
  indice(): Promise<Uint8Array | undefined>;
  guardarIndice(datos: Uint8Array): Promise<void>;
  vaciar(): Promise<void>;
  cerrar(): void;
}
```

### Reconciliar al abrir

`reconciliar(almacen, cache, alProgreso?)`:

1. Lista `elementos/` y `papelera/elementos/` (solo nombres, tamaños y fechas: barato).
2. Compara con la caché por **ruta, tamaño y fecha de modificación**:
   - igual: no se toca;
   - nuevo o cambiado: se lee, se analiza y se guarda su frontmatter;
   - falta en los archivos: se borra de la caché con sus derivados.
3. Avisa del progreso (`{ hechos, total }`) cada 100 archivos leídos.
4. Devuelve `{ nuevos, cambiados, borrados, fallidos, total }`.

Una caché vacía (o borrada) es el caso extremo: todo es «nuevo» y se reconstruye entera. La interfaz de esa espera («Indexando 4.210 de 10.000» con `<Senal estado="indexando">`) la pone la pantalla de arranque de IN-007 con este progreso.

### Invalidación de derivados

La clave de un derivado lleva el **hash del original** y la **versión del lector**: si cambia cualquiera de los dos, la consulta falla y IN-012 vuelve a derivar. `guardarDerivado` borra los derivados viejos del mismo elemento para que no se acumulen. Cambiar la versión de la caché lo vacía todo.

### Repositorio

`Repositorio.cargarDesde(entradas)` arma su índice id/ref → ruta desde la caché, sin abrir archivos.

## Tareas

- [ ] Almacenes `frontmatter`, `derivados`, `indice` y `meta`.
- [ ] Reconstrucción completa con progreso (el texto y la animación los pone IN-007).
- [ ] Invalidación por hash, versión del lector y versión de la caché.
- [ ] Reconciliación al arrancar.

## Pruebas previstas

Con `fake-indexeddb` (IndexedDB en Node):

- Borrar IndexedDB y reconciliar da el mismo estado que antes.
- Cambiar un archivo, añadir otro y borrar un tercero: la reconciliación solo lee los dos primeros y borra el tercero.
- Subir la versión de un lector: el derivado viejo no se devuelve; guardar el nuevo borra el viejo.
- Una versión de caché distinta vacía la base.
- El índice comprimido vuelve idéntico.
- 10.000 elementos: leer todos los frontmatters de la caché caliente (en `fake-indexeddb`) y reconciliar sin cambios en menos de 2 s.

## Criterios de aceptación

- Apertura de 10.000 elementos con caché caliente < 2 s (medido en Node con `fake-indexeddb`; en navegador, pendiente de validación humana).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| La fecha de modificación de OPFS puede no cambiar en escrituras rápidas | También se compara el tamaño; y el repositorio actualiza la caché al guardar, sin esperar a reconciliar |
| `CompressionStream` no existe en Node antiguos | Node 24 y los navegadores actuales lo tienen |
| Varias pestañas con la misma caché | Solo la que escribe (IN-005) reconcilia y escribe en la caché |

## Autorrevisión

Cubre la ficha; la parte visible de la reconstrucción va en IN-007, que ya depende de IN-090.

## Cambios durante la implementación

- **`openDB` de `idb` no admite otra IndexedDB que la global**: la caché abre la base con la fábrica indicada (`fabrica.open`) y la envuelve con `wrap` de `idb`. Así las pruebas usan una IndexedDB aislada cada una (`new IDBFactory()` de `fake-indexeddb`); con la global compartida, la prueba «borrar IndexedDB y reconciliar» no habría borrado nada.
- `Repositorio.cargarDesde(entradas)` arma el índice id/ref → ruta desde la caché.
- `reconciliar` devuelve también las entradas vigentes, para que quien abre el espacio (IN-007) llene el repositorio sin otra consulta.
