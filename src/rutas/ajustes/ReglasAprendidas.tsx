/**
 * Las reglas de detección aprendidas (IN-049, CAP-06) en Ajustes: cada una con su prefijo (se guarda al salir del
 * campo), su tipo y «Borrar». Se crean desde el feed, cuando Rimor las propone. Si el archivo no se entiende, se dice
 * y no se toca.
 */
import { TIPOS_ELEMENTO, type TipoElemento } from '@rimor/formato';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  borrarRegla,
  type DatosReglas,
  editarRegla,
  LARGO_PREFIJO,
  prefijoValido,
  REGLAS_INICIALES,
} from '../../captura/reglas';
import { ErrorReglasIlegibles } from '../../espacio/abrir';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { useAvisosOpcional } from '../../ui/componentes/Avisos';
import { Icono } from '../../ui/iconos/Icono';

/** Los binarios no se detectan por su texto: una regla no puede llevar a ellos. */
const BINARIOS: ReadonlySet<TipoElemento> = new Set(['imagen', 'pdf', 'archivo']);

export function ReglasAprendidas({ editable }: { editable: boolean }) {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const lectores = useLectoresOpcional();
  const titulo = useRef<HTMLHeadingElement>(null);
  const [datos, setDatos] = useState<DatosReglas>(() => espacio?.reglas() ?? REGLAS_INICIALES);
  const [legibles, setLegibles] = useState(() => espacio?.reglasLegibles() ?? true);
  // Al día con las de ahora (también una que se acaba de aceptar en el feed o en la otra pestaña).
  useEffect(
    () =>
      espacio
        ? espacio.alCambiar(() => {
            setDatos(espacio.reglas());
            setLegibles(espacio.reglasLegibles());
          })
        : undefined,
    [espacio],
  );
  // Los prefijos mientras se escriben (por el prefijo guardado de su regla); se guardan al salir del campo.
  const [escritos, setEscritos] = useState<Record<string, string>>({});
  const [noVale, setNoVale] = useState<string | null>(null);

  // Los tipos que tienen lector (sin los binarios).
  const tipos = useMemo(() => {
    const conLector = new Set<TipoElemento>(lectores?.registro.lectores.map((l) => l.tipo) ?? TIPOS_ELEMENTO);
    return TIPOS_ELEMENTO.filter((tipo) => conLector.has(tipo) && !BINARIOS.has(tipo));
  }, [lectores]);

  const guardar = (cambio: (d: DatosReglas) => DatosReglas) => {
    if (!espacio || !editable) return;
    void espacio
      .guardarReglas(cambio)
      .catch((e) =>
        avisos?.avisar(t(e instanceof ErrorReglasIlegibles ? 'ajustes.reglasNoGuardadas' : 'ajustes.noGuardado')),
      );
    setDatos(espacio.reglas());
  };

  function guardarPrefijo(prefijo: string) {
    const escrito = escritos[prefijo];
    setEscritos((x) => {
      const resto = { ...x };
      delete resto[prefijo];
      return resto;
    });
    if (escrito === undefined || escrito === prefijo) return setNoVale(null);
    if (!prefijoValido(escrito) || datos.reglas.some((r) => r.prefijo === escrito)) return setNoVale(prefijo);
    setNoVale(null);
    guardar((d) => editarRegla(d, prefijo, { prefijo: escrito }));
  }

  return (
    <div className="ajustes-reglas">
      <h4 ref={titulo} tabIndex={-1}>
        {t('ajustes.reglas')}
      </h4>
      {!legibles ? (
        <p className="xs warn-texto">{t('ajustes.reglasIlegibles')}</p>
      ) : datos.reglas.length ? (
        <>
          <p className="xs muted">{t('ajustes.reglasTexto')}</p>
          {datos.reglas.map((r, i) => (
            <div key={r.prefijo} className="ajustes-regla">
              <input
                type="text"
                spellCheck={false}
                autoComplete="off"
                maxLength={LARGO_PREFIJO}
                aria-label={t('ajustes.reglaPrefijo', { n: i + 1 })}
                aria-invalid={noVale === r.prefijo || undefined}
                value={escritos[r.prefijo] ?? r.prefijo}
                disabled={!editable}
                onChange={(e) => setEscritos((x) => ({ ...x, [r.prefijo]: e.target.value }))}
                onBlur={() => guardarPrefijo(r.prefijo)}
              />
              <select
                aria-label={t('ajustes.reglaTipo', { n: i + 1 })}
                value={r.tipo}
                disabled={!editable}
                onChange={(e) => guardar((d) => editarRegla(d, r.prefijo, { tipo: e.target.value as TipoElemento }))}
              >
                {/* Si su tipo ya no tiene lector, sigue en la lista: que se vea qué dice. */}
                {(tipos.includes(r.tipo) ? tipos : [r.tipo, ...tipos]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {t(`tipos.${tipo}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ibtn"
                aria-label={t('ajustes.reglaBorrar', { prefijo: r.prefijo })}
                disabled={!editable}
                onClick={() => {
                  setNoVale(null);
                  guardar((d) => borrarRegla(d, r.prefijo));
                  // El botón desaparece: el foco, al título de la lista (no al principio de la página).
                  titulo.current?.focus();
                }}
              >
                <Icono nombre="papelera" tamano={14} />
              </button>
            </div>
          ))}
          {/* Región viva siempre presente: el aviso se anuncia al salir de un prefijo que no vale. */}
          <p className="xs warn-texto" role="status">
            {noVale !== null ? t('ajustes.reglaNoVale') : ''}
          </p>
        </>
      ) : (
        <p className="xs muted">{t('ajustes.reglasVacio')}</p>
      )}
    </div>
  );
}
