/**
 * Página /muestras (solo en desarrollo): cada componente en los dos temas lado a lado (IN-002).
 * Los dos temas se pintan en dos marcos de la propia página, porque los tokens viven en :root.
 * Los textos son de ejemplo y quedan fuera de la regla de textos de i18n.
 */
import './muestras.css';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Banner,
  BarraH,
  Boton,
  Cargando,
  ChipTipo,
  Cifra,
  Detalles,
  ErrorTarjeta,
  Estado,
  Filtro,
  Hueco,
  Huecos,
  IconoTipo,
  Kbd,
  Medidor,
  Piloto,
  ProveedorAvisos,
  Ref,
  Rejilla,
  Segmentado,
  SelectorTema,
  Tabla,
  Tarjeta,
  useAvisos,
  Vacio,
  Veredicto,
} from '../componentes';
import { ASPECTO_TIPO, type TipoVisual } from '../iconos/tipos';
import type { EstadoSenal } from '../marca/estadosSenal';
import { Logotipo } from '../marca/Logotipo';
import { Senal } from '../marca/Senal';
import { SimboloRimor } from '../marca/SimboloRimor';
import { aplicarTema } from '../tema/tema';

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const TOKENS = [
  ['--app', 'Fondo'],
  ['--panel', 'Superficie'],
  ['--ink', 'Tinta'],
  ['--muted', 'Secundario'],
  ['--key', 'Naranja'],
  ['--ok', 'Correcto'],
  ['--warn', 'Aviso'],
  ['--bad', 'Error'],
] as const;

const REGLAS = [
  'Una columna de lectura de 780 px; solo lienzo, tiempo, métricas y documento usan todo el ancho.',
  'Arriba lo que responde a «¿qué pasa?»; lo demás en «Detalles», plegado.',
  'Un veredicto por pantalla, en una frase y una cifra.',
  'Las referencias (LOG-0047) solo donde se pueden pulsar; el resto va en Detalles.',
  'Rimor habla en una o dos frases; las preguntas llevan botones, nunca formularios.',
  'Naranja solo para enviar, la serie destacada de una gráfica y los pilotos. Nunca en texto largo ni en más de un botón por pantalla.',
  'Las tarjetas no llevan borde: se separan por el tono y una sombra mínima. Botones y filtros, en píldora; iconos de tipo, en círculo.',
];

const FILAS = [
  { serie: 'reqwest', mediana: '38,54', ic: '38,11 – 39,02', n: '20' },
  { serie: 'ureq', mediana: '36,80', ic: '36,40 – 37,10', n: '20' },
];

function ValorToken({ token }: { token: string }) {
  const [valor, setValor] = useState('');
  useEffect(() => setValor(getComputedStyle(document.documentElement).getPropertyValue(token).trim()), [token]);
  return (
    <span className="mono xs muted">
      {token} · {valor}
    </span>
  );
}

const ESTADOS: [EstadoSenal, string][] = [
  ['arranque', 'Abriendo el espacio'],
  ['primer-uso', 'Bienvenida'],
  ['cargando', 'DuckDB, solo la primera vez'],
  ['analizando', 'Analizando 340.000 líneas'],
  ['indexando', 'Indexando 4.210 de 10.000'],
  ['contestando', 'Leyendo…'],
  ['exportando', 'Exportando 62 %'],
  ['copia-al-dia', 'Copia al día'],
  ['guardado', 'Importado'],
  ['error', 'No se pudo leer el ZIP'],
  ['comparando', 'Comparando las dos series'],
  ['sin-conexion', 'Sin red: guardado sin enriquecer'],
];

/** Cada estado de «Señal», con botón para repetir y un interruptor de movimiento reducido (IN-090). */
function Animaciones() {
  const [vuelta, setVuelta] = useState(0);
  const [quieto, setQuieto] = useState(false);
  return (
    <Tarjeta titulo="Animaciones del símbolo">
      <div className="row">
        <Boton pequeno onClick={() => setVuelta((v) => v + 1)}>
          Repetir
        </Boton>
        <Filtro activo={quieto} onClick={() => setQuieto((q) => !q)}>
          Movimiento reducido
        </Filtro>
      </div>
      <div className={quieto ? 'muestras-senales muestras-sin-movimiento' : 'muestras-senales'}>
        {ESTADOS.map(([estado, texto]) => (
          <Senal
            key={`${estado}-${vuelta}`}
            estado={estado}
            etiqueta={texto}
            tamano={48}
            frase="del rumor a la conclusión"
            // El catálogo enseña todas a la vez: aquí no rige «una en bucle por pantalla».
            prioridad="sinTurno"
          />
        ))}
      </div>
    </Tarjeta>
  );
}

