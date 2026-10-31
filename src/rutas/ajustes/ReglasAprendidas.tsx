/**
 * Las reglas de detección aprendidas (IN-049, CAP-06) en Ajustes: cada una con su prefijo (se guarda al salir del
 * campo), su tipo y «Borrar». Se crean desde el feed, cuando Rimor las propone.
 */
import { TIPOS_ELEMENTO, type TipoElemento } from '@rimor/formato';
import { useEffect, useMemo, useState } from 'react';
import { borrarRegla, type DatosReglas, editarRegla, prefijoValido, REGLAS_INICIALES } from '../../captura/reglas';
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
  const [datos, setDatos] = useState<DatosReglas>(() => espacio?.reglas() ?? REGLAS_INICIALES);
  // Al día con las de ahora (también una que se acaba de aceptar en el feed o en la otra pestaña).
  useEffect(() => (espacio ? espacio.alCambiar(() => setDatos(espacio.reglas())) : undefined), [espacio]);
  // Los prefijos mientras se escriben (por regla); se guardan al salir del campo.
  const [escritos, setEscritos] = useState<Record<number, string>>({});
  const [noVale, setNoVale] = useState<number | null>(null);

  // Los tipos que tienen lector (sin los binarios).
  const tipos = useMemo(() => {
    const conLector = new Set<TipoElemento>(lectores?.registro.lectores.map((l) => l.tipo) ?? TIPOS_ELEMENTO);
    return TIPOS_ELEMENTO.filter((tipo) => conLector.has(tipo) && !BINARIOS.has(tipo));
  }, [lectores]);

  const guardar = (cambio: (d: DatosReglas) => DatosReglas) => {
    if (!espacio || !editable) return;
    void espacio.guardarReglas(cambio).catch(() => avisos?.avisar(t('ajustes.noGuardado')));
    setDatos(espacio.reglas());
  };

  function guardarPrefijo(i: number) {
    const escrito = escritos[i];
    setEscritos((x) => {
      const resto = { ...x };
      delete resto[i];
      return resto;
    });
    const actual = datos.reglas[i];
    if (escrito === undefined || !actual || escrito === actual.prefijo) return setNoVale(null);
    const otra = datos.reglas.some((r, j) => j !== i && r.prefijo === escrito);
    if (!prefijoValido(escrito) || otra) return setNoVale(i);
    setNoVale(null);
    guardar((d) => editarRegla(d, i, { prefijo: escrito }));
  }

  return (
    <div className="ajustes-reglas">
      <h4>{t('ajustes.reglas')}</h4>
      {datos.reglas.length ? (
        <>
          <p className="xs muted">{t('ajustes.reglasTexto')}</p>
          {datos.reglas.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: el prefijo cambia al editarlo; la posición es la regla.
            <div key={i} className="ajustes-regla">
              <input
                type="text"
                spellCheck={false}
                autoComplete="off"
                aria-label={t('ajustes.reglaPrefijo')}
                aria-invalid={noVale === i || undefined}
                value={escritos[i] ?? r.prefijo}
                disabled={!editable}
                onChange={(e) => setEscritos((x) => ({ ...x, [i]: e.target.value }))}
                onBlur={() => guardarPrefijo(i)}
              />
              <select
                aria-label={t('ajustes.reglaTipo')}
                value={r.tipo}
                disabled={!editable}
                onChange={(e) => guardar((d) => editarRegla(d, i, { tipo: e.target.value as TipoElemento }))}
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
                  setEscritos({});
                  setNoVale(null);
                  guardar((d) => borrarRegla(d, i));
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
