import { describe, expect, it } from 'vitest';
import { crearMotorNode } from './motor-datos';

describe('DuckDB en Node (pruebas)', () => {
  it('registra un CSV y lo consulta', async () => {
    const m = await crearMotorNode();
    await m.registrar('x.csv', new TextEncoder().encode('a,b\n1,uno\n2,dos\n'));
    expect(await m.consultar("select a, b from read_csv_auto('x.csv') order by a")).toEqual({
      columnas: ['a', 'b'],
      filas: [
        [1, 'uno'],
        [2, 'dos'],
      ],
    });
  }, 60_000);
});
