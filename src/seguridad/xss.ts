/**
 * Corpus de cargas XSS (adaptadas de la «XSS Filter Evasion Cheat Sheet» de OWASP) para las pruebas del saneado.
 * Ninguna debe ejecutar código ni hacer peticiones al pintarse.
 */
export const CARGAS_XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<img src="javascript:alert(1)">',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:alert(1)">pulsa</a>',
  '<a href="JaVaScRiPt:alert(1)">pulsa</a>',
  '<a href="jav&#x09;ascript:alert(1)">pulsa</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">pulsa</a>',
  '<a href="vbscript:msgbox(1)">pulsa</a>',
  '<body onload=alert(1)>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<style>@import "http://ataque.example/x.css";</style>',
  '<link rel="stylesheet" href="http://ataque.example/x.css">',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '[pulsa](javascript:alert(1))',
  '![x](https://rastreo.example/pixel.png)',
  '<a href="https://ejemplo.org" onclick="alert(1)">ok</a>',
  '<marquee onstart=alert(1)>x</marquee>',
] as const;
