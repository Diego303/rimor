/**
 * Ajustes (APP-04): lo que se puede cambiar de Rimor, guardado al momento en `.rimor/ajustes.json` (y el tema y el
 * idioma también en este navegador, para pintar sin parpadeo). La referencia no dibuja esta pantalla: se compone
 * como Datos y copias, con sus piezas: tres tarjetas abiertas (guía §8.3: apariencia, detección y respuestas) y lo
 * que se toca menos plegado (secretos, recordatorio de copia y red).
 */
import { TIPOS_ELEMENTO } from '@rimor/formato';
import { type ReactNode, useEffect, useState } from 'react';
import { AjustesRecordatorio } from '../../datos/AjustesRecordatorio';
import { AJUSTES_INICIALES, type Ajustes as AjustesEspacio, LIMITES_DETECCION } from '../../espacio/ajustes';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import type { Idioma } from '../../i18n/formatos';
import { elegirIdioma } from '../../i18n/iniciar';
import { useT } from '../../i18n/useT';
import { GRUPOS_DOMINIOS, guardarTokenGithub, leerTokenGithub } from '../../lectores/enlace/enriquecer/dominios';
import { REGLAS_SECRETOS } from '../../seguridad/secretos/reglas';
import { Detalles, Segmentado, SelectorTema } from '../../ui/componentes';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { leerPreferencia } from '../../ui/tema/tema';
import { Pantalla } from '../Pantalla';

/** Las reglas de secretos por lo que ocultan (`aws` agrupa la clave y el secreto). */
const TIPOS_SECRETO = [...new Set(REGLAS_SECRETOS.map((r) => r.tipo))];
const reglasDe = (tipo: string) => REGLAS_SECRETOS.filter((r) => r.tipo === tipo).map((r) => r.id);

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="card ajustes" aria-label={titulo}>
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

