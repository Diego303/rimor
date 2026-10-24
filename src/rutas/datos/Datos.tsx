import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { crearAlmacenOpfs } from '../../almacen/opfs/cliente';
import { AjustesRecordatorio } from '../../datos/AjustesRecordatorio';
import { descargarCopiaDeEspacio } from '../../datos/copiaDeEspacio';
import { cancelarExportacion, useExportacion } from '../../datos/exportacion';
import { useArchivoImportar } from '../../datos/importar/importacion';
import { SenalExportacion, useEsperaExportacion, useExportar } from '../../datos/useExportar';
import { TarjetaCuidado } from '../../espacio/Avisos';
import { borrarEspacio, cambiarDeEspacio, espaciosConocidos, useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Boton, Detalles, Dialogo } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Pantalla } from '../Pantalla';

/** Cuántos elementos hay en el espacio y en su papelera, al día con cada cambio. */
function useRecuentos(): { elementos: number; papelera: number } {
  const espacio = useEspacioOpcional();
  const [recuentos, setRecuentos] = useState({ elementos: 0, papelera: 0 });
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () =>
      setRecuentos({
        elementos: espacio.repositorio.elementos().length,
        papelera: espacio.repositorio.enPapelera().length,
      });
    leer();
    return espacio.alCambiar(leer);
  }, [espacio]);
  return recuentos;
}

/** Exportar (el ZIP, o el JSON en «Otras exportaciones»); deshabilitado mientras haya una exportación en marcha. */
function BotonExportar({ tipo }: { tipo: 'zip' | 'json' }) {
  const { t } = useT();
  const exportar = useExportar();
  const enMarcha = useExportacion((s) => s.tipo !== null);
  return (
    <Boton
      variante={tipo === 'zip' ? 'senal' : 'secundario'}
      pequeno={tipo === 'json'}
      disabled={enMarcha}
      onClick={() => void exportar(tipo)}
    >
      {t(tipo === 'zip' ? 'pantallas.datos.exportarZip' : 'pantallas.datos.exportar')}
    </Boton>
  );
}

/** «Importar…»: elige un `.zip` o un `.json` y lleva a la pantalla Importar, que lo comprueba antes de nada. */
function BotonImportar() {
  const { t } = useT();
  const navegar = useNavigate();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const selector = useRef<HTMLInputElement>(null);
  return (
    <>
      <Boton
        disabled={soloLectura}
        title={soloLectura ? t('importar.soloLectura') : undefined}
        onClick={() => selector.current?.click()}
      >
        {t('pantallas.datos.importar')}
      </Boton>
      <input
        ref={selector}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        hidden
        aria-label={t('pantallas.datos.importar')}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (!archivo) return;
          useArchivoImportar.setState({ archivo });
          void navegar({ to: '/importar' });
        }}
      />
    </>
  );
}

/**
 * Los botones de la tarjeta de cuidado o, si la exportación pasa de 400 ms, la señal con el porcentaje y «Cancelar»
 * (los botones, deshabilitados mientras tanto). Si el foco se pierde al cambiar unos por otros, vuelve a la fila.
 */
