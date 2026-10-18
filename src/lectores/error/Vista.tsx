/**
 * Vista del lector Error, como la pantalla de referencia: el mensaje y dónde; si ya pasó, «3.ª vez» con lo que
 * escribiste al resolverlo (y «Añadir cómo lo resolví»); tus marcos; y, plegados, las librerías, la traza y los
 * detalles con la huella y las cifras.
 */
import { type FrontmatterComun, isoConZona } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtDia, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { construirContexto } from '../../respuestas/contexto';
import { Boton, Detalles, Tarjeta, Veredicto } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import type { Contexto, PropsVista } from '../contrato';
import { type DatosError, lectorError } from './lector';
import { textos } from './textos';

type T = (c: string, v?: Record<string, string | number>) => string;

/** «el 2 oct y el 15 oct». */
function listaDeFechas(fechas: string[], idioma: Idioma, t: T): string {
  const partes = fechas.map((f) => t('fechaEl', { fecha: fmtDia(new Date(f), new Date(), idioma) }));
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')}${t('y')}${partes.at(-1)}` : (partes[0] ?? '');
}

export default function VistaError({ el, datos }: PropsVista<DatosError>) {
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
  const primeraNota = ctx?.notas[0];

  async function guardarNota() {
    const texto = nota.trim();
    if (!espacio || !texto) return;
    const r = await espacio.repositorio
      .actualizarElemento(el.frontmatter.id, (actual) => ({
        ...actual,
        notas: actual.notas.trim() ? `${texto}\n\n${actual.notas}` : texto,
        frontmatter: { ...actual.frontmatter, estado: 'resuelto', modificado: isoConZona(new Date()) },
      }))
      .catch(() => null);
    if (r?.ok) {
      setEscribiendo(false);
      setNota('');
      avisos?.avisar(t('resuelto'));
    } else avisos?.avisar(t('noGuardado'));
  }

  const cifras = Object.entries(lectorError.cifras ?? {}).map(
    ([nombre, f]) => [nombre, f(datos, ctx ?? undefined, el).texto] as const,
  );

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
            cifra={t('vez', { n: anteriores.length + 1 })}
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
          />
          {!soloLectura &&
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

      <Detalles resumen={t('detalles')}>
        <dl className="kv">
          <dt>{t('huella')}</dt>
          <dd className="mono">{datos.huella}</dd>
          <dt>{t('comoSeCalcula')}</dt>
          <dd>{t('explicacionHuella')}</dd>
        </dl>
        <p className="xs muted">
          {t('cifras')} <span className="mono">{t('sintaxisCifra', { ref: el.frontmatter.ref })}</span>:
        </p>
        <div className="row">
          {cifras.map(([nombre, valor]) => (
            <span key={nombre} className="st">
              <span className="mono">{nombre}</span> {valor}
            </span>
          ))}
        </div>
      </Detalles>
    </>
  );
}
