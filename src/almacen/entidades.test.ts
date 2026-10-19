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
    expect(otra.frontmatter('CMP-0004')).toBeTruthy();
    expect(otra.frontmatter('CMP-0099')).toBeUndefined();
    // El nombre del archivo repetido sigue ocupando su ref: no se asigna a otra.
    expect([...otra.refs()].sort()).toEqual(['CMP-0004', 'CMP-0099']);
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

  it('crear asigna la ref y guarda en el mismo turno: dos a la vez no se llevan la misma', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new RepositorioEntidades(almacen, ['comparacion']);
    const nueva = (id: string) => (ref: string) =>
      comparacion({ id, ref: ref as Comparacion['ref'], titulo: 'reqwest frente a ureq' });
    const refs = await Promise.all([
      repo.crear('comparacion', nueva('01JAB4C2Q2X8M5N7P0R4S6T8V1')),
      repo.crear('comparacion', nueva('01JAB4C2Q2X8M5N7P0R4S6T8V2')),
    ]);
    expect(refs).toEqual(['CMP-0001', 'CMP-0002']);
    expect((await listarTodo(almacen)).map((e) => e.ruta).sort()).toEqual([
      'comparaciones/CMP-0001--reqwest-frente-a-ureq.md',
      'comparaciones/CMP-0002--reqwest-frente-a-ureq.md',
    ]);
    // Una ref que ya es de otra no se pisa.
    await expect(repo.guardar(comparacion({ id: '01JAB4C2Q2X8M5N7P0R4S6T8V3', ref: 'CMP-0001' }))).rejects.toThrow(
      'entidad.refOcupada',
    );
  });

  it('un archivo que no se puede leer conserva su ref: no se asigna otra vez ni se sobrescribe', async () => {
    const almacen = new AlmacenMemoria();
    await almacen.escribir('comparaciones/CMP-0003--a-mano.md', new TextEncoder().encode('---\nroto: [\n---\n'));
    const repo = new RepositorioEntidades(almacen, ['comparacion']);
    await repo.cargar();
    expect(asignarRef('comparacion', repo.refs())).toBe('CMP-0004');
    await expect(
      repo.guardar(comparacion({ id: '01JAB4C2Q2X8M5N7P0R4S6T8V4', ref: 'CMP-0003', titulo: 'A mano' })),
    ).rejects.toThrow();
    expect(await leerTexto(almacen, 'comparaciones/CMP-0003--a-mano.md')).toBe('---\nroto: [\n---\n');
  });

  it('dos copias en su sitio de la misma: gana la modificada más tarde', async () => {
    const almacen = new AlmacenMemoria();
    const escribir = (ruta: string, e: Entidad) => almacen.escribir(ruta, new TextEncoder().encode(escribirEntidad(e)));
    await escribir(
      'comparaciones/CMP-0004--uno.md',
      comparacion({ titulo: 'Uno', modificado: '2026-10-16T18:21:00+02:00' }),
    );
    await escribir(
      'comparaciones/CMP-0004--dos.md',
      comparacion({ titulo: 'Dos', modificado: '2026-10-17T09:00:00+02:00' }),
    );
    const repo = new RepositorioEntidades(almacen, ['comparacion']);
    expect((await repo.cargar()).map((f) => f.codigo)).toEqual(['entidad.duplicada']);
    expect(repo.frontmatter('CMP-0004')?.titulo).toBe('Dos');
  });

  it('al heredar la escritura (aún sin poder escribir) termina el diario si se le pide', async () => {
    const almacen = new AlmacenMemoria();
    const vieja = await new RepositorioEntidades(almacen, ['comparacion']).guardar(comparacion());
    const nueva = 'comparaciones/CMP-0004--otro.md';
    await almacen.escribir(nueva, new TextEncoder().encode(escribirEntidad(comparacion({ titulo: 'Otro' }))));
    await almacen.escribir(RUTA_DIARIO_ENTIDADES, new TextEncoder().encode(JSON.stringify({ de: vieja, a: nueva })));
    const heredera = new RepositorioEntidades(almacen, ['comparacion'], { puedeEscribir: () => false });
    expect(await heredera.cargar({ recuperar: true })).toEqual([]);
    expect(await leerTexto(almacen, vieja)).toBeNull();
    // Sin pedirlo, una pestaña que solo lee no toca el diario.
    await almacen.escribir(RUTA_DIARIO_ENTIDADES, new TextEncoder().encode(JSON.stringify({ de: nueva, a: vieja })));
    await new RepositorioEntidades(almacen, ['comparacion'], { puedeEscribir: () => false }).cargar();
    expect(await leerTexto(almacen, RUTA_DIARIO_ENTIDADES)).not.toBeNull();
  });

  it('una pestaña que solo lee no escribe', async () => {
    const repo = new RepositorioEntidades(new AlmacenMemoria(), ['comparacion'], { puedeEscribir: () => false });
    expect(() => repo.guardar(comparacion())).toThrow('almacen.soloLectura');
    expect(() => repo.crear('comparacion', () => comparacion())).toThrow('almacen.soloLectura');
  });
});
