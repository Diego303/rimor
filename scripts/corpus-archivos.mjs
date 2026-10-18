#!/usr/bin/env node
// Genera fixtures/deteccion/archivo/: binarios pequeños y reales (cabeceras de verdad de cada formato) para el
// corpus de detección del lector genérico de archivo (IN-017). Se puede volver a ejecutar: el resultado es el mismo.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { deflateRawSync, gzipSync } from 'node:zlib';

const DESTINO = new URL('../fixtures/deteccion/archivo/', import.meta.url);

const b = (...partes) =>
  Buffer.concat(
    partes.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Array.isArray(p) ? Buffer.from(p) : p)),
  );
const ceros = (n) => Buffer.alloc(n);
const u32le = (n) => {
  const x = Buffer.alloc(4);
  x.writeUInt32LE(n);
  return x;
};
const u16le = (n) => {
  const x = Buffer.alloc(2);
  x.writeUInt16LE(n);
  return x;
};
const u32be = (n) => {
  const x = Buffer.alloc(4);
  x.writeUInt32BE(n);
  return x;
};

/** CRC-32 (para ZIP y PNG). */
const TABLA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const x of buf) c = TABLA[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** ZIP con archivos comprimidos (deflate), como los que generan las herramientas de verdad. */
function zip(archivos) {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const datos = Buffer.from(contenido);
    const comprimido = deflateRawSync(datos);
    const n = Buffer.from(nombre);
    const comun = b(
      u16le(20),
      u16le(0),
      u16le(8),
      u16le(0),
      u16le(0x21),
      u32le(crc32(datos)),
      u32le(comprimido.length),
      u32le(datos.length),
      u16le(n.length),
      u16le(0),
    );
    const local = b([0x50, 0x4b, 3, 4], comun, n, comprimido);
    centrales.push(
      b([0x50, 0x4b, 1, 2], u16le(20), comun, u16le(0), u16le(0), u16le(0), u32le(0), u32le(desplazamiento), n),
    );
    locales.push(local);
    desplazamiento += local.length;
  }
  const central = Buffer.concat(centrales);
  const fin = b(
    [0x50, 0x4b, 5, 6],
    u16le(0),
    u16le(0),
    u16le(archivos.length),
    u16le(archivos.length),
    u32le(central.length),
    u32le(desplazamiento),
    u16le(0),
  );
  return Buffer.concat([...locales, central, fin]);
}

function png() {
  const trozo = (tipo, datos) => b(u32be(datos.length), tipo, datos, u32be(crc32(b(tipo, datos))));
  const ihdr = b(u32be(2), u32be(2), [8, 2, 0, 0, 0]);
  const idat = deflateRawSync(b([0, 255, 0, 0, 0, 255, 0], [0, 0, 0, 255, 255, 255, 255]));
  const zlib = b([0x78, 0x01], idat, u32be(1));
  return b(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib),
    trozo('IEND', ceros(0)),
  );
}

const ejemplos = {
  'imagen.png': png(),
  'animacion.gif': b(
    'GIF89a',
    u16le(1),
    u16le(1),
    [0x80, 0, 0],
    [0, 0, 0, 255, 255, 255],
    [0x2c],
    ceros(4),
    u16le(1),
    u16le(1),
    [0, 2, 2, 0x44, 1, 0, 0x3b],
  ),
  'foto.jpg': b(
    [0xff, 0xd8, 0xff, 0xe0],
    u16le(0x1000),
    'JFIF',
    ceros(1),
    [1, 1, 0],
    u16le(1),
    u16le(1),
    [0, 0, 0xff, 0xd9],
  ),
  'imagen.webp': b(
    'RIFF',
    u32le(26),
    'WEBPVP8L',
    u32le(14),
    [0x2f, 0, 0, 0, 0, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0],
  ),
  'informe.pdf': b(
    '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    ceros(2),
    'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
  ),
  'datos.zip': zip([
    ['latencias.csv', 'cliente,ms\nureq,38\nreqwest,40\n'],
    ['LEEME.txt', 'Mediciones del gateway.\n'],
  ]),
  'hoja.xlsx': zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ],
    ['xl/workbook.xml', '<workbook/>'],
  ]),
  'documento.docx': zip([
    ['[Content_Types].xml', '<?xml version="1.0"?><Types/>'],
    ['word/document.xml', '<w:document/>'],
  ]),
  'registro.log.gz': gzipSync(Buffer.from('17:40:01 ERROR read timeout\n'.repeat(20))),
  'base.sqlite': b('SQLite format 3', ceros(1), u16le(0x10), [1, 1, 0, 64, 32, 32], ceros(76)),
  'tabla.parquet': b('PAR1', [0x15, 0, 0x15, 0x1c, 0x15, 0x1c, 0x2c, 0x15, 0x04, 0, 0x15, 0x06], ceros(8), 'PAR1'),
  'modulo.wasm': b([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 4, 1, 0x60, 0, 0]),
  programa: b([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0], ceros(8), u16le(2), u16le(0x3e), u32le(1), ceros(24)),
  'Clase.class': b([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 0x41, 0, 0x0d], ceros(16)),
  'audio.mp3': b('ID3', [4, 0, 0, 0, 0, 0, 0], [0xff, 0xfb, 0x90, 0x44], ceros(28)),
  'sonido.wav': b(
    'RIFF',
    u32le(40),
    'WAVEfmt ',
    u32le(16),
    u16le(1),
    u16le(1),
    u32le(8000),
    u32le(8000),
    u16le(1),
    u16le(8),
    'data',
    u32le(4),
    [128, 130, 126, 128],
  ),
  'icono.ico': b(u16le(0), u16le(1), u16le(1), [1, 1, 0, 0], u16le(1), u16le(32), u32le(40), u32le(22), ceros(40)),
  'fuente.ttf': b([0, 1, 0, 0], u16le(0), u16le(0), u16le(0), u16le(0), 'cmap', ceros(12)),
  'fuente.woff2': b('wOF2', [0, 1, 0, 0], u32le(48), ceros(36)),
  'copia.tar': b(
    Buffer.from('notas.txt'),
    ceros(91),
    '0000644',
    ceros(1),
    '0001750',
    ceros(1),
    '0001750',
    ceros(1),
    '00000000012',
    ceros(1),
    '14706523152',
    ceros(1),
    '        0',
    ceros(100),
    'ustar',
    ceros(1),
    '00',
    ceros(247),
  ),
  'datos.bz2': b('BZh91AY&SY', [0x4e, 0xec, 0xe8, 0x36, 0, 0, 2, 0x51, 0x80, 0, 0x10, 0x40, 0, 6]),
  'paquete.7z': b(['7'.charCodeAt(0), 'z'.charCodeAt(0), 0xbc, 0xaf, 0x27, 0x1c, 0, 4], ceros(24)),
  'video.mp4': b(u32be(24), 'ftypisom', u32be(0x200), 'isomiso2', u32be(8), 'free'),
  'audio.ogg': b('OggS', [0, 2], ceros(8), u32le(0x1234), u32le(0), ceros(4), [1, 30], [1], 'vorbis', ceros(23)),
  'app.exe': b('MZ', [0x90, 0], u16le(3), ceros(4), u16le(4), ceros(2), u16le(0xffff), ceros(48)),
};

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
for (const [nombre, datos] of Object.entries(ejemplos)) writeFileSync(new URL(nombre, DESTINO), datos);
console.log(`Corpus de archivo: ${Object.keys(ejemplos).length} binarios en fixtures/deteccion/archivo/`);
