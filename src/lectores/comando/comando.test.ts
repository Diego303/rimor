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
    expect(leer(r)).toBe('Comando con un hueco: {{baseline}}. Puedes copiarlo con el valor rellenado.');
    expect(r.texto.find((f) => f.t === 'mono')).toEqual({ t: 'mono', v: '{{baseline}}' });
    expect(r.acciones).toEqual([{ id: 'abrir', etiqueta: 'Copiar con valores' }]);
    expect(leer(respuesta('cargo bench -- --save-baseline {{baseline}}', 'en'))).toBe(
      'Command with one blank: {{baseline}}. You can copy it with the value filled in.',
    );
  });

  it('varios huecos, más de tres y ninguno; las reglas de estilo', () => {
    const copiar = ' Puedes copiarlo con los valores rellenados.';
    expect(leer(respuesta('ssh {{usuario}}@{{host}}'))).toBe(`Comando con 2 huecos: {{usuario}} y {{host}}.${copiar}`);
    expect(leer(respuesta('git {{a}} {{b}} {{c}}'))).toBe(`Comando con 3 huecos: {{a}}, {{b}} y {{c}}.${copiar}`);
    expect(leer(respuesta('git {{a}} {{b}} {{c}} {{d}} {{e}}'))).toBe(
      `Comando con 5 huecos: {{a}}, {{b}}, {{c}} y 2 más.${copiar}`,
    );
    const sin = respuesta('git log --oneline');
    expect([leer(sin), sin.acciones]).toEqual(['Comando de git.', undefined]);
    for (const texto of ['git log', 'ssh {{a}}@{{b}}', 'git {{a}} {{b}} {{c}} {{d}}'])
      for (const idioma of ['es', 'en'] as const) expect(comprobarEstilo(respuesta(texto, idioma))).toEqual([]);
    expect(lectorComando.resumenLegible?.(lectorComando.resumen(analizarComando('ssh {{a}}')), 'es')).toBe(
      'ssh · 1 hueco',
    );
  });
});

describe('correcciones de la revisión', () => {
  it('las marcas de prompt no aceptan cualquier texto: citas, precios, porcentajes', () => {
    for (const texto of [
      '> Nota: revisar el contrato',
      '> El conocimiento es poder\n> — Francis Bacon',
      '% de usuarios activos subió',
      '$ 20 al mes por el plan pro',
    ])
      expect([texto, puntuarComando(texto)]).toEqual([texto, 0]);
    expect(puntuarComando('> git status')).toBe(0.9);
  });

  it('comandos que acaban en punto, con sudo y sus opciones, time, env y variables en minúscula', () => {
    for (const texto of [
      'git add .',
      'cd ..',
      '$ docker build .',
      'git add .\ngit commit -m "wip, the end."\ngit push',
      'sudo -u postgres psql',
      'time cargo build --release',
      'env FOO=1 node x.js',
      'http_proxy=http://proxy:3128 curl https://example.com',
    ])
      expect([texto, puntuarComando(texto) > 0]).toEqual([texto, true]);
    expect(programaDe('sudo -u postgres psql -d base')).toBe('psql');
  });

  it('un programa conocido seguido de prosa no es un comando', () => {
    for (const texto of [
      'make sure to call mom tomorrow',
      'go to the store and buy milk',
      'ssh into the server and restart nginx',
      'kill the process',
      'head over to the docs',
      'export const x = 1;',
      'make a list of {{n}} ideas about {{tema}}',
      'find the bugs in this code: {{codigo}}',
    ])
      expect([texto, puntuarComando(texto)]).toEqual([texto, 0]);
    expect(puntuarComando('export RUST_LOG=debug')).toBe(0.85);
  });

  it('otros prompts, sesiones con su salida, heredocs y comillas en varias líneas', () => {
    expect(comandosDe('ana@portatil:~/rimor$ git status')).toEqual(['git status']);
    expect(comandosDe('PS C:\\Users\\ana> git status')).toEqual(['git status']);
    expect(comandosDe('$ git status\nOn branch main\nnothing to commit\n$ git log -1')).toEqual([
      'git status',
      'git log -1',
    ]);
    expect(comandosDe('cat <<EOF > notas.txt\nuna\ndos\nEOF')).toEqual(['cat <<EOF > notas.txt\nuna\ndos\nEOF']);
    expect(comandosDe('echo "hola\nmundo" | tr a-z A-Z')).toEqual(['echo "hola\nmundo" | tr a-z A-Z']);
    expect(puntuarComando('$ git status\nOn branch main\nnothing to commit')).toBe(0.9);
  });

  it('las palabras reservadas de una plantilla de Go no son huecos', () => {
    expect(huecosDe('docker ps --format "{{.Names}} {{end}}"')).toEqual([]);
    expect(huecosDe('gh pr list --template "{{range .}}{{.title}}{{end}}" --repo {{repo}}')).toEqual(['{{repo}}']);
    expect(trozosComando('docker ps --format "{{.Names}} {{end}}"', [])).toEqual([
      { t: 'texto', v: 'docker ps --format "{{.Names}} {{end}}"' },
    ]);
  });
});
