/** gzip con CompressionStream (navegadores actuales y Node 24), para guardar el índice de búsqueda (F0-8). */

async function pasar(datos: Uint8Array, flujo: GenericTransformStream): Promise<Uint8Array> {
  const salida = new Blob([new Uint8Array(datos)]).stream().pipeThrough(flujo);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}

export const comprimir = (datos: Uint8Array) => pasar(datos, new CompressionStream('gzip'));
export const descomprimir = (datos: Uint8Array) => pasar(datos, new DecompressionStream('gzip'));
