import { describe, expect, it } from 'vitest';
import { compararLogs } from '../../comparaciones/logs';
import { analizar } from './analisis';
import { agrupar, COMODIN } from './drain';

const nivel = (plantillas: string[]) => (i: number) => (plantillas[i] ?? '').split(' ')[0] ?? '';

describe('Drain', () => {
  it('junta lo que solo difiere en un campo sin forma conocida (usuarios, hosts, colas) y pone <*> en su sitio', () => {
    const p = [
      'INFO user ana logged in',
      'INFO user luis logged in',
      'INFO user marta logged in',
      'WARN cola pedidos llena',
      'WARN cola pagos llena',
      'INFO conectado a db-primaria',
      'INFO conectado a db-replica',
    ];
    const r = agrupar(p, nivel(p));
    expect(r.plantillas).toEqual([
      `INFO user ${COMODIN} logged in`,
      `WARN cola ${COMODIN} llena`,
      `INFO conectado a ${COMODIN}`,
    ]);
    expect(r.grupoDe).toEqual([0, 0, 0, 1, 1, 2, 2]);
  });

  it('no junta mensajes distintos: otro nivel, otro largo, otra primera palabra, poco parecidos o con otra ruta', () => {
    const p = [
      'INFO user ana logged in',
      'ERROR user ana logged in',
      'INFO user ana logged in twice',
      'INFO admin ana logged in',
      'INFO failed to open file',
      'INFO failed to parse json',
      'INFO GET /api/salud <N>',
      'INFO GET /api/items <N>',
    ];
    expect(agrupar(p, nivel(p)).plantillas).toHaveLength(p.length);
  });

  it('es determinista e idempotente: lo ya generalizado se queda igual', () => {
    const p = ['INFO user ana logged in', 'INFO user luis logged in'];
    const una = agrupar(p, nivel(p));
    expect(agrupar(p, nivel(p))).toEqual(una);
    expect(agrupar(una.plantillas, nivel(una.plantillas)).plantillas).toEqual(una.plantillas);
  });
});

describe('Drain en el análisis de un log', () => {
  const log = [
    '2026-10-17T17:40:00Z INFO user ana logged in',
    '2026-10-17T17:40:01Z INFO user luis logged in',
    '2026-10-17T17:40:02Z ERROR payment declined for ana',
    '2026-10-17T17:40:03Z INFO user marta logged in',
    '2026-10-17T17:40:04Z ERROR payment declined for luis',
  ].join('\n');

  it('menos plantillas, con su recuento, y cada línea con la suya', () => {
    const d = analizar(log);
    expect(d.plantillas.map((p) => [p.plantilla, p.n, p.nivel])).toEqual([
      ['INFO user <*> logged in', 3, 'INFO'],
      ['ERROR payment declined for <*>', 2, 'ERROR'],
    ]);
    expect(d.lineaPlantilla).toEqual([0, 0, 1, 0, 1]);
  });

  it('dos logs que solo difieren en los usuarios ya no divergen', () => {
    const otro = log.replaceAll('ana', 'pedro').replaceAll('luis', 'sara').replaceAll('marta', 'iris');
    const c = compararLogs(analizar(log), analizar(otro));
    expect(c.divergencia).toBeNull();
    expect([c.nuevos, c.ausentes, c.cambian]).toEqual([[], [], []]);
  });
});
