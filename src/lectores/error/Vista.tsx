/**
 * Vista del lector Error, como la pantalla de referencia: el mensaje y dónde; si ya pasó, «3.ª vez» con lo que
 * escribiste al resolverlo (y «Añadir cómo lo resolví»); tus marcos; y, plegados, las librerías, la traza y los
 * detalles con la huella y las cifras.
 */
import { type FrontmatterComun, isoConZona } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, fmtOrdinal, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { construirContexto } from '../../respuestas/contexto';
import { Boton, Detalles, Tarjeta, Veredicto } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import type { Contexto, PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { type DatosError, lectorError } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

const enLista = (partes: string[], t: T) =>
  partes.length > 1 ? `${partes.slice(0, -1).join(', ')}${t('y')}${partes.at(-1)}` : (partes[0] ?? '');

/**
 * «el 2 y el 15 de octubre» si todas son del mismo mes (como la pantalla de referencia); si no, «el 28 sep y
 * el 2 oct».
 */
export function listaDeFechas(fechas: string[], idioma: Idioma, t: T, ahora = new Date()): string {
  const dias = fechas.map((f) => new Date(f)).filter((d) => !Number.isNaN(d.getTime()));
  const primera = dias[0];
  if (!primera) return '';
  const mismoMes = dias.every((d) => d.getMonth() === primera.getMonth() && d.getFullYear() === primera.getFullYear());
  if (!mismoMes)
    return enLista(
      dias.map((d) => t('fechaEl', { fecha: fmtDia(d, ahora, idioma) })),
      t,
    );
  const formato: Intl.DateTimeFormatOptions =
    primera.getFullYear() === ahora.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' };
  const mes = new Intl.DateTimeFormat(idioma, formato).format(primera);
  return t('diasDe', {
    dias: enLista(
      dias.map((d) => t('dia', { dia: d.getDate() })),
      t,
    ),
    mes,
  });
}

export default function VistaError({ el, datos, editable = true }: PropsVista<DatosError>) {
  const { idioma } = useT();
  const t = textos.t.bind(textos, idioma) as unknown as T;
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const avisos = useAvisosOpcional();
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [nota, setNota] = useState('');

  // Las ocurrencias y sus notas, como las ve la respuesta (misma huella); se rehacen con cada cambio.
  useEffect(() => {
    if (!espacio) return undefined;
    let vigente = true;
    const rehacer = () =>
      void construirContexto(el, espacio.repositorio, idioma, { resumen: lectorError.resumen(datos) })
        .then((c) => vigente && setCtx(c))
        .catch(() => undefined);
    rehacer();
    const baja = espacio.alCambiar(rehacer);
    return () => {
      vigente = false;
      baja();
    };
  }, [espacio, el, datos, idioma]);

  const propio = Date.parse(el.frontmatter.creado);
  const anteriores: FrontmatterComun[] = (ctx?.mismaHuella ?? [])
    .filter((o) => Date.parse(o.creado) < propio)
    .sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
  const propios = datos.marcos.filter((m) => m.propio);
  const ajenos = datos.marcos.filter((m) => !m.propio);
  // Lo que se escribió al resolver una ocurrencia anterior; y lo que se escribió en esta, si ya está resuelta.
  const primeraNota = ctx?.notas.find((n) => anteriores.some((o) => o.ref === n.ref));
  const notaPropia =
    el.frontmatter.estado === 'resuelto'
      ? (el.notas
          .split('\n')
          .find((l) => l.trim())
          ?.trim() ?? null)
      : null;

  async function guardarNota() {
    const texto = nota.trim();
    if (!espacio || !texto) return;
    // Escribir en las notas es una edición del usuario: deja copia en el historial (IN-029).
    const r = await espacio.repositorio
      .guardarConHistorial(
        el.frontmatter.id,
        (actual) => ({
          ...actual,
          notas: actual.notas.trim() ? `${texto}\n\n${actual.notas}` : texto,
          frontmatter: { ...actual.frontmatter, estado: 'resuelto', modificado: isoConZona(new Date()) },
        }),
        'edicion',
      )
      .catch(() => null);
    if (r?.ok) {
      setEscribiendo(false);
      setNota('');
      avisos?.avisar(t('resuelto'));
    } else avisos?.avisar(t('noGuardado'));
  }

  const cifras = cifrasDe(lectorError, datos, ctx ?? undefined, el);

  return (
    <>
      <Tarjeta>
        <p className="mono sm mensaje-error">{datos.mensaje || datos.tipo}</p>
        {datos.donde && (
          <p className="xs muted">
            {t('en')}
            <span className="mono">{datos.donde}</span>
          </p>
        )}
      </Tarjeta>

      {anteriores.length > 0 && (
        <Tarjeta>
          <Veredicto
            tono="bad"
            cifra={t('vez', { ordinal: fmtOrdinal(anteriores.length + 1, idioma) })}
            frase={t('yaTePaso', {
              fechas: listaDeFechas(
                anteriores.map((o) => o.creado),
                idioma,
                t,
              ),
            })}
            explicacion={
              primeraNota
                ? t('escribiste', {
                    fecha: fmtDia(new Date(primeraNota.fecha), new Date(), idioma),
                    nota: primeraNota.texto,
                  })
                : undefined
            }
            explicacionAtenuada={false}
          />
          {notaPropia && <p className="sm">{t('loResolviste', { nota: notaPropia })}</p>}
          {editable &&
            !soloLectura &&
            !notaPropia &&
            (escribiendo ? (
              <div className="nota-resolucion">
                <textarea
                  aria-label={t('resolucion')}
                  rows={3}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
                <div className="row">
                  <Boton variante="primario" pequeno onClick={() => void guardarNota()} disabled={!nota.trim()}>
                    {t('guardarResolucion')}
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="row">
                <Boton pequeno onClick={() => setEscribiendo(true)}>
                  {t('anadirResolucion')}
                </Boton>
              </div>
            ))}
        </Tarjeta>
      )}

      <Tarjeta titulo={t('tuCodigo')}>
        {propios.length ? (
          <div className="list">
            {propios.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: una función puede repetirse (recursión); el orden es fijo.
              <div key={i} className="marco-propio">
                <div className="mono sm">{m.funcion || '—'}</div>
                {m.ruta && (
                  <div className="mono xs muted">
                    {m.ruta}
                    {m.linea !== undefined ? `:${m.linea}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="sm muted">{t('sinMarcosPropios')}</p>
        )}
      </Tarjeta>

      {ajenos.length > 0 && (
        <Detalles resumen={t('librerias', { n: ajenos.length })}>
          {ajenos.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los marcos de una traza son fijos y en su orden.
            <div key={i} className="mono xs">
              {m.funcion || m.ruta}
            </div>
          ))}
        </Detalles>
      )}

      <Detalles resumen={t('original')}>
        <pre className="code traza-original">{el.original ?? ''}</pre>
      </Detalles>

      <DetallesElemento refe={el.frontmatter.ref} cifras={cifras}>
        <dt>{t('huella')}</dt>
        <dd className="mono">{datos.huella}</dd>
        <dt>{t('comoSeCalcula')}</dt>
        <dd>{t('explicacionHuella')}</dd>
      </DetallesElemento>
    </>
  );
}
