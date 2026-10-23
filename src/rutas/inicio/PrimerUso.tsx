/**
 * Bienvenida del primer uso (APP-03; espacio sin nada): la señal con el logotipo y «Del rumor a la conclusión», qué es
 * Rimor en dos frases y tres ejemplos que llenan el compositor al pulsarlos (no se guardan solos: se ve cómo se
 * guardarían y se decide). Debajo, un espacio de ejemplo para explorar sin tocar este y, si el navegador lo
 * ofrece, instalar la app.
 */
import { useState } from 'react';
import { crearAlmacenOpfs } from '../../almacen/opfs/cliente';
import { useCompositor } from '../../captura/compositor';
import { crearEspacioDeEjemplo } from '../../datos/ejemplo/crear';
import { cambiarDeEspacio, recordarEspacioConocido, useEspacioOpcional } from '../../espacio/Espacio';
import { instalar, useInstalacion } from '../../espacio/instalar';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { useLectoresOpcional } from '../../lectores/Lectores';
import { Boton, IconoTipo } from '../../ui/componentes';
import { Senal } from '../../ui/marca/Senal';

/** Ejemplos de qué pegar: un log del gateway, su traza y unas mediciones. */
export const EJEMPLOS = {
  log: [
    '2026-10-17T17:40:01Z INFO  gateway: request id=7f3a model=llama3.1:8b',
    '2026-10-17T17:40:15Z WARN  http: response has no content-length, reading body to end',
    '2026-10-17T17:40:45Z ERROR stream: read timeout after 30000ms',
    '2026-10-17T17:41:02Z INFO  gateway: retry 1/2 id=7f3a',
  ].join('\n'),
  error: [
    "thread 'tokio-runtime-worker' panicked at src/gateway/stream.rs:142:17:",
    'called `Result::unwrap()` on an `Err` value: Timeout',
    'stack backtrace:',
    '   0: gateway::stream::next_chunk',
    '             at ./src/gateway/stream.rs:142:17',
  ].join('\n'),
  mediciones: ['# reqwest · 64 KB', '38.41 ms', '39.02 ms', '37.88 ms', '38.76 ms', '40.12 ms'].join('\n'),
} as const;

type EstadoEjemplo =
  | { fase: 'nada' }
  | { fase: 'creando' }
  | { fase: 'listo'; id: string; nombre: string }
  | { fase: 'fallo' };

export function PrimerUso() {
  const { t } = useT();
  const recibir = useCompositor((s) => s.recibir);
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const instalable = useInstalacion((s) => s.aviso !== null);
  const [ejemplo, setEjemplo] = useState<EstadoEjemplo>({ fase: 'nada' });
  // Un espacio nuevo necesita OPFS: en memoria no se ofrece.
  const conEjemplo = Boolean(espacio && lectores && !espacio.enMemoria);

  async function crearEjemplo() {
    if (!espacio || !lectores) return;
    setEjemplo({ fase: 'creando' });
    try {
      const creado = await crearEspacioDeEjemplo(espacio, lectores.registro, {
        crearAlmacen: crearAlmacenOpfs,
        alCrearEspacio: recordarEspacioConocido,
      });
      setEjemplo({ fase: 'listo', ...creado });
    } catch {
      setEjemplo({ fase: 'fallo' });
    }
  }

  return (
    <div className="empty primer-uso">
      <Senal
        estado="primer-uso"
        veces={1}
        tamano={40}
        etiqueta={t('pantallas.inicio.primerUsoTitulo')}
        frase={t('pantallas.inicio.primerUsoFrase')}
      />
      <span className="sm">{t('pantallas.inicio.primerUsoTexto')}</span>
      <div className="row ejemplos">
        {(Object.keys(EJEMPLOS) as (keyof typeof EJEMPLOS)[]).map((tipo) => (
          <button key={tipo} type="button" className="btn sm" onClick={() => recibir(EJEMPLOS[tipo])}>
            <IconoTipo tipo={tipo} denso />
            {t(`pantallas.inicio.ejemplos.${tipo}`)}
          </button>
        ))}
      </div>
      <div className="row ejemplos">
        {conEjemplo && ejemplo.fase !== 'listo' && (
          <Boton
            variante="fantasma"
            pequeno
            disabled={ejemplo.fase === 'creando' || soloLectura}
            onClick={() => void crearEjemplo()}
          >
            {ejemplo.fase === 'creando' ? t('pantallas.inicio.ejemploCreando') : t('pantallas.inicio.ejemploCrear')}
          </Boton>
        )}
        {ejemplo.fase === 'listo' && (
          <Boton variante="primario" pequeno onClick={() => cambiarDeEspacio(ejemplo.id)}>
            {t('pantallas.inicio.ejemploAbrir', { nombre: ejemplo.nombre })}
          </Boton>
        )}
        {instalable && (
          <Boton variante="fantasma" pequeno onClick={() => void instalar()}>
            {t('pantallas.inicio.instalar')}
          </Boton>
        )}
      </div>
      <span className="xs muted" role="status">
        {ejemplo.fase === 'listo'
          ? t('pantallas.inicio.ejemploListo')
          : ejemplo.fase === 'fallo'
            ? t('pantallas.inicio.ejemploFallo')
            : ''}
      </span>
    </div>
  );
}
