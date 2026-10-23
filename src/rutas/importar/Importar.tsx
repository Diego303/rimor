/**
 * Importar (DAT-04, SEG-04; como `SC.importar`): qué va a pasar antes de tocar nada y una sola decisión, cómo
 * importarlo. Se comprueba el archivo entero (un rechazo dice qué archivo y qué regla); la vista previa cuenta
 * nuevos, idénticos, actualizados y en conflicto (con el detalle), y las refs reasignadas; al terminar, la señal de
 * guardado.
 */
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { crearAlmacenOpfs } from '../../almacen/opfs/cliente';
import type { ModoImportar } from '../../datos/importar/aplicar';
import {
  type Comprobado,
  comprobar,
  type Importado,
  importar,
  useArchivoImportar,
} from '../../datos/importar/importacion';
import { ErrorImportar } from '../../datos/importar/paquete';
import { useExportar } from '../../datos/useExportar';
import { cambiarDeEspacio, recordarEspacioConocido, useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { fmtBytes, fmtFecha } from '../../i18n/formatos';
import type { Clave } from '../../i18n/i18n';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, ErrorTarjeta, Vacio } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
import { Pantalla } from '../Pantalla';

type Estado =
  | { fase: 'comprobando' }
  | { fase: 'rechazado'; codigo: string; ruta?: string }
  | { fase: 'listo'; comprobado: Comprobado }
  | { fase: 'importando'; comprobado: Comprobado; modo: ModoImportar }
  | { fase: 'hecho'; importado: Importado }
  | { fase: 'fallo'; comprobado: Comprobado; codigo: string };

const MODOS: readonly ModoImportar[] = ['fusionar', 'reemplazar', 'nuevo'];

