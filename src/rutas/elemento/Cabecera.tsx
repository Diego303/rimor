/**
 * Cabecera de la pantalla de un elemento, como `head` de la referencia: chips de tipo y estado, el título (que se
 * edita en el sitio), la línea de meta («Pegado hoy a las 17:49 · Rust») y, a la derecha, fijar y papelera.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { estadoVisible, tonoDeEstado } from '../../espacio/estados';
import { diasDesde, fmtDia, fmtHora, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import type { Lector } from '../../lectores/contrato';
import { clases } from '../../ui/clases';
import { Boton, ChipTipo, Estado } from '../../ui/componentes';
import { EnSitio } from '../../ui/componentes/EnSitio';
import { nombreDeEstado } from './estados';

type T = ReturnType<typeof useT>['t'];

/** «hoy a las 17:49», «ayer a las 18:21» o «el 2 oct a las 10:40»; vacío si la fecha no se entiende. */
export function cuandoDe(fecha: Date, ahora: Date, idioma: Idioma, t: T): string {
  const dias = diasDesde(fecha, ahora);
  if (!Number.isFinite(dias)) return '';
  const hora = fmtHora(fecha);
  if (dias === 0) return t('pantallas.elemento.cuando.hoy', { hora });
  if (dias === 1) return t('pantallas.elemento.cuando.ayer', { hora });
  return t('pantallas.elemento.cuando.otro', { dia: fmtDia(fecha, ahora, idioma), hora });
}

/** La línea de meta: de dónde vino y cuándo, y el resumen del lector. */
export function metaDe(fm: FrontmatterComun, legible: string, ahora: Date, idioma: Idioma, t: T): string {
  const cuando = cuandoDe(new Date(fm.creado), ahora, idioma, t);
  const origen = cuando
    ? t(`pantallas.elemento.origen.${fm.origen}`, { cuando })
    : t(`pantallas.elemento.origenes.${fm.origen}`);
  return legible ? `${origen} · ${legible}` : origen;
}

interface PropsMarcas {
  fm: FrontmatterComun;
  lector: Lector | null;
  editable: boolean;
  alPedirEstado: () => void;
}

/** Chip de tipo y de estado; el de estado, si se puede editar, abre la lista de estados. */
export function MarcasElemento({ fm, lector, editable, alPedirEstado }: PropsMarcas) {
  const { t, idioma } = useT();
  const estado = estadoVisible(fm.estado, lector);
  const nombre = nombreDeEstado(estado, lector, idioma);
  const tono = tonoDeEstado(estado);
  return (
    <>
      <ChipTipo tipo={fm.tipo} />
      {editable ? (
        <button
          type="button"
          className={clases('st', tono !== 'neutro' && tono, 'st-boton')}
          aria-haspopup="dialog"
          aria-label={t('pantallas.elemento.cambiarEstado', { estado: nombre })}
          onClick={alPedirEstado}
        >
          {nombre}
        </button>
      ) : (
        <Estado tono={tono}>{nombre}</Estado>
      )}
    </>
  );
}

interface PropsTitulo {
  titulo: string;
  editable: boolean;
  editando: boolean;
  alEditar: (si: boolean) => void;
  alGuardar: (titulo: string) => void;
}

/** El título; se edita en el sitio. */
export function TituloElemento({ titulo, editable, editando, alEditar, alGuardar }: PropsTitulo) {
  const { t } = useT();
  return (
    <EnSitio
      valor={titulo}
      editando={editando}
      soloLectura={!editable}
      etiqueta={editando ? t('pantallas.elemento.campoTitulo') : t('pantallas.elemento.editarTitulo')}
      alEmpezar={() => alEditar(true)}
      alTerminar={(texto) => {
        alEditar(false);
        if (texto !== null) alGuardar(texto);
      }}
    >
      {titulo}
    </EnSitio>
  );
}

interface PropsAcciones {
  fijado: boolean;
  enPapelera: boolean;
  alFijar: () => void;
  alPapelera: () => void;
  alRestaurar: () => void;
}

/** A la derecha de la cabecera: fijar y mover a la papelera; en la papelera, restaurar. */
export function AccionesElemento({ fijado, enPapelera, alFijar, alPapelera, alRestaurar }: PropsAcciones) {
  const { t } = useT();
  if (enPapelera)
    return (
      <Boton variante="primario" pequeno onClick={alRestaurar}>
        {t('pantallas.elemento.restaurar')}
      </Boton>
    );
  const fijar = t(fijado ? 'pantallas.elemento.soltar' : 'pantallas.elemento.fijar');
  return (
    <div className="row acciones-elemento">
      <Boton variante="icono" icono="fijar" aria-pressed={fijado} aria-label={fijar} title={fijar} onClick={alFijar} />
      <Boton
        variante="icono"
        icono="papelera"
        aria-label={t('pantallas.elemento.aPapelera')}
        title={t('pantallas.elemento.aPapelera')}
        onClick={alPapelera}
      />
    </div>
  );
}
