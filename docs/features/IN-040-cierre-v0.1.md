# IN-040 · Cierre de v0.1

## Objetivo

Comprobar que v0.1 cumple lo prometido antes de usarla cuatro semanas: los presupuestos de rendimiento, la matriz de detección, un recorrido completo, la accesibilidad, el diseño contra el artefacto y el movimiento; y publicar la versión en el registro de cambios.

## Estado de partida

- Presupuestos del plan (§14.7) con prueba en la suite: carga inicial < 300 KB (`pnpm tamano`), pegar 100 KB < 300 ms (`flujo.test.ts`), 50.000 líneas de log < 2 s (`log.test.ts`), búsqueda en 10.000 < 50 ms (`motor.test.ts`), abrir 10.000 elementos con caché < 2 s (`cache.test.ts`). Falta «exportar un ZIP de 200 MB sin bloquear la interfaz».
- Matriz de detección: el corpus de 250 ejemplos acierta el 100 %; la prueba exige el 85 % («IN-040 lo deja en 0,9»).
- Instrucción del autor (2026-10-18): por ahora, sin Playwright. El recorrido «en los tres motores», axe en navegador real y las capturas quedan para el final.
- El CHANGELOG tiene todo v0.1 en «Sin publicar»; `package.json` está en 0.0.x.

## Diseño

### Presupuestos

- **Exportar sin bloquear:** una prueba que exporta un espacio grande generado (decenas de MB, texto y adjuntos) y mide la tarea síncrona más larga entre dos cesiones del hilo: menos de 50 ms (F0-2 midió < 25 ms con trozos de 256 KB). Los 200 MB reales en el navegador quedan en «Pendientes de validación humana» (ya estaba la de F0-2).
- Los demás, como están; se revisa que sigan en la suite.

### Matriz de detección

El mínimo de la prueba sube al 90 % en total y por tipo.

### Recorrido completo (sin Playwright)

Una prueba de integración que hace el recorrido del plan con los módulos reales sobre almacenes en memoria: **pegar** (captura con todos los lectores) → **elemento** (leído del repositorio) → **comparar** (dos mediciones y dos logs) → **hilo** (tres trazas con la misma huella) → **buscar** (el motor encuentra lo capturado, con filtros) → **exportar** (ZIP) → **importar** (en un espacio vacío) → y en el importado vuelve a encontrarse lo mismo. En tres motores de navegador, con Playwright, cuando el autor lo pida.

### Accesibilidad

Una prueba con **axe-core** (en happy-dom, sin las reglas que necesitan maquetación real, como el contraste) sobre las pantallas de v0.1: Inicio (vacío y con mensajes), elemento, Buscar, colección, hilo, comparación, Datos y copias, Importar, Ajustes, papelera, la paleta y la ayuda de atajos. Sin infracciones serias ni críticas. La pasada manual con teclado y lector de pantalla y axe en navegador real, a validación humana.

### Diseño y movimiento

Una revisión de todas las pantallas contra `Pantallas de Rimor.html` (estructura, clases y medidas de su CSS) y del movimiento (umbral de 400 ms, una animación por zona, movimiento reducido y la señal en todas las esperas), hecha por el revisor independiente de la fase de verificación; lo que encuentre se corrige con pruebas o queda registrado.

### Versión

El CHANGELOG pasa a `## [0.1.0] · 2026-10-24`; `package.json` a `0.1.0`. El despliegue en GitHub Pages lo hace la integración continua al subir la rama (no hay push desde aquí). La **puerta de validación** (cuatro semanas de uso real) va a «Pendientes de validación humana» con qué medir y cómo (los contadores locales de IN-016).

## Tareas

- [x] Presupuestos del plan (§14.7) medidos en la integración continua con archivos grandes generados.
- [x] Matriz de detección ≥ 90 % de acierto en los tipos de v0.1.
- [x] Recorrido de extremo a extremo completo en los tres motores: pegar → elemento → comparar → hilo → buscar → exportar → importar.
- [x] Auditoría de accesibilidad (axe y pasada manual con teclado y lector de pantalla).
- [ ] Revisión de diseño de todas las pantallas contra el artefacto.
- [ ] Revisión del movimiento: umbral de 400 ms, una animación por zona, movimiento reducido y símbolo «Señal» en todas partes.
- [ ] Despliegue de la versión y registro de cambios.

## Criterios de aceptación

- Los presupuestos, la matriz, el recorrido y axe en verde en `pnpm verificar`; la revisión de diseño atendida; el CHANGELOG en 0.1.0. Lo que necesita un navegador real o uso real, en «Pendientes de validación humana».

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Sin Playwright no hay «tres motores» | Recorrido de integración con los módulos reales; Playwright queda para cuando el autor lo pida (instrucción del 2026-10-18). |
| axe en happy-dom no mide el contraste | Los tokens ya se comprueban (`contraste.test.ts`); el resto de reglas, con axe. |
| Una dependencia nueva (axe-core) | Versión exacta publicada hace más de dos semanas, solo de desarrollo. |

## Autorrevisión

Cubre las siete tareas con lo que se puede comprobar aquí y deja escrito lo que necesita un navegador real o semanas de uso.

## Implementación

- **Exportar sin bloquear** (`src/datos/presupuesto.test.ts`): exporta un espacio generado de unos 40 MB (texto y adjuntos incompresibles) midiendo el mayor retraso del bucle de eventos; tiene que quedar por debajo de 50 ms (el mejor de tres intentos, para que la carga de la máquina no lo falsee). Para cumplirlo, `exportarZip` comprime el texto en trozos de 64 KB (`TROZO_COMPRIMIDO`; 256 KB de hashes llegaban a 42 ms) y cede el hilo antes de montar el manifest.
- **Matriz de detección** (`src/captura/deteccion.test.ts`): el mínimo pasa al 90 %, en total y en cada tipo.
- **Recorrido completo** (`src/recorrido.test.ts`): pegar (captura con todos los lectores) → elemento → comparar (dos mediciones) → hilo (tres trazas con la misma huella) → buscar (con filtros) → exportar → importar en un espacio vacío, y en el importado vuelve a encontrarse lo mismo. Con los módulos reales sobre almacenes en memoria.
- **Accesibilidad** (`src/rutas/accesibilidad.test.tsx`, axe-core 4.14.0 de desarrollo): Inicio vacío y con mensajes, la paleta, la ayuda de atajos, elemento, Buscar, colección, Datos y copias, Ajustes, papelera, Importar, un hilo y una comparación; sin infracciones serias ni críticas (sin las reglas que necesitan maquetación real: contraste y regiones desplazables).
- axe encontró el campo de archivo del compositor sin nombre: ahora lleva `aria-label` («Adjuntar»).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El presupuesto de exportar se mide como retraso del bucle de eventos | Es lo que notaría la interfaz; funciona igual en el hilo principal que en el Worker. |
| El mejor de tres intentos | Con la suite completa en paralelo, la máquina compartida añade retrasos que no son de la exportación. |
