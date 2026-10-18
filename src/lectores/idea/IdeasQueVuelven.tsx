/**
 * Ideas que vuelven (ORG-13 mínimo): en Inicio, cada idea en semilla cuya vuelta llegó, como el mensaje de la
 * pantalla de referencia («Hace 7 días guardaste una idea: …. ¿Sigue en pie?») con [Más adelante] y [Descartar].
 * «Convertir en investigación» no se ofrece hasta IN-070 (incoherencia 2).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import { Boton } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { descartar, diasDesde, posponer, vuelven } from './resurgir';
import { textos } from './textos';

interface Props {
  /** El reloj (las pruebas lo simulan). */
  reloj?: () => Date;
}

export function IdeasQueVuelven({ reloj = () => new Date() }: Props) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const [ideas, setIdeas] = useState<FrontmatterComun[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: el reloj se lee al recalcular; cambiarlo no recalcula.
  useEffect(() => {
    if (!espacio) return undefined;
    const calcular = () => setIdeas(vuelven(espacio.repositorio.elementos(), reloj()));
    calcular();
    return espacio.alCambiar(calcular);
  }, [espacio]);

  if (!espacio || !ideas.length) return null;
  const t = (clave: Parameters<typeof textos.t>[1], vars?: Record<string, number>) => textos.t(idioma, clave, vars);

  async function actuar(fm: FrontmatterComun, cambio: (f: FrontmatterComun) => FrontmatterComun, aviso: string) {
    const r = await espacio?.repositorio
      .actualizarElemento(fm.id, (el) => ({ ...el, frontmatter: cambio(el.frontmatter) }))
      .catch(() => null);
    if (r?.ok) avisos?.avisar(aviso);
  }

  return (
    <>
      {ideas.map((fm) => (
        <article key={fm.id} className="msg">
          <RespuestaRimor
            respuesta={{
              texto: [
                { t: 'texto', v: t('vuelve', { n: diasDesde(fm, reloj()) }) },
                { t: 'fuerte', v: fm.titulo },
                { t: 'texto', v: t('sigue') },
              ],
            }}
          />
          <div className="mact">
            <Boton pequeno onClick={() => void actuar(fm, (f) => posponer(f, reloj()), t('pospuesta'))}>
              {t('masAdelante')}
            </Boton>
            <Boton pequeno onClick={() => void actuar(fm, descartar, t('descartadaAviso'))}>
              {t('descartar')}
            </Boton>
          </div>
        </article>
      ))}
    </>
  );
}
