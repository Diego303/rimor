# Plantilla de lector

Un lector entiende un tipo de captura: lo detecta, lo lee al guardar, deriva lo que haga falta en un Worker y lo
pinta. Esta carpeta es un lector completo que funciona (cuenta líneas y palabras); cópiala para empezar uno.

## Archivos

| Archivo | Qué es |
|---|---|
| `lector.ts` | El núcleo (`Lector<D>` de `../contrato.ts`): `detectar`, `leer`, `derivar`, `resumen`, `respuesta` y lo opcional (`resumenLegible`, `cifras`, `acciones`, `incrustaciones`, `textoIndexable`). TS puro: se ejecuta también en el Worker de derivados, así que no puede importar React ni nada del DOM. |
| `textos.ts` | Sus textos en español (base) e inglés, con `definirTextos`. `analizando` es obligatorio: se enseña junto a la animación mientras `derivar` trabaja. |
| `Vista.tsx` | Vista completa (export por defecto), con el elemento y los datos derivados. Se carga en diferido. |
| `Tarjeta.tsx` | Vista previa en mosaico (export por defecto), solo con el elemento. Opcional. |
| `fixtures/` | Ejemplos reales para las pruebas y para el corpus de detección (IN-013). |
| `plantilla.test.ts` | Pruebas del lector. |

## Pasos

1. Copia la carpeta a `src/lectores/<nombre>/` (sin el `_`). `<nombre>` en minúsculas, igual que `nombre` en `lector.ts`.
2. En `lector.ts`: cambia `nombre`, `tipo` (uno de `TIPOS_ELEMENTO`; el prefijo de la ref sale solo) y empieza en `version: 1`.
3. Rellena `textos.ts`, las funciones y las vistas. Pinta con las clases de la guía (`card`, `stats`, `code`…) y sin colores fuera de los tokens; los textos, siempre desde `textos.ts`.
4. En `../registro.ts`: impórtalo y añádelo a `LECTORES` en su puesto de `ORDEN_DETECCION` (Anexo D del plan).
5. Añade sus ejemplos a `fixtures/deteccion/<tipo>/` (IN-013) y sus pruebas.

Nada más: el registro, la cola de derivados, la caché y las vistas diferidas ya lo encuentran.

## Reglas

- `derivar` debe devolver datos copiables con structured clone y no depender de nada global: es regenerable.
- Si cambias lo que calcula `derivar`, sube `version`: los derivados guardados se recalculan.
- `respuesta`: como mucho dos frases, sin `!` ni emojis, y como mucho dos acciones (IN-016).