export function Ajustes() {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const [ajustes, setAjustes] = useState<AjustesEspacio>(() => espacio?.ajustes() ?? AJUSTES_INICIALES);
  // Al día con los ajustes de ahora (también lo que cambia la otra pestaña).
  useEffect(() => (espacio ? espacio.alCambiar(() => setAjustes(espacio.ajustes())) : undefined), [espacio]);
  // El token de GitHub es de este navegador (no del espacio): se guarda al salir del campo.
  const [token, setToken] = useState(() => leerTokenGithub() ?? '');
  const [secretosAbiertos] = useState(() => ajustes.secretos.desactivadas.length > 0);
  const [duda, setDuda] = useState(Math.round(ajustes.deteccion.duda * 100));
  useEffect(() => setDuda(Math.round(ajustes.deteccion.duda * 100)), [ajustes.deteccion.duda]);

  const editable = Boolean(espacio) && !soloLectura;
  const guardar = (cambio: (a: AjustesEspacio) => AjustesEspacio) => {
    if (!espacio || soloLectura) return;
    // Si no se pudo escribir, se dice: lo cambiado vale ahora, pero no estaría al volver a abrir.
    void espacio.guardarAjustes(cambio).catch(() => avisos?.avisar(t('ajustes.noGuardado')));
    setAjustes(espacio.ajustes());
  };

  // El margen se guarda un momento después de dejar de moverlo (ratón, teclado o dedo) y solo si cambió.
  useEffect(() => {
    if (!espacio || duda / 100 === espacio.ajustes().deteccion.duda) return undefined;
    const espera = setTimeout(() => guardar((a) => ({ ...a, deteccion: { ...a.deteccion, duda: duda / 100 } })), 400);
    return () => clearTimeout(espera);
  });
  const alternar = <T extends string>(lista: readonly T[], valores: readonly T[], activar: boolean): T[] =>
    activar ? lista.filter((x) => !valores.includes(x)) : [...new Set([...lista, ...valores])];

  return (
    <Pantalla titulo={t('pantallas.ajustes.titulo')} meta={soloLectura ? t('ajustes.soloLectura') : t('ajustes.meta')}>
      <Seccion titulo={t('ajustes.apariencia')}>
        <div className="kv ajustes-kv">
          <span className="sm">{t('tema.etiqueta')}</span>
          <SelectorTema
            valor={ajustes.tema ?? leerPreferencia()}
            deshabilitado={soloLectura}
            alCambiar={(tema) => guardar((a) => ({ ...a, tema }))}
          />
          <span className="sm">{t('idioma.etiqueta')}</span>
          <Segmentado<Idioma>
            etiqueta={t('idioma.etiqueta')}
            valor={idioma}
            deshabilitado={soloLectura}
            opciones={[
              { valor: 'es', etiqueta: t('idioma.es') },
              { valor: 'en', etiqueta: t('idioma.en') },
            ]}
            alCambiar={(nuevo) => {
              elegirIdioma(nuevo);
              guardar((a) => ({ ...a, idioma: nuevo }));
            }}
          />
        </div>
      </Seccion>

      <Seccion titulo={t('ajustes.deteccion')}>
        <label className="chk ajustes-rango">
          <span>{t('ajustes.duda', { n: duda })}</span>
          <input
            type="range"
            min={LIMITES_DETECCION.duda[0] * 100}
            max={LIMITES_DETECCION.duda[1] * 100}
            step={1}
            value={duda}
            disabled={!editable}
            aria-label={t('ajustes.dudaEtiqueta')}
            onChange={(e) => setDuda(Number(e.target.value))}
          />
        </label>
        <p className="xs muted">{t('ajustes.dudaTexto')}</p>
      </Seccion>

      <Seccion titulo={t('ajustes.respuestas')}>
        <p className="xs muted">{t('ajustes.respuestasTexto')}</p>
        <div className="ajustes-casillas">
          {TIPOS_ELEMENTO.map((tipo) => (
            <label key={tipo} className="chk">
              <input
                type="checkbox"
                checked={!ajustes.respuestas.desactivadas.includes(tipo)}
                disabled={!editable}
                onChange={(e) =>
                  guardar((a) => ({
                    ...a,
                    respuestas: {
                      ...a.respuestas,
                      desactivadas: alternar(a.respuestas.desactivadas, [tipo], e.target.checked),
                    },
                  }))
                }
              />
              <span>{t(`tipos.${tipo}`)}</span>
            </label>
          ))}
        </div>
      </Seccion>

      {/* Con alguna regla desactivada, abierto: su aviso tiene que verse. */}
      <Detalles resumen={t('ajustes.secretos')} {...(secretosAbiertos ? { abierto: true } : {})}>
        <p className="xs muted">{t('ajustes.secretosTexto')}</p>
        <div className="ajustes-casillas">
          {TIPOS_SECRETO.map((tipo) => {
            const ids = reglasDe(tipo);
            const activa = !ids.some((id) => ajustes.secretos.desactivadas.includes(id));
            return (
              <label key={tipo} className="chk">
                <input
                  type="checkbox"
                  checked={activa}
                  disabled={!editable}
                  onChange={(e) =>
                    guardar((a) => ({
                      ...a,
                      secretos: {
                        ...a.secretos,
                        desactivadas: alternar(a.secretos.desactivadas, ids, e.target.checked),
                      },
                    }))
                  }
                />
                <span>{t(`ajustes.tiposSecreto.${tipo}` as Parameters<typeof t>[0])}</span>
              </label>
            );
          })}
        </div>
        {/* Región viva siempre presente: el aviso se anuncia al desactivar una regla. */}
        <p className="xs warn-texto" role="status">
          {ajustes.secretos.desactivadas.length > 0 ? t('ajustes.secretosAviso') : ''}
        </p>
      </Detalles>

      <Detalles resumen={t('copias.plegado')}>
        <AjustesRecordatorio />
      </Detalles>

      <Detalles resumen={t('ajustes.red')}>
        <p className="xs muted">{t('ajustes.redTexto')}</p>
        {GRUPOS_DOMINIOS.map(({ grupo, dominios }) => (
          <fieldset key={grupo} className="ajustes-dominios">
            <legend className="xs muted">{t(`ajustes.gruposRed.${grupo}`)}</legend>
            <div className="ajustes-casillas">
              {dominios.map((dominio) => (
                <label key={dominio} className="chk">
                  <input
                    type="checkbox"
                    checked={ajustes.red.dominios.includes(dominio)}
                    disabled={!editable}
                    onChange={(e) =>
                      guardar((a) => ({
                        ...a,
                        red: { ...a.red, dominios: alternar(a.red.dominios, [dominio], !e.target.checked) },
                      }))
                    }
                  />
                  <span className="mono xs">{dominio}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="ajustes-token">
          <span className="sm">{t('ajustes.tokenGithub')}</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onBlur={() => guardarTokenGithub(token)}
          />
          <span className="xs muted">{t('ajustes.tokenTexto')}</span>
        </label>
      </Detalles>
    </Pantalla>
  );
}
