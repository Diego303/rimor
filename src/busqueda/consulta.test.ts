import type { FrontmatterComun } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { analizarConsulta, type Consulta, coincideFiltros, hayConsulta } from './consulta';

const AHORA = new Date(2026, 9, 17, 18, 0, 0);
const dia = (a: number, m: number, d: number) => new Date(a, m - 1, d).getTime();
const FIN = 86_400_000 - 1;
const VACIA = analizarConsulta('');

/** Lo que interesa de una consulta (sin los campos vacíos). */
function resumen(c: Consulta): Partial<Consulta> {
  return Object.fromEntries(
    Object.entries(c).filter(([k, v]) => (Array.isArray(v) ? v.length > 0 : k === 'imposible' ? v : v !== undefined)),
  );
}

// 50 consultas: lo que escribe el usuario y lo que debe entenderse.
const CASOS: [string, Partial<Consulta>][] = [
  ['timeout streaming', { palabras: ['timeout', 'streaming'] }],
  ['Timeout  STREAMING', { palabras: ['timeout', 'streaming'] }],
  ['canción', { palabras: ['cancion'] }],
  ['"read timeout"', { frases: ['read timeout'] }],
  ['"Read   Timeout" ureq', { frases: ['read   timeout'], palabras: ['ureq'] }],
  ['"una"', { frases: ['una'] }],
  ['"sin cerrar', { frases: ['sin cerrar'] }],
  ['tipo:log', { tipos: ['log'] }],
  ['tipo:error,mediciones', { tipos: ['error', 'mediciones'] }],
  ['tipo:errores', { tipos: ['error'] }],
  ['tipo:logs timeout', { tipos: ['log'], palabras: ['timeout'] }],
  ['tipo:md', { tipos: ['markdown'] }],
  ['tipo:doc', { tipos: ['markdown'] }],
  ['tipo:Código', { tipos: ['codigo'] }],
  ['tipo:code', { tipos: ['codigo'] }],
  ['tipo:documentomd', { tipos: ['markdown'] }],
  ['tipo:measurements', { tipos: ['mediciones'] }],
  ['tipo:url', { tipos: ['enlace'] }],
  ['“read timeout” «sin cerrar»', { frases: ['read timeout', 'sin cerrar'] }],
  ['tipo:nada', { imposible: true }],
  ['en:gateway', { en: [['gateway']] }],
  ['en:@gateway en:prompts', { en: [['gateway'], ['prompts']] }],
  ['en:INV-0003', { en: [['inv-0003']] }],
  ['en:gateway,prompts', { en: [['gateway', 'prompts']] }],
  ['#ureq', { etiquetas: ['ureq'] }],
  ['#UREQ #staging', { etiquetas: ['ureq', 'staging'] }],
  ['#', { palabras: ['#'] }],
  ['desde:2026-10-01', { desde: dia(2026, 10, 1) }],
  ['hasta:2026-10-15', { hasta: dia(2026, 10, 15) + FIN }],
  ['desde:2026-10-01 hasta:2026-10-15', { desde: dia(2026, 10, 1), hasta: dia(2026, 10, 15) + FIN }],
  ['desde:hoy', { desde: dia(2026, 10, 17) }],
  ['desde:ayer', { desde: dia(2026, 10, 16) }],
  ['desde:semana', { desde: dia(2026, 10, 10) }],
  ['hasta:hoy', { hasta: dia(2026, 10, 17) + FIN }],
  ['desde:2026-13-45', { palabras: ['desde:2026-13-45'] }],
  ['desde:mañana', { palabras: ['desde:manana'] }],
  ['estado:resuelto', { estados: ['resuelto'] }],
  ['estado:en-uso', { estados: ['en-uso'] }],
  ['estado:nuevo,semilla', { estados: ['nuevo', 'semilla'] }],
  ['nivel:error', { niveles: ['error'] }],
  ['nivel:warn,error', { niveles: ['warn', 'error'] }],
  ['nivel:avisos', { niveles: ['warn'] }],
  ['nivel:debug', { imposible: true }],
  ['huella:3fa2', { huellas: ['3fa2'] }],
  ['dominio:github.com', { dominios: ['github.com'] }],
  ['dominio:www.GitHub.com', { dominios: ['github.com'] }],
  ['-staging', { excluir: ['staging'] }],
  ['timeout -"read body"', { palabras: ['timeout'], excluir: ['read body'] }],
  [
    '-#staging -tipo:log',
    {
      sinFiltros: [
        { ...VACIA, etiquetas: ['staging'] },
        { ...VACIA, tipos: ['log'] },
      ],
    },
  ],
  ['C:\\ruta foo:bar 10:30', { palabras: ['c:\\ruta', 'foo:bar', '10:30'] }],
];

