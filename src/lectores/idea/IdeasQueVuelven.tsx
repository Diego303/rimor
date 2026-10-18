/**
 * Ideas que vuelven (ORG-13 mínimo): en Inicio, cada idea en semilla cuya vuelta llegó, como el mensaje de la
 * pantalla de referencia («Hace 7 días guardaste una idea: …. ¿Sigue en pie?») con [Más adelante] y [Descartar].
 * «Convertir en investigación» no se ofrece hasta IN-070 (incoherencia 2).
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { RespuestaRimor } from '../../respuestas/RespuestaRimor';
import { Boton } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { descartar, diasDesde, posponer, proximaVuelta, vuelven } from './resurgir';
import { textos } from './textos';

/** Como mucho se espera esto entre repasos, aunque no toque ninguna vuelta (relojes que saltan, suspensión). */
const REPASO_MAXIMO_MS = 60 * 60 * 1000;

interface Props {
  /** El reloj (las pruebas lo simulan). */
  reloj?: () => Date;
}

export function IdeasQueVuelven({ reloj = () => new Date() }: Props) {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const avisos = useAvisosOpcional();
  const [ideas, setIdeas] = useState<FrontmatterComun[]>([]);

  // Se recalcula con cada cambio del espacio y, con la app abierta, cuando le toca volver a la siguiente.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el reloj se lee al recalcular; cambiarlo no recalcula.
  useEffect(() => {
    if (!espacio) return undefined;
    let despertador: ReturnType<typeof setTimeout> | undefined;
    const calcular = () => {
      clearTimeout(despertador);
      const ahora = reloj();
      const elementos = espacio.repositorio.elementos();
      setIdeas(vuelven(elementos, ahora));
      const proxima = proximaVuelta(elementos, ahora);
      const espera = proxima === null ? REPASO_MAXIMO_MS : Math.min(proxima - ahora.getTime() + 1000, REPASO_MAXIMO_MS);
      despertador = setTimeout(calcular, Math.max(espera, 1000));
    };
    calcular();
    const baja = espacio.alCambiar(calcular);
    return () => {
      baja();
      clearTimeout(despertador);
    };
  }, [espacio]);

  if (!espacio || !ideas.length) return null;
  const t = (clave: Parameters<typeof textos.t>[1], vars?: Record<string, number>) => textos.t(idioma, clave, vars);

  async function actuar(fm: FrontmatterComun, cambio: (f: FrontmatterComun) => FrontmatterComun, aviso: string) {
    const r = await espacio?.repositorio
      .actualizarElemento(fm.id, (el) => ({ ...el, frontmatter: cambio(el.frontmatter) }))
      .catch(() => null);
    // Nunca en silencio: si no se pudo guardar, se dice.
    avisos?.avisar(r?.ok ? aviso : t('noGuardado'));
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
          {/* En una pestaña que solo lee no se ofrece lo que no podría guardarse. */}
          {!soloLectura && (
            <div className="mact">
              <Boton pequeno onClick={() => void actuar(fm, (f) => posponer(f, reloj()), t('pospuesta'))}>
                {t('masAdelante')}
              </Boton>
              <Boton pequeno onClick={() => void actuar(fm, (f) => descartar(f, reloj()), t('descartadaAviso'))}>
                {t('descartar')}
              </Boton>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
