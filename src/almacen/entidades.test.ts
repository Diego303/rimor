import { asignarRef, type Comparacion, type Entidad, escribirEntidad } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { leerTexto, listarTodo } from './contrato';
import { RepositorioEntidades, RUTA_DIARIO_ENTIDADES } from './entidades';
import { AlmacenMemoria } from './memoria';

const comparacion = (cambios: Partial<Comparacion> = {}): Entidad<Comparacion> => ({
  frontmatter: {
    id: '01JAB4C2Q2X8M5N7P0R4S6T8V0',
    ref: 'CMP-0004',
    tipo: 'comparacion',
    titulo: 'reqwest frente a ureq',
    creado: '2026-10-16T18:21:00+02:00',
    modificado: '2026-10-16T18:21:00+02:00',
    clase: 'mediciones',
    fuentes: ['MED-0007', 'MED-0008'],
    resultado: { cambio: -4.5 },
    ...cambios,
  },
  cuerpo: '',
});

describe('RepositorioEntidades', () => {
  it('guarda en su carpeta, renombra al cambiar el título y da refs sin repetir', async () => {
    const almacen = new AlmacenMemoria();
    let cambios = 0;
    const repo = new RepositorioEntidades(almacen, ['comparacion'], { alCambiar: () => cambios++ });
    expect(await repo.guardar(comparacion())).toBe('comparaciones/CMP-0004--reqwest-frente-a-ureq.md');
    expect(asignarRef('comparacion', repo.refs())).toBe('CMP-0005');
    await repo.guardar(comparacion({ titulo: 'Clientes HTTP' }));
    expect((await listarTodo(almacen)).map((e) => e.ruta)).toEqual(['comparaciones/CMP-0004--clientes-http.md']);
    expect(repo.frontmatter('CMP-0004')?.titulo).toBe('Clientes HTTP');
    expect(repo.lista('comparacion')).toHaveLength(1);
    expect(cambios).toBe(2);
    const leida = await repo.leer('CMP-0004');
    expect(leida.ok && leida.valor.frontmatter.titulo).toBe('Clientes HTTP');
  });

  it('actualizar lee y escribe en el turno de la entidad: dos cambios a la vez no se pisan', async () => {
    const repo = new RepositorioEntidades(new AlmacenMemoria(), ['comparacion']);
    await repo.guardar(comparacion());
    await Promise.all([
      repo.actualizar('CMP-0004', (e) => ({ ...e, cuerpo: 'una nota' })),
      repo.actualizar('CMP-0004', (e) => ({ ...e, frontmatter: { ...e.frontmatter, resultado: { cambio: -3 } } })),
    ]);
    const leida = await repo.leer('CMP-0004');
    expect(leida.ok && leida.valor).toMatchObject({ cuerpo: 'una nota', frontmatter: { resultado: { cambio: -3 } } });
    const nada = await repo.actualizar('CMP-0004', () => null);
    expect(nada.ok && nada.valor).toBe(false);
  });

  it('cargar rehace el índice; lo ilegible, de otra carpeta o repetido queda fuera y se dice', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new RepositorioEntidades(almacen, ['comparacion']);
    await repo.guardar(comparacion());
    const texto = escribirEntidad(comparacion());
    const escribir = (ruta: string, t: string) => almacen.escribir(ruta, new TextEncoder().encode(t));
    await escribir('comparaciones/CMP-0099--copia.md', texto);
    await escribir('comparaciones/roto.md', 'no es una entidad');
    await escribir('comparaciones/notas.txt', 'se ignora');
    const otra = new RepositorioEntidades(almacen, ['comparacion']);
    const fallidos = await otra.cargar();
    expect(fallidos.map((f) => f.codigo).sort()).toEqual(['entidad.duplicada', 'formato.sinFrontmatter']);
    expect(fallidos.find((f) => f.codigo === 'entidad.duplicada')?.ruta).toBe('comparaciones/CMP-0099--copia.md');
    expect([...otra.refs()]).toEqual(['CMP-0004']);
  });

  it('termina un renombrado cortado según su diario', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new RepositorioEntidades(almacen, ['comparacion']);
    const vieja = await repo.guardar(comparacion());
    const nueva = 'comparaciones/CMP-0004--otro.md';
    await almacen.escribir(nueva, new TextEncoder().encode(escribirEntidad(comparacion({ titulo: 'Otro' }))));
    await almacen.escribir(RUTA_DIARIO_ENTIDADES, new TextEncoder().encode(JSON.stringify({ de: vieja, a: nueva })));
    const otra = new RepositorioEntidades(almacen, ['comparacion']);
    expect(await otra.cargar()).toEqual([]);
    expect(await leerTexto(almacen, vieja)).toBeNull();
    expect(otra.frontmatter('CMP-0004')?.titulo).toBe('Otro');
  });

  it('una pestaña que solo lee no escribe', async () => {
    const repo = new RepositorioEntidades(new AlmacenMemoria(), ['comparacion'], { puedeEscribir: () => false });
    expect(() => repo.guardar(comparacion())).toThrow('almacen.soloLectura');
  });
});
