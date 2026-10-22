/**
 * Buscar (BUS-01, BUS-02; como `SC.buscar` de la referencia): una caja en mono con la consulta (también en la
 * dirección, `?q=`), unos filtros rápidos sacados de lo que hay y «Limpiar»; los resultados agrupados por tipo,
 * con lo que casa resaltado y «coincide dentro» si solo casa en el contenido; y «Afinar», plegado, con las
 * facetas de los resultados. Abrir un resultado cuenta una búsqueda con resultado abierto (IN-016).
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useBuscar, useContarAbierto, useEstadoBusqueda } from '../../busqueda/Busqueda';
import type { Facetas, ResultadoBusqueda } from '../../busqueda/motor';
import { Resaltado } from '../../busqueda/Resaltado';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, Detalles, FilaElemento, Vacio } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';
import { Senal } from '../../ui/marca/Senal';
import { useEsperaVisible } from '../../ui/marca/useEsperaVisible';
import { Pantalla } from '../Pantalla';

/** Añade la pieza a la consulta o, si ya está, la quita. */
export function alternarPieza(q: string, pieza: string): string {
  const piezas = q.split(/\s+/).filter(Boolean);
  return piezas.includes(pieza) ? piezas.filter((p) => p !== pieza).join(' ') : [...piezas, pieza].join(' ');
}

/**
 * Los filtros rápidos, de lo que hay en el espacio: los dos tipos más frecuentes, la colección y la etiqueta más
 * usadas, y excluir la segunda etiqueta.
 */
function useFiltrosRapidos(): string[] {
  const espacio = useEspacioOpcional();
  const [filtros, setFiltros] = useState<string[]>([]);
  useEffect(() => {
    if (!espacio) return undefined;
    const calcular = () => {
      const cuenta = (valores: string[]) => {
        const n = new Map<string, number>();
        for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1);
        return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
      };
      const elementos = espacio.repositorio.elementos();
      const tipos = cuenta(elementos.map((fm) => fm.tipo));
      const colecciones = cuenta(elementos.flatMap((fm) => fm.colecciones ?? []));
      const etiquetas = cuenta(elementos.flatMap((fm) => (fm.etiquetas ?? []).map((e) => e.toLocaleLowerCase())));
      const lista = [
        ...tipos.slice(0, 1).map((t) => `tipo:${t}`),
        ...colecciones.slice(0, 1).map((c) => `en:${c}`),
        ...etiquetas.slice(0, 1).map((e) => `#${e}`),
        ...tipos.slice(1, 2).map((t) => `tipo:${t}`),
        ...etiquetas.slice(1, 2).map((e) => `-${e}`),
      ];
      setFiltros((antes) => (antes.join(' ') === lista.join(' ') ? antes : lista));
    };
    calcular();
    return espacio.alCambiar(calcular);
  }, [espacio]);
  return filtros;
}

function Faceta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <span className="lbl">{titulo}</span>
      <div className="row faceta">{children}</div>
    </div>
  );
}

function Afinar({ facetas, q, alCambiar }: { facetas: Facetas; q: string; alCambiar: (q: string) => void }) {
  const { t } = useT();
  const pieza = (clave: string, etiqueta: string, n: number) => (
    <button
      key={clave}
      type="button"
      className="pill"
      aria-pressed={q.split(/\s+/).includes(clave)}
      onClick={() => alCambiar(alternarPieza(q, clave))}
    >
      {etiqueta} <span className="faint">{n}</span>
    </button>
  );
  return (
    <Detalles resumen={t('pantallas.buscar.afinar')}>
      <div className="facetas">
        {facetas.tipos.length > 0 && (
          <Faceta titulo={t('pantallas.buscar.facetaTipo')}>
            {facetas.tipos.map(([tipo, n]) => pieza(`tipo:${tipo}`, t(`tipos.${tipo}`), n))}
          </Faceta>
        )}
        {facetas.colecciones.length > 0 && (
          <Faceta titulo={t('pantallas.buscar.facetaColeccion')}>
            {facetas.colecciones.map(([c, n]) => pieza(`en:${c}`, c, n))}
          </Faceta>
        )}
        {facetas.etiquetas.length > 0 && (
          <Faceta titulo={t('pantallas.buscar.facetaEtiqueta')}>
            {facetas.etiquetas.slice(0, 8).map(([e, n]) => pieza(`#${e}`, `#${e}`, n))}
          </Faceta>
        )}
      </div>
    </Detalles>
  );
}

/** Los resultados agrupados por tipo, en el orden del primero de cada uno. */
function agrupar(resultados: readonly ResultadoBusqueda[]): [TipoElemento, ResultadoBusqueda[]][] {
  const grupos = new Map<TipoElemento, ResultadoBusqueda[]>();
  for (const r of resultados) {
    const grupo = grupos.get(r.fm.tipo);
    if (grupo) grupo.push(r);
    else grupos.set(r.fm.tipo, [r]);
  }
  return [...grupos];
}

