import { describe, expect, it, vi } from 'vitest';
import { describir, ESPERA_SECUENCIA_MS, GestorAtajos } from './atajos';

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
