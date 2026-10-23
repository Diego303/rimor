# IN-037 · Datos y copias

## Objetivo y catálogo

Que perder los datos sea difícil sin dar la lata: la pantalla responde de un vistazo cuánto ocupa el espacio, si está protegido y cuándo se copió; el piloto del raíl dice si la copia está al día; y, si no lo está, Inicio lo recuerda con un mensaje que se puede posponer. Catálogo: **DAT-06** (la interfaz del indicador) y **DAT-07** (recordatorio de copia). Depende de IN-007 (estado de cuidado y piloto) e IN-035 (exportar).

## Estado de partida

- Datos y copias ya tiene la tarjeta de cuidado con sus tres cifras, «Exportar ZIP» (el único botón `senal` de la app) e «Importar…», y los plegados «Otras exportaciones», «Espacios y papelera» y «Qué contiene el ZIP» (IN-007, IN-027, IN-035, IN-036).
- El piloto del raíl se pone verde con una copia de menos de 50 cambios y 7 días (`copiaAlDia`, con umbrales fijos) y ámbar si no.
- `.rimor/ajustes.json` admite `copias: { cambios, dias }` en su esquema, pero nada lo escribe: no hay forma de guardar ajustes.
- Inicio pinta arriba la tarjeta de persistencia (IN-007).
- La referencia (`SC.copias`): el plegado «Recordatorio de copia» con «☑ Avisar tras 50 cambios o 7 días sin copia» y «☑ Exportar un ZIP antes de reemplazar o vaciar la papelera».

## Diseño

### Ajustes de copia (`src/espacio/ajustes.ts`)

- `copias: { cambios, dias, avisar, zipPrevio }` con sus valores por defecto (50, 7, sí, sí) y límites sensatos (cambios de 5 a 1.000; días de 1 a 90). `leerAjustes` los valida y conserva lo que no conoce.
- `EspacioAbierto.guardarAjustes(cambio)`: como `guardarEstado` (en orden, solo la pestaña que escribe, avisa del cambio). Lo usará también IN-038.
- `copiaAlDia` y el resumen del raíl usan los umbrales de los ajustes.

### El recordatorio (`RecordatorioCopia` en Inicio)

- Una tarjeta debajo de la de persistencia cuando la copia no está al día, hay algo guardado, el aviso está activo, esta pestaña escribe y no se ha pospuesto: «Han pasado 9 días desde la última copia y llevas 63 cambios.» (o «Aún no has hecho ninguna copia de este espacio.»), con «Exportar ZIP» (primario: exporta como `Ctrl+E`) y «Más tarde» (lo pospone un día).
- Lo pospuesto va en el estado de cuidado (`recordatorioHasta`), que es de este navegador.
- Nunca bloquea: es una tarjeta más, no un diálogo.

### El piloto

Cuando pasa de ámbar a verde (una copia completa), en su sitio se ve una vez la animación `copia-al-dia` de la señal (con movimiento reducido, el reposo) y después el piloto verde.

### Datos y copias

- El plegado «Recordatorio de copia»: «Avisar tras [50] cambios o [7] días sin copia» (casilla y dos números) y «Exportar un ZIP antes de reemplazar o vaciar la papelera» (casilla).
- Sin el ZIP previo: reemplazar al importar no lo descarga, y vaciar la papelera deja vaciar sin descargar antes su ZIP (sigue ofreciéndolo).

## Tareas

- [x] Pantalla con tres respuestas (cuánto ocupa, si está protegido y cuándo se copió) y «Exportar ZIP» (el único botón naranja de la app).
- [x] Piloto del raíl: verde con copia al día y ámbar al pasar el umbral. La animación `copia-al-dia` (IN-035) acompaña el cambio a verde.
- [x] Recordatorio tras 50 cambios o 7 días (configurable), como mensaje en Inicio, sin bloquear.
- [x] Plegados: otras exportaciones, recordatorio, espacios y papelera, y qué contiene el ZIP.

## Pruebas previstas

- Ajustes: valores por defecto, límites, lo que no se conoce se conserva; `guardarAjustes` escribe y avisa (y no en solo lectura).
- `copiaAlDia` con umbrales configurados; el raíl los usa.
- Recordatorio: aparece con los umbrales pasados, no con la copia al día, ni en un espacio vacío, ni desactivado, ni pospuesto; «Más tarde» lo pospone un día; «Exportar ZIP» exporta y desaparece.
- Piloto: la animación al pasar a verde, una vez.
- Datos y copias: el plegado guarda los ajustes; sin ZIP previo, la papelera se vacía sin descargar y reemplazar no exporta; solo hay un botón `senal`.

## Criterios de aceptación

- `pnpm verificar` en verde; el recordatorio nunca bloquea.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Dónde se configura? | En el plegado «Recordatorio de copia» de Datos y copias (como la referencia); Ajustes (IN-038) puede enlazarlo. |
| ¿Cuánto se pospone? | Un día: lo bastante para no molestar, lo bastante corto para no olvidarlo. |
| Desactivar el ZIP previo | Es decisión de quien lo usa; por defecto, activado. La papelera sigue ofreciendo su ZIP. |

## Autorrevisión

Cubre las cuatro tareas. Reutiliza la tarjeta de cuidado, `exportarEspacio` (vía `useExportar`), el estado de cuidado, la `Senal` y el patrón de `guardarEstado`.

## Implementación

- `src/espacio/ajustes.ts`: `AjustesCopias`, `COPIAS_INICIALES`, `LIMITES_COPIAS` y `copiasDe`; `leerAjustes` los normaliza y conserva lo demás. `EspacioAbierto.guardarAjustes` (en orden, solo la pestaña que escribe, avisa a la otra) y `esperarEscrituras` lo espera.
- `src/espacio/estado.ts`: `recordatorioHasta` y `conRecordatorioHasta`. `src/espacio/resumen.ts`: `debeRecordarCopia`; el resumen del raíl usa los umbrales de los ajustes.
- `src/datos/RecordatorioCopia.tsx`: la tarjeta de Inicio («Exportar ZIP» y «Más tarde»).
- `Rail.tsx`: `PilotoCopia` (la señal `copia-al-dia` una vez al pasar a verde).
- Datos y copias: el plegado «Recordatorio de copia» (`AjustesRecordatorio`). El ZIP previo desactivado: Importar no descarga la copia al reemplazar y la papelera deja vaciar sin descargar (con otro texto).
- Pruebas: `espacio/copias.test.ts` (ajustes, umbrales, recordatorio, aplazamiento, el único botón naranja) y `rutas/datos/Copias.test.tsx` (tarjeta en Inicio, «Más tarde», exportar y piloto, el plegado y la papelera sin ZIP previo).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Los números se guardan al salir del campo, ajustados a sus límites | Mientras se escribe «1» camino de «15» no debe guardarse 5. |
| La tarjeta no sale en la pestaña que solo lee | No podría apuntar ni la copia ni el aplazamiento. |

