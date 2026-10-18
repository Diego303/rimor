/** Vista del lector Idea: el texto y su estado, que se cambia aquí (salvo «convertida», que pone IN-070). */
import { useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { Segmentado, Tarjeta } from '../../ui/componentes';
import type { PropsVista } from '../contrato';
import { ESTADOS_ELEGIBLES, type EstadoIdea } from './lector';
import { textos } from './textos';

export default function VistaIdea({ el }: PropsVista) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const inicial = (el.frontmatter.estado ?? 'semilla') as EstadoIdea;
  const [estado, setEstado] = useState<EstadoIdea>(inicial);
  const puede = Boolean(espacio?.repositorio.escribible()) && ESTADOS_ELEGIBLES.includes(estado);

  async function cambiar(nuevo: EstadoIdea) {
    if (!espacio || nuevo === estado) return;
    const previo = estado;
    setEstado(nuevo);
    const r = await espacio.repositorio
      .actualizarElemento(el.frontmatter.id, (actual) => {
        const { vuelve: _vuelve, ...resto } = actual.frontmatter;
        // Fuera de «semilla», deja de volver; si vuelve a semilla, cuenta de nuevo desde que se guardó.
        return { ...actual, frontmatter: { ...resto, estado: nuevo } as typeof actual.frontmatter };
      })
      .catch(() => null);
    if (!r?.ok) setEstado(previo);
  }

  return (
    <Tarjeta>
      <p>{el.original}</p>
      {puede ? (
        <Segmentado
          etiqueta={textos.t(idioma, 'estado')}
          valor={estado}
          alCambiar={(v) => void cambiar(v)}
          opciones={ESTADOS_ELEGIBLES.map((e) => ({ valor: e, etiqueta: textos.t(idioma, `estados.${e}`) }))}
        />
      ) : (
        <p className="sm muted">{textos.t(idioma, `estados.${estado}`)}</p>
      )}
    </Tarjeta>
  );
}
