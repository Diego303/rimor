import { describe, expect, it } from 'vitest';
import { type Entidad, escribirEntidad, leerEntidad } from './entidad';
import type { Comparacion } from './esquemas';
import { rutaEntidad } from './nombres';

const comparacion = (): Entidad<Comparacion> => ({
  frontmatter: {
    id: '01JAB4C2Q2X8M5N7P0R4S6T8V0',
    ref: 'CMP-0004',
    tipo: 'comparacion',
    titulo: 'reqwest frente a ureq',
    creado: '2026-10-16T18:21:00+02:00',
    modificado: '2026-10-16T18:21:00+02:00',
    clase: 'mediciones',
    fuentes: ['MED-0007', 'MED-0008'],
    resultado: { cambio: -4.515, p: 0.000007, significativo: true },
  },
  cuerpo: '',
});

describe('entidades', () => {
  it('una comparación se escribe y se lee igual, con su cuerpo', () => {
    const e = { ...comparacion(), cuerpo: 'Medido en el portátil.\n\nCon Ollama local.' };
    const texto = escribirEntidad(e);
    expect(texto.startsWith('---\nid: 01JAB4C2Q2X8M5N7P0R4S6T8V0\nref: CMP-0004\ntipo: comparacion\n')).toBe(true);
    const leida = leerEntidad(texto);
    expect(leida.ok && leida.valor).toEqual(e);
    expect(rutaEntidad('comparacion', 'CMP-0004', e.frontmatter.titulo)).toBe(
      'comparaciones/CMP-0004--reqwest-frente-a-ureq.md',
    );
  });

  it('conserva el YAML anterior (comentarios y claves que no conoce)', () => {
    const previo = escribirEntidad(comparacion()).replace('clase: mediciones', 'clase: mediciones # a mano');
    const conOtra = previo.replace('---\n\n', 'extra: 1\n---\n\n');
    const leida = leerEntidad(conOtra);
    if (!leida.ok) throw new Error(leida.error.codigo);
    expect((leida.valor.frontmatter as Record<string, unknown>).extra).toBe(1);
    const reescrita = escribirEntidad({ ...leida.valor, cuerpo: 'nota' }, conOtra);
    expect(reescrita).toContain('clase: mediciones # a mano');
    expect(reescrita).toContain('extra: 1');
  });

  it('rechaza un tipo que no es de entidad y un frontmatter que no cumple su esquema', () => {
    const texto = escribirEntidad(comparacion());
    const deElemento = leerEntidad(texto.replace('tipo: comparacion', 'tipo: log'));
    expect(!deElemento.ok && deElemento.error.codigo).toBe('formato.tipoEntidadDesconocido');
    expect(texto).toContain('fuentes: [MED-0007, MED-0008]');
    const unaFuente = leerEntidad(texto.replace('fuentes: [MED-0007, MED-0008]', 'fuentes: [MED-0007]'));
    expect(!unaFuente.ok && unaFuente.error).toMatchObject({
      codigo: 'formato.frontmatterInvalido',
      datos: { campo: 'fuentes' },
    });
  });
});
