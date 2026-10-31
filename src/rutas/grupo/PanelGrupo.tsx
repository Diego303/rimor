/**
 * Panel común de un grupo (VIS-04, IN-052), como la pantalla «Colección» de la referencia (`SC.coleccion`): «Qué hay»
 * (una barra por tipo), «Cuándo» (las dos últimas semanas), «Se repite» (la huella de error que más vuelve) y
 * «Elementos» (los 8 más recientes y «Ver los N»; en lista, mosaico o densa; en la lista, dos se marcan para
 * compararlos). Lo usan la pantalla de una colección y la de un grupo automático.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useState } from 'react';
import { comparables } from '../../comparaciones/clases';
import { useExportacion } from '../../datos/exportacion';
import type { SoloExportar } from '../../datos/exportar';
import { useExportar } from '../../datos/useExportar';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { type ClaseGrupo, panelDe, rutasDeGrupo } from '../../espacio/grupos';
import { useEspacio } from '../../estado/espacio';
import { hiloDe } from '../../hilos/hilos';
import { fmtDia, fmtDiaRelativo, fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, FilaElemento, Hueco, Vacio } from '../../ui/componentes';
import { BarraH } from '../../ui/componentes/Datos';
import { Icono } from '../../ui/iconos/Icono';
import { ASPECTO_TIPO } from '../../ui/iconos/tipos';
import { useComparar } from '../comparacion/useComparar';
import type { Vista } from '../vistas/orden';
import { ListaDensa, Mosaico, SelectorVista } from '../vistas/Vistas';

/** Los que se enseñan en la lista hasta pedir «Ver los N» (como la referencia). */
export const EN_LISTA = 8;

/** «Exportar ZIP» de un grupo: solo sus elementos, sus adjuntos, su historial y sus hilos (no es una copia). */
export function ExportarGrupo({
  elementos,
  nombre,
  grupo,
}: {
  elementos: readonly FrontmatterComun[];
  nombre: string;
  grupo: { clase: ClaseGrupo; valor: string };
}) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const exportar = useExportar();
  const exportando = useExportacion((s) => s.tipo !== null);
  if (!espacio || !elementos.length) return null;
  const alPulsar = () => {
    const entidades = new Map(espacio.entidades.entradas().map((e) => [e.ref, e.ruta]));
    const solo: SoloExportar = {
      ...rutasDeGrupo(
        elementos,
        (id) => espacio.repositorio.buscar(id)?.ruta,
        (ref) => entidades.get(ref),
      ),
      grupo,
    };
    void exportar('zip', nombre, solo);
  };
  return (
    <Boton pequeno disabled={exportando} onClick={alPulsar}>
      {t('pantallas.grupo.exportar')}
    </Boton>
  );
}

const ANCHO = 420;
const ALTO = 90;