export function Buscar() {
  const { t, idioma } = useT();
  const { q = '' } = useSearch({ from: '/buscar' });
  const navegar = useNavigate();
  const lectores = useLectoresOpcional();
  const filtros = useFiltrosRapidos();
  const estadoIndice = useEstadoBusqueda();
  const preparando = useEsperaVisible(estadoIndice.fase !== 'listo');
  const contar = useContarAbierto();
  const [montaje] = useState(() => `${Date.now()}-${Math.random()}`);

  // La caja manda mientras se escribe; la dirección la sigue (y si cambia por fuera, la caja la adopta).
  const [texto, setTexto] = useState(q);
  const enviado = useRef(q);
  useEffect(() => {
    if (q !== enviado.current) {
      enviado.current = q;
      setTexto(q);
    }
  }, [q]);
  const cambiar = (nuevo: string) => {
    setTexto(nuevo);
    enviado.current = nuevo;
    void navegar({ to: '/buscar', search: nuevo ? { q: nuevo } : {}, replace: true });
  };

  const caja = useRef<HTMLInputElement>(null);
  useEffect(() => caja.current?.focus(), []);

  const consulta = texto.trim();
  const { busqueda } = useBuscar(consulta);
  const grupos = useMemo(() => agrupar(busqueda?.resultados ?? []), [busqueda]);

  const legible = (fm: FrontmatterComun) => {
    try {
      return lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
    } catch {
      return '';
    }
  };
  const abrir = (ref: string) => {
    contar(`buscar:${montaje}:${consulta}`);
    void navegar({ to: '/e/$ref', params: { ref } });
  };
  const terminosDe = (r: ResultadoBusqueda) => [...r.terminos, ...(busqueda?.consulta.palabras ?? [])];

  return (
    <Pantalla titulo={t('pantallas.buscar.titulo')}>
      <div className="cbox caja-buscar">
        <Icono nombre="buscar" tamano={17} />
        <input
          ref={caja}
          type="text"
          value={texto}
          onChange={(e) => cambiar(e.target.value)}
          aria-label={t('pantallas.buscar.titulo')}
          placeholder={t('pantallas.buscar.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="row">
        {filtros.map((f) => (
          <button
            key={f}
            type="button"
            className="pill"
            aria-pressed={texto.split(/\s+/).includes(f)}
            onClick={() => cambiar(alternarPieza(texto, f))}
          >
            {f}
          </button>
        ))}
        <Boton variante="fantasma" pequeno onClick={() => cambiar('')}>
          {t('pantallas.buscar.limpiar')}
        </Boton>
      </div>
      {preparando && (
        <Senal
          estado="indexando"
          etiqueta={
            estadoIndice.fase === 'indexando'
              ? t('pantallas.buscar.indexando', { hechos: estadoIndice.hechos, total: estadoIndice.total })
              : t('pantallas.buscar.preparando')
          }
        />
      )}
      <div className="resultados-busqueda" aria-live="polite">
        {!consulta ? (
          <Vacio titulo={t('pantallas.buscar.vacioTitulo')}>{t('pantallas.buscar.vacio')}</Vacio>
        ) : busqueda ? (
          <>
            <p className="sm muted">
              {busqueda.total > busqueda.resultados.length
                ? t('pantallas.buscar.algunos', { n: busqueda.resultados.length, total: busqueda.total })
                : t('pantallas.buscar.resultados', { n: busqueda.total })}
            </p>
            {grupos.length ? (
              grupos.map(([tipo, lista]) => (
                <section key={tipo} className="card grupo-busqueda" aria-label={t(`tipos.${tipo}`)}>
                  <span className="lbl">
                    {t(`tipos.${tipo}`)} · {lista.length}
                  </span>
                  <div className="list">
                    {lista.map((r) => (
                      <FilaElemento
                        key={r.fm.id}
                        fm={r.fm}
                        titulo={<Resaltado texto={r.fm.titulo} terminos={terminosDe(r)} />}
                        resumen={
                          <>
                            {r.enContenido && <span className="st">{t('pantallas.buscar.dentro')}</span>}{' '}
                            <Resaltado texto={legible(r.fm) || r.fm.ref} terminos={terminosDe(r)} />
                          </>
                        }
                        alAbrir={abrir}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <Vacio titulo={t('pantallas.buscar.sinResultados')}>{t('pantallas.buscar.sinResultadosTexto')}</Vacio>
            )}
            {grupos.length > 0 && <Afinar facetas={busqueda.facetas} q={texto} alCambiar={cambiar} />}
          </>
        ) : null}
      </div>
    </Pantalla>
  );
}
