import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo } from '../../respuestas/reglas';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizarComando, comandosDe, huecosDe, programaDe, puntuarComando, rellenar, trozosComando } from './analisis';
import { lectorComando, tituloDeComando } from './lector';

const ctx = (idioma: 'es' | 'en') => ({ idioma, mismaHuella: [], versiones: [], notas: [], colecciones: [] });
const respuesta = (texto: string, idioma: 'es' | 'en' = 'es') =>
  lectorComando.respuesta(elementoFalso(1, texto, 'comando'), analizarComando(texto), ctx(idioma));
const leer = (r: ReturnType<typeof respuesta>) => r.texto.map((f) => ('v' in f ? f.v : '')).join('');

describe('análisis de un comando', () => {
  it('con $ o con un programa conocido; con huecos, algo más', () => {
    expect(puntuarComando('$ git log --oneline')).toBe(0.9);
    expect(puntuarComando('git log --oneline')).toBe(0.85);
    expect(puntuarComando('cargo bench -- --save-baseline {{baseline}}')).toBeCloseTo(0.9);
    expect(puntuarComando('$ docker compose up -d\n$ docker compose logs -f')).toBe(0.9);
  });

  it('continuaciones con \\, prompt, sudo, variables de entorno y rutas', () => {
    expect(comandosDe('kubectl get pods \\\n  -A \\\n  -o wide\n')).toEqual(['kubectl get pods -A -o wide']);
    expect(programaDe('$ sudo RUST_LOG=debug ./target/release/gateway --puerto 1')).toBe('gateway');
    expect(analizarComando('$ cargo run\n$ cargo test').comandos).toEqual(['cargo run', 'cargo test']);
  });

  // biome-ignore lint/suspicious/noTemplateCurlyInString: `${VAR}` es la sintaxis del shell que no debe contar como hueco.
  it('huecos {{x}} sin repetir (con espacios dentro), y nada de ${VAR}, $VAR ni <x>', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: lo mismo, en el texto de la prueba.
    expect(huecosDe('ssh {{usuario}}@{{ host }} -p {{puerto}} && echo {{usuario}} ${HOME} $PATH <entrada')).toEqual([
      '{{usuario}}',
      '{{host}}',
      '{{puerto}}',
    ]);
    expect(rellenar('ssh {{usuario}}@{{ host }}', { '{{usuario}}': 'ana', '{{host}}': '' })).toBe('ssh ana@{{ host }}');
    expect(trozosComando('git rebase -i HEAD~{{n}} --autosquash')).toEqual([
      { t: 'texto', v: 'git rebase -i HEAD~' },
      { t: 'hueco', v: '{{n}}' },
      { t: 'texto', v: ' --autosquash' },
    ]);
  });

  it('lo que no es comando: prosa, un script largo, un programa desconocido, Markdown, un log', () => {
    expect(puntuarComando('git es un sistema de control de versiones.')).toBe(0);
    expect(puntuarComando(Array.from({ length: 5 }, (_, i) => `echo ${i}`).join('\n'))).toBe(0);
    expect(puntuarComando('frobnicar --rapido')).toBe(0);
    expect(puntuarComando('# Instalar\n\nnpm install')).toBe(0);
    expect(puntuarComando('2026-10-17T17:40:45Z ERROR stream: read timeout')).toBe(0);
  });

  it('se detecta como comando, no como Código ni Idea', () => {
    for (const texto of ['git log --oneline', '$ cargo bench', 'kubectl logs -f deploy/gateway'])
      expect(detectar({ texto }, REGISTRO).lector).toBe('comando');
  });

  it('título: el primer comando sin el prompt, recortado', () => {
    expect(tituloDeComando(analizarComando('$ cargo bench --bench http'))).toBe('cargo bench --bench http');
    expect(tituloDeComando(analizarComando(`git commit -m "${'x'.repeat(100)}"`)).length).toBe(80);
  });
});

describe('respuesta', () => {
  it('«Comando con un hueco: {{baseline}}.» (en mono) y la acción «Copiar con valores»', () => {
    const r = respuesta('cargo bench --bench http -- --save-baseline {{baseline}}');
    expect(leer(r)).toBe('Comando con un hueco: {{baseline}}.');
    expect(r.texto.find((f) => f.t === 'mono')).toEqual({ t: 'mono', v: '{{baseline}}' });
    expect(r.acciones).toEqual([{ id: 'abrir', etiqueta: 'Copiar con valores' }]);
    expect(leer(respuesta('cargo bench -- --save-baseline {{baseline}}', 'en'))).toBe(
      'Command with one blank: {{baseline}}.',
    );
  });

  it('varios huecos, más de tres y ninguno; las reglas de estilo', () => {
    expect(leer(respuesta('ssh {{usuario}}@{{host}}'))).toBe('Comando con 2 huecos: {{usuario}} y {{host}}.');
    expect(leer(respuesta('x {{a}} {{b}} {{c}}'.replace('x', 'git')))).toBe(
      'Comando con 3 huecos: {{a}}, {{b}} y {{c}}.',
    );
    expect(leer(respuesta('git {{a}} {{b}} {{c}} {{d}}'))).toBe('Comando con 4 huecos: {{a}}, {{b}}, {{c}}….');
    const sin = respuesta('git log --oneline');
    expect([leer(sin), sin.acciones]).toEqual(['Comando de git.', undefined]);
    for (const texto of ['git log', 'ssh {{a}}@{{b}}', 'git {{a}} {{b}} {{c}} {{d}}'])
      for (const idioma of ['es', 'en'] as const) expect(comprobarEstilo(respuesta(texto, idioma))).toEqual([]);
    expect(lectorComando.resumenLegible?.(lectorComando.resumen(analizarComando('ssh {{a}}')), 'es')).toBe(
      'ssh · 1 hueco',
    );
  });
});
