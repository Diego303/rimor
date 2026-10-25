/**
 * La ficha de un enlace en su vista (IN-041): antes de la primera consulta, qué dominios se consultarían y
 * «Activar y consultar» (o «Consultar», si ya están activados); después, lo que dijo la API con su fecha,
 * «Volver a consultar» y qué cambió desde la consulta anterior. Sin red, la señal `sin-conexion`.
 */
import type { Elemento } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { dominiosActivos } from '../../espacio/ajustes';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, fmtFecha, fmtHora, fmtNumero, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Tarjeta } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
import { useEsperaVisible } from '../../ui/marca/useEsperaVisible';
import { activarDominios, enriquecerElemento } from './enriquecer/aplicar';
import type { CamposFicha, CodigoFallo } from './enriquecer/contrato';
import { cambiosDeFicha, dominiosDe, sePuedeConsultar } from './enriquecer/enriquecer';
import { fichaAnteriorDe, fichaDe } from './enriquecer/ficha';
import type { DatosEnlace } from './lector';
import { textos } from './textos';

type Estado = { fase: 'quieta' } | { fase: 'consultando' } | { fase: 'fallo'; codigo: CodigoFallo; hasta?: string };

type Campo = keyof (typeof textos.es)['ficha']['campos'];
const FECHAS: ReadonlySet<string> = new Set(['ultimoPush', 'fechaLanzamiento', 'actualizado', 'fechaVersion']);

/** Un valor de la ficha como se lee: números con su formato, fechas, sí o no. */
function valorLegible(campo: string, v: CamposFicha[string] | undefined, idioma: Idioma): string {
  const t = textos.t.bind(textos, idioma);
  if (v === undefined) return '—';
  if (typeof v === 'boolean') return v ? t('ficha.si') : t('ficha.no');
  if (typeof v === 'number') return campo === 'anio' ? String(v) : fmtNumero(v, idioma);
  if (FECHAS.has(campo) && !Number.isNaN(Date.parse(v))) return fmtDia(new Date(v), new Date(), idioma);
  if (campo === 'estado' && (v === 'open' || v === 'closed' || v === 'fusionado')) return t(`ficha.estados.${v}`);
  return v;
}

const nombreCampo = (campo: string, idioma: Idioma) =>
  campo in textos.es.ficha.campos ? textos.t(idioma, `ficha.campos.${campo as Campo}`) : campo;

export function FichaEnlace({ el, datos, editable }: { el: Elemento; datos: DatosEnlace; editable: boolean }) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma);
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  // Los ajustes de red, al día (Ajustes, la otra pestaña).
  const [red, setRed] = useState(() => espacio?.ajustes().red);
  useEffect(() => (espacio ? espacio.alCambiar(() => setRed(espacio.ajustes().red)) : undefined), [espacio]);
  const [estado, setEstado] = useState<Estado>({ fase: 'quieta' });
  const consultando = useEsperaVisible(estado.fase === 'consultando');
  const dominios = dominiosDe(datos);
  if (!espacio || !red || !dominios.length) return null;

  const ficha = fichaDe(el.frontmatter);
  const anterior = fichaAnteriorDe(el.frontmatter);
  const activos = dominiosActivos(espacio.ajustes());
  const puede = editable && !soloLectura && estado.fase !== 'consultando' && !red.sinRed;
  const lista = dominios.join(' · ');

  async function consultar(activar: boolean) {
    if (!espacio) return;
    setEstado({ fase: 'consultando' });
    try {
      if (activar) await activarDominios(espacio, dominios);
      const r = await enriquecerElemento(espacio, el.frontmatter.id);
      setEstado(
        r.estado === 'fallo'
          ? { fase: 'fallo', codigo: r.codigo, ...(r.hasta ? { hasta: r.hasta } : {}) }
          : { fase: 'quieta' },
      );
    } catch {
      setEstado({ fase: 'fallo', codigo: 'fallo' });
    }
  }

  const reintentar = puede && (
    <Boton pequeno onClick={() => void consultar(false)}>
      {t('ficha.reintentar')}
    </Boton>
  );
  const aviso = red.sinRed ? (
    <Senal estado="sin-conexion" etiqueta={t('ficha.modoSinRed')} />
  ) : estado.fase === 'fallo' && estado.codigo === 'sin-red' ? (
    <div className="row">
      <Senal estado="sin-conexion" etiqueta={t('ficha.sinRed')} />
      {reintentar}
    </div>
  ) : estado.fase === 'fallo' ? (
    <div className="row">
      <p className="sm" role="status">
        {estado.codigo === 'limite'
          ? estado.hasta
            ? t('ficha.limite', { hora: fmtHora(new Date(estado.hasta)) })
            : t('ficha.limiteSinHora')
          : t(estado.codigo === 'no-encontrado' ? 'ficha.noEncontrado' : 'ficha.fallo', { dominio: dominios[0] ?? '' })}
      </p>
      {reintentar}
    </div>
  ) : consultando ? (
    <Senal estado="cargando" etiqueta={t('ficha.consultando', { dominios: lista })} />
  ) : null;

  if (!ficha)
    return (
      <Tarjeta titulo={t('ficha.titulo')} className="ficha-enlace">
        <p className="sm">{t('ficha.sePuede', { dominios: lista })}</p>
        {aviso}
        {puede && estado.fase !== 'fallo' && (
          <div className="row">
            <Boton pequeno onClick={() => void consultar(!sePuedeConsultar(datos, activos))}>
              {sePuedeConsultar(datos, activos) ? t('ficha.consultar') : t('ficha.activarYConsultar')}
            </Boton>
          </div>
        )}
      </Tarjeta>
    );

  const cambios = anterior ? cambiosDeFicha(anterior.campos, ficha.campos) : [];
  return (
    <Tarjeta titulo={t('ficha.titulo')} className="ficha-enlace">
      <dl className="kv">
        {Object.entries(ficha.campos).map(([campo, v]) => (
          <div key={campo} className="contents">
            <dt>{nombreCampo(campo, idioma)}</dt>
            <dd className={typeof v === 'number' ? 'num' : undefined}>{valorLegible(campo, v, idioma)}</dd>
          </div>
        ))}
      </dl>
      <p className="xs muted">
        {t('ficha.consultada', {
          cuando: fmtFecha(new Date(ficha.consultada), idioma),
          dominio: dominios[0] ?? '',
        })}
      </p>
      {aviso}
      {puede && estado.fase !== 'fallo' && (
        <div className="row">
          <Boton pequeno onClick={() => void consultar(!sePuedeConsultar(datos, activos))}>
            {t('ficha.volverAConsultar')}
          </Boton>
        </div>
      )}
      {anterior && (
        <Detalles resumen={t('ficha.cambios', { fecha: fmtDia(new Date(anterior.consultada), new Date(), idioma) })}>
          {cambios.length ? (
            <dl className="kv">
              {cambios.map((c) => (
                <div key={c.campo} className="contents">
                  <dt>{nombreCampo(c.campo, idioma)}</dt>
                  <dd>
                    {valorLegible(c.campo, c.antes, idioma)} → {valorLegible(c.campo, c.despues, idioma)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="sm muted">
              {t('ficha.sinCambios', { fecha: fmtDia(new Date(anterior.consultada), new Date(), idioma) })}
            </p>
          )}
        </Detalles>
      )}
    </Tarjeta>
  );
}
