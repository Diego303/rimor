/** Descarga de bytes guardados en el espacio (adjuntos), con su nombre. */

/**
 * Tiempo antes de revocar el enlace temporal: Safari (sobre todo en iOS) y algunos Firefox cancelan la descarga
 * o dejan un archivo vacío si se revoca enseguida.
 */
export const ESPERA_REVOCAR_MS = 60_000;

/** Descarga unos bytes con su nombre (un Blob y un enlace temporal que se revoca después). */
export function descargar(bytes: Uint8Array, nombre: string, mime: string): void {
  descargarBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime || 'application/octet-stream' }), nombre);
}

/** Descarga un Blob con su nombre (una exportación). */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), ESPERA_REVOCAR_MS);
}
