import { describe, expect, it, vi } from 'vitest';
import { describir, ESPERA_SECUENCIA_MS, esControlInteractivo, GestorAtajos } from './atajos';

describe('describir', () => {
  it('normaliza teclas y modificadores', () => {
    expect(describir({ key: 'j' })).toBe('j');
    expect(describir({ key: '?', shiftKey: true })).toBe('?');
    expect(describir({ key: 'E', ctrlKey: true })).toBe('ctrl+e');
    expect(describir({ key: 'C', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+c');
    expect(describir({ key: ' ', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+space');
    expect(describir({ key: 'k', metaKey: true })).toBe('ctrl+k');
    expect(describir({ key: 'Enter' })).toBe('enter');
  });
});

describe('GestorAtajos', () => {
  it('ejecuta atajos simples y con modificadores', () => {
    const g = new GestorAtajos();
    const buscar = vi.fn();
    const exportar = vi.fn();
    g.registrar('global', [
      { teclas: '/', descripcion: 'atajos.buscar', accion: buscar },
      { teclas: 'Ctrl+E', descripcion: 'atajos.ayuda', accion: exportar },
    ]);
    expect(g.pulsar({ key: '/' })).toBe(true);
    expect(g.pulsar({ key: 'e', ctrlKey: true })).toBe(true);
    expect(g.pulsar({ key: 'x' })).toBe(false);
    expect(buscar).toHaveBeenCalledOnce();
    expect(exportar).toHaveBeenCalledOnce();
  });

  it('secuencias «g + letra» dentro del tiempo de espera', () => {
    let ahora = 0;
    const g = new GestorAtajos(() => ahora);
    const inicio = vi.fn();
    g.registrar('global', [{ teclas: 'g h', descripcion: 'atajos.irInicio', accion: inicio }]);
    expect(g.pulsar({ key: 'g' })).toBe(true);
    expect(g.pulsar({ key: 'h' })).toBe(true);
    expect(inicio).toHaveBeenCalledOnce();
    g.pulsar({ key: 'g' });
    ahora += ESPERA_SECUENCIA_MS + 1;
    expect(g.pulsar({ key: 'h' })).toBe(false);
    expect(inicio).toHaveBeenCalledOnce();
  });

  it('en un campo de texto solo atiende los atajos con modificador o marcados', () => {
    const g = new GestorAtajos();
    const j = vi.fn();
    const enfocar = vi.fn();
    const enviar = vi.fn();
    g.registrar('global', [
      { teclas: 'j', descripcion: 'atajos.ayuda', accion: j },
      { teclas: 'ctrl+shift+space', descripcion: 'atajos.ayuda', accion: enfocar },
      { teclas: 'escape', descripcion: 'atajos.ayuda', accion: enviar, enCampos: true },
    ]);
    expect(g.pulsar({ key: 'j', enCampo: true })).toBe(false);
    expect(g.pulsar({ key: ' ', ctrlKey: true, shiftKey: true, enCampo: true })).toBe(true);
    expect(g.pulsar({ key: 'Escape', enCampo: true })).toBe(true);
    expect(j).not.toHaveBeenCalled();
  });

  it('los atajos de pantalla ganan a los globales y se dan de baja', () => {
    const g = new GestorAtajos();
    const global = vi.fn();
    const pantalla = vi.fn();
    g.registrar('global', [{ teclas: 'j', descripcion: 'atajos.ayuda', accion: global }]);
    const baja = g.registrar('inicio', [{ teclas: 'j', descripcion: 'atajos.ayuda', accion: pantalla }]);
    g.pulsar({ key: 'j' });
    expect(pantalla).toHaveBeenCalledOnce();
    baja();
    g.pulsar({ key: 'j' });
    expect(global).toHaveBeenCalledOnce();
    expect(g.lista().map((x) => x.ambito)).toEqual(['global']);
  });

  it('ignora la pulsación de un modificador solo', () => {
    const g = new GestorAtajos();
    g.registrar('global', [{ teclas: 'g h', descripcion: 'atajos.irInicio', accion: vi.fn() }]);
    expect(g.pulsar({ key: 'Shift', shiftKey: true })).toBe(false);
  });
});

describe('atajos condicionados', () => {
  it('con `cuando` falso no se atienden y la tecla sigue su camino', () => {
    const g = new GestorAtajos();
    let puede = false;
    let abiertos = 0;
    g.registrar('inicio', [
      { teclas: 'enter', descripcion: 'atajos.ayuda', accion: () => abiertos++, cuando: () => puede },
    ]);
    expect(g.pulsar({ key: 'Enter' })).toBe(false);
    puede = true;
    expect(g.pulsar({ key: 'Enter' })).toBe(true);
    expect(abiertos).toBe(1);
  });

  it('controles que ya hacen algo con Enter', () => {
    // Elementos mínimos (estas pruebas corren sin DOM).
    const el = (tagName: string, atributos: Record<string, string> = {}) =>
      ({
        tagName,
        isContentEditable: false,
        hasAttribute: (a: string) => a in atributos,
        getAttribute: (a: string) => atributos[a] ?? null,
      }) as unknown as Element;
    const boton = el('BUTTON');
    const enlace = el('A', { href: '#/x' });
    const articulo = el('ARTICLE');
    const conRol = el('DIV', { role: 'button' });
    expect([boton, enlace, conRol].every(esControlInteractivo)).toBe(true);
    expect(esControlInteractivo(articulo)).toBe(false);
    expect(esControlInteractivo(null)).toBe(false);
  });
});

describe('acciones de la paleta', () => {
  it('sin teclas: no se disparan con el teclado ni salen en la ayuda, pero sí en la paleta', () => {
    const g = new GestorAtajos();
    const ajustes = vi.fn();
    g.registrar('global', [
      { descripcion: 'atajos.irAjustes', accion: ajustes },
      { teclas: 'g h', descripcion: 'atajos.irInicio', accion: vi.fn() },
    ]);
    expect(g.pulsar({ key: 'a' })).toBe(false);
    expect(g.lista()[0]?.atajos.map((a) => a.descripcion)).toEqual(['atajos.irInicio']);
    expect(g.acciones().map((a) => a.atajo.descripcion)).toEqual(['atajos.irAjustes', 'atajos.irInicio']);
  });

  it('la pantalla antes que lo global, sin `enPaleta: false` ni lo que ahora no se puede, una por descripción', () => {
    const g = new GestorAtajos();
    const comparar = vi.fn();
    let seleccion = false;
    g.registrar('global', [{ teclas: '?', descripcion: 'atajos.ayuda', accion: vi.fn() }]);
    g.registrar('inicio', [
      { teclas: 'j', descripcion: 'atajos.feedSiguiente', enPaleta: false, accion: vi.fn() },
      { teclas: 'e', descripcion: 'atajos.feedArchivar', cuando: () => seleccion, accion: vi.fn() },
      { teclas: 'delete', descripcion: 'atajos.elementoPapelera', accion: vi.fn() },
      { teclas: '#', descripcion: 'atajos.elementoPapelera', accion: vi.fn() },
      { teclas: 'ctrl+shift+c', descripcion: 'atajos.feedComparar', ofrecer: () => seleccion, accion: comparar },
    ]);
    // `ofrecer` solo cuenta para la paleta: la tecla sigue atendiéndose.
    expect(g.pulsar({ key: 'C', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(comparar).toHaveBeenCalledOnce();
    const ver = () => g.acciones().map(({ ambito, atajo }) => `${ambito}:${atajo.descripcion}:${atajo.teclas}`);
    expect(ver()).toEqual(['inicio:atajos.elementoPapelera:delete', 'global:atajos.ayuda:?']);
    seleccion = true;
    expect(ver()).toEqual([
      'inicio:atajos.feedArchivar:e',
      'inicio:atajos.elementoPapelera:delete',
      'inicio:atajos.feedComparar:ctrl+shift+c',
      'global:atajos.ayuda:?',
    ]);
  });
});
