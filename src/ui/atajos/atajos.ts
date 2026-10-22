/**
 * Gestor de atajos de teclado (APP-01, Anexo H): registro global y por pantalla, secuencias «g + letra» y
 * respeto a los campos de texto. Es también el registro de acciones de la paleta (BUS-03): una acción es un
 * atajo, con teclas o sin ellas. TS puro: recibe teclas ya descritas, sin depender del DOM.
 */
import type { Clave } from '../../i18n/i18n';

export interface Atajo {
  /**
   * `'j'`, `'?'`, `'/'`, `'g h'` (secuencia), `'ctrl+e'`, `'ctrl+shift+space'`. Sin teclas, es una acción que solo
   * se lanza desde la paleta.
   */
  teclas?: string;
  descripcion: Clave;
  accion: () => void;
  /** Se atiende también con el foco en un campo de texto. */
  enCampos?: boolean;
  /**
   * Si devuelve `false`, el atajo no se atiende y la tecla sigue su camino (`Enter` sobre un botón lo pulsa en vez de
   * abrir lo seleccionado). Se mira en el momento de la pulsación.
   */
  cuando?: () => boolean;
  /** `false`: no sale en la paleta (mover la selección, confirmar: solo tienen sentido con su tecla). */
  enPaleta?: boolean;
  /**
   * Solo para la paleta: si devuelve `false`, ahora no se ofrece, aunque la tecla siga atendiéndose (para explicar
   * con un aviso por qué no se puede).
   */
  ofrecer?: () => boolean;
}

/** Un atajo con teclas (los que atiende el teclado y lista la ayuda). */
export type AtajoConTeclas = Atajo & { teclas: string };

export const tieneTeclas = (a: Atajo): a is AtajoConTeclas => Boolean(a.teclas);

export interface TeclaPulsada {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  /** El foco está en un campo de texto (input, textarea, select o contenteditable). */
  enCampo?: boolean;
}

export const ESPERA_SECUENCIA_MS = 1000;

/** Normaliza una tecla pulsada a la forma de `Atajo.teclas`: `ctrl+shift+space`, `?`, `j`. */
export function describir(t: TeclaPulsada): string {
  const tecla = t.key === ' ' ? 'space' : t.key.length === 1 ? t.key.toLowerCase() : t.key.toLowerCase();
  const mods = [(t.ctrlKey || t.metaKey) && 'ctrl', t.altKey && 'alt', t.shiftKey && tecla.length > 1 && 'shift'];
  // Con un carácter impreso («?», «/», «A»), la mayúscula ya va en la propia tecla.
  if (t.shiftKey && tecla.length === 1 && (t.ctrlKey || t.metaKey)) mods[2] = 'shift';
  return [...mods.filter(Boolean), tecla].join('+');
}

const normalizar = (teclas: string) =>
  teclas
    .toLowerCase()
    .split(' ')
    .map((paso) => {
      const partes = paso.split('+');
      const tecla = partes.pop() ?? '';
      const orden = ['ctrl', 'alt', 'shift'];
      return [...orden.filter((m) => partes.includes(m)), tecla].join('+');
    })
    .join(' ');

/** Un ámbito global: `global` o `global-…` (los que registra otro componente de la carcasa). */
export const esGlobal = (ambito: string): boolean => ambito === 'global' || ambito.startsWith('global-');

/** El orden de los ámbitos: los de pantalla, `global` y después los `global-…`. */
const rango = (ambito: string) => (ambito === 'global' ? 1 : esGlobal(ambito) ? 2 : 0);

export class GestorAtajos {
  private readonly ambitos = new Map<string, Atajo[]>();
  private prefijo: string | null = null;
  private prefijoHasta = 0;

  constructor(private readonly reloj: () => number = Date.now) {}

