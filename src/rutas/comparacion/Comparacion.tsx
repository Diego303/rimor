/**
 * Pantalla de una comparación (CMP-01), en `/e/CMP-0004`: cabecera con el chip, el título editable en el sitio y
 * las fuentes («Ayer, 18:21 · MED-0007 frente a MED-0008»); la comparación de mediciones o de logs como la
 * referencia; los avisos si una fuente cambió (está recalculada), falta o ya no se puede comparar; «Detalles» con
 * las fuentes, la referencia y las cifras; e «Intercambiar» las fuentes con un clic.
 */
import { type Comparacion as FrontmatterComparacion, isoConZona } from '@rimor/formato';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useCallback, useState } from 'react';
import { type Calculo, nombreDe, resultadoDe } from '../../comparaciones/crear';
import { cifrasDeResultado, type ResultadoComparacion } from '../../comparaciones/resultado';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { tituloNuevo } from '../../espacio/ediciones';
import { useEspacio } from '../../estado/espacio';
import { fmtFecha, fmtFechaRelativa } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { DetallesElemento } from '../../lectores/DetallesElemento';
import { Banner, Boton, ChipTipo, Ref, Tarjeta, Vacio, Veredicto } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Senal } from '../../ui/marca/Senal';
import { useEsperaVisible } from '../../ui/marca/useEsperaVisible';
import { TituloElemento } from '../elemento/Cabecera';
import { Pantalla } from '../Pantalla';
import { useComparacion } from './useComparacion';
import { VistaComparacionLogs } from './VistaLogs';
import { VeredictoMediciones, VistaComparacionMediciones } from './VistaMediciones';

/** Los motivos que se nombran con su frase (el de tipos distintos lleva además los dos tipos). */
const MOTIVOS = ['mismo', 'sinComparacion', 'sinValores', 'otroLector', 'demasiadas'] as const;
type Motivo = (typeof MOTIVOS)[number];

