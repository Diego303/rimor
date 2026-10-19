/**
 * Estado vacío de primer uso (espacio sin nada): qué se puede pegar, con ejemplos que llenan el compositor al
 * pulsarlos (no se guardan solos: se ve cómo se guardarían y se decide).
 */
import { useCompositor } from '../../captura/compositor';
import { useT } from '../../i18n/useT';
import { IconoTipo } from '../../ui/componentes';

/** Ejemplos de qué pegar: un texto de muestra por tipo. */
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
  enlace: 'https://github.com/algesten/ureq?utm_source=newsletter',
  mediciones: ['# reqwest · 64 KB', '38.41 ms', '39.02 ms', '37.88 ms', '38.76 ms', '40.12 ms'].join('\n'),
  idea: 'Exportar minipapers con Typst',
} as const;

export function PrimerUso() {
  const { t } = useT();
  const recibir = useCompositor((s) => s.recibir);
  return (
    <div className="empty primer-uso">
      <b>{t('pantallas.inicio.primerUsoTitulo')}</b>
      <span className="sm">{t('pantallas.inicio.primerUsoTexto')}</span>
      <div className="row ejemplos">
        {(Object.keys(EJEMPLOS) as (keyof typeof EJEMPLOS)[]).map((tipo) => (
          <button key={tipo} type="button" className="btn sm" onClick={() => recibir(EJEMPLOS[tipo])}>
            <IconoTipo tipo={tipo} denso />
            {t(`pantallas.inicio.ejemplos.${tipo}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
