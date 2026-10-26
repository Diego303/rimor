import { type Elemento, hashOriginal, isoConZona } from '@rimor/formato';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { crearCapturador } from '../../captura/flujo';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { haceMinutos } from '../../pruebas/fechas';
import { ContextoVersion } from '../ContextoVersion';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizar } from './analisis';
import { lectorJson, tituloDe } from './lector';
import VistaJson from './Vista';

const TOML = `[gateway]
client = "ureq"
stream_timeout_ms = 30000

[[servers]]
name = "alpha"
ip = "10.0.0.1"
`;

function json(n: number, original: string, cambios: Partial<Elemento['frontmatter']> = {}): Elemento {
  const base = elementoFalso(n, original, 'json');
  return {
    ...base,
    frontmatter: { ...base.frontmatter, tipo: 'json', ref: `JSN-${String(n).padStart(4, '0')}` as never, ...cambios },
  };
}

async function montar(el: Elemento, anterior?: { version: number; original: string }) {
  const datos = await lectorJson.derivar(el);
  const vista = <VistaJson el={el} datos={datos} editable />;
  return render(anterior ? <ContextoVersion.Provider value={anterior}>{vista}</ContextoVersion.Provider> : vista);
}

describe('vista de JSON, YAML y TOML', () => {
  afterEach(() => cleanup());

  it('árbol: el primer nivel a la vista, plegar y abrir, elegir una clave y su ruta para copiar', async () => {
    const { container } = await montar(json(1, TOML));
    const arbol = container.querySelector('.arbol-json') as HTMLElement;
    expect([...arbol.querySelectorAll(':scope > li > .arbol-fila .arbol-clave')].map((b) => b.textContent)).toEqual([
      'gateway',
      'servers',
    ]);
    expect(within(arbol).getByText('2 claves')).toBeTruthy();
    expect(screen.getByText('Elige una clave del árbol para ver su ruta.')).toBeTruthy();
    const abrir = screen.getByRole('button', { name: 'Abrir gateway' });
    fireEvent.click(abrir);
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    expect(within(arbol).getByText('"ureq"').className).toContain('v-texto');
    expect(within(arbol).getByText('30000').className).toContain('v-numero');
    fireEvent.click(screen.getByRole('button', { name: 'stream_timeout_ms' }));
    expect(screen.getByLabelText('Ruta del valor elegido').textContent).toBe('gateway.stream_timeout_ms');
    expect(screen.getByRole('button', { name: 'stream_timeout_ms' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    // Una lista: sus elementos por posición.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir servers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'ip' }));
    expect(screen.getByLabelText('Ruta del valor elegido').textContent).toBe('servers[0].ip');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar gateway' }));
    expect(within(arbol).queryByText('"ureq"')).toBeNull();
  });

  it('una lista larga se pinta de 100 en 100', async () => {
    const lista = JSON.stringify(Array.from({ length: 230 }, (_, i) => ({ id: i })));
    const { container } = await montar(json(2, lista));
    const filas = () => container.querySelectorAll('.arbol-json > li > .arbol-fila').length;
    expect(filas()).toBe(100);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar 100 más' }));
    expect(filas()).toBe(200);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar 30 más' }));
    expect(filas()).toBe(230);
  });

  it('esquema inferido: cada ruta con su tipo', async () => {
    const { container } = await montar(json(3, TOML));
    const filas = [...container.querySelectorAll('.tabla-esquema-json tbody tr')].map((f) =>
      [...f.querySelectorAll('td')].map((c) => c.textContent),
    );
    expect(filas).toContainEqual(['gateway.stream_timeout_ms', 'número']);
    expect(filas).toContainEqual(['servers', 'lista de 1 elemento']);
    expect(filas).toContainEqual(['servers[].ip', 'texto']);
  });

  it('cambios frente a la versión anterior, si la pantalla la da', async () => {
    const { container } = await montar(json(4, TOML.replace('30000', '60000')), { version: 1, original: TOML });
    expect(screen.getByText('Cambios frente a la versión 1')).toBeTruthy();
    expect([...container.querySelectorAll('.tabla-cambios-json tbody td')].map((c) => c.textContent)).toEqual([
      'gateway.stream_timeout_ms',
      '30000',
      '60000',
    ]);
    cleanup();
    await montar(json(5, TOML), { version: 2, original: TOML });
    expect(screen.getByText('Ninguna clave cambia frente a la versión 2.')).toBeTruthy();
  });

  it('un original que ya no se lee: el aviso y el texto tal cual', async () => {
    await montar(json(6, 'clave: [sin cerrar'));
    expect(
      screen.getByText('Este texto no se lee como JSON, YAML ni TOML. Puedes corregirlo o cambiarle el tipo.'),
    ).toBeTruthy();
    expect(screen.getByText('clave: [sin cerrar')).toBeTruthy();
  });
});

describe('capturar una configuración otra vez', () => {
  beforeAll(async () => {
    await import('../../rutas/inicio/Inicio');
  }, 120_000);
  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    useCompositor.setState({ versiones: [], busquedas: [] });
  });

  /** Una configuración de verdad (con el título que le pondría el lector): cambiar dos valores la deja muy parecida. */
  const GATEWAY = `[gateway]
client = "ureq"
stream_timeout_ms = 30000
connect_timeout_ms = 2000
retries = 3
backoff_ms = 250
user_agent = "rimor-gateway/0.4"

[gateway.tls]
verify = true
ca_file = "/etc/ssl/certs/ca.pem"

[gateway.pool]
max_idle = 16
idle_timeout_s = 90
`;

  it('se guarda como versión y el mensaje dice las claves que cambian', async () => {
    const TOML = GATEWAY;
    const a = analizar(TOML);
    const creado = isoConZona(haceMinutos(60 * 24 * 3));
    const anterior = json(7, TOML, {
      titulo: a ? tituloDe(a.formato, a.valor) : '',
      creado,
      modificado: creado,
      hash: hashOriginal(TOML),
      lector: { nombre: 'json', version: 1, resumen: { formato: 'toml', claves: 13 } },
    });
    const { espacio } = await montarApp('/', [anterior]);
    await screen.findByRole('button', { name: anterior.frontmatter.titulo }, PRIMERA_CARGA);
    const capturador = crearCapturador({ repositorio: espacio.repositorio, registro: REGISTRO });
    const nueva = TOML.replace('"ureq"', '"reqwest"').replace('30000', '60000');
    await act(async () => {
      const r = await capturador.capturar({ texto: nueva, origen: 'pegado' });
      if (!r.ok || r.valor.tipo !== 'version') throw new Error('esperaba una versión');
      useCompositor.getState().anotarVersion({ ...r.valor, en: isoConZona(new Date()) });
    });
    const frase = await screen.findByText(/^TOML con 13 claves\. Frente a la versión del /, {}, ESCRITURA);
    expect(frase.textContent).toMatch(/cambian 2: client y stream_timeout_ms\.$/);
    expect(screen.getByRole('button', { name: 'Ver cambios' })).toBeTruthy();
  }, 60_000);
});

describe('veredicto de la comparación', () => {
  afterEach(() => cleanup());

  it('avisa con cuántas claves cambian; si ninguna, las dos son iguales', async () => {
    const { VeredictoJson } = await import('../../rutas/comparacion/VistaJson');
    const { container } = render(<VeredictoJson r={{ anadidas: 1, quitadas: 0, cambiadas: 2 }} />);
    expect(container.querySelector('.verdict')?.className).toContain('warn');
    expect(container.textContent).toContain('3 claves cambian');
    expect(container.textContent).toContain('1 añadida · 0 quitadas · 2 cambiadas');
    cleanup();
    const iguales = render(<VeredictoJson r={{ anadidas: 0, quitadas: 0, cambiadas: 0 }} />);
    expect(iguales.container.querySelector('.verdict')?.className).toContain('ok');
    expect(iguales.container.textContent).toContain('Las dos tienen las mismas claves y valores');
  });
});

describe('revisión de IN-045: la vista', () => {
  afterEach(() => cleanup());

  it('los cambios de versión, primero y abiertos, aunque la anterior no tenga forma de configuración', async () => {
    const { container } = await montar(json(20, '- uno\n- tres\n'), { version: 1, original: '- uno\n- dos\n' });
    const plegable = screen.getByText('Cambios frente a la versión 1').closest('details');
    expect(plegable?.open).toBe(true);
    expect(container.firstElementChild).toBe(plegable);
    expect([...container.querySelectorAll('.tabla-cambios-json tbody td')].map((c) => c.textContent)).toEqual([
      '[1]',
      '"dos"',
      '"tres"',
    ]);
  });

  it('una hoja enorme se recorta en el árbol; el esquema recortado lo dice', async () => {
    const largo = JSON.stringify({ blob: 'x'.repeat(5000), n: 1 });
    const { container } = await montar(json(21, largo));
    const hoja = container.querySelector('.arbol-valor.v-texto') as HTMLElement;
    expect(hoja.textContent?.length).toBe(200);
    cleanup();
    await montar(json(22, JSON.stringify(Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`k${i}`, i])))));
    expect(screen.getByText('Se enseñan las primeras 500 rutas.')).toBeTruthy();
  });
});