function AccionesCopia() {
  const { t } = useT();
  const { visible, enMarcha } = useEsperaExportacion();
  const fila = useRef<HTMLDivElement>(null);
  const montada = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: se mira cada vez que cambian los botones de la fila.
  useEffect(() => {
    // Al montar no: entrar en la pantalla no mueve el foco.
    if (!montada.current) {
      montada.current = true;
      return;
    }
    if (document.activeElement === document.body || !document.activeElement)
      fila.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [visible]);
  if (visible)
    return (
      <div className="row" ref={fila}>
        <SenalExportacion />
        {enMarcha && (
          <Boton variante="fantasma" pequeno onClick={cancelarExportacion}>
            {t('pantallas.datos.cancelar')}
          </Boton>
        )}
      </div>
    );
  return (
    <div className="row" ref={fila}>
      <BotonExportar tipo="zip" />
      <BotonImportar />
    </div>
  );
}

/**
 * Datos y copias: cuánto ocupa, si está protegido y la última copia, con exportar e importar (IN-007, IN-035,
 * IN-036); los plegados de otras exportaciones, el recordatorio, los espacios y la papelera, y qué contiene el ZIP.
 */
export function Datos() {
  const { t } = useT();
  const navegar = useNavigate();
  const nombre = useEspacio((s) => s.nombre);
  const espacio = useEspacioOpcional();
  const enMemoria = espacio?.enMemoria ?? false;
  const { elementos, papelera } = useRecuentos();
  const actual = espacio?.id;
  // Los demás espacios de este navegador (un espacio nuevo importado): se pueden abrir.
  const [otros, setOtros] = useState(() => espaciosConocidos().filter((e) => e.id !== actual));
  const [aBorrar, setABorrar] = useState<{ id: string; nombre: string } | null>(null);
  const avisos = useAvisosOpcional();
  async function borrar() {
    const e = aBorrar;
    setABorrar(null);
    if (!e || !actual) return;
    try {
      // Con el ZIP previo en los ajustes (por defecto), primero se descarga su copia.
      const conCopia = espacio?.ajustes().copias.zipPrevio ?? true;
      await borrarEspacio(e.id, {
        abierto: actual,
        ...(conCopia
          ? {
              copiaPrevia: (id: string) =>
                descargarCopiaDeEspacio(id, e.nombre, t('pantallas.datos.motivoBorrar'), crearAlmacenOpfs),
            }
          : {}),
      });
      setOtros((lista) => lista.filter((x) => x.id !== e.id));
      avisos?.avisar(t('pantallas.datos.espacioBorrado', { nombre: e.nombre }));
    } catch {
      avisos?.avisar(t('pantallas.datos.espacioNoBorrado', { nombre: e.nombre }));
    }
  }
  return (
    <Pantalla
      titulo={t('pantallas.datos.titulo')}
      meta={t(enMemoria ? 'espacio.cuidado.metaMemoria' : 'espacio.cuidado.meta', { nombre })}
    >
      <TarjetaCuidado>
        <AccionesCopia />
      </TarjetaCuidado>
      <Detalles resumen={t('pantallas.datos.otras')}>
        <div className="gaps">
          <div className="gap acc">
            <span className="dot" />
            <span className="gbody">{t('pantallas.datos.json')}</span>
            <BotonExportar tipo="json" />
          </div>
        </div>
      </Detalles>
      <Detalles resumen={t('copias.plegado')}>
        <AjustesRecordatorio />
      </Detalles>
      <Detalles resumen={t('pantallas.datos.espacios')}>
        <dl className="kv">
          <dt>{nombre}</dt>
          <dd>{t('pantallas.datos.espacioActivo', { n: elementos })}</dd>
          {otros.map((e) => (
            <div key={e.id} className="contents">
              <dt>{e.nombre}</dt>
              <dd>
                <Boton variante="fantasma" pequeno onClick={() => cambiarDeEspacio(e.id)}>
                  {t('pantallas.datos.abrirEspacio')}
                </Boton>
                <Boton variante="fantasma" pequeno peligro onClick={() => setABorrar(e)}>
                  {t('pantallas.datos.borrarEspacio')}
                </Boton>
              </dd>
            </div>
          ))}
          <dt>{t('pantallas.datos.papelera')}</dt>
          <dd>
            {papelera ? t('pantallas.datos.papeleraN', { n: papelera }) : t('pantallas.datos.papeleraVacia')}{' '}
            <Boton variante="fantasma" pequeno onClick={() => void navegar({ to: '/papelera' })}>
              {t('pantallas.datos.verPapelera')}
            </Boton>
          </dd>
        </dl>
      </Detalles>
      <Dialogo
        abierto={aBorrar !== null}
        alCerrar={() => setABorrar(null)}
        titulo={t('pantallas.datos.borrarEspacioTitulo', { nombre: aBorrar?.nombre ?? '' })}
      >
        <p className="sm">{t('pantallas.datos.borrarEspacioTexto')}</p>
        <div className="row">
          <Boton variante="primario" peligro pequeno onClick={() => void borrar()}>
            {t('pantallas.datos.borrarEspacio')}
          </Boton>
          <Boton pequeno onClick={() => setABorrar(null)}>
            {t('pantallas.inicio.cancelar')}
          </Boton>
        </div>
      </Dialogo>
      <Detalles resumen={t('pantallas.datos.queContiene')}>
        <pre className="tree">{t('pantallas.datos.arbol')}</pre>
      </Detalles>
    </Pantalla>
  );
}
