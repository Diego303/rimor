import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarkdownSeguro from '../ui/componentes/MarkdownSeguro';
import { markdownAHast, sanearHtml, sanearSvg } from './sanear';
import { CARGAS_XSS } from './xss';

const PELIGROSO = /^(javascript|data|vbscript):/i;

/** Comprueba que un DOM pintado no puede ejecutar nada ni cargar recursos de fuera. */
function comprobarInofensivo(raiz: HTMLElement) {
  expect(raiz.querySelectorAll('script, iframe, object, embed, style, link, meta, base, form, svg, math').length).toBe(
    0,
  );
  for (const el of raiz.querySelectorAll('*')) {
    for (const atributo of el.getAttributeNames()) {
      expect(atributo.startsWith('on'), `${el.tagName} ${atributo}`).toBe(false);
      expect(atributo).not.toBe('style');
    }
    for (const a of ['href', 'src', 'action', 'data']) {
      // Sin espacios ni caracteres de control, que el navegador ignora dentro de un protocolo.
      const v = [...(el.getAttribute(a) ?? '')].filter((c) => c.charCodeAt(0) > 32).join('');
      expect(PELIGROSO.test(v), `${el.tagName} ${a}=${v}`).toBe(false);
    }
  }
  // Ninguna imagen: las remotas pasan a enlace.
  expect(raiz.querySelectorAll('img').length).toBe(0);
}

describe('MarkdownSeguro con el corpus XSS', () => {
  for (const carga of CARGAS_XSS) {
    it(carga, () => {
      const { container } = render(<MarkdownSeguro texto={`Antes\n\n${carga}\n\nDespués`} />);
      comprobarInofensivo(container);
      expect(container.textContent).toContain('Antes');
      expect(container.textContent).toContain('Después');
    });
  }
});

describe('saneado', () => {
  it('pinta bien el Markdown normal', () => {
    const { container } = render(
      <MarkdownSeguro
        texto={
          '# Título\n\n- [x] hecha\n- [ ] pendiente\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n\n[docs](https://ejemplo.org)'
        }
      />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Título');
    expect(container.querySelectorAll('input[type=checkbox]').length).toBe(2);
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('pre code')?.textContent).toContain('const x = 1;');
    const enlace = container.querySelector('a[href="https://ejemplo.org"]');
    expect(enlace?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(enlace?.getAttribute('target')).toBe('_blank');
  });

  it('una imagen remota no se carga: queda como enlace con su texto', () => {
    const arbol = markdownAHast('![píxel](https://rastreo.example/p.png)');
    expect(JSON.stringify(arbol)).not.toContain('"tagName":"img"');
    expect(JSON.stringify(arbol)).toContain('imagen-externa');
  });

  it('los id llevan prefijo para no pisar la app', () => {
    expect(JSON.stringify(sanearHtml('<p id="principal">x</p>'))).toContain('rimor-principal');
  });

  it('sanearSvg quita scripts, foreignObject, on* y enlaces externos, y conserva formas y texto', () => {
    const limpio = sanearSvg(
      '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><foreignObject><div>x</div></foreignObject><a href="https://x.example"><rect width="5" height="5" onclick="alert(1)"/></a><use href="https://x.example/s.svg#a"/><use href="#b"/><text x="1" y="9">hola</text></svg>',
    );
    expect(limpio).not.toMatch(/script|foreignObject|onload|onclick|x\.example/);
    expect(limpio).toContain('<rect');
    expect(limpio).toContain('href="#b"');
    expect(limpio).toContain('hola');
  });
});
