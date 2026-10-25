/**
 * «Copiar con valores» (IN-023, IN-043): una caja por hueco (las variables de un prompt, los `{{x}}` de un comando),
 * con los valores recordados en este navegador para ese elemento; copia el texto con ellos al portapapeles o, si el
 * navegador no deja, lo deja a la vista y seleccionado para Ctrl+C. Lo usan el Prompt y el Comando.
 */
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { Boton, Tarjeta } from '../ui/componentes';
import { useAvisosOpcional } from '../ui/componentes/Avisos';

/** Clave de los valores recordados: de este navegador, de este espacio y de este elemento. */
const claveValores = (ambito: string, espacio: string, id: string) => `rimor:${espacio}:${ambito}:${id}`;

function leerValores(clave: string): Record<string, string> {
  try {
    const guardado = JSON.parse(globalThis.localStorage?.getItem(clave) ?? '{}') as unknown;
    if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return {};
    return Object.fromEntries(Object.entries(guardado).filter(([, v]) => typeof v === 'string')) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function guardarValores(clave: string, valores: Record<string, string>): void {
  try {
    const conAlgo = Object.fromEntries(Object.entries(valores).filter(([, v]) => v));
    if (Object.keys(conAlgo).length) globalThis.localStorage?.setItem(clave, JSON.stringify(conAlgo));
    else globalThis.localStorage?.removeItem(clave);
  } catch {
    // Sin almacenamiento del navegador (ventana privada estricta): los valores duran lo que la vista.
  }
}

/** Copia al portapapeles; `false` si el navegador no deja (sin permiso, sin contexto seguro, sin API). */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) return false;
    await globalThis.navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export interface TextosCopiar {
  titulo: string;
  copiar: string;
  copiado: string;
  noCopiado: string;
  /** El nombre del cuadro con el texto listo para copiar a mano. */
  textoListo: string;
}

interface Props {
  /** De qué es (`prompt`, `comando`): separa los valores recordados de cada lector. */
  ambito: string;
  idElemento: string;
  /** El texto con sus huecos sin rellenar. */
  texto: string;
  /** Los huecos como se escriben (`{{baseline}}`), en su orden y sin repetir. */
  huecos: readonly string[];
  /** El texto con los valores puestos (los huecos sin valor se dejan como están). */
  sustituir: (texto: string, valores: Readonly<Record<string, string>>) => string;
  textos: TextosCopiar;
  /** Lo que va junto al botón (la valoración media de un prompt). */
  pie?: ReactNode;
}

export function CopiarConValores({ ambito, idElemento, texto, huecos, sustituir, textos, pie }: Props) {
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const clave = claveValores(ambito, espacio?.manifest.espacio.id ?? 'local', idElemento);
  const [valores, setValores] = useState<Record<string, string>>(() => leerValores(clave));
  // `vez` cambia en cada intento: si vuelve a fallar con el mismo texto, se vuelve a seleccionar.
  const [listo, setListo] = useState<{ texto: string; vez: number } | null>(null);
  const areaLista = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => setValores(leerValores(clave)), [clave]);
  // El texto listo para copiar a mano era el de otro texto (otra versión): fuera.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se descarta al cambiar el texto.
  useEffect(() => setListo(null), [texto]);
  // Si el navegador no dejó copiar, el texto queda seleccionado para Ctrl+C.
  useEffect(() => {
    if (listo !== null) areaLista.current?.select();
  }, [listo]);

  function cambiar(hueco: string, valor: string) {
    const nuevos = { ...valores, [hueco]: valor };
    setValores(nuevos);
    guardarValores(clave, nuevos);
    setListo(null);
  }

  async function copiar() {
    const conValores = sustituir(texto, valores);
    void espacio?.contadores.contar('copiasConValores').catch(() => undefined);
    if (await copiarAlPortapapeles(conValores)) {
      setListo(null);
      avisos?.avisar(textos.copiado);
    } else setListo((previo) => ({ texto: conValores, vez: (previo?.vez ?? 0) + 1 }));
  }

  return (
    <Tarjeta titulo={textos.titulo}>
      <div className="g3">
        {huecos.map((hueco, i) => (
          <label key={hueco} className="xs muted campo-variable" htmlFor={`${id}-${i}`}>
            {hueco}
            <input
              id={`${id}-${i}`}
              type="text"
              value={valores[hueco] ?? ''}
              onChange={(e) => cambiar(hueco, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <Boton variante="primario" pequeno onClick={() => void copiar()}>
          {textos.copiar}
        </Boton>
        {pie}
      </div>
      {listo !== null && (
        <div className="copia-manual">
          <p className="xs muted" role="status">
            {textos.noCopiado}
          </p>
          <textarea ref={areaLista} readOnly rows={6} aria-label={textos.textoListo} value={listo.texto} />
        </div>
      )}
    </Tarjeta>
  );
}
