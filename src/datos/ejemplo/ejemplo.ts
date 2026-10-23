/**
 * El espacio de ejemplo (APP-03): la colección `gateway` del plan, capturada con el flujo de captura real (los
 * mismos lectores y el mismo formato que una captura de verdad) en un almacén en memoria y exportada a ZIP, lista
 * para importarse como espacio nuevo. Se genera al pedirlo: nunca queda en un formato viejo.
 */
import { isoConZona } from '@rimor/formato';
import buenaLog from '../../../fixtures/comparaciones/buena.log?raw';
import malaLog from '../../../fixtures/comparaciones/mala.log?raw';
import reqwest from '../../../fixtures/mediciones/reqwest.txt?raw';
import ureq from '../../../fixtures/mediciones/ureq.txt?raw';
import { escribirTexto } from '../../almacen/contrato';
import { AlmacenMemoria } from '../../almacen/memoria';
import { Repositorio } from '../../almacen/repositorio';
import { capturar, type EntradaCaptura } from '../../captura/flujo';
import { crearManifest } from '../../espacio/manifest';
import type { Registro } from '../../lectores/registro';
import { exportarZip } from '../exportar';

export const NOMBRE_EJEMPLO = 'Ejemplo · gateway';
const COLECCION = 'gateway';

const TRAZA = [
  "thread 'tokio-runtime-worker' panicked at src/gateway/stream.rs:142:17:",
  'called `Result::unwrap()` on an `Err` value: Timeout(ReadTimeout { after: 30s })',
  'stack backtrace:',
  '   0: gateway::stream::next_chunk',
  '             at ./src/gateway/stream.rs:142:17',
  '   1: gateway::stream::forward',
  '             at ./src/gateway/stream.rs:88:9',
  '   2: ureq::body::BodyReader::read',
  '             at ./ureq-3.1.2/src/body.rs:311:5',
].join('\n');

const PROMPT = [
  'Eres revisor de ADR. Lee la decisión y responde en tres apartados:',
  '1. Qué se decide y por qué, en dos frases.',
  '2. Qué alternativas faltan o se descartan sin razón.',
  '3. Qué riesgo concreto ves, con {{contexto}} como referencia.',
].join('\n');

/** Lo que se captura, en orden (con sus etiquetas; todo en la colección `gateway`). */
const CAPTURAS: (Omit<EntradaCaptura, 'origen'> & { minutos: number })[] = [
  { texto: buenaLog, etiquetas: ['ollama'], minutos: 0 },
  { texto: malaLog, etiquetas: ['ollama', 'timeout'], minutos: 12 },
  { texto: TRAZA, etiquetas: ['ureq', 'timeout'], minutos: 15 },
  { texto: reqwest, etiquetas: ['reqwest'], minutos: 40 },
  { texto: ureq, etiquetas: ['ureq'], minutos: 46 },
  { texto: 'https://github.com/algesten/ureq', etiquetas: ['ureq'], minutos: 50 },
  { texto: PROMPT, tipo: 'prompt', etiquetas: ['adr'], minutos: 70 },
  { texto: 'Probar ureq con streaming y un timeout de lectura más largo', tipo: 'idea', minutos: 90 },
];

/**
 * El ZIP del espacio de ejemplo. Con el mismo `ahora` (y los mismos lectores), el mismo contenido: las fechas salen
 * de él y los ids, de un contador.
 */
export async function zipDeEjemplo(registro: Registro, ahora: Date = new Date()): Promise<Uint8Array> {
  const almacen = new AlmacenMemoria();
  // Empieza un día antes de ahora: lo capturado queda «ayer».
  const inicio = new Date(ahora.getTime() - 86_400_000);
  const manifest = crearManifest(NOMBRE_EJEMPLO, inicio, '01JAB3K9Q2X8M5N7P0R4EJEMP0');
  await escribirTexto(almacen, 'manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  const repositorio = new Repositorio(almacen);
  let n = 0;
  for (const { minutos, ...entrada } of CAPTURAS) {
    const cuando = new Date(inicio.getTime() + minutos * 60_000);
    const r = await capturar(
      { ...entrada, origen: 'pegado', colecciones: [COLECCION] },
      {
        repositorio,
        registro,
        reloj: () => cuando,
        nuevoId: () => `01JAB3K9Q2X8M5N7P0R4E${String(++n).padStart(5, '0')}`,
      },
    );
    if (!r.ok) throw new Error(`ejemplo.captura: ${r.error.codigo}`);
  }
  await escribirTexto(
    almacen,
    'colecciones.json',
    `${JSON.stringify({ esquema: 1, colecciones: [{ id: COLECCION, nombre: COLECCION, orden: 0, creado: isoConZona(inicio) }] }, null, 2)}\n`,
  );
  const { trozos } = await exportarZip(almacen, { ahora, version: __VERSION_APP__, ceder: async () => undefined });
  const zip = new Uint8Array(trozos.reduce((s, t) => s + t.length, 0));
  let i = 0;
  for (const t of trozos) {
    zip.set(t, i);
    i += t.length;
  }
  return zip;
}
