/**
 * Pantalla de un hilo (ORG-15), como `SC.hilo` de la referencia: chip «Hilo» y estado, título editable en el
 * sitio, «N elementos · desde el 2 oct · colección gateway», «Marcar resuelto» (con una línea de nota) o «Reabrir»;
 * los mensajes en orden con lo que dijo Rimor de cada uno y «Así lo resolviste» destacado; y el compositor, que
 * responde en el hilo.
 */
import type { FrontmatterComun, Hilo as FrontmatterHilo } from '@rimor/formato';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useCompositor } from '../../captura/compositor';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { tituloNuevo } from '../../espacio/ediciones';
import { useEspacio } from '../../estado/espacio';
import { elementosDe, hiloDe, reabrir, renombrarHilo, resolver } from '../../hilos/hilos';
import { fmtDia } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { clases } from '../../ui/clases';
import { Boton, Dialogo, Estado, Hueco, Vacio } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Compositor } from '../../ui/componentes/Compositor';
import { Icono } from '../../ui/iconos/Icono';
import { ASPECTO_TIPO } from '../../ui/iconos/tipos';
import { TituloElemento } from '../elemento/Cabecera';
import { Mensaje } from '../inicio/Mensaje';
import { Pantalla } from '../Pantalla';

/** El hilo y sus elementos, al día con cada cambio del espacio (también de otra pestaña). */
function useHilo(refe: string): { hilo: FrontmatterHilo | null; elementos: FrontmatterComun[]; listo: boolean } {
  const espacio = useEspacioOpcional();
  const [estado, setEstado] = useState<{ hilo: FrontmatterHilo | null; elementos: FrontmatterComun[] } | null>(null);
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () => {
      const hilo = hiloDe(refe, espacio.entidades);
      setEstado({ hilo, elementos: hilo ? elementosDe(hilo.ref, espacio.repositorio) : [] });
    };
    leer();
    return espacio.alCambiar(leer);
  }, [espacio, refe]);
  return { hilo: estado?.hilo ?? null, elementos: estado?.elementos ?? [], listo: estado !== null };
}

/** La primera línea con texto de las notas: «así lo resolviste». */
const primeraLinea = (notas: string) =>
  notas
    .split('\n')
    .find((l) => l.trim())
    ?.trim() ?? '';