describe('analizar la consulta', () => {
  it('son 50 consultas', () => expect(CASOS).toHaveLength(50));
  it.each(CASOS)('%s', (texto, esperado) => {
    expect(resumen(analizarConsulta(texto, { ahora: AHORA }))).toEqual(esperado);
  });

  it('un guion solo, un tipo repetido y un negado que no es filtro', () => {
    expect(resumen(analizarConsulta('-'))).toEqual({ palabras: ['-'] });
    expect(resumen(analizarConsulta('tipo:log,log'))).toEqual({ tipos: ['log'] });
    expect(resumen(analizarConsulta('-foo:bar'))).toEqual({ excluir: ['foo:bar'] });
  });

  it('vacía: no hay nada que buscar', () => {
    expect(hayConsulta(analizarConsulta('   '))).toBe(false);
    expect(hayConsulta(analizarConsulta('tipo:log'))).toBe(true);
  });
});

function fm(cambios: Partial<FrontmatterComun> & Record<string, unknown> = {}): FrontmatterComun {
  return { ...elementoFalso(1, 'x', 'texto').frontmatter, creado: '2026-10-12T10:00:00+02:00', ...cambios };
}

describe('filtros sobre el frontmatter', () => {
  const pasa = (q: string, f: FrontmatterComun) => coincideFiltros(f, analizarConsulta(q, { ahora: AHORA }));

  it('tipo, colección o investigación, etiquetas (todas), fechas y estado visible', () => {
    expect(pasa('tipo:texto', fm())).toBe(true);
    expect(pasa('tipo:log', fm())).toBe(false);
    expect(pasa('en:gateway', fm({ colecciones: ['gateway'] }))).toBe(true);
    expect(pasa('en:inv-0003', fm({ investigaciones: ['INV-0003'] as never }))).toBe(true);
    // Cada `en:` se cumple (Y); las comas son O.
    expect(pasa('en:gateway en:api', fm({ colecciones: ['gateway'] }))).toBe(false);
    expect(pasa('en:gateway,api', fm({ colecciones: ['gateway'] }))).toBe(true);
    expect(pasa('en:gateway en:api', fm({ colecciones: ['api', 'gateway'] }))).toBe(true);
    expect(pasa('-#staging', fm({ etiquetas: ['staging'] }))).toBe(false);
    expect(pasa('-#staging', fm({ etiquetas: ['ureq'] }))).toBe(true);
    expect(pasa('-tipo:texto', fm())).toBe(false);
    expect(pasa('-tipo:nada', fm())).toBe(true);
    expect(pasa('#ureq #staging', fm({ etiquetas: ['ureq'] }))).toBe(false);
    expect(pasa('#ureq', fm({ etiquetas: ['UReq'] }))).toBe(true);
    expect(pasa('desde:2026-10-12 hasta:2026-10-12', fm())).toBe(true);
    expect(pasa('desde:2026-10-13', fm())).toBe(false);
    expect(pasa('estado:nuevo', fm())).toBe(true);
    expect(pasa('estado:enuso', fm({ estado: 'en-uso' }))).toBe(true);
    expect(pasa('tipo:nada', fm())).toBe(false);
  });

  it('nivel, huella y dominio miran el resumen de su lector', () => {
    const log = fm({ tipo: 'log', lector: { nombre: 'log', version: 1, resumen: { errores: 3, avisos: 0 } } });
    expect(pasa('nivel:error', log)).toBe(true);
    expect(pasa('nivel:warn', log)).toBe(false);
    const error = fm({ tipo: 'error', lector: { nombre: 'error', version: 1, resumen: { huella: '3FA2c9' } } });
    expect(pasa('huella:3fa2', error)).toBe(true);
    expect(pasa('huella:ffff', error)).toBe(false);
    const enlace = fm({ tipo: 'enlace', url: 'https://docs.github.com/x' });
    expect(pasa('dominio:github.com', enlace)).toBe(true);
    expect(pasa('dominio:gitlab.com', enlace)).toBe(false);
  });
});
