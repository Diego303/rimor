import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo, textoDe } from '../../respuestas/reglas';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizarCodigo, confianzaCodigo } from './analisis';
import { lectorCodigo, tituloDeCodigo } from './lector';
import { type Lenguaje, lenguajePorExtension, lenguajePorSintaxis } from './lenguajes';
import { resaltar, tieneResaltado } from './resaltado';

const raiz = join(process.cwd(), 'fixtures/codigo');
const leer = (archivo: string) => readFileSync(join(raiz, archivo), 'utf8');
const esperado = JSON.parse(leer('esperado.json')) as Record<string, Lenguaje>;
const ctx = (idioma: 'es' | 'en' = 'es'): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
});

describe('los fragmentos de fixtures/codigo (los 12 lenguajes)', () => {
  expect(new Set(Object.values(esperado)).size).toBe(12);
  for (const [archivo, lenguaje] of Object.entries(esperado))
    it(archivo, () => {
      const texto = leer(archivo);
      expect(lenguajePorSintaxis(texto)).toBe(lenguaje);
      expect(confianzaCodigo(texto)).toBe(0.8);
      expect(detectar({ texto }, REGISTRO).lector).toBe('codigo');
    });
});

describe('por extensión', () => {
  it('manda la extensión del archivo', () => {
    expect(lenguajePorExtension('src/app.tsx')).toBe('typescript');
    expect(lenguajePorExtension('main.RS')).toBe('rust');
    expect(lenguajePorExtension('backup.sh')).toBe('shell');
    expect(lenguajePorExtension('notas.txt')).toBeNull();
    expect(confianzaCodigo('x = 1', 'a.py')).toBe(0.95);
    expect(analizarCodigo('print(1)', 'a.rb')).toMatchObject({ lenguaje: 'ruby', comoSeSupo: 'extension' });
  });
});

describe('TypeScript frente a JavaScript', () => {
  it('sin nada propio de TypeScript, es JavaScript', () => {
    expect(lenguajePorSintaxis('const a = 1;\nconst f = (x) => x * 2;\nexport function g() {}\n')).toBe('javascript');
    expect(
      lenguajePorSintaxis('const a: number = 1;\nexport function g(x: string): void {}\ninterface A { b: string }\n'),
    ).toBe('typescript');
  });
});

