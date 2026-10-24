/**
 * Presupuesto del plan (§14.7, IN-040): exportar un espacio grande sin bloquear la interfaz. Se mide el retraso
 * máximo del bucle de eventos mientras se exporta (lo que bloquearía la interfaz si se exportara aquí; en el Worker,
 * lo que tardaría en responder a un mensaje). F0-2 midió menos de 25 ms con trozos de 256 KB; el texto se comprime
 * en trozos de 64 KB.
 */
import { describe, expect, it } from 'vitest';
import { escribirTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import { exportarZip } from './exportar';

const MANIFEST = {
  formato: 'rimor',
  esquema: 1,
  espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Grande' },
  app: { version: '0.1.0' },
};

/** Bytes al azar (incompresibles), deterministas. */
function azar(n: number, semilla: number): Uint8Array {
  const d = new Uint8Array(n);
  let s = semilla;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    d[i] = s >>> 24;
  }
  return d;
}

describe('presupuesto: exportar sin bloquear', () => {
  it('un espacio de ~40 MB (2.000 elementos y 4 adjuntos de 5 MB) sin tareas de más de 50 ms', {
    timeout: 300_000,
  }, async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, 'manifest.json', JSON.stringify(MANIFEST));
    const linea = '2026-10-17T17:40:45Z ERROR stream: read timeout after 30000ms id=7f3a\n';
    for (let i = 0; i < 2000; i++)
      await escribirTexto(
        almacen,
        `elementos/2026/10/LOG-${String(i).padStart(4, '0')}.md`,
        `---\nid: ${i}\n---\n${linea.repeat(150)}`,
      );
    for (let i = 0; i < 4; i++) await almacen.escribir(`adjuntos/a${i}/grande.bin`, azar(5 * 1024 * 1024, i + 1));

    // Lo que bloquearía la interfaz: cuánto llega tarde un temporizador de 5 ms mientras se exporta (el retraso
    // del bucle de eventos). Las esperas asíncronas (el SHA-256 de un adjunto, fuera del hilo) no cuentan. El mejor
    // de tres intentos: en la suite completa, los demás procesos también retrasan el temporizador.
    const exportarMidiendo = async () => {
      let mayor = 0;
      let sigue = true;
      const vigilar = async () => {
        while (sigue) {
          const antes = performance.now();
          await new Promise((r) => setTimeout(r, 5));
          mayor = Math.max(mayor, performance.now() - antes - 5);
        }
      };
      const vigia = vigilar();
      const { bytes } = await exportarZip(almacen, { ahora: new Date(), version: '0.1.0' });
      sigue = false;
      await vigia;
      return { bytes, mayor };
    };
    let { bytes, mayor } = await exportarMidiendo();
    for (let intento = 1; intento < 3 && mayor >= 50; intento++) {
      const otro = await exportarMidiendo();
      bytes = otro.bytes;
      mayor = Math.min(mayor, otro.mayor);
    }
    expect(bytes).toBeGreaterThan(20 * 1024 * 1024);
    expect(mayor, `retraso máximo ${mayor.toFixed(1)} ms`).toBeLessThan(50);
  });
});
