/**
 * Vista del lector JSON, YAML y TOML (IN-045): el árbol plegable en mono (como `.tree` de la referencia), con la ruta
 * del valor elegido y «Copiar»; el esquema inferido y, en la pantalla del elemento, los cambios frente a su versión
 * anterior. La referencia no dibuja esta pantalla: se compone con sus piezas (tarjetas, plegables, tablas).
 */
import { useContext, useMemo, useState } from 'react';
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
  type Segmento,
  tipoDe,
  totalCambios,
  type ValorJson,
} from './analisis';
import { type DatosJson, lectorJson, nombreFormato } from './lector';
import { TablaCambiosJson } from './TablaCambios';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** Los hijos de una lista o un mapa se pintan de tantos en tantos. */
export const POR_TANDA = 100;

/** Los hijos de un valor (`null` si es una hoja): de una lista, por su posición; de un mapa, por su clave. */
const hijosDe = (v: ValorJson): [Segmento, ValorJson][] | null =>
  Array.isArray(v) ? v.map((x, i) => [i, x]) : esMapa(v) ? Object.entries(v) : null;

interface PropsNodo {
  segmento: Segmento;
  valor: ValorJson;
  segmentos: Segmento[];
  elegida: string | null;
  alElegir: (ruta: string) => void;
  t: T;
}

function Nodo({ segmento, valor, segmentos, elegida, alElegir, t }: PropsNodo) {
  const [abierto, setAbierto] = useState(false);
  const [mostrados, setMostrados] = useState(POR_TANDA);
  const hijos = hijosDe(valor);
  const ruta = rutaDe(segmentos);
  const etiqueta = String(segmento);
  return (
    <li>
      <div className="arbol-fila">
        {hijos ? (
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
          className={clases('arbol-clave', typeof segmento === 'number' && 'indice')}
          aria-pressed={elegida === ruta}
          onClick={() => alElegir(ruta)}
        >
          {etiqueta}
        </button>
        {hijos ? (
          <span className="faint">
            {Array.isArray(valor) ? t('elementos', { n: hijos.length }) : t('clavesHijas', { n: hijos.length })}
          </span>
        ) : (
          <span className={`arbol-valor v-${tipoDe(valor)}`}>{JSON.stringify(valor)}</span>
        )}
      </div>
      {hijos && abierto && (
        <Hijos
          hijos={hijos}
          segmentos={segmentos}
          mostrados={mostrados}
          alMostrarMas={() => setMostrados((m) => m + POR_TANDA)}
          elegida={elegida}
          alElegir={alElegir}
          t={t}
        />
      )}
    </li>
  );
}

function Hijos({
  hijos,
  segmentos,
  mostrados,
  alMostrarMas,
  elegida,
  alElegir,
  t,
  raiz = false,
}: {
  hijos: [Segmento, ValorJson][];
  segmentos: Segmento[];
  mostrados: number;
  alMostrarMas: () => void;
  elegida: string | null;
  alElegir: (ruta: string) => void;
  t: T;
  raiz?: boolean;
}) {
  const resto = hijos.length - mostrados;
  return (
    <ul className={raiz ? 'arbol-json' : undefined}>
      {hijos.slice(0, mostrados).map(([s, v]) => (
        <Nodo
          key={String(s)}
          segmento={s}
          valor={v}
          segmentos={[...segmentos, s]}
          elegida={elegida}
          alElegir={alElegir}
          t={t}
        />
      ))}
      {resto > 0 && (
        <li>
          <Boton pequeno onClick={alMostrarMas}>
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
  const [mostrados, setMostrados] = useState(POR_TANDA);
  const hijos = hijosDe(valor);
  return (
    <Tarjeta titulo={t('arbol')}>
      {hijos ? (
        <Hijos
          hijos={hijos}
          segmentos={[]}
          mostrados={mostrados}
          alMostrarMas={() => setMostrados((m) => m + POR_TANDA)}
          elegida={elegida}
          alElegir={setElegida}
          t={t}
          raiz
        />
      ) : (
        <p className={`mono sm arbol-valor v-${tipoDe(valor)}`}>{JSON.stringify(valor)}</p>
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
    const a = analizar(anterior.original, nombre);
    return a ? compararValores(a.valor, datos.valor) : undefined;
  }, [anterior, nombre, datos.valor]);
  if (!anterior) return null;
  return (
    <Detalles resumen={t('cambiosVersion', { n: anterior.version })}>
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
  const t = textos.t.bind(textos, idioma) as unknown as T;
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
      <Arbol valor={datos.valor} t={t} />
      {comparar && (
        <div className="row">
          <Boton variante="primario" pequeno onClick={comparar}>
            {tg('pantallas.comparacion.crear.conJson')}
          </Boton>
        </div>
      )}
      <Esquema esquema={datos.esquema} t={t} />
      <CambiosVersion datos={datos} nombre={nombre} t={t} />
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifrasDe(lectorJson, datos)} />
    </>
  );
}
