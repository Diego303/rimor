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

  it('los enlaces relativos o sin protocolo pierden el destino; las anclas internas se quedan', () => {
    for (const md of [
      '[x](//evil.example/p)',
      '<a href="//evil.example">x</a>',
      '[x](/otra/ruta)',
      '[x](../../salir)',
    ]) {
      const { container } = render(<MarkdownSeguro texto={md} />);
      expect(container.querySelector('a')?.hasAttribute('href'), md).toBe(false);
    }
    const { container } = render(<MarkdownSeguro texto="[ir](#seccion)" />);
    // Con el prefijo de los `id`, para que casen.
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#rimor-seccion');
  });

  it('las notas al pie casan con sus destinos, en el idioma de la interfaz, y no navegan', () => {
    const { container } = render(<MarkdownSeguro texto={'Dato[^1].\n\n[^1]: La fuente.'} />);
    const llamada = container.querySelector('sup a') as HTMLAnchorElement;
    const destino = llamada.getAttribute('href')?.slice(1) ?? '';
    expect(container.querySelector(`[id="${destino}"]`)).toBeTruthy();
    expect(container.textContent).toContain('Notas');
    expect(container.querySelector('[aria-label="Volver a la referencia 1"]')).toBeTruthy();
    const hashAntes = window.location.hash;
    const clic = new MouseEvent('click', { bubbles: true, cancelable: true });
    llamada.dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(true);
    expect(window.location.hash).toBe(hashAntes);
  });

  it('sanearSvg solo admite url(#…) internas y pone prefijo a los id y a sus referencias', () => {
    const limpio = sanearSvg(
      '<svg><defs><linearGradient id="g"/><mask id="m"/></defs><rect fill="url(https://e.example/x.svg#g)" mask="url(https://e.example/m.svg#m)" clip-path="url(//e.example/c)" marker-end="url(data:x)"/><rect fill="url(#g)" mask="url(\'#m\')"/><g id="ayuda-atajos"/></svg>',
    );
    expect(limpio).not.toContain('e.example');
    expect(limpio).not.toContain('data:');
    expect(limpio).toContain('id="rimor-g"');
    expect(limpio).toContain('fill="url(#rimor-g)"');
    expect(limpio).toContain('mask="url(#rimor-m)"');
    expect(limpio).toContain('id="rimor-ayuda-atajos"');
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
    expect(limpio).toContain('href="#rimor-b"');
    expect(limpio).toContain('hola');
  });
});
