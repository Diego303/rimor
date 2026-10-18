# Plan: cliente HTTP del gateway

## 1. Objetivo

Sustituir reqwest por un cliente con menos dependencias sin perder fiabilidad.

## 2. Cliente HTTP

- [x] Medir reqwest con 64 KB
- [x] Medir ureq con 64 KB
- [x] Comparar las dos series
- [ ] Revisar el manejo de timeouts
- [ ] Decidir

## 3. Streaming

El gateway debe reenviar los fragmentos según llegan.

- [x] Leer la respuesta como flujo con reqwest
- [ ] Probar `into_reader` con ureq
- [ ] Timeout por fragmento, no por petición
- [ ] Medir respuestas de 1 MB

### 3.1 Detalles del flujo

- [x] Documentar el formato de los fragmentos

## 4. Dependencias

| Crate | Versión | Licencia |
|---|---|---|
| reqwest | 0.12 | MIT |
| ureq | 3.1 | MIT |

- [x] Listar dependencias transitivas
- [ ] Revisar licencias

## 5. Pruebas

```rust
#[test]
fn lee_fragmentos() {
    assert!(true);
}
```

- [ ] Pruebas de integración contra Ollama local
- [ ] Pruebas de carga

Ver [la documentación de ureq](https://docs.rs/ureq) y [[CMP-0004]].
