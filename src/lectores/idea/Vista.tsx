/**
 * Vista del lector Idea: el texto y su estado, que se cambia aquí (salvo «convertida», que pone IN-070). Puede
 * tener también un estado común (archivada desde Inicio, resuelta): se nombra y el segmentado queda sin marcar.
 */
import { isoConZona } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Segmentado, Tarjeta } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import type { PropsVista } from '../contrato';
import { cifrasDe, DetallesElemento } from '../DetallesElemento';
import { nombreDeEstado } from '../nombreEstado';
import { type DatosIdea, ESTADOS_ELEGIBLES, ESTADOS_IDEA, type EstadoIdea, lectorIdea } from './lector';
import { estadoDe } from './resurgir';
import { textos } from './textos';

export default function VistaIdea({ el, datos, editable = true }: PropsVista<DatosIdea>) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const avisos = useAvisosOpcional();
  const id = el.frontmatter.id;
  const [estado, setEstado] = useState<string>(estadoDe(el.frontmatter));

  // El estado puede cambiar desde fuera (Inicio, otra pestaña): se sigue al repositorio.
  useEffect(() => {
    if (!espacio) return undefined;
    const seguir = () => {
      const fm = espacio.repositorio.frontmatter(id);
      if (fm) setEstado(estadoDe(fm));
    };
    seguir();
    return espacio.alCambiar(seguir);
  }, [espacio, id]);

  const puede = Boolean(espacio) && editable && !soloLectura && estado !== 'convertida';
  const nombre = (ESTADOS_IDEA as readonly string[]).includes(estado)
    ? textos.t(idioma, `estados.${estado as EstadoIdea}`)
    : nombreDeEstado(estado, lectorIdea, idioma);

  async function cambiar(nuevo: EstadoIdea) {
    if (!espacio || nuevo === estado) return;
    const previo = estado;
    setEstado(nuevo);
    // `vuelve` se conserva: una idea pospuesta que vuelve a «semilla» sigue esperando a su fecha.
    const r = await espacio.repositorio
      .actualizarElemento(id, (actual) => ({
        ...actual,
        frontmatter: { ...actual.frontmatter, estado: nuevo, modificado: isoConZona(new Date()) },
      }))
      .catch(() => null);
    if (!r?.ok) {
      setEstado(previo);
      avisos?.avisar(textos.t(idioma, 'noGuardado'));
    }
  }

  return (
    <>
      <Tarjeta>
        <p>{el.original}</p>
        {puede ? (
          <Segmentado
            etiqueta={textos.t(idioma, 'estado')}
            // Con un estado común, ninguna opción marcada.
            valor={estado as EstadoIdea}
            alCambiar={(v) => void cambiar(v)}
            opciones={ESTADOS_ELEGIBLES.map((e) => ({ valor: e, etiqueta: textos.t(idioma, `estados.${e}`) }))}
          />
        ) : (
          <p className="sm muted">{nombre}</p>
        )}
      </Tarjeta>
      <DetallesElemento refe={el.frontmatter.ref} cifras={cifrasDe(lectorIdea, datos)} />
    </>
  );
}
