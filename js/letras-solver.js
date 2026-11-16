/*
 * Solver de la prueba de LETRAS.
 *
 * Dadas unas letras, encuentra todas las palabras del diccionario que se pueden
 * formar usando cada letra como máximo tantas veces como aparece, y devuelve
 * las más largas primero. Todo ocurre en local: no hay API ni servidor.
 *
 * Las tildes y la diéresis no cuentan (la Á vale como A), pero la Ñ es una
 * letra distinta, como en el concurso.
 */
(function (global) {
  'use strict';

  const ALFABETO = 'abcdefghijklmnñopqrstuvwxyz';
  const INDICE = {};
  for (let k = 0; k < ALFABETO.length; k++) INDICE[ALFABETO[k]] = k;

  // Frecuencia aproximada de cada letra en español (%), para sacar letras "realistas".
  const FRECUENCIAS = {
    a: 12.5, b: 1.4, c: 4.7, d: 5.9, e: 13.7, f: 0.7, g: 1.0, h: 0.7, i: 6.3, j: 0.4,
    k: 0.05, l: 5.0, m: 3.2, n: 6.7, ñ: 0.3, o: 8.7, p: 2.5, q: 0.9, r: 6.9, s: 8.0,
    t: 4.6, u: 3.9, v: 0.9, w: 0.03, x: 0.2, y: 0.9, z: 0.5,
  };
  const VOCALES = 'aeiou';

  function normalizar(texto) {
    return String(texto)
      .toLowerCase()
      .replace(/ñ/g, '\u0001')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\u0001/g, 'ñ')
      .replace(/[^a-zñ]/g, '');
  }

  /* Decodifica el formato "front coding" generado por scripts/build-dict.js. */
  function cargarDiccionario(fuente) {
    const datos = fuente.datos;
    const palabras = [];
    const esLema = [];
    let anterior = '';
    let k = 0;
    while (k < datos.length) {
      const marca = datos.charCodeAt(k++);
      const lema = marca >= 65;
      const comun = marca - (lema ? 65 : 48);
      let fin = k;
      while (fin < datos.length) {
        const c = datos.charCodeAt(fin);
        if (c < 97 && c >= 48) break; // siguiente marcador ('0'..'<' o 'A'..'M')
        fin++;
      }
      const palabra = anterior.slice(0, comun) + datos.slice(k, fin);
      palabras.push(palabra);
      esLema.push(lema);
      anterior = palabra;
      k = fin;
    }
    // Precalculamos el recuento de letras de cada palabra en un único buffer.
    const n = ALFABETO.length;
    const recuentos = new Uint8Array(palabras.length * n);
    for (let p = 0; p < palabras.length; p++) {
      const w = palabras[p];
      for (let c = 0; c < w.length; c++) recuentos[p * n + INDICE[w[c]]]++;
    }
    return { palabras, esLema, recuentos, total: palabras.length };
  }

  /*
   * opciones:
   *   soloLemas  → solo entradas de diccionario (sin plurales ni verbos conjugados)
   *   minLetras  → longitud mínima (por defecto 3)
   */
  function resolverLetras(letras, diccionario, opciones) {
    const soloLemas = !!(opciones && opciones.soloLemas);
    const minLetras = (opciones && opciones.minLetras) || 3;
    const disponibles = normalizar(letras);
    if (disponibles.length === 0) throw new Error('Introduce alguna letra.');

    const inicio = Date.now();
    const n = ALFABETO.length;
    const tengo = new Uint8Array(n);
    for (const c of disponibles) tengo[INDICE[c]]++;

    // Letras que NO tenemos: descartamos rápido cualquier palabra que las use.
    const { palabras, esLema, recuentos } = diccionario;
    const encontradas = [];
    for (let p = 0; p < palabras.length; p++) {
      const w = palabras[p];
      if (w.length > disponibles.length || w.length < minLetras) continue;
      if (soloLemas && !esLema[p]) continue;
      const base = p * n;
      let ok = true;
      for (let c = 0; c < n; c++) {
        if (recuentos[base + c] > tengo[c]) { ok = false; break; }
      }
      if (ok) encontradas.push({ palabra: w, longitud: w.length, lema: esLema[p] });
    }

    encontradas.sort((x, y) =>
      y.longitud - x.longitud || (y.lema - x.lema) || x.palabra.localeCompare(y.palabra, 'es')
    );

    return {
      letras: disponibles,
      total: encontradas.length,
      maxLongitud: encontradas.length ? encontradas[0].longitud : 0,
      palabras: encontradas,
      milisegundos: Date.now() - inicio,
    };
  }

  /* Letras que sobran al formar una palabra (para mostrarlas atenuadas). */
  function letrasSobrantes(letras, palabra) {
    const resto = normalizar(letras).split('');
    for (const c of normalizar(palabra)) {
      const k = resto.indexOf(c);
      if (k !== -1) resto.splice(k, 1);
    }
    return resto;
  }

  function letraAleatoria(tipo, aleatorio) {
    const rnd = aleatorio || Math.random;
    const pool = Object.keys(FRECUENCIAS).filter(c =>
      tipo === 'vocal' ? VOCALES.includes(c) : !VOCALES.includes(c)
    );
    const total = pool.reduce((s, c) => s + FRECUENCIAS[c], 0);
    let x = rnd() * total;
    for (const c of pool) {
      x -= FRECUENCIAS[c];
      if (x <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  /* Ronda típica: unas 4 vocales y el resto consonantes, en orden aleatorio. */
  function letrasAleatorias(cantidad, aleatorio) {
    const rnd = aleatorio || Math.random;
    const total = cantidad || 10;
    const vocales = Math.round(total * 0.4);
    const letras = [];
    for (let k = 0; k < total; k++) letras.push(letraAleatoria(k < vocales ? 'vocal' : 'consonante', rnd));
    for (let k = letras.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [letras[k], letras[j]] = [letras[j], letras[k]];
    }
    return letras.join('');
  }

  const api = { normalizar, cargarDiccionario, resolverLetras, letrasSobrantes, letraAleatoria, letrasAleatorias };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
