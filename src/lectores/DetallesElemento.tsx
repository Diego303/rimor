/**
 * El plegado «Detalles» de la vista de un lector, uno por pantalla como en la referencia: las filas propias del
 * lector, lo común del elemento que pone la pantalla (colecciones, etiquetas, origen, tipo, referencia…, con
 * `ContextoDetalles`) y las cifras que se pueden citar. Es el último plegado (guía §8.2: los metadatos al final):
 * los de la pantalla (las versiones) van justo antes, con `ContextoAntesDeDetalles`.
 */
import type { Elemento } from '@rimor/formato';
import { createContext, type ReactNode, useContext } from 'react';
import { useT } from '../i18n/useT';
import { Detalles } from '../ui/componentes';
import type { Contexto, Lector } from './contrato';

/** Filas `dt`/`dd` comunes a cualquier elemento; las pone la pantalla del elemento (fuera de ella, ninguna). */
export const ContextoDetalles = createContext<ReactNode>(null);

/** Plegados de la pantalla del elemento que van antes de «Detalles» (los cambios y la lista de versiones). */
export const ContextoAntesDeDetalles = createContext<ReactNode>(null);

/** Solo esos plegados: mientras la vista aún no pinta su «Detalles» (calculando, o cargando su trozo). */
export function AntesDeDetalles() {
  return useContext(ContextoAntesDeDetalles);
}

/** Una cifra citable ya escrita: nombre y texto. */
export type CifraEscrita = readonly [nombre: string, texto: string];

/** Las cifras citables de un lector con sus datos (y el contexto, para las que dependen de otros elementos). */
export function cifrasDe<D>(lector: Lector<D>, datos: D, ctx?: Contexto, el?: Elemento): CifraEscrita[] {
  return Object.entries(lector.cifras ?? {}).map(([nombre, f]) => [nombre, f(datos, ctx, el).texto] as const);
}

interface Props {
  /** La ref del elemento, para la sintaxis de cita (`{{LOG-0047.nombre}}`). */
  refe: string;
  cifras?: readonly CifraEscrita[];
  /** Filas propias del lector (`dt`/`dd`), antes de las comunes. */
  children?: ReactNode;
  /** Lo que el lector añade después de las filas (los estadísticos de cada serie, el frontmatter del documento). */
  anexo?: ReactNode;
}

export function DetallesElemento({ refe, cifras = [], children, anexo }: Props) {
  const { t } = useT();
  const comunes = useContext(ContextoDetalles);
  const antes = useContext(ContextoAntesDeDetalles);
  const conFilas = Boolean(children) || Boolean(comunes);
  if (!conFilas && !anexo && !cifras.length) return antes;
  return (
    <>
      {antes}
      <Detalles resumen={t('lectores.detalles')}>
        {conFilas && (
          <dl className="kv">
            {children}
            {comunes}
          </dl>
        )}
        {anexo}
        {cifras.length > 0 && (
          <>
            <p className="xs muted">
              {t('lectores.cifras')} <span className="mono">{t('lectores.sintaxisCifra', { ref: refe })}</span>:
            </p>
            <div className="row">
              {cifras.map(([nombre, valor]) => (
                <span key={nombre} className="st">
                  <span className="mono">{nombre}</span> {valor}
                </span>
              ))}
            </div>
          </>
        )}
      </Detalles>
    </>
  );
}
