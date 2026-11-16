const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/letras-solver.js');
const diccionario = L.cargarDiccionario(require('../data/diccionario.js'));

function cabe(palabra, letras) {
  const bolsa = L.normalizar(letras).split('');
  for (const c of palabra) {
    const k = bolsa.indexOf(c);
    if (k === -1) return false;
    bolsa.splice(k, 1);
  }
  return true;
}

test('el diccionario se carga entero', () => {
  assert.ok(diccionario.total > 500000);
  const set = new Set(diccionario.palabras);
  for (const w of ['casa', 'pantalones', 'murcielago', 'niño', 'estructura']) {
    assert.ok(set.has(w), `falta ${w}`);
  }
});

test('normaliza tildes y diéresis pero conserva la ñ', () => {
  assert.equal(L.normalizar('Pingüino Ratón ÑANDÚ'), 'pinguinoratonñandu');
});

test('encuentra la palabra de 10 letras con todas las letras', () => {
  const r = L.resolverLetras('PANTALONSE', diccionario);
  assert.equal(r.palabras[0].palabra, 'pantalones');
  assert.equal(r.maxLongitud, 10);
});

test('todas las palabras devueltas se pueden formar y están ordenadas por longitud', () => {
  for (const letras of ['AEROLSNTCI', 'MUSICOALRE', 'ESTRUCTURA']) {
    const r = L.resolverLetras(letras, diccionario);
    assert.ok(r.total > 0);
    for (let k = 0; k < r.palabras.length; k++) {
      assert.ok(cabe(r.palabras[k].palabra, letras), `${r.palabras[k].palabra} no cabe en ${letras}`);
      if (k > 0) assert.ok(r.palabras[k - 1].longitud >= r.palabras[k].longitud);
    }
  }
});

test('no reutiliza letras repetidas de más', () => {
  const r = L.resolverLetras('CASXYZ', diccionario);
  assert.ok(!r.palabras.some(p => p.palabra === 'casas'));
});

test('el modo solo lemas excluye plurales y conjugaciones', () => {
  const r = L.resolverLetras('PANTALONSE', diccionario, { soloLemas: true });
  assert.ok(r.palabras.every(p => p.lema));
  assert.ok(!r.palabras.some(p => p.palabra === 'pantalones'));
  assert.ok(r.palabras.some(p => p.palabra === 'pantalon'));
});

test('la ñ es una letra distinta de la n', () => {
  assert.ok(!L.resolverLetras('NINOXX', diccionario).palabras.some(p => p.palabra === 'niño'));
  assert.ok(L.resolverLetras('NIÑOXX', diccionario).palabras.some(p => p.palabra === 'niño'));
});

test('genera rondas aleatorias de 10 letras', () => {
  const letras = L.letrasAleatorias(10);
  assert.equal(letras.length, 10);
  assert.match(letras, /^[a-zñ]+$/);
});