  /** Registra atajos en un ámbito (`'global'` o el de una pantalla). Devuelve la baja. */
  registrar(ambito: string, atajos: Atajo[]): () => void {
    const normalizados = atajos.map((a) => (a.teclas ? { ...a, teclas: normalizar(a.teclas) } : a));
    this.ambitos.set(ambito, normalizados);
    return () => {
      if (this.ambitos.get(ambito) === normalizados) this.ambitos.delete(ambito);
    };
  }

  /** Atajos activos, los de pantalla antes que los globales. */
  private activos(): Atajo[] {
    return [...this.ambitos].sort(([a], [b]) => rango(a) - rango(b)).flatMap(([, v]) => v);
  }

  /** Atiende una tecla. Devuelve true si la consumió un atajo (o empezó una secuencia). */
  pulsar(t: TeclaPulsada): boolean {
    if (['shift', 'control', 'alt', 'meta'].includes(t.key.toLowerCase())) return false;
    const conModificador = Boolean(t.ctrlKey || t.metaKey || t.altKey);
    const tecla = describir(t);
    const ahora = this.reloj();
    const activos = this.activos()
      .filter(tieneTeclas)
      .filter((a) => (!t.enCampo || a.enCampos || conModificador) && (!a.cuando || a.cuando()));

    if (this.prefijo && ahora <= this.prefijoHasta) {
      const secuencia = `${this.prefijo} ${tecla}`;
      this.prefijo = null;
      const a = activos.find((x) => x.teclas === secuencia);
      if (a) {
        a.accion();
        return true;
      }
    }
    this.prefijo = null;

    const directo = activos.find((x) => x.teclas === tecla);
    if (directo) {
      directo.accion();
      return true;
    }
    if (activos.some((x) => x.teclas.startsWith(`${tecla} `))) {
      this.prefijo = tecla;
      this.prefijoHasta = ahora + ESPERA_SECUENCIA_MS;
      return true;
    }
    return false;
  }

  /** Atajos con teclas por ámbito, para la ayuda. */
  lista(): { ambito: string; atajos: AtajoConTeclas[] }[] {
    return [...this.ambitos].map(([ambito, atajos]) => ({ ambito, atajos: atajos.filter(tieneTeclas) }));
  }

  /**
   * Lo que la paleta ofrece ahora: los de la pantalla y después los globales, sin los que no van en la paleta ni
   * los que ahora no se pueden hacer (`cuando`); uno por descripción (la papelera tiene dos teclas), con la
   * primera tecla.
   */
  acciones(): { ambito: string; atajo: Atajo }[] {
    const vistas = new Set<string>();
    const lista: { ambito: string; atajo: Atajo }[] = [];
    const ordenados = [...this.ambitos].sort(([a], [b]) => rango(a) - rango(b));
    for (const [ambito, atajos] of ordenados)
      for (const atajo of atajos) {
        const ahoraNo = (atajo.cuando && !atajo.cuando()) || (atajo.ofrecer && !atajo.ofrecer());
        if (atajo.enPaleta === false || vistas.has(atajo.descripcion) || ahoraNo) continue;
        vistas.add(atajo.descripcion);
        lista.push({ ambito, atajo });
      }
    return lista;
  }
}

/** ¿El foco está en un control que ya hace algo con `Enter` o `Espacio` (botón, enlace, resumen, campo)? */
export function esControlInteractivo(el: Element | null): boolean {
  if (!el) return false;
  if (esCampoDeTexto(el)) return true;
  const etiqueta = el.tagName;
  if (etiqueta === 'BUTTON' || etiqueta === 'SUMMARY' || etiqueta === 'INPUT' || etiqueta === 'SELECT') return true;
  if (etiqueta === 'A' && el.hasAttribute('href')) return true;
  const rol = el.getAttribute('role');
  return rol === 'button' || rol === 'link' || rol === 'menuitem' || rol === 'tab' || rol === 'checkbox';
}

/** ¿El elemento con el foco es un campo de texto? */
export function esCampoDeTexto(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  const etiqueta = el.tagName;
  if (etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return true;
  if (etiqueta !== 'INPUT') return false;
  const tipo = (el as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(tipo);
}
