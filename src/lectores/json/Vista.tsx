/**
 * Vista del lector JSON, YAML y TOML (IN-045): el árbol plegable en mono (como `.tree` de la referencia), con la ruta
 * del valor elegido y «Copiar»; el esquema inferido y, en la pantalla del elemento, los cambios frente a su versión
 * anterior. La referencia no dibuja esta pantalla: se compone con sus piezas (tarjetas, plegables, tablas).
 */
import { memo, useContext, useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import { clases } from '../../ui/clases';
import { Banner, Boton, Detalles, Tarjeta } from '../../ui/componentes';
import { ContextoComparar } from '../ContextoComparar';
import { ContextoVersion } from '../ContextoVersion';
import { CopiarTexto } from '../CopiarConValores';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import {
  analizar,
  compararValores,
  type EntradaEsquema,
  esMapa,
  MAX_ESQUEMA,
  rutaDe,
  tipoDe,
  totalCambios,
  type ValorJson,
} from './analisis';
import { type DatosJson, lectorJson, nombreFormato } from './lector';
import { TablaCambiosJson } from './TablaCambios';
import { textos } from './textos';
import { valorCorto } from './valores';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Los hijos de una lista o un mapa se pintan de tantos en tantos. */
export const POR_TANDA = 100;
/** Largo máximo de una hoja en el árbol (un texto en base64 de varios MB no va entero al DOM). */
const LARGO_HOJA = 200;

/** Un paso del árbol: la clave de un mapa o la posición en una lista. */
type Paso = string | number;

/** Cuántos hijos tiene un valor (`null` si es una hoja). */
const cuantosHijos = (v: ValorJson): number | null =>
  Array.isArray(v) ? v.length : esMapa(v) ? Object.keys(v).length : null;

/** Los hijos que se pintan: los primeros `n`, sin recorrer el resto. */
function primerosHijos(v: ValorJson, n: number): [Paso, ValorJson][] {
  if (Array.isArray(v)) return v.slice(0, n).map((x, i) => [i, x]);
  return esMapa(v)
    ? Object.keys(v)
        .slice(0, n)
        .map((k) => [k, v[k] ?? null])
    : [];
}

/** ¿Cambia algo de este nodo (o de los de dentro) si la elegida es `e`? */
const afecta = (e: string | null, ruta: string) =>
  e !== null && (e === ruta || e.startsWith(`${ruta}.`) || e.startsWith(`${ruta}[`));

interface PropsNodo {
  paso: Paso;
  valor: ValorJson;
  pasos: Paso[];
  ruta: string;
  elegida: string | null;
  alElegir: (ruta: string) => void;
  t: T;
}

/**
 * Un nodo del árbol. Memorizado: al elegir una clave solo se vuelven a pintar los nodos de la elegida de antes y de
 * la de ahora (con un JSON grande abierto, no todos).
 */
const Nodo = memo(
  function Nodo({ paso, valor, pasos, ruta, elegida, alElegir, t }: PropsNodo) {
    const [abierto, setAbierto] = useState(false);
    const n = cuantosHijos(valor);
    const etiqueta = String(paso);
    return (
      <li>
        <div className="arbol-fila">
          {n !== null ? (
            <button
              type="button"
              className="arbol-plegar"
              aria-expanded={abierto}
              aria-label={t(abierto ? 'cerrar' : 'abrir', { clave: etiqueta })}
              onClick={() => setAbierto((a) => !a)}
            />
          ) : (
            <span className="arbol-hueco" />
          )}
          <button
            type="button"
            className={clases('arbol-clave', typeof paso === 'number' && 'indice')}
            aria-pressed={elegida === ruta}
            onClick={() => alElegir(ruta)}
          >
            {etiqueta}
          </button>
          {n !== null ? (
            <span className="faint">{Array.isArray(valor) ? t('elementos', { n }) : t('clavesHijas', { n })}</span>
          ) : (
            <span className={`arbol-valor v-${tipoDe(valor)}`}>{valorCorto(valor, LARGO_HOJA)}</span>
          )}
        </div>
        {n !== null && abierto && <Hijos valor={valor} pasos={pasos} elegida={elegida} alElegir={alElegir} t={t} />}
      </li>
    );
  },
  (a, b) =>
    a.valor === b.valor &&
    a.ruta === b.ruta &&
    a.t === b.t &&
    a.alElegir === b.alElegir &&
    !afecta(a.elegida, a.ruta) &&
    !afecta(b.elegida, b.ruta),
);

function Hijos({
  valor,
  pasos,
  elegida,
  alElegir,
  t,
  raiz = false,
}: {
  valor: ValorJson;
  pasos: Paso[];
  elegida: string | null;
  alElegir: (ruta: string) => void;
  t: T;
  raiz?: boolean;
}) {
  const [mostrados, setMostrados] = useState(POR_TANDA);
  const hijos = useMemo(() => primerosHijos(valor, mostrados), [valor, mostrados]);
  const resto = (cuantosHijos(valor) ?? 0) - hijos.length;
  return (
    <ul className={raiz ? 'arbol-json' : undefined}>
      {hijos.map(([p, v]) => {
        const camino = [...pasos, p];
        return (
          <Nodo
            key={String(p)}
            paso={p}
            valor={v}
            pasos={camino}
            ruta={rutaDe(camino)}
            elegida={elegida}
            alElegir={alElegir}
            t={t}
          />
        );
      })}
      {resto > 0 && (
        <li>
          <Boton pequeno onClick={() => setMostrados((m) => m + POR_TANDA)}>
            {t('mostrarMas', { n: Math.min(resto, POR_TANDA) })}
          </Boton>
        </li>
      )}
    </ul>
  );
}

/** El árbol y, debajo, la ruta del valor elegido con «Copiar». */
function Arbol({ valor, t }: { valor: ValorJson; t: T }) {
  const [elegida, setElegida] = useState<string | null>(null);
  return (
    <Tarjeta titulo={t('arbol')}>
      {cuantosHijos(valor) !== null ? (
        <Hijos valor={valor} pasos={[]} elegida={elegida} alElegir={setElegida} t={t} raiz />
      ) : (
        <p className={`mono sm arbol-valor v-${tipoDe(valor)}`}>{valorCorto(valor, LARGO_HOJA)}</p>
      )}
      <div className="arbol-ruta">
        <span className="xs muted">{t('ruta')}</span>
        {elegida ? (
          <>
            <output className="mono sm" aria-label={t('rutaElegida')}>
              {elegida}
            </output>
            <CopiarTexto
              texto={elegida}
              textos={{
                titulo: t('ruta'),
                copiar: t('copiar'),
                copiado: t('copiada'),
                noCopiado: t('noCopiada'),
                textoListo: t('rutaLista'),
              }}
            />
          </>
        ) : (
          <span className="xs faint">{t('sinRuta')}</span>
        )}
      </div>
    </Tarjeta>
  );
}

/** «texto», «número o nulo», «lista de 3 elementos». */
function tipoLegible(e: EntradaEsquema, t: T): string {
  const tipos = e.tipos.map((x) => t(`tipos.${x}`)).join(t('o'));
  return e.elementos !== undefined && e.tipos.length === 1 ? t('deElementos', { tipo: tipos, n: e.elementos }) : tipos;
}

function Esquema({ esquema, t }: { esquema: EntradaEsquema[]; t: T }) {
  return (
    <Detalles resumen={t('esquema')} recuento={esquema.length}>
      <div className="tbl-wrap">
        <table className="tabla-esquema-json">
          <thead>
            <tr>
              <th>{t('esquemaRuta')}</th>
              <th>{t('esquemaTipo')}</th>
            </tr>
          </thead>
          <tbody>
            {esquema.map((e) => (
              <tr key={e.ruta}>
                <td className="mono xs">{e.ruta}</td>
                <td className="xs">{tipoLegible(e, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {esquema.length >= MAX_ESQUEMA && <p className="xs muted">{t('esquemaRecortado', { n: MAX_ESQUEMA })}</p>}
    </Detalles>
  );
}

/** Los cambios frente a la versión anterior, si la pantalla la da. */
function CambiosVersion({ datos, nombre, t }: { datos: DatosJson; nombre: string; t: T }) {
  const anterior = useContext(ContextoVersion);
  const { idioma } = useT();
  const cambios = useMemo(() => {
    if (!anterior) return null;
    // Como al derivar: lo que ya se guardó como configuración se lee aunque no tenga su forma.
    const a = analizar(anterior.original, nombre, { estricto: false });
    return a ? compararValores(a.valor, datos.valor) : undefined;
  }, [anterior, nombre, datos.valor]);
  if (!anterior) return null;
  return (
    // Abierto: es a lo que lleva «Ver cambios» desde el mensaje de la versión.
    <Detalles resumen={t('cambiosVersion', { n: anterior.version })} abierto>
      {cambios === undefined || cambios === null ? (
        <p className="sm muted">
          {t('versionIlegible', { n: anterior.version, formato: nombreFormato(datos.formato, idioma) })}
        </p>
      ) : totalCambios(cambios) ? (
        <TablaCambiosJson d={cambios} />
      ) : (
        <p className="sm muted">{t('sinCambiosVersion', { n: anterior.version })}</p>
      )}
    </Detalles>
  );
}

export default function VistaJson({ el, datos }: PropsVista<DatosJson>) {
  const { idioma, t: tg } = useT();
  // Estable mientras no cambie el idioma: los nodos del árbol están memorizados.
  const t = useMemo(() => textos.t.bind(textos, idioma) as unknown as T, [idioma]);
  const comparar = useContext(ContextoComparar);
  const nombre = el.frontmatter.adjunto?.nombre ?? el.frontmatter.titulo;
  if (datos.ilegible)
    return (
      <>
        <Banner>{t('ilegible')}</Banner>
        <pre className="code">{el.original ?? ''}</pre>
        <DetallesElemento refe={el.frontmatter.ref} />
      </>
    );
  return (
    <>
      <CambiosVersion datos={datos} nombre={nombre} t={t} />
      <Arbol valor={datos.valor} t={t} />
      {comparar && (
        <div className="row">
          <Boton variante="primario" pequeno onClick={comparar}>
            {tg('pantallas.comparacion.crear.conJson')}
          </Boton>
        </div>
      )}
      <Esquema esquema={datos.esquema} t={t} />
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifrasDe(lectorJson, datos)} />
    </>
  );
}
