import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AjustesRecordatorio } from '../../datos/AjustesRecordatorio';
import { cancelarExportacion, useExportacion } from '../../datos/exportacion';
import { useArchivoImportar } from '../../datos/importar/importacion';
import { useExportar } from '../../datos/useExportar';
import { TarjetaCuidado } from '../../espacio/Avisos';
import { cambiarDeEspacio, espaciosConocidos, useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Boton, Detalles } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';
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

/** Los botones de la tarjeta de cuidado o, mientras se exporta, la señal con el porcentaje. */
function AccionesCopia() {
  const { t } = useT();
  const { tipo, porcentaje } = useExportacion();
  if (tipo)
    return (
      <div className="row">
        <Senal
          estado="exportando"
          etiqueta={t(tipo === 'zip' ? 'pantallas.datos.exportandoZip' : 'pantallas.datos.exportandoJson', {
            p: porcentaje,
          })}
        />
        <Boton variante="fantasma" pequeno onClick={cancelarExportacion}>
          {t('pantallas.datos.cancelar')}
        </Boton>
      </div>
    );
  return (
    <div className="row">
      <BotonExportar tipo="zip" />
      <BotonImportar />
    </div>
  );
}

/**
 * Datos y copias: de momento, cuánto ocupa, si está protegido y la última copia (IN-007), y el espacio con su
 * papelera (IN-027); el resto, IN-037.
 */
export function Datos() {
  const { t } = useT();
  const navegar = useNavigate();
  const nombre = useEspacio((s) => s.nombre);
  const enMemoria = useEspacioOpcional()?.enMemoria ?? false;
  const { elementos, papelera } = useRecuentos();
  const actual = useEspacioOpcional()?.id;
  // Los demás espacios de este navegador (un espacio nuevo importado): se pueden abrir.
  const [otros] = useState(() => espaciosConocidos().filter((e) => e.id !== actual));
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
      <Detalles resumen={t('pantallas.datos.queContiene')}>
        <pre className="tree">{t('pantallas.datos.arbol')}</pre>
      </Detalles>
    </Pantalla>
  );
}