export function Hilo() {
  const { t, idioma } = useT();
  const { ref } = useParams({ from: '/hilo/$ref' });
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const responderA = useCompositor((s) => s.responderA);
  const { hilo, elementos, listo } = useHilo(ref);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const [notas, setNotas] = useState<ReadonlyMap<string, string>>(new Map());
  const editable = Boolean(espacio) && !soloLectura;
  const d = useMemo(
    () => (espacio ? { repositorio: espacio.repositorio, entidades: espacio.entidades } : null),
    [espacio],
  );

  // Las notas de los elementos resueltos (para «Así lo resolviste»): se leen sus archivos.
  useEffect(() => {
    if (!espacio) return undefined;
    let vigente = true;
    const resueltos = elementos.filter((fm) => fm.estado === 'resuelto');
    void Promise.all(
      resueltos.map(async (fm) => {
        const r = await espacio.repositorio.leerElemento(fm.id).catch(() => null);
        return [fm.id, r?.ok ? primeraLinea(r.valor.notas) : ''] as const;
      }),
    ).then((pares) => vigente && setNotas(new Map(pares.filter(([, n]) => n))));
    return () => {
      vigente = false;
    };
  }, [espacio, elementos]);

  const abrir = useCallback((r: string) => void navegar({ to: '/e/$ref', params: { ref: r } }), [navegar]);
  const legible = useCallback(
    (fm: FrontmatterComun) => {
      try {
        return lectores?.registro.paraElemento({ frontmatter: fm })?.resumenLegible?.(fm.lector.resumen, idioma) ?? '';
      } catch {
        return '';
      }
    },
    [lectores, idioma],
  );

  if (!listo || !hilo)
    return (
      <Pantalla titulo={ref}>
        {listo && <Vacio titulo={t('pantallas.hilo.noEncontrado')}>{t('pantallas.hilo.vacio')}</Vacio>}
      </Pantalla>
    );

  const resuelto = hilo.estado === 'resuelto';
  // Como la referencia: el hilo de un error lleva el color del error.
  const deError = elementos[0]?.tipo === 'error';
  const colecciones = [
    ...new Set(
      elementos
        .flatMap((fm) => fm.colecciones ?? [])
        .filter((c) => elementos.every((fm) => fm.colecciones?.includes(c))),
    ),
  ];
  const desde = elementos[0] ? fmtDia(new Date(elementos[0].creado), new Date(), idioma) : '';
  const meta = [
    t('pantallas.hilo.elementos', { n: elementos.length }),
    desde && t('pantallas.hilo.desde', { dia: desde }),
    colecciones.length && t('pantallas.hilo.coleccion', { n: colecciones.length, colecciones: colecciones.join(', ') }),
  ]
    .filter(Boolean)
    .join(' · ');

  async function guardarTitulo(escrito: string) {
    const titulo = hilo ? tituloNuevo(hilo.titulo, escrito) : null;
    if (titulo && d && hilo && !(await renombrarHilo(hilo.ref, titulo, d).catch(() => false)))
      avisos?.avisar(t('pantallas.elemento.noGuardado'));
  }

  async function alReabrir() {
    if (!d || !hilo) return;
    const hecho = await reabrir(hilo.ref, d).catch(() => false);
    avisos?.avisar(t(hecho ? 'pantallas.hilo.reabierto' : 'pantallas.elemento.noGuardado'));
  }

  return (
    <>
      <Pantalla
        marcas={
          <>
            <span className={clases('kchip', deError ? ASPECTO_TIPO.error.clase : ASPECTO_TIPO.hilo.clase)}>
              <Icono nombre="hilo" tamano={13} />
              {t('tipos.hilo')}
            </span>
            <Estado tono={resuelto ? 'ok' : 'warn'}>
              {t(resuelto ? 'pantallas.hilo.resuelto' : 'pantallas.hilo.abierto')}
            </Estado>
          </>
        }
        titulo={
          <TituloElemento
            titulo={hilo.titulo}
            editable={editable}
            editando={editandoTitulo}
            alEditar={setEditandoTitulo}
            alGuardar={(titulo) => void guardarTitulo(titulo)}
          />
        }
        meta={meta}
        control={
          editable ? (
            <div className="row">
              {resuelto ? (
                <Boton pequeno onClick={() => void alReabrir()}>
                  {t('pantallas.hilo.reabrir')}
                </Boton>
              ) : (
                <Boton pequeno onClick={() => setResolviendo(true)}>
                  {t('pantallas.hilo.marcarResuelto')}
                </Boton>
              )}
              {/* «Convertir en investigación» llega con las investigaciones (IN-070). */}
            </div>
          ) : undefined
        }
      >
        <div className="feed" role="feed" aria-label={t('pantallas.hilo.mensajes')}>
          {elementos.map((fm, i) => {
            const nota = notas.get(fm.id);
            return (
              <div key={fm.id} className="mensaje-hilo">
                <Mensaje
                  fm={fm}
                  seleccionado={false}
                  marcado={false}
                  fresco={false}
                  // Las acciones de la respuesta (añadir a una colección, a su hilo) son de Inicio: aquí, ninguna.
                  sinAcciones
                  soloLectura={soloLectura}
                  resumen={legible(fm)}
                  posicion={i + 1}
                  total={elementos.length}
                  alAbrir={abrir}
                  alResponder={responderA}
                  alArchivar={() => undefined}
                  alAccion={() => undefined}
                  conDia
                  sinArchivar
                />
                {nota && (
                  <div className="nota-hilo">
                    <Hueco gravedad="resuelto">
                      <b className="sm">{t('pantallas.hilo.asiLoResolviste')}</b>
                      <span className="sm">{nota}</span>
                    </Hueco>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Pantalla>
      <div className="col ccol">
        <Compositor alAbrir={abrir} hiloFijo={hilo.ref} />
      </div>
      <DialogoResolver
        abierto={resolviendo}
        alCerrar={() => setResolviendo(false)}
        alResolver={async (nota) => {
          setResolviendo(false);
          if (!d) return;
          const hecho = await resolver(hilo.ref, nota, d).catch(() => false);
          avisos?.avisar(t(hecho ? 'pantallas.hilo.marcado' : 'pantallas.elemento.noGuardado'));
        }}
      />
    </>
  );
}

/** «Marcar resuelto»: una línea de nota (cómo se resolvió), sin formularios largos. */
function DialogoResolver({
  abierto,
  alCerrar,
  alResolver,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alResolver: (nota: string) => void;
}) {
  const { t } = useT();
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={t('pantallas.hilo.marcarResuelto')}>
      <FormularioNota alResolver={alResolver} alCerrar={alCerrar} />
    </Dialogo>
  );
}

function FormularioNota({ alResolver, alCerrar }: { alResolver: (nota: string) => void; alCerrar: () => void }) {
  const { t } = useT();
  const [nota, setNota] = useState('');
  const id = useId();
  return (
    <form
      method="dialog"
      className="formulario-dialogo"
      onSubmit={(e) => {
        e.preventDefault();
        alResolver(nota);
      }}
    >
      <label className="xs muted" htmlFor={id}>
        {t('pantallas.hilo.nota')}
      </label>
      <input
        id={id}
        type="text"
        value={nota}
        placeholder={t('pantallas.hilo.notaEjemplo')}
        onChange={(e) => setNota(e.target.value)}
        // biome-ignore lint/a11y/noAutofocus: el diálogo se abre para escribir la nota.
        autoFocus
      />
      <div className="row">
        <Boton variante="primario" pequeno type="submit">
          {t('pantallas.hilo.marcarResuelto')}
        </Boton>
        <Boton pequeno onClick={alCerrar}>
          {t('pantallas.inicio.cancelar')}
        </Boton>
      </div>
    </form>
  );
}