/** «Cuándo»: los elementos por día de las dos últimas semanas (como el SVG de la referencia). */
function Cuando({ dias, pico, ahora }: { dias: { dia: string; n: number }[]; pico: string | null; ahora: Date }) {
  const { t, idioma } = useT();
  const maximo = Math.max(1, ...dias.map((d) => d.n));
  const ancho = (ANCHO - 10) / dias.length;
  const fecha = (dia: string) => new Date(`${dia}T12:00:00`);
  // El mes del pico (no el de hoy: el pico puede ser del mes anterior).
  const mes = pico ? new Intl.DateTimeFormat(idioma, { month: 'long' }).format(fecha(pico)) : '';
  const conAlgo = dias.filter((d) => d.n > 0);
  return (
    <section className="card" aria-labelledby="grupo-cuando">
      <h3 id="grupo-cuando">{t('pantallas.grupo.cuando')}</h3>
      <div className="tbl-wrap">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width="100%" className="grafico-cuando" aria-hidden="true">
          {dias.map((d, i) => (
            <g key={d.dia}>
              <rect
                x={5 + i * ancho + 2}
                y={ALTO - 18 - (d.n / maximo) * (ALTO - 30)}
                width={ancho - 4}
                height={Math.max(1.5, (d.n / maximo) * (ALTO - 30))}
                rx={2}
                className={d.n ? 'con' : 'sin'}
              >
                <title>{`${d.dia}: ${fmtNumero(d.n, idioma)}`}</title>
              </rect>
              {(i % 3 === 0 || i === dias.length - 1) && (
                <text className="eje" x={5 + i * ancho + ancho / 2} y={ALTO - 4} textAnchor="middle">
                  {Number(d.dia.slice(8))}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {/* Lo que dice el gráfico, para los lectores de pantalla: los días con algo. */}
      <p className="solo-lector">
        {t('pantallas.grupo.cuandoEtiqueta')}:{' '}
        {conAlgo.map((d) => `${fmtDia(fecha(d.dia), ahora, idioma)}, ${fmtNumero(d.n, idioma)}`).join('; ')}
      </p>
      <p className="xs muted">
        {pico
          ? t('pantallas.grupo.pico', {
              mes: mes.charAt(0).toLocaleUpperCase(idioma) + mes.slice(1),
              dia: Number(pico.slice(8)),
            })
          : t('pantallas.grupo.sinActividad')}
      </p>
    </section>
  );
}

/** La hora de ahora, al día cada minuto (si la pantalla sigue abierta pasada la medianoche, «hoy» cambia). */
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

interface Props {
  elementos: readonly FrontmatterComun[];
  vista: Vista;
  alCambiarVista: (v: Vista) => void;
  /** Para el `id` de la sección de elementos. */
  id: string;
  /** En el grupo de una huella, «Se repite» sería ella misma. */
  sinRepetido?: boolean;
}

/** El cuerpo del panel: qué hay, cuándo, qué se repite y los elementos. */
export function CuerpoGrupo({ elementos, vista, alCambiarVista, id, sinRepetido = false }: Props) {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const { comparar, creando } = useComparar();
  const pista = useId();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [todos, setTodos] = useState(false);
  const ahora = useAhora();
  const dia = ahora.toDateString();
  // biome-ignore lint/correctness/useExhaustiveDependencies: se recalcula al cambiar de día, no cada minuto.
  const panel = useMemo(() => panelDe(elementos, ahora), [elementos, dia]);
  // Lo marcado que ya no está en el grupo (a la papelera, cambió) no se compara.
  useEffect(() => {
    const refs = new Set<string>(elementos.map((fm) => fm.ref));
    setMarcados((m) => (m.every((r) => refs.has(r)) ? m : m.filter((r) => refs.has(r))));
  }, [elementos]);
  const visibles = useMemo(() => (todos ? elementos : elementos.slice(0, EN_LISTA)), [elementos, todos]);
  const legibles = useMemo(
    () =>
      new Map<string, string>(
        visibles.map((fm) => {
          try {
            const lector = lectores?.registro.paraElemento({ frontmatter: fm });
            return [fm.id, lector?.resumenLegible?.(fm.lector.resumen, idioma) ?? ''];
          } catch {
            return [fm.id, ''];
          }
        }),
      ),
    [visibles, lectores, idioma],
  );
  if (!elementos.length) return null;
  const abrir = (ref: string) => void navegar({ to: '/e/$ref', params: { ref } });
  const maximo = panel.tipos[0]?.n ?? 0;
  const r = sinRepetido ? null : panel.repetido;
  // El hilo de esa huella, si lo hay (el de cualquiera de sus errores).
  const hilo = r && espacio ? r.elementos.map((fm) => hiloDe(fm.hilo, espacio.entidades)).find(Boolean) : null;
  // Comparar: dos marcados; si no se pueden comparar, se dice por qué (el botón, deshabilitado).
  const [a, b] = marcados.map((ref) => elementos.find((fm) => fm.ref === ref));
  const motivo = (() => {
    if (!a || !b) return null;
    const c = comparables(a, b);
    if (!('motivo' in c)) return null;
    return c.motivo === 'distintoTipo'
      ? t('pantallas.comparacion.motivos.distintoTipo', { a: t(`tipos.${a.tipo}`), b: t(`tipos.${b.tipo}`) })
      : t(`pantallas.comparacion.motivos.${c.motivo}`);
  })();
  const alternar = (ref: string) =>
    setMarcados((m) => (m.includes(ref) ? m.filter((x) => x !== ref) : m.length < 2 ? [...m, ref] : m));
  const marcables = !soloLectura && elementos.length > 1;

  return (
    <>
      <div className="split">
        <section className="card" aria-labelledby="grupo-que-hay">
          <h3 id="grupo-que-hay">{t('pantallas.grupo.queHay')}</h3>
          <div className="list lista-que-hay">
            {panel.tipos.map(({ tipo, n }) => (
              <BarraH
                key={tipo}
                etiqueta={
                  <span className="row etiqueta-tipo">
                    <Icono nombre={ASPECTO_TIPO[tipo].icono} tamano={14} />
                    {t(`tipos.${tipo}`)}
                  </span>
                }
                valor={n}
                maximo={maximo}
                texto={fmtNumero(n, idioma)}
                color={`var(--${ASPECTO_TIPO[tipo].clase})`}
              />
            ))}
          </div>
        </section>
        <Cuando dias={panel.dias} pico={panel.pico} ahora={ahora} />
      </div>
      {r && (
        <section className="card" aria-labelledby="grupo-se-repite">
          <h3 id="grupo-se-repite">{t('pantallas.grupo.seRepite')}</h3>
          <Hueco
            gravedad="grave"
            accion={
              hilo ? (
                <Boton pequeno onClick={() => void navegar({ to: '/hilo/$ref', params: { ref: hilo.ref } })}>
                  {t('pantallas.grupo.verHilo')}
                </Boton>
              ) : (
                <Boton
                  pequeno
                  onClick={() => void navegar({ to: '/g/$clase/$valor', params: { clase: 'huella', valor: r.huella } })}
                >
                  {t('pantallas.grupo.verGrupo')}
                </Boton>
              )
            }
          >
            <b className="sm">{r.ultimo.titulo}</b>
            <span className="xs muted">
              {t('pantallas.grupo.veces', {
                n: r.veces,
                cuando: fmtDiaRelativo(new Date(r.ultimo.creado), ahora, idioma),
              })}
            </span>
          </Hueco>
        </section>
      )}
      <section className="card" aria-labelledby={id}>
        <div className="ah">
          <h3 id={id}>{t('pantallas.coleccion.elementos')}</h3>
          <div className="row">
            {vista === 'lista' && marcados.length === 2 && !soloLectura && (
              <Boton
                variante="primario"
                pequeno
                icono="comparacion"
                disabled={creando || motivo !== null}
                title={motivo ?? undefined}
                onClick={() => {
                  const [x, y] = marcados;
                  if (x && y) void comparar(x, y);
                }}
              >
                {t('pantallas.comparacion.crear.comparar')}
              </Boton>
            )}
            <SelectorVista vista={vista} alCambiar={alCambiarVista} />
          </div>
        </div>
        {vista === 'mosaico' ? (
          <Mosaico elementos={[...elementos]} alAbrir={abrir} />
        ) : vista === 'densa' ? (
          <ListaDensa elementos={[...elementos]} alAbrir={abrir} />
        ) : (
          <>
            {marcables && (
              <p className="xs muted" id={pista} role="status">
                {motivo ?? t('pantallas.grupo.seleccionar')}
              </p>
            )}
            <div className="list">
              {visibles.map((fm) => (
                <div key={fm.id} className="fila-marcable">
                  {marcables && (
                    <input
                      type="checkbox"
                      checked={marcados.includes(fm.ref)}
                      // Con dos marcados, los demás esperan (no se desmarca uno sin decirlo).
                      disabled={marcados.length >= 2 && !marcados.includes(fm.ref)}
                      onChange={() => alternar(fm.ref)}
                      aria-label={t('pantallas.grupo.marcar', { titulo: fm.titulo })}
                      aria-describedby={pista}
                    />
                  )}
                  <FilaElemento fm={fm} resumen={legibles.get(fm.id) ?? ''} alAbrir={abrir} />
                </div>
              ))}
            </div>
            {elementos.length > EN_LISTA && (
              <Boton variante="fantasma" pequeno onClick={() => setTodos((x) => !x)}>
                {todos ? t('pantallas.grupo.verMenos') : t('pantallas.grupo.verTodos', { n: elementos.length })}
              </Boton>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** Sin elementos (una clase o un valor que no existe, o ya sin nada). */
export function GrupoVacio() {
  const { t } = useT();
  return <Vacio titulo={t('pantallas.grupo.vacioTitulo')}>{t('pantallas.grupo.vacio')}</Vacio>;
}