function BotonAviso() {
  const { avisar } = useAvisos();
  return <Boton onClick={() => avisar('Copiado con valores')}>Mostrar aviso</Boton>;
}

function Galeria() {
  const [seg, setSeg] = useState<'todo' | 'sin'>('todo');
  const [fila, setFila] = useState('reqwest');
  const ir = () => undefined;
  return (
    <ProveedorAvisos>
      <div className="muestras">
        <div className="ah">
          <div className="tl">
            <h2>Sistema de diseño</h2>
            <span className="meta">Estilo Instrumento · tokens, tipografía y componentes</span>
          </div>
        </div>
        <Tarjeta titulo="Color">
          <div className="g4">
            {TOKENS.map(([token, nombre]) => (
              <div key={token} className="muestra-color">
                <div className="swatch" style={{ background: `var(${token})` }} />
                <b className="sm">{nombre}</b>
                <ValorToken token={token} />
              </div>
            ))}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Tipos (icono y nombre; solo Error lleva color)">
          <div className="row">
            {(Object.keys(ASPECTO_TIPO) as TipoVisual[]).map((t) => (
              <ChipTipo key={t} tipo={t} />
            ))}
          </div>
          <div className="row">
            {(['log', 'error', 'mediciones', 'prompt', 'enlace', 'idea'] as const).map((t) => (
              <IconoTipo key={t} tipo={t} />
            ))}
            {(['log', 'error'] as const).map((t) => (
              <IconoTipo key={`d-${t}`} tipo={t} denso />
            ))}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Tipografía">
          <p className="muestra-titular">Del rumor a la conclusión</p>
          <p>Archivo para títulos y texto; Roboto Mono para logs, código y cifras.</p>
          <p className="mono num">Roboto Mono · 38,54 ms · p &lt; 0,001</p>
          <span className="lbl">Etiqueta de sección</span>
        </Tarjeta>
        <Tarjeta titulo="Componentes">
          <div className="row">
            <Boton variante="primario">Primario</Boton>
            <Boton>Normal</Boton>
            <Boton variante="fantasma">Fantasma</Boton>
            <Boton variante="senal" icono="descargar">
              Exportar ZIP
            </Boton>
            <Boton variante="icono" icono="responder">
              Responder
            </Boton>
            <Boton pequeno>Pequeño</Boton>
            <Boton peligro>Vaciar papelera</Boton>
            <Filtro>filtro</Filtro>
            <Filtro activo>activo</Filtro>
          </div>
          <div className="row">
            <Estado tono="acc">nuevo</Estado>
            <Estado tono="ok">resuelto</Estado>
            <Estado tono="warn">abierta</Estado>
            <Estado tono="warn">borrador</Estado>
            <Estado tono="bad">roto</Estado>
            <Estado>archivado</Estado>
            <Cifra>−4,5 %</Cifra>
            <Cifra tono="desfasada">−4,6 %</Cifra>
            <Cifra tono="rota">¿MED-0099?</Cifra>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
            <Ref refe="LOG-0047" alPulsar={ir} />
            <Piloto tono="ok" etiqueta="Copia al día" />
            <Piloto tono="warn" etiqueta="Toca hacer copia" />
          </div>
          <div className="row">
            <Segmentado
              etiqueta="Filtro del feed"
              valor={seg}
              alCambiar={setSeg}
              opciones={[
                { valor: 'todo', etiqueta: 'Todo' },
                { valor: 'sin', etiqueta: 'Sin clasificar · 7' },
              ]}
            />
            <BotonAviso />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Marca: símbolo «Señal»">
          <div className="row muestras-marca">
            {[16, 20, 24, 48, 96].map((t) => (
              <SimboloRimor key={t} tamano={t} titulo={`Rimor ${t} px`} />
            ))}
            <SimboloRimor tamano={48} variante="mono" titulo="Rimor mono" />
          </div>
          <div className="row muestras-marca">
            <Logotipo />
            <Logotipo tamano={28} />
          </div>
          <div className="row muestras-marca">
            {['rimor-app-claro-32.png', 'rimor-app-claro-180.png', 'rimor-maskable-claro-192.png'].map((png) => (
              <img key={png} src={`${BASE}marca/${png}`} alt={png} width={64} height={64} />
            ))}
            <img src={`${BASE}marca/favicon.svg`} alt="favicon.svg" width={32} height={32} />
          </div>
        </Tarjeta>
        <Animaciones />
        <Tarjeta titulo="Respuesta de Rimor">
          <div className="rimor muestra-rimor">
            <span className="av" aria-hidden="true">
              <SimboloRimor variante="mono" tamano={13} />
            </span>
            <p>Así habla Rimor: una o dos frases con lo que ha entendido y, si hace falta, una pregunta con botones.</p>
          </div>
        </Tarjeta>
        <section className="card">
          <Veredicto
            tono="ok"
            cifra="−4,5 %"
            frase="ureq es un 4,5 % más rápido"
            explicacion="Mann-Whitney, p < 0,001 · 20 mediciones por serie"
          />
          <Tabla
            titulo="Estadísticos por serie"
            columnas={[
              { id: 's', titulo: 'Serie', celda: (f) => f.serie },
              { id: 'm', titulo: 'Mediana (ms)', celda: (f) => f.mediana, numerica: true },
              { id: 'i', titulo: 'IC 95 %', celda: (f) => f.ic, numerica: true },
              { id: 'n', titulo: 'n', celda: (f) => f.n, numerica: true },
            ]}
            filas={FILAS}
            clave={(f) => f.serie}
            alPulsarFila={(f) => setFila(f.serie)}
            activa={(f) => f.serie === fila}
          />
          <BarraH etiqueta="read timeout" valor={16} maximo={20} texto="16" />
          <BarraH etiqueta="no content-length" valor={9} maximo={20} texto="9" />
          <Medidor fraccion={7 / 18} etiqueta="7 de 18 tareas hechas" />
          <Detalles resumen="Avisos de método" recuento={2}>
            <p className="sm">Son pocas: lo recomendable son al menos 10.</p>
          </Detalles>
        </section>
        <Banner>
          <b>3 cosas</b> por revisar antes de concluir.
        </Banner>
        <Huecos>
          <Hueco gravedad="grave" accion={<Boton variante="fantasma">Vincular</Boton>}>
            La conclusión no tiene evidencias.
          </Hueco>
          <Hueco accion={<Boton variante="fantasma">Medir otra vez</Boton>}>Solo hay una medición.</Hueco>
          <Hueco gravedad="resuelto">Interpretación escrita.</Hueco>
        </Huecos>
        <section className="g3">
          <Vacio titulo="Vacío">Dice qué aparecerá y cómo empezar.</Vacio>
          <Tarjeta>
            <b className="sm">Cargando</b>
            <Cargando texto="DuckDB-WASM, solo la primera vez" />
            <Cargando texto="Indexando 4.210 de 10.000" progreso={0.421} />
          </Tarjeta>
          <ErrorTarjeta titulo="Error">El ZIP tiene rutas fuera del espacio. No se ha escrito nada.</ErrorTarjeta>
        </section>
        <Tarjeta titulo="Rejilla del raíl">
          <Rejilla />
        </Tarjeta>
        <Tarjeta titulo="Reglas de limpieza">
          <Huecos>
            {REGLAS.map((r) => (
              <Hueco key={r} gravedad="neutro">
                {r}
              </Hueco>
            ))}
          </Huecos>
        </Tarjeta>
      </div>
    </ProveedorAvisos>
  );
}

/** Con `?marco=claro|oscuro` pinta la galería en ese tema; sin él, los dos marcos lado a lado. */
export default function Muestras() {
  const marco = new URLSearchParams(location.hash.split('?')[1] ?? '').get('marco');
  // Antes que los efectos de los hijos (que leen los tokens) y sin guardar nada: el marco queda fijo en su tema.
  useLayoutEffect(() => {
    if (marco === 'claro' || marco === 'oscuro') aplicarTema(marco);
  }, [marco]);
  if (marco) return <Galeria />;
  return (
    <div className="muestras-pagina">
      <div className="muestras-cabecera">
        <b>Muestras</b>
        <SelectorTema />
      </div>
      <div className="muestras-marcos">
        <iframe title="Tema claro" src="#/muestras?marco=claro" />
        <iframe title="Tema oscuro" src="#/muestras?marco=oscuro" />
      </div>
    </div>
  );
}
