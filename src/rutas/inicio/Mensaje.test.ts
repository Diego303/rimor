import { describe, expect, it } from 'vitest';
import { vistaPrevia } from './Mensaje';

describe('vista previa del mensaje', () => {
  it('la primera línea con contenido, sin repetir el título', () => {
    expect(vistaPrevia({ original: 'Título\n\n  primera línea  \nsegunda' }, 'Título')).toBe('primera línea');
    expect(vistaPrevia({ original: null }, 'x')).toBeNull();
  });

  it('si la primera solo abre algo (una tabla de TOML, un JSON), las siguientes detrás, como la referencia', () => {
    expect(vistaPrevia({ original: '[gateway]\nclient = "ureq"\nstream_timeout_ms = 30000\n' }, 'config.toml')).toBe(
      '[gateway]  client = "ureq"  stream_timeout_ms = 30000',
    );
    expect(vistaPrevia({ original: '{\n  "name": "rimor"\n}' }, 'x')).toBe('{  "name": "rimor"  }');
  });
});
