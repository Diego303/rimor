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
import { activarDominios, enriquecerElemento, falloAnterior } from './enriquecer/aplicar';
import type { CamposFicha, CodigoFallo } from './enriquecer/contrato';
import { leerTokenGithub } from './enriquecer/dominios';
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
  // Si ya falló en esta pestaña (también la consulta al capturar), se dice desde el principio.
  const [estado, setEstado] = useState<Estado>(() => {
    const previo = falloAnterior(el.frontmatter.id);
    return previo
      ? { fase: 'fallo', codigo: previo.codigo, ...(previo.hasta ? { hasta: previo.hasta } : {}) }
      : { fase: 'quieta' };
  });
  const consultando = useEsperaVisible(estado.fase === 'consultando');
  const dominios = dominiosDe(datos);
  if (!espacio || !red || !dominios.length) return null;

  const ficha = fichaDe(el.frontmatter);
  const anterior = fichaAnteriorDe(el.frontmatter);
  const activos = dominiosActivos(espacio.ajustes());
  const activado = sePuedeConsultar(datos, activos);
  const activable = editable && !soloLectura && !red.sinRed;
  // Los que se consultarán de verdad: los activados o, si hay que activar, todos los suyos.
  const lista = (activado ? dominios.filter((d) => activos.has(d)) : dominios).join(' · ');

  /** Consulta; solo activa dominios si se pulsa «Activar y consultar» (nunca al volver a consultar). */
  async function consultar() {
    if (!espacio) return;
    setEstado({ fase: 'consultando' });
    try {
      if (!activado) await activarDominios(espacio, dominios);
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

  const conToken = Boolean(leerTokenGithub());
  const hora = estado.fase === 'fallo' && estado.hasta ? fmtHora(new Date(estado.hasta)) : undefined;
  const textoFallo = (codigo: CodigoFallo): string => {
    if (codigo === 'limite') {
      if (conToken) return hora ? t('ficha.limiteToken', { hora }) : t('ficha.limiteTokenSinHora');
      return hora ? t('ficha.limite', { hora }) : t('ficha.limiteSinHora');
    }
    if (codigo === 'token') return t('ficha.token');
    return t(codigo === 'no-encontrado' ? 'ficha.noEncontrado' : 'ficha.fallo', { dominio: dominios[0] ?? '' });
  };
  // Lo que se anuncia, en una región viva que está siempre (una que aparece ya con su texto no siempre se anuncia).
  const aviso = red.sinRed ? (
    <>
      <Senal estado="sin-conexion" decorativa etiqueta="" />
      {t('ficha.modoSinRed')}
    </>
  ) : estado.fase === 'fallo' && estado.codigo === 'sin-red' ? (
    <>
      <Senal estado="sin-conexion" decorativa etiqueta="" />
      {t('ficha.sinRed')}
    </>
  ) : estado.fase === 'fallo' ? (
    textoFallo(estado.codigo)
  ) : consultando ? (
    <>
      <Senal estado="cargando" decorativa etiqueta="" />
      {t('ficha.consultando', { dominios: lista })}
    </>
  ) : null;

  // Un solo botón, que se queda (deshabilitado) mientras consulta: el foco no se pierde.
  const etiqueta = !activado
    ? t('ficha.activarYConsultar')
    : estado.fase === 'fallo'
      ? t('ficha.reintentar')
      : ficha
        ? t('ficha.volverAConsultar')
        : t('ficha.consultar');
  const acciones = (activable || red.sinRed || estado.fase !== 'quieta') && (
    <div className="row">
      {activable && (
        <Boton pequeno disabled={estado.fase === 'consultando'} onClick={() => void consultar()}>
          {etiqueta}
        </Boton>
      )}
      <span className="sm row inline ficha-estado" role="status">
        {aviso}
      </span>
    </div>
  );
  // Sin ficha, o con sus dominios apagados: qué se consultaría.
  const sePuede = (!ficha || !activado) && <p className="sm">{t('ficha.sePuede', { dominios: lista })}</p>;

  if (!ficha)
    return (
      <Tarjeta titulo={t('ficha.titulo')} className="ficha-enlace">
        {sePuede}
        {acciones}
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
      {sePuede}
      {acciones}
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
