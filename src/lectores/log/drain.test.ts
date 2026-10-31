import { describe, expect, it } from 'vitest';
import { compararLogs } from '../../comparaciones/logs';
import { analizar } from './analisis';
import { agrupar, COMODIN, juntarPlantillas, MIN_VALORES, pareceVariable } from './drain';

const nivel = (plantillas: readonly string[]) => (i: number) => (plantillas[i] ?? '').split(' ')[0] ?? '';
const usuarios = ['ana', 'luis', 'marta', 'pedro', 'sara', 'iris'];

/** Baraja con una semilla (determinista). */
function barajar<T>(xs: readonly T[], semilla: number): T[] {
  const r = [...xs];
  let s = semilla;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j] as T, r[i] as T];
  }
  return r;
}

describe('Drain: qué parece un campo variable', () => {
  it('los identificadores (con dígitos o @) sí; las palabras corrientes, los marcadores, las rutas y las claves no', () => {
    expect(['ana_92', 'worker7', 'ana@x.es', 'v2', COMODIN].every(pareceVariable)).toBe(true);
    expect(['ana', 'db-primaria', 'hit', 'NullPointerException', '<N>', '/api/v2', '{a1,b}'].some(pareceVariable)).toBe(
      false,
    );
  });
});

describe('Drain', () => {
  it('junta lo que solo difiere en identificadores y pone <*> en su sitio', () => {
    const p = [
      'INFO user ana_92 logged in',
      'INFO user luis7 logged in',
      'WARN cola pedidos-2 llena',
      'WARN cola pagos-9 llena',
      'INFO conectado a ana@x.es',
      'INFO conectado a luis@x.es',
    ];
    const r = agrupar(p, nivel(p));
    expect(r.plantillas).toEqual([
      `INFO user ${COMODIN} logged in`,
      `WARN cola ${COMODIN} llena`,
      `INFO conectado a ${COMODIN}`,
    ]);
    expect(r.grupoDe).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it(`un hueco de palabras corrientes se generaliza con ${MIN_VALORES} valores distintos, no con menos`, () => {
    const cinco = usuarios.slice(0, MIN_VALORES).map((u) => `WARN Invalid user ${u} from <IP>`);
    expect(agrupar(cinco, nivel(cinco)).plantillas).toEqual([`WARN Invalid user ${COMODIN} from <IP>`]);
    const cuatro = cinco.slice(0, MIN_VALORES - 1);
    expect(agrupar(cuatro, nivel(cuatro)).plantillas).toEqual(cuatro);
  });

  it('un hueco que ya es variable (por un identificador) recoge las palabras corrientes', () => {
    const p = ['INFO user ana_92 logged in', 'INFO user luis7 logged in', 'INFO user root logged in'];
    expect(agrupar(p, nivel(p))).toEqual({ grupoDe: [0, 0, 0], plantillas: [`INFO user ${COMODIN} logged in`] });
  });

  it('no junta mensajes con otro sentido aunque se parezcan', () => {
    const p = [
      'INFO Accepted password for ana from <IP> port <N> ssh2',
      'INFO Failed password for ana from <IP> port <N> ssh2',
      'INFO Job <N> started',
      'INFO Job <N> finished',
      'INFO Job <N> failed',
      'INFO cache hit for key <HEX>',
      'INFO cache miss for key <HEX>',
      'INFO feature enabled',
      'INFO feature disabled',
      'INFO <N> --- [main] c.e.App : Started App',
      'INFO <N> --- [main] c.e.App : Stopped App',
      'INFO:root:Starting server',
      'INFO:root:Stopping server',
      'INFO Caught NullPointerException in handler',
      'INFO Caught IllegalStateException in handler',
      'INFO failed to open file',
      'INFO failed to parse json',
    ];
    expect(agrupar(p, nivel(p)).plantillas).toEqual(p);
  });

  it('no junta otro nivel, otro largo, otra primera palabra, otra ruta ni otras claves', () => {
    const p = [
      'INFO user ana_1 logged in',
      'ERROR user ana_2 logged in',
      'INFO user ana_3 logged in twice',
      'INFO admin ana_4 logged in',
      'INFO GET /api/salud <N>',
      'INFO GET /api/items <N>',
      'INFO pedido_1 {id,total}',
      'INFO pedido_2 {id,user}',
    ];
    expect(agrupar(p, nivel(p)).plantillas).toEqual(p);
  });

  it('el nivel no se generaliza ni cuenta: solo la primera palabra de nivel, la del mensaje sí', () => {
    const p = ['ERROR', '[ERROR]', 'ERROR', 'INFO error en worker1', 'INFO error en worker2'];
    const r = agrupar(p, () => '');
    expect(r.plantillas).toEqual(['ERROR', '[ERROR]', `INFO error en ${COMODIN}`]);
    expect(r.grupoDe).toEqual([0, 1, 0, 2, 2]);
  });

  it('nunca deja fijas menos de la mitad de las palabras', () => {
    const p = usuarios.map((u, i) => `INFO alta ${u} ${usuarios[(i + 1) % usuarios.length]} <N>`);
    // Generalizar el segundo hueco dejaría «alta <*> <*> <N>»: una fija de cuatro.
    expect(agrupar(p, nivel(p)).plantillas).toHaveLength(p.length);
  });

  it('el orden de llegada no cambia nada', () => {
    const p = [
      ...usuarios.map((u) => `INFO user ${u} logged in`),
      'INFO user ana_92 logged in',
      'INFO cache hit for key <HEX>',
      'INFO cache miss for key <HEX>',
      ...usuarios.map((u, i) => `WARN cola ${u}-${i} llena`),
      'INFO GET /api/items <N>',
    ];
    const base = agrupar(p, nivel(p));
    const textoDe = (r: typeof base, i: number) => r.plantillas[r.grupoDe[i] ?? -1];
    for (const semilla of [1, 7, 42, 1234]) {
      const orden = barajar(
        p.map((_, i) => i),
        semilla,
      );
      const barajadas = orden.map((i) => p[i] ?? '');
      const r = agrupar(barajadas, nivel(barajadas));
      expect(new Set(r.plantillas)).toEqual(new Set(base.plantillas));
      orden.forEach((i, j) => {
        expect(textoDe(r, j)).toBe(textoDe(base, i));
      });
    }
  });

  it('es idempotente: lo ya generalizado se queda igual', () => {
    const p = [
      'INFO user ana_1 logged in',
      'INFO user luis_2 logged in',
      ...usuarios.map((u) => `WARN cola ${u} llena`),
    ];
    const una = agrupar(p, nivel(p));
    expect(agrupar(una.plantillas, nivel(una.plantillas)).plantillas).toEqual(una.plantillas);
  });

  it('dos grupos de niveles distintos con el mismo texto son uno (no hay dos plantillas iguales)', () => {
    const r = juntarPlantillas([
      { plantilla: 'GET /x <N> worker1', n: 3, nivel: 'INFO' },
      { plantilla: 'GET /x <N> worker2', n: 2, nivel: 'INFO' },
      { plantilla: 'GET /x <N> worker3', n: 1, nivel: 'WARN' },
      { plantilla: 'GET /x <N> worker4', n: 1, nivel: 'WARN' },
    ]);
    expect(r.plantillas).toEqual([{ plantilla: `GET /x <N> ${COMODIN}`, n: 7, nivel: 'INFO' }]);
    expect(r.grupoDe).toEqual([0, 0, 0, 0]);
  });
});

describe('Drain en el análisis de un log', () => {
  const log = (nombres: readonly string[]) =>
    nombres
      .flatMap((u, i) => [
        `2026-10-17T17:40:0${i}Z INFO user ${u} logged in`,
        `2026-10-17T17:40:0${i}Z ERROR payment declined for ${u}_${i}`,
      ])
      .join('\n');

  it('menos plantillas, con su recuento, y cada línea con la suya', () => {
    const d = analizar(log(usuarios.slice(0, 5)));
    expect(d.plantillas.map((p) => [p.plantilla, p.n, p.nivel])).toEqual([
      ['INFO user <*> logged in', 5, 'INFO'],
      ['ERROR payment declined for <*>', 5, 'ERROR'],
    ]);
    expect(d.lineaPlantilla).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it('dos logs que solo difieren en los usuarios no divergen, aunque cada uno solo tenga tres', () => {
    const a = analizar(log(usuarios.slice(0, 3)));
    const b = analizar(log(usuarios.slice(3)));
    // Cada uno por su lado no ve un campo variable en tres usuarios…
    expect(a.plantillas.filter((p) => p.plantilla.startsWith('INFO user'))).toHaveLength(3);
    // …pero juntos son seis.
    const c = compararLogs(a, b);
    expect(c.divergencia).toBeNull();
    expect([c.nuevos, c.ausentes, c.cambian]).toEqual([[], [], []]);
  });

  it('la comparación sigue viendo los mensajes que cambian', () => {
    const a = analizar(log(usuarios));
    const b = analizar(`${log(usuarios)}\n2026-10-17T17:41:00Z ERROR disk full`);
    const c = compararLogs(a, b);
    expect(c.divergencia).toBe(12);
    expect(c.nuevos).toEqual(['ERROR disk full']);
  });
});