/** «Ayer, 18:21»: la fecha relativa con mayúscula, como la cabecera de la referencia. */
const cuando = (fecha: string, idioma: Parameters<typeof fmtFechaRelativa>[2]) => {
  const texto = fmtFechaRelativa(new Date(fecha), new Date(), idioma);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Lo guardado, cuando no se puede calcular ahora: la cifra principal y su frase. */
function VeredictoGuardado({ r, nombre }: { r: ResultadoComparacion; nombre: string }) {
  const { t } = useT();
  if (r.clase === 'mediciones')
    return (
      <Tarjeta>
        <VeredictoMediciones r={r} nombre={nombre} />
      </Tarjeta>
    );
  return (
    <Tarjeta>
      {r.divergencia === null ? (
        <Veredicto tono="ok" cifra="=" frase={t('pantallas.comparacion.logs.iguales')} />
      ) : (
        <Veredicto
          tono="bad"
          cifra={t('pantallas.comparacion.logs.linea', { n: r.divergencia })}
          frase={t('pantallas.comparacion.logs.separan')}
          explicacion={`${t('pantallas.comparacion.logs.nuevos', { n: r.nuevos })} · ${t(
            'pantallas.comparacion.logs.ausentes',
            { n: r.ausentes },
          )}`}
        />
      )}
    </Tarjeta>
  );
}

export function PantallaComparacion({ refe }: { refe: string }) {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const leida = useComparacion(refe);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const calculando = leida.estado === 'lista' && leida.calculando;
  // «Comparando» aparece si tarda más de 400 ms (guía §11.1).
  const comparando = useEsperaVisible(calculando);
  const editable = Boolean(espacio) && !soloLectura;
  const abrir = useCallback((r: string) => void navegar({ to: '/e/$ref', params: { ref: r } }), [navegar]);

  /** Cambia la entidad en su turno, con su fecha de modificación. */
  const editar = useCallback(
    async (cambio: (fm: FrontmatterComparacion) => FrontmatterComparacion | null) => {
      if (!espacio || leida.estado !== 'lista') return false;
      const r = await espacio.entidades
        .actualizar(leida.entidad.frontmatter.id, (e) =>
          e.frontmatter.tipo === 'comparacion'
            ? (() => {
                const nuevo = cambio(e.frontmatter);
                return nuevo && { ...e, frontmatter: { ...nuevo, modificado: isoConZona(new Date()) } };
              })()
            : null,
        )
        .catch(() => null);
      return Boolean(r?.ok && r.valor);
    },
    [espacio, leida],
  );

  if (leida.estado !== 'lista')
    return (
      <Pantalla titulo={refe}>
        {leida.estado === 'no-encontrada' && (
          <Vacio titulo={t('pantallas.comparacion.noEncontradaTitulo')}>{t('pantallas.elemento.noEncontrado')}</Vacio>
        )}
      </Pantalla>
    );

  const { entidad, fuentes, calculo, motivo, guardado, cambiaron } = leida;
  const fm = entidad.frontmatter;
  const [a, b] = fuentes;
  const [refA = '', refB = ''] = fm.fuentes;
  const faltan = fm.fuentes.filter((_, i) => !fuentes[i]);
  const nombres: [string, string] =
    calculo && a && b
      ? [nombreDe(a, calculo, 'a'), nombreDe(b, calculo, 'b')]
      : [guardado?.nombres?.[0] ?? refA, guardado?.nombres?.[1] ?? refB];
  const resultado = calculo && a && b ? resultadoDe(calculo, [a, b]) : guardado;
  const titular = (x: string, y: string) => t('pantallas.comparacion.titulo', { a: x, b: y });

  async function intercambiar() {
    const [primera, segunda, ...resto] = fm.fuentes;
    if (!calculo || !primera || !segunda) return;
    // El título se da la vuelta si es el que se le puso al crearla; uno escrito a mano se queda.
    const automatico = fm.titulo === titular(nombres[0], nombres[1]);
    const pintadas = fm.fuentes.join('\n');
    // Sobre lo que hay al escribir: si ya no son las fuentes pintadas (otro intercambio entró antes), nada.
    const hecho = await editar((f) =>
      f.fuentes.join('\n') !== pintadas
        ? null
        : {
            ...f,
            fuentes: [segunda, primera, ...resto],
            ...(automatico && f.titulo === fm.titulo ? { titulo: titular(nombres[1], nombres[0]) } : {}),
            // Sin resultado de esta versión: se recalcula al releer (sin avisar de que cambió una fuente).
            resultado: {},
          },
    );
    avisos?.avisar(
      hecho ? t('pantallas.comparacion.intercambiada', { ref: refB }) : t('pantallas.elemento.noGuardado'),
    );
  }

  async function guardarTitulo(escrito: string) {
    const titulo = tituloNuevo(fm.titulo, escrito);
    if (titulo && !(await editar((f) => ({ ...f, titulo })))) avisos?.avisar(t('pantallas.elemento.noGuardado'));
  }

  const meta: ReactNode = (
    <>
      {cuando(fm.creado, idioma)} ·{' '}
      {fm.clase === 'logs' ? (
        <>
          <Ref refe={refA} alPulsar={abrir} /> {t('pantallas.comparacion.buena')} · <Ref refe={refB} alPulsar={abrir} />{' '}
          {t('pantallas.comparacion.mala')}
        </>
      ) : (
        <>
          <Ref refe={refA} alPulsar={abrir} /> {t('pantallas.comparacion.frente')} <Ref refe={refB} alPulsar={abrir} />
        </>
      )}
    </>
  );

  /** El motivo de no poder calcular, en una frase. */
  const textoMotivo = (m: string) =>
    m === 'comparacion.distintoTipo' && a && b
      ? t('pantallas.comparacion.motivos.distintoTipo', {
          a: t(`tipos.${a.frontmatter.tipo}`),
          b: t(`tipos.${b.frontmatter.tipo}`),
        })
      : MOTIVOS.includes(m.slice('comparacion.'.length) as Motivo)
        ? t(`pantallas.comparacion.motivos.${m.slice('comparacion.'.length) as Motivo}`)
        : t('pantallas.comparacion.motivos.sinComparacion');

  return (
    <Pantalla
      marcas={<ChipTipo tipo="comparacion" />}
      titulo={
        <TituloElemento
          titulo={fm.titulo}
          editable={editable}
          editando={editandoTitulo}
          alEditar={setEditandoTitulo}
          alGuardar={(titulo) => void guardarTitulo(titulo)}
        />
      }
      meta={meta}
      control={
        editable && calculo && !calculando ? (
          <Boton variante="fantasma" pequeno icono="comparacion" onClick={() => void intercambiar()}>
            {t('pantallas.comparacion.intercambiar')}
          </Boton>
        ) : undefined
      }
    >
      {cambiaron.length > 0 && (
        <Banner>{t('pantallas.comparacion.cambiada', { n: cambiaron.length, refs: cambiaron.join(', ') })}</Banner>
      )}
      {faltan.length > 0 && (
        <Banner>{t('pantallas.comparacion.faltan', { n: faltan.length, refs: faltan.join(', ') })}</Banner>
      )}
      {motivo && <Banner>{t('pantallas.comparacion.yaNoSePuede', { motivo: textoMotivo(motivo) })}</Banner>}
      {comparando && <Senal estado="comparando" veces={1} etiqueta={t('pantallas.comparacion.comparando')} />}
      <Cuerpo calculo={calculo} a={a ?? null} b={b ?? null} nombres={nombres} guardado={guardado} />
      <DetallesElemento refe={fm.ref} cifras={resultado ? cifrasDeResultado(resultado, idioma) : []}>
        <dt>{t('pantallas.comparacion.fuentes')}</dt>
        <dd>
          {fm.fuentes.map((r, i) => (
            <span key={r}>
              {i > 0 && ' · '}
              <Ref refe={r} alPulsar={abrir} />
            </span>
          ))}
        </dd>
        <dt>{t('pantallas.comparacion.creada')}</dt>
        <dd>{fmtFecha(new Date(fm.creado), idioma)}</dd>
        <dt>{t('pantallas.elemento.referencia')}</dt>
        <dd className="mono">{fm.ref}</dd>
      </DetallesElemento>
    </Pantalla>
  );
}

interface PropsCuerpo {
  calculo: Calculo | null;
  a: Parameters<typeof nombreDe>[0] | null;
  b: Parameters<typeof nombreDe>[0] | null;
  nombres: [string, string];
  guardado: ResultadoComparacion | null;
}

/** La comparación de ahora; si no se puede calcular, lo guardado. */
function Cuerpo({ calculo, a, b, nombres, guardado }: PropsCuerpo) {
  if (calculo?.clase === 'mediciones') return <VistaComparacionMediciones c={calculo.mediciones} nombres={nombres} />;
  if (calculo?.clase === 'logs' && a && b) return <VistaComparacionLogs c={calculo.logs} buena={a} mala={b} />;
  return guardado ? <VeredictoGuardado r={guardado} nombre={nombres[1]} /> : null;
}