export function Importar() {
  const { t, idioma } = useT();
  const navegar = useNavigate();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const archivo = useArchivoImportar((s) => s.archivo);
  const copiaPrevia = useExportar();
  const [estado, setEstado] = useState<Estado>({ fase: 'comprobando' });
  const [modo, setModo] = useState<ModoImportar>('fusionar');
  // Al salir de la pantalla, el archivo elegido se olvida (y su paquete, que puede ser grande).
  useEffect(() => () => useArchivoImportar.setState({ archivo: null }), []);

  useEffect(() => {
    if (!espacio || !archivo) return undefined;
    let vigente = true;
    setEstado({ fase: 'comprobando' });
    comprobar(espacio, archivo, archivo.name)
      .then((comprobado) => vigente && setEstado({ fase: 'listo', comprobado }))
      .catch((e: unknown) => {
        if (!vigente) return;
        if (e instanceof ErrorImportar)
          setEstado({ fase: 'rechazado', codigo: e.codigo, ...(e.ruta ? { ruta: e.ruta } : {}) });
        else setEstado({ fase: 'rechazado', codigo: 'importar.ilegible' });
      });
    return () => {
      vigente = false;
    };
  }, [espacio, archivo]);

  const regla = (codigo: string) => t(`importar.reglas.${codigo}` as Clave);

  if (estado.fase === 'hecho')
    return (
      <Pantalla marcas={<span className="lbl">{t('importar.titulo')}</span>} titulo={t('importar.terminado')}>
        <Hecho importado={estado.importado} />
      </Pantalla>
    );

  if (!archivo || !espacio)
    return (
      <Pantalla titulo={t('importar.titulo')}>
        <Vacio titulo={t('importar.sinArchivo')}>
          <Boton pequeno onClick={() => void navegar({ to: '/datos' })}>
            {t('importar.irADatos')}
          </Boton>
        </Vacio>
      </Pantalla>
    );

  async function hacer(comprobado: Comprobado) {
    if (!espacio) return;
    setEstado({ fase: 'importando', comprobado, modo });
    try {
      const importado = await importar(espacio, comprobado, modo, {
        // Sin el ZIP previo en los ajustes (Datos y copias), no se descarga.
        copiaPrevia: () =>
          espacio.ajustes().copias.zipPrevio ? copiaPrevia('zip', t('importar.motivoCopia')) : Promise.resolve(true),
        crearAlmacen: (id) => crearAlmacenOpfs(id),
        alCrearEspacio: recordarEspacioConocido,
      });
      // Hecho: el archivo ya no se puede volver a importar desde aquí por error (atrás y adelante).
      useArchivoImportar.setState({ archivo: null });
      setEstado({ fase: 'hecho', importado });
    } catch (e) {
      if (e instanceof ErrorImportar) {
        setEstado({ fase: 'rechazado', codigo: e.codigo, ...(e.ruta ? { ruta: e.ruta } : {}) });
        return;
      }
      const conocido = e instanceof Error && ['importar.sinCopia', 'importar.noRecargado'].includes(e.message);
      setEstado({ fase: 'fallo', comprobado, codigo: conocido ? (e as Error).message : 'importar.noImportado' });
    }
  }

  const exportado = (c: Comprobado) => {
    const fecha = new Date(c.paquete.manifest.exportado ?? '');
    return Number.isNaN(fecha.getTime()) ? '' : ` · ${t('importar.exportadoEl', { fecha: fmtFecha(fecha, idioma) })}`;
  };

  return (
    <Pantalla
      marcas={<span className="lbl">{t('importar.titulo')}</span>}
      titulo={archivo.name}
      meta={`${fmtBytes(archivo.size, idioma)}${estado.fase === 'listo' ? exportado(estado.comprobado) : ''}`}
    >
      {estado.fase === 'comprobando' && <Senal estado="analizando" etiqueta={t('importar.comprobando')} />}
      {estado.fase === 'rechazado' && (
        <ErrorTarjeta
          titulo={t('importar.rechazado')}
          accion={
            <Boton pequeno onClick={() => void navegar({ to: '/datos' })}>
              {t('importar.volver')}
            </Boton>
          }
        >
          {estado.ruta
            ? t('importar.reglaEn', { ruta: estado.ruta, regla: regla(estado.codigo) })
            : t('importar.regla', { regla: regla(estado.codigo) })}
        </ErrorTarjeta>
      )}
      {(estado.fase === 'listo' || estado.fase === 'importando' || estado.fase === 'fallo') && (
        <>
          <Vista comprobado={estado.comprobado} />
          {estado.fase === 'fallo' && (
            <ErrorTarjeta titulo={t('importar.noHecho')}>
              {t(`importar.${estado.codigo.split('.')[1]}` as Clave)}
            </ErrorTarjeta>
          )}
          <section className="card" aria-labelledby="como-importar">
            <h3 id="como-importar">{t('importar.como')}</h3>
            <div className="list" role="radiogroup" aria-labelledby="como-importar">
              {MODOS.filter((m) => m !== 'nuevo' || !espacio.enMemoria).map((m) => (
                <label key={m} className={`radio${modo === m ? ' on' : ''}`}>
                  <input type="radio" name="modo" checked={modo === m} onChange={() => setModo(m)} />
                  <span>
                    <b className="sm">{t(`importar.modos.${m}.titulo`)}</b>
                    <br />
                    <span className="xs muted">
                      {m === 'reemplazar' && !espacio.ajustes().copias.zipPrevio
                        ? t('importar.modos.reemplazar.textoSinCopia', { nombre: espacio.manifest.espacio.nombre })
                        : t(`importar.modos.${m}.texto`, { nombre: espacio.manifest.espacio.nombre })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="row acciones-importar">
              {estado.fase === 'importando' ? (
                <Senal estado="cargando" etiqueta={t('importar.importando')} />
              ) : (
                <>
                  <Boton onClick={() => void navegar({ to: '/datos' })}>{t('importar.cancelar')}</Boton>
                  <Boton
                    variante="primario"
                    disabled={soloLectura}
                    title={soloLectura ? t('importar.soloLectura') : undefined}
                    onClick={() => void hacer(estado.comprobado)}
                  >
                    {t('importar.importar')}
                  </Boton>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </Pantalla>
  );
}

/** La comprobación y lo que va a pasar. */
function Vista({ comprobado: { paquete, plan } }: { comprobado: Comprobado }) {
  const { t, idioma } = useT();
  const conflictos = plan.elementos.filter((c) => c.categoria === 'conflicto');
  const fecha = (iso?: string) => (iso ? fmtFecha(new Date(iso), idioma) : '');
  const cifras: [number, string, boolean][] = [
    [plan.recuentos.nuevo, t('importar.nuevos'), false],
    [plan.recuentos.identico, t('importar.identicos'), false],
    [plan.recuentos.actualizado, t('importar.actualizados'), false],
    [plan.recuentos.conflicto, t('importar.enConflicto'), plan.recuentos.conflicto > 0],
  ];
  return (
    <section className="card">
      <div className="chk">
        <span className="m ok">✓</span>
        <span>
          {t(paquete.origen === 'zip' ? 'importar.validoZip' : 'importar.validoJson', {
            esquema: paquete.manifest.esquema,
            n: paquete.archivos.size,
          })}
        </span>
      </div>
      {paquete.avisos.map((a) => (
        <div key={a} className="chk">
          <span className="m warn">!</span>
          <span>{t(`importar.avisos.${a.split('.')[1]}` as Clave)}</span>
        </div>
      ))}
      <div className="stats">
        {cifras.map(([n, etiqueta, aviso]) => (
          <div key={etiqueta} className="stat">
            <span className={`v${aviso ? ' warn' : ''}`}>{n}</span>
            <span className="xs muted">{etiqueta}</span>
          </div>
        ))}
      </div>
      {conflictos.length > 0 && (
        <Detalles resumen={t('importar.verConflictos', { n: conflictos.length })}>
          <dl className="kv">
            {conflictos.map((c) => (
              <div key={c.id} className="contents">
                <dt className="mono">{c.ref}</dt>
                <dd>
                  {t(c.ganador === 'aqui' ? 'importar.conflictoAqui' : 'importar.conflictoPaquete', {
                    aqui: fecha(c.modificadoAqui),
                    paquete: fecha(c.modificadoPaquete),
                  })}
                </dd>
              </div>
            ))}
          </dl>
        </Detalles>
      )}
      {plan.reasignadas.length > 0 && (
        <Detalles resumen={t('importar.verReasignadas', { n: plan.reasignadas.length })}>
          <dl className="kv">
            {plan.reasignadas.map((r) => (
              <div key={r.de} className="contents">
                <dt className="mono">{r.de}</dt>
                <dd>{t('importar.reasignada', { a: r.a })}</dd>
              </div>
            ))}
          </dl>
        </Detalles>
      )}
      {plan.avisos.length > 0 && (
        <Detalles resumen={t('importar.verAvisos', { n: plan.avisos.length })}>
          <ul className="sm">
            {plan.avisos.map((a) => (
              <li key={a.ruta}>
                <span className="mono xs">{a.ruta}</span> {t(`importar.avisos.${a.codigo.split('.')[1]}` as Clave)}
              </li>
            ))}
          </ul>
        </Detalles>
      )}
    </section>
  );
}

/** El final: la señal de guardado, el resumen y adónde ir. */
function Hecho({ importado }: { importado: Importado }) {
  const { t } = useT();
  const navegar = useNavigate();
  const texto =
    importado.modo === 'nuevo'
      ? t('importar.hechoNuevo', { nombre: importado.nombre })
      : t('importar.hecho', {
          nuevos: importado.plan.recuentos.nuevo,
          actualizados: importado.plan.recuentos.actualizado,
          conflictos: importado.plan.recuentos.conflicto,
        });
  return (
    <section className="card">
      <div className="row">
        <Senal estado="guardado" veces={1} etiqueta={texto} />
      </div>
      <div className="row">
        {importado.modo === 'nuevo' ? (
          <Boton variante="primario" onClick={() => cambiarDeEspacio(importado.id)}>
            {t('importar.abrirNuevo', { nombre: importado.nombre })}
          </Boton>
        ) : (
          <Boton variante="primario" onClick={() => void navegar({ to: '/' })}>
            {t('importar.irAInicio')}
          </Boton>
        )}
      </div>
    </section>
  );
}
