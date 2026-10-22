/** Un texto con lo que casa con la búsqueda marcado (`mark`), en Buscar y en el mensaje de Inicio. */
import { resaltar } from './resaltar';

export function Resaltado({ texto, terminos }: { texto: string; terminos: readonly string[] }) {
  return (
    <>
      {resaltar(texto, terminos).map((t, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: los trozos de un texto no cambian de sitio.
        t.marca ? <mark key={i}>{t.texto}</mark> : t.texto,
      )}
    </>
  );
}
