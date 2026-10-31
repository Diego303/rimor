/**
 * Panel común de un grupo (VIS-04, IN-052), como la pantalla «Colección» de la referencia (`SC.coleccion`): «Qué hay»
 * (una barra por tipo), «Cuándo» (las dos últimas semanas), «Se repite» (la huella de error que más vuelve) y
 * «Elementos» (lista, mosaico o densa; en la lista, dos se seleccionan para compararlos). Lo usan la pantalla de una
 * colección y la de un grupo automático.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useExportacion } from '../../datos/exportacion';
import type { SoloExportar } from '../../datos/exportar';
import { useExportar } from '../../datos/useExportar';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { panelDe, rutasDeGrupo } from '../../espacio/grupos';
import { hiloDe } from '../../hilos/hilos';
import { fmtDiaRelativo, fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, FilaElemento, Hueco, Vacio } from '../../ui/componentes';
import { BarraH } from '../../ui/componentes/Datos';
import { Icono } from '../../ui/iconos/Icono';
import { ASPECTO_TIPO } from '../../ui/iconos/tipos';
import { useComparar } from '../comparacion/useComparar';
import type { Vista } from '../vistas/orden';
import { ListaDensa, Mosaico } from '../vistas/Vistas';

/** «Exportar ZIP» de un grupo: solo sus elementos, sus adjuntos y su historial (no es una copia del espacio). */
export function ExportarGrupo({ elementos, nombre }: { elementos: readonly FrontmatterComun[]; nombre: string }) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const exportar = useExportar();
  const exportando = useExportacion((s) => s.tipo !== null);
  if (!espacio || !elementos.length) return null;
  const solo: SoloExportar = rutasDeGrupo(elementos, (id) => espacio.repositorio.buscar(id)?.ruta);
  return (
    <Boton pequeno disabled={exportando} onClick={() => void exportar('zip', nombre, solo)}>
      {t('pantallas.grupo.exportar')}
    </Boton>
  );
}

const ANCHO = 420;
const ALTO = 90;

/** «Cuándo»: los elementos por día de las dos últimas semanas (como el SVG de la referencia). */
function Cuando({ dias, pico }: { dias: { dia: string; n: number }[]; pico: string | null }) {
  const { t, idioma } = useT();
  const maximo = Math.max(1, ...dias.map((d) => d.n));
  const ancho = (ANCHO - 10) / dias.length;
  const ultimo = dias.at(-1)?.dia ?? '';
  const mes = ultimo ? new Intl.DateTimeFormat(idioma, { month: 'long' }).format(new Date(`${ultimo}T12:00:00`)) : '';
  return (
    <section className="card" aria-labelledby="grupo-cuando">
      <h3 id="grupo-cuando">{t('pantallas.grupo.cuando')}</h3>
      <div className="tbl-wrap">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width="100%"
          className="grafico-cuando"
          role="img"
          aria-label={t('pantallas.grupo.cuandoEtiqueta')}
        >
          {dias.map((d, i) => {
            const alto = Math.max(1.5, (d.n / maximo) * (ALTO - 30));
            return (
              <g key={d.dia}>
                <rect
                  x={5 + i * ancho + 2}
                  y={ALTO - 18 - (d.n / maximo) * (ALTO - 30)}
                  width={ancho - 4}
                  height={alto}
                  rx={2}
                  className={d.n ? 'con' : 'sin'}
                >
                  <title>{`${d.dia}: ${fmtNumero(d.n, idioma)}`}</title>
                </rect>
                {(i % 3 === 0 || i === dias.length - 1) && (
                  <text x={5 + i * ancho + ancho / 2} y={ALTO - 4} textAnchor="middle">
                    {Number(d.dia.slice(8))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
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

interface Props {
  elementos: readonly FrontmatterComun[];
  vista: Vista;
  /** Etiqueta de la sección de elementos (para su `aria-labelledby`). */
  id: string;
}

/** El cuerpo del panel: qué hay, cuándo, qué se repite y los elementos. */
export function CuerpoGrupo({ elementos, vista, id }: Props) {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const { comparar, creando } = useComparar();
  const [marcados, setMarcados] = useState<string[]>([]);
  // `ahora`, una vez por montaje (las barras son de las dos últimas semanas hasta hoy).
  const [ahora] = useState(() => new Date());
  const panel = useMemo(() => panelDe(elementos, ahora), [elementos, ahora]);
  const abrir = (ref: string) => void navegar({ to: '/e/$ref', params: { ref } });
  const legible = (fm: FrontmatterComun) => {
    try {
      return lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
    } catch {
      return '';
    }
  };
  if (!elementos.length) return null;
  const maximo = panel.tipos[0]?.n ?? 0;
  const r = panel.repetido;
  // El hilo de esa huella, si lo hay (el de cualquiera de sus errores).
  const hilo = r && espacio ? r.elementos.map((fm) => hiloDe(fm.hilo, espacio.entidades)).find(Boolean) : null;
  const alternar = (ref: string) =>
    setMarcados((m) => (m.includes(ref) ? m.filter((x) => x !== ref) : [...m.slice(-1), ref]));

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
        <Cuando dias={panel.dias} pico={panel.pico} />
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
      {vista === 'mosaico' ? (
        <Mosaico elementos={[...elementos]} alAbrir={abrir} />
      ) : (
        <section className="card" aria-labelledby={id}>
          <div className="ah">
            <h3 id={id}>{t('pantallas.coleccion.elementos')}</h3>
            {vista === 'lista' && marcados.length === 2 && (
              <Boton
                pequeno
                disabled={creando}
                onClick={() => {
                  const [a, b] = marcados;
                  if (a && b) void comparar(a, b);
                }}
              >
                {t('pantallas.grupo.comparar')}
              </Boton>
            )}
          </div>
          {vista === 'densa' ? (
            <ListaDensa elementos={[...elementos]} alAbrir={abrir} />
          ) : (
            <>
              <p className="xs muted">{t('pantallas.grupo.seleccionar')}</p>
              <div className="list">
                {elementos.map((fm) => (
                  <div key={fm.id} className="fila-marcable">
                    <input
                      type="checkbox"
                      checked={marcados.includes(fm.ref)}
                      onChange={() => alternar(fm.ref)}
                      aria-label={t('pantallas.grupo.marcar', { titulo: fm.titulo })}
                    />
                    <FilaElemento fm={fm} resumen={legible(fm)} alAbrir={abrir} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}

/** Sin elementos (una clase o un valor que no existe, o ya sin nada). */
export function GrupoVacio() {
  const { t } = useT();
  return <Vacio titulo={t('pantallas.grupo.vacioTitulo')}>{t('pantallas.grupo.vacio')}</Vacio>;
}
