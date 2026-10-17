# Rimor · icono «Señal»

Una onda que se lee y el punto donde se adelanta el resultado: del rumor a la conclusión.

## Construcción
- Retícula de 48 × 48. Trazo de 3 (3,6 en el favicon), extremos y uniones redondeados.
- Onda: `M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24`
- Punto: círculo en (33, 15,5), radio 3,1. Es el siguiente máximo de la onda.
- Guion final: `M40 24 H41`.
- Icono de app: cuadrado redondeado con radio 22,5 % del lado.

## Colores
| | Claro | Oscuro |
|---|---|---|
| Tinta | #191919 | #EDEBE6 |
| Señal | #EE4F1F | #FF6A3D |
| Fondo de app | #F6F5F1 | #1A1A19 |

Sobre naranja, siempre tinta oscura (#191919), nunca blanco.

## Archivos
- `favicon.svg`: se adapta solo a claro u oscuro.
- `svg/`: símbolo (color, oscuro, mono negro y blanco), iconos de app (claro, oscuro, señal, maskable) y logotipo con el nombre.
- `png/`: de 16 a 1024 px. Los maskable van a sangre para Android/PWA.
- `manifest-iconos.json`: bloque `icons` listo para el manifest de la PWA.

## HTML
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/png/rimor-app-claro-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/png/rimor-app-claro-180.png">
```

## Reglas
- Sin degradados, sombras ni otros colores.
- El logotipo usa Archivo 700; para producción, pasa el texto a contornos o empaqueta la fuente.
- Margen libre alrededor del símbolo: al menos el diámetro del punto.
