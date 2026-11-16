# Cifras y Letras

Solver de las dos pruebas del concurso de La 2, en una sola página web que funciona **en local, sin servidor y sin API**.

## Cifras

Introduce el objetivo y hasta 6 números: el programa combina `+ − × ÷` y muestra la operación paso a paso hasta el **exacto** o, si no existe, la **mejor aproximación**.

- Cada número se usa como máximo una vez; solo enteros positivos (sin negativos ni divisiones con resto).
- Devuelve siempre la solución con **menos operaciones**, la expresión completa con paréntesis y otras soluciones igual de cortas.
- Búsqueda exhaustiva con poda de estados repetidos y operaciones inútiles (×1, ÷1…): unos 50 ms por ronda.

## Letras

Introduce hasta 12 letras (o pide vocal / consonante como en el programa) y obtén las **5 palabras más largas**, con las letras que sobran y un enlace a la RAE, más el resto agrupadas por longitud.

- Diccionario local de ~540 000 palabras (tildes y diéresis no cuentan; la Ñ es una letra aparte).
- Modo **solo formas de diccionario**: sin plurales ni verbos conjugados (~58 000 lemas).

Las dos pruebas tienen modo **Jugar · 30 s**: ronda aleatoria, cuenta atrás y solución al terminar.

### Comodidad de uso

- **Teclados en pantalla**: números del concurso (1–10, 25, 50, 75, 100) y letras en QWERTY español con Ñ. En el móvil no salta el teclado del sistema (toca dos veces una casilla si quieres escribir otro número).
- **Teclado físico**: escribe directamente, `Enter` resuelve, `Esc` limpia, `Retroceso` borra letras. También puedes pegar letras.
- **Enlaces compartibles**: cada resultado actualiza la URL (`?n=75.50.2.3.8.7&o=812`, `?l=pantalones`) y el botón *Compartir* la envía.
- Recuerda la última ronda, copia la solución con un toque y lleva la vista al resultado.

## Uso

Abre `index.html` en el navegador (funciona con doble clic). Está desplegado en Vercel como sitio estático (`vercel.json`, sin paso de build).

```bash
npm install        # solo hace falta para tests o regenerar el diccionario
npm test           # 14 tests: el solver de cifras se contrasta con fuerza bruta
npm run build:dict # regenera data/diccionario.js
```

## Estructura

```
index.html            interfaz
css/styles.css
js/cifras-solver.js   algoritmo de cifras
js/letras-solver.js   algoritmo de letras
js/app.js             lógica de la interfaz
data/diccionario.js   diccionario comprimido (generado)
scripts/build-dict.js genera el diccionario
tests/                tests con node:test
```

## Créditos del diccionario

- [an-array-of-spanish-words](https://github.com/words/an-array-of-spanish-words) (MIT).
- [dictionary-es](https://github.com/wooorm/dictionaries) del corrector de LibreOffice (triple licencia GPL/LGPL/MPL; usado bajo MPL-1.1).