describe('lo que no es código (con el detector real)', () => {
  const casos: Record<string, string> = {
    JSON: '{\n  "a": 1,\n  "b": [1, 2]\n}\n',
    'log de JSON por línea': readFileSync(join(process.cwd(), 'fixtures/logs/json.log'), 'utf8'),
    'log logfmt': readFileSync(join(process.cwd(), 'fixtures/logs/logfmt.log'), 'utf8'),
    'traza de Python': readFileSync(join(process.cwd(), 'fixtures/trazas/python/01.txt'), 'utf8'),
    'traza de Node': readFileSync(join(process.cwd(), 'fixtures/trazas/javascript/01.txt'), 'utf8'),
    'documento con un bloque de código':
      '# Uso\n\nEjecuta esto:\n\n```bash\npnpm install\npnpm dev\n```\n\nY abre el navegador.\n',
    prosa:
      'Hoy hemos revisado el despliegue del gateway.\nTodo ha ido bien salvo un aviso de memoria.\nLo vigilaremos durante la semana.\n',
    'dos líneas': 'const a = 1;\nconst b = 2;\n',
    prompt: readFileSync(join(process.cwd(), 'fixtures/prompts/revisor-adr.txt'), 'utf8'),
  };
  for (const [nombre, texto] of Object.entries(casos))
    it(nombre, () => {
      expect(confianzaCodigo(texto), nombre).toBe(0);
      expect(detectar({ texto }, REGISTRO).lector).not.toBe('codigo');
    });

  it('un script muy comentado sigue siendo código', () => {
    const texto =
      '#!/usr/bin/env bash\n# Copia de seguridad\n#\n# Uso: backup.sh <carpeta>\n# Sale con 1 si falla.\nset -e\ntar czf backup.tgz "$1"\necho "hecho"\n';
    expect(lenguajePorSintaxis(texto)).toBe('shell');
    expect(detectar({ texto }, REGISTRO).lector).toBe('codigo');
  });

  it('sin retroceso: líneas enormes', () => {
    const inicio = performance.now();
    confianzaCodigo(
      `def x(${')'.repeat(30_000)}\nclass Y(${'('.repeat(30_000)}\nFoo bar baz qux quux ${'a '.repeat(30_000)}`,
    );
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});

describe('lector', () => {
  it('respuesta de la ficha, en es y en; sin lenguaje', () => {
    const d = analizarCodigo(leer('typescript-1.txt'));
    const r = lectorCodigo.respuesta(elementoFalso(1), { ...d, lineas: 48 }, ctx());
    expect(r.texto.map(textoDe).join('')).toBe('Código TypeScript, 48 líneas.');
    expect(comprobarEstilo(r)).toEqual([]);
    expect(
      lectorCodigo
        .respuesta(elementoFalso(1), { ...d, lineas: 48 }, ctx('en'))
        .texto.map(textoDe)
        .join(''),
    ).toBe('TypeScript code, 48 lines.');
    expect(
      lectorCodigo
        .respuesta(elementoFalso(1), { ...d, lenguaje: null, lineas: 1 }, ctx())
        .texto.map(textoDe)
        .join(''),
    ).toBe('Código de 1 línea.');
  });

  it('líneas, definiciones y título', () => {
    const d = analizarCodigo(leer('python-1.txt'));
    expect(d.lineas).toBe(11);
    expect(d.definiciones).toEqual(['Config', '__init__', 'leer']);
    expect(tituloDeCodigo(leer('python-1.txt'), d)).toBe('Config');
    expect(analizarCodigo(leer('typescript-1.txt')).definiciones).toEqual(['Props', 'Panel']);
    expect(analizarCodigo(leer('javascript-2.txt')).definiciones).toEqual(['debounce']);
    expect(tituloDeCodigo('// cabecera\nSELECT 1;', { definiciones: [] })).toBe('SELECT 1;');
  });

  it('resumen, resumen legible, cifras y texto indexable', async () => {
    const b = await lectorCodigo.leer({ texto: leer('go-1.txt'), nombre: 'main.go' });
    expect(b.resumen).toEqual({ lenguaje: 'go', lineas: 15 });
    expect(b.metadatos).toEqual({ archivo_de_codigo: 'main.go' });
    expect(lectorCodigo.resumenLegible?.({ lenguaje: 'go', lineas: 15 }, 'es')).toBe('Go · 15 líneas');
    expect(lectorCodigo.resumenLegible?.({ lenguaje: 'cobol', lineas: 2 }, 'es')).toBe('2 líneas');
    const el = { ...elementoFalso(1, leer('go-1.txt'), 'codigo') };
    el.frontmatter = { ...el.frontmatter, archivo_de_codigo: 'main.go' } as typeof el.frontmatter;
    const d = await lectorCodigo.derivar(el);
    expect(d.comoSeSupo).toBe('extension');
    expect(lectorCodigo.cifras?.lineas?.(d)).toEqual({ texto: '15', valor: 15 });
    expect(lectorCodigo.textoIndexable?.(analizarCodigo(leer('rust-1.txt')))).toBe('Cache\nnueva');
  });
});

describe('resaltado (Lezer, D16)', () => {
  it('ocho lenguajes con analizador; C#, Ruby, Shell y SQL, sin él', () => {
    expect(
      ['typescript', 'javascript', 'python', 'java', 'cpp', 'go', 'rust', 'php'].every((l) =>
        tieneResaltado(l as Lenguaje),
      ),
    ).toBe(true);
    expect(['csharp', 'ruby', 'shell', 'sql'].some((l) => tieneResaltado(l as Lenguaje))).toBe(false);
  });

  for (const archivo of [
    'typescript-1.txt',
    'python-1.txt',
    'rust-1.txt',
    'go-1.txt',
    'java-1.txt',
    'cpp-1.txt',
    'php-1.txt',
    'javascript-1.txt',
  ])
    it(`${archivo}: palabras clave y cadenas resaltadas, y el texto intacto`, async () => {
      const texto = leer(archivo).replace(/\n$/, '');
      const lineas = await resaltar(texto, esperado[archivo] ?? null);
      expect(lineas).not.toBeNull();
      expect(lineas?.map((l) => l.map((t) => t.texto).join('')).join('\n')).toBe(texto);
      const clases = new Set(lineas?.flat().flatMap((t) => t.clases.split(' ')));
      expect(clases.has('tok-keyword'), archivo).toBe(true);
    });

  it('sin analizador o demasiado grande: null', async () => {
    expect(await resaltar('SELECT 1;', 'sql')).toBeNull();
    expect(await resaltar('x', null)).toBeNull();
    expect(await resaltar('x'.repeat(200_001), 'python')).toBeNull();
  });
});

/** Casos de la revisión independiente. */
describe('revisión: confusiones de lenguaje', () => {
  it('el `from x import y` de Python no suma a SQL', () => {
    const py =
      'from os import path\nfrom typing import List\nfrom dataclasses import dataclass\n\ndef f(x):\n    return path.join(x)\n';
    expect(lenguajePorSintaxis(py)).toBe('python');
  });

  it('C# sin `using` ni `namespace` (un controlador) es C#, no TypeScript', () => {
    const cs = [
      '[ApiController]',
      'public class UsuariosController : ControllerBase',
      '{',
      '    private readonly IUserService _service;',
      '    public async Task<IActionResult> Get(int id)',
      '    {',
      '        var user = await _service.GetAsync(id);',
      '        return Ok(user);',
      '    }',
      '}',
    ].join('\n');
    expect(lenguajePorSintaxis(cs)).toBe('csharp');
  });

  it('PHP sin `<?php`, Shell sin shebang y Swift (que no es Go)', () => {
    expect(lenguajePorSintaxis('public function getName(): string\n{\n    return $this->name;\n}\n')).toBe('php');
    expect(lenguajePorSintaxis('for f in *.log; do\n  gzip "$f"\ndone\n')).toBe('shell');
    expect(
      lenguajePorSintaxis(
        'func saludo(nombre: String) -> String {\n    return "Hola"\n}\nlet x = saludo(nombre: "a")\n',
      ),
    ).not.toBe('go');
  });

  it('`enum class Color` define Color', () => {
    expect(analizarCodigo('enum class Color { Rojo, Verde };\nint main() { return 0; }\n').definiciones).toContain(
      'Color',
    );
  });
});

describe('revisión: lo que no es código', () => {
  const casos: Record<string, string> = {
    'lista de tareas en inglés': 'Update the changelog\nSelect a new logo\nOrder by Friday\nCreate table for the party',
    'otra lista en inglés':
      'Update README with the new flags\nSelect a venue for the offsite\nDelete from the calendar the old meetings',
    TOML: '[package]\nname = "rimor"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nserde = "1"\n',
    '.env': 'DATABASE_URL=postgres://localhost/db\nPORT=8080\nDEBUG=true\nexport API_KEY=abc\n',
    INI: '; configuración\n[servidor]\nhost = localhost\npuerto = 8080\n[registro]\nnivel = info\n',
    JSONC: '{\n  // Opciones del compilador\n  "compilerOptions": {\n    "strict": true,\n  },\n}\n',
  };
  for (const [nombre, texto] of Object.entries(casos))
    it(nombre, () => {
      expect(confianzaCodigo(texto), nombre).toBe(0);
      expect(detectar({ texto }, REGISTRO).lector).not.toBe('codigo');
    });

  it('un fragmento corto de Ruby es código, sin duda con Idea', () => {
    const d = detectar({ texto: 'users.each do |u|\n  puts u.name\nend' }, REGISTRO);
    expect(d.lector).toBe('codigo');
    expect(d.alternativa).toBeUndefined();
  });
});

describe('revisión: Python real', () => {
  it('docstrings, decoradores, campos anotados, assert e imports en varias líneas', () => {
    const py = [
      'from dataclasses import dataclass',
      'from .tipos import (',
      '    EXTENSIONES,',
      '    MAPA,',
      ')',
      '',
      '',
      '@dataclass(frozen=True)',
      'class Salud:',
      '    """Salud del jugador.',
      '',
      '    Guarda la vida y las vendas que le quedan para curarse durante la partida.',
      '    """',
      '',
      '    vida: int',
      '    vendas: int = 3',
      '',
      '    def curar(self, n: int) -> "Salud":',
      '        assert n > 0',
      '        return Salud(self.vida + n, self.vendas - 1)',
    ].join('\n');
    expect(confianzaCodigo(py)).toBe(0.8);
    expect(lenguajePorSintaxis(py)).toBe('python');
  });
});

describe('revisión: resaltado de textos grandes', () => {
  it('más de 60.000 caracteres no se resaltan', async () => {
    expect(await resaltar('x = 1\n'.repeat(12_000), 'python')).toBeNull();
    expect(await resaltar('x = 1\n'.repeat(1_000), 'python')).not.toBeNull();
  });
});
