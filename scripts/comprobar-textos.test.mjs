import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buscarTextos, comprobarCarpeta } from './comprobar-textos.mjs';

const SCRIPT = fileURLToPath(new URL('./comprobar-textos.mjs', import.meta.url));
const textos = (codigo) => buscarTextos(codigo).map((h) => h.texto);

describe('buscarTextos', () => {
  it('rechaza texto JSX y atributos visibles escritos a mano', () => {
    expect(textos('const A = () => <b>Guardar</b>;')).toEqual(['Guardar']);
    expect(textos('const A = () => <button aria-label="Cerrar" />;')).toEqual(['Cerrar']);
    expect(textos("const A = () => <Tarjeta titulo={'Resumen'} />;")).toEqual(['Resumen']);
    expect(textos("const A = () => <p>{'Hola'}</p>;")).toEqual(['Hola']);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: es código de ejemplo con una plantilla dentro.
    expect(textos('const A = ({ n }) => <p>{`${n} filas`}</p>;')).toEqual(['filas']);
  });

  it('mira dentro de ternarias, operadores, listas, objetos de props, inputs de botón y avisos', () => {
    expect(textos("const A = ({ c }) => <b aria-label={c ? 'Abrir' : 'Cerrar'} />;")).toEqual(['Abrir', 'Cerrar']);
    expect(
      textos("const A = ({ c, x }) => <p>{c ? 'Sí' : 'No'}{x ?? 'Sin título'}{x && 'Hola'}{['Lista']}</p>;"),
    ).toEqual(['Sí', 'No', 'Sin título', 'Hola', 'Lista']);
    expect(textos("const A = () => <b aria-label={('Cerrar')} title={'Abrir' as const} />;")).toEqual([
      'Cerrar',
      'Abrir',
    ]);
    expect(textos("const A = () => <Segmentado opciones={[{ valor: 'claro', etiqueta: 'Claro' }]} />;")).toEqual([
      'Claro',
    ]);
    expect(textos("const A = () => <Tabla columnas={[{ id: 'n', titulo: 'Nombre' }]} />;")).toEqual(['Nombre']);
    expect(textos('const A = () => <input type="submit" value="Enviar" />;')).toEqual(['Enviar']);
    expect(textos('const A = () => <input type="text" value="dato" />;')).toEqual([]);
    expect(textos('const A = () => <Hueco accion="Ver" />;')).toEqual(['Ver']);
    expect(textos("avisar('Copiado'); avisos.avisar(t('x'));")).toEqual(['Copiado']);
  });

  it('acepta claves de i18n, símbolos, cifras y propiedades que no se ven', () => {
    expect(textos("const A = () => <b>{t('acciones.guardar')}</b>;")).toEqual([]);
    expect(textos('const A = () => <span>· › − 42</span>;')).toEqual([]);
    expect(textos('const A = () => <span>&nbsp;&middot;&#183;</span>;')).toEqual([]);
    expect(textos("const A = ({ e }) => <g>{e === 'cargando' && <path />}{e !== 'x' ? null : <b />}</g>;")).toEqual([]);
    expect(
      textos("const A = () => <Segmentado opciones={[{ valor: 'claro', etiqueta: t('tema.claro') }]} />;"),
    ).toEqual([]);
    expect(textos('const A = () => <Icono nombre="enviar" className="ti k-log" />;')).toEqual([]);
    expect(textos('const A = () => <a href="#add" title={t("x")} />;')).toEqual([]);
  });
});

describe('la orden', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('falla con un literal en un componente y deja fuera pruebas y muestras', () => {
    dir = mkdtempSync(join(tmpdir(), 'textos-'));
    mkdirSync(join(dir, 'ui', 'muestras'), { recursive: true });
    writeFileSync(join(dir, 'ui', 'muestras', 'M.tsx'), 'export const M = () => <b>Ejemplo</b>;');
    writeFileSync(join(dir, 'ui', 'B.test.tsx'), 'render(<b>Hola</b>);');
    writeFileSync(join(dir, 'ui', 'Boton.tsx'), 'export const B = () => <button>Guardar</button>;');
    expect(comprobarCarpeta(dir).map((h) => h.archivo)).toEqual([join('ui', 'Boton.tsx')]);
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Boton.tsx:1');
  });
});
