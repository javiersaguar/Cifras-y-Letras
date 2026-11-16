/*
 * Genera data/diccionario.js a partir de dos listas libres:
 *
 *   - an-array-of-spanish-words (MIT): ~636 000 formas (plurales, femeninos,
 *     conjugaciones...). Ya viene sin tildes.
 *   - dictionary-es (LibreOffice, GPL/LGPL/MPL): ~57 000 lemas, es decir, las
 *     entradas "de diccionario" (singular, infinitivo). Se usa para el modo
 *     "solo lemas" y para completar la lista anterior.
 *
 * Normalización: minúsculas, sin tildes ni diéresis, conservando la ñ (como en
 * el concurso). Se descartan nombres propios, siglas y palabras con caracteres
 * fuera de a–z y ñ.
 *
 * Formato de salida (front coding, para que pese poco): las palabras van
 * ordenadas y cada una se escribe como
 *     <marcador><sufijo>
 * donde el marcador indica cuántas letras comparte con la anterior:
 *     '0' + n  → forma flexionada que comparte n letras
 *     'A' + n  → lema que comparte n letras
 * Los marcadores nunca son minúsculas ni ñ, así que no hace falta separador.
 *
 * Uso: npm install && npm run build:dict
 */
const fs = require('fs');
const path = require('path');

const MAX_LETRAS = 12;
const MIN_LETRAS = 2;

const raiz = path.join(__dirname, '..');
const modulo = nombre => {
  const dir = path.join(raiz, 'node_modules', nombre);
  if (!fs.existsSync(dir)) throw new Error(`Falta ${nombre}: ejecuta "npm install" primero.`);
  return dir;
};

function normalizar(palabra) {
  return palabra
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ');
}

const valida = w => /^[a-zñ]+$/.test(w) && w.length >= MIN_LETRAS && w.length <= MAX_LETRAS;

// 1) Formas completas
const formas = require(path.join(modulo('an-array-of-spanish-words'), 'index.json'));

// 2) Lemas de Hunspell (+ femenino singular mediante la regla G)
const dirEs = modulo('dictionary-es');
const aff = fs.readFileSync(path.join(dirEs, 'index.aff'), 'utf8').split('\n');
const dic = fs.readFileSync(path.join(dirEs, 'index.dic'), 'utf8').split('\n').slice(1);

const reglasFemenino = aff
  .filter(l => l.startsWith('SFX G ') && l.trim().split(/\s+/).length >= 5)
  .map(l => {
    const [, , quitar, poner, condicion] = l.trim().split(/\s+/);
    return { quitar: quitar === '0' ? '' : quitar, poner, condicion: new RegExp(`${condicion}$`) };
  })
  .filter(r => !r.poner.endsWith('s')); // solo femenino singular, no plurales

const lemas = new Set();
for (const linea of dic) {
  const [raw, flags = ''] = linea.trim().split('/');
  if (!raw || /^[A-ZÁÉÍÓÚÜÑ]/.test(raw)) continue; // nombres propios y siglas fuera
  const lema = normalizar(raw);
  if (valida(lema)) lemas.add(lema);
  if (flags.includes('G')) {
    for (const r of reglasFemenino) {
      if (r.condicion.test(raw)) {
        const fem = normalizar(raw.slice(0, raw.length - r.quitar.length) + r.poner);
        if (valida(fem)) lemas.add(fem);
        break;
      }
    }
  }
}

const todas = new Set();
for (const w of formas) {
  const n = normalizar(w);
  if (valida(n)) todas.add(n);
}
for (const l of lemas) todas.add(l);

const ordenadas = [...todas].sort();
let salida = '';
let anterior = '';
for (const w of ordenadas) {
  let comun = 0;
  while (comun < anterior.length && comun < w.length && anterior[comun] === w[comun]) comun++;
  const base = lemas.has(w) ? 65 : 48;
  salida += String.fromCharCode(base + comun) + w.slice(comun);
  anterior = w;
}

const js =
  '/* Diccionario generado por scripts/build-dict.js — no editar a mano.\n' +
  ' * Fuentes: an-array-of-spanish-words (MIT) y dictionary-es de LibreOffice\n' +
  ' * (triple licencia GPL-3.0+/LGPL-3.0+/MPL-1.1, usado aquí bajo MPL-1.1). */\n' +
  `var DICCIONARIO_ES = ${JSON.stringify({ total: ordenadas.length, lemas: lemas.size, datos: salida })};\n` +
  "if (typeof module !== 'undefined' && module.exports) module.exports = DICCIONARIO_ES;\n";

const destino = path.join(raiz, 'data', 'diccionario.js');
fs.writeFileSync(destino, js);
console.log(`${ordenadas.length} palabras (${lemas.size} lemas) → ${destino} (${(js.length / 1e6).toFixed(2)} MB)`);
