/*
 * Solver de la prueba de CIFRAS.
 *
 * Busca, combinando los números disponibles con + − × ÷, el valor exacto del
 * objetivo o, si no existe, el más cercano. Siempre devuelve la solución con
 * MENOS operaciones posibles.
 *
 * Reglas (las del concurso):
 *   - Cada número se usa como máximo una vez (no hace falta usarlos todos).
 *   - Solo enteros positivos: no hay negativos, ceros ni divisiones con resto.
 *
 * Idea del algoritmo: búsqueda exhaustiva en profundidad sobre multiconjuntos
 * de números. Un estado es el multiconjunto de números que quedan; como cada
 * operación reduce el tamaño en 1, todos los caminos a un mismo estado tienen
 * la misma longitud, así que podemos podar estados repetidos sin perder la
 * solución más corta. Además se descartan operaciones inútiles (× 1, ÷ 1,
 * a − b = b, a ÷ b = b), que equivalen a no usar un número.
 */
(function (global) {
  'use strict';

  const SIMBOLOS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const PRECEDENCIA = { '+': 1, '-': 1, '*': 2, '/': 2 };

  function resolverCifras(numeros, objetivo, opciones) {
    const maxAlternativas = (opciones && opciones.maxAlternativas) || 6;

    if (!Array.isArray(numeros) || numeros.length === 0) {
      throw new Error('Hace falta al menos un número.');
    }
    if (!numeros.every(n => Number.isInteger(n) && n > 0)) {
      throw new Error('Los números deben ser enteros positivos.');
    }
    if (!Number.isInteger(objetivo) || objetivo <= 0) {
      throw new Error('El objetivo debe ser un entero positivo.');
    }

    const inicio = Date.now();
    const visitados = new Set();
    const camino = []; // operaciones del camino actual: {i, j, op, a, b, r}
    let mejor = { dif: Infinity, pasos: Infinity, valor: null, camino: [] };
    let alternativas = []; // otras soluciones con la misma (mínima) longitud
    let firmasAlternativas = new Set();
    let estadosExplorados = 0;

    function registrar(valor) {
      const dif = Math.abs(valor - objetivo);
      const pasos = camino.length;
      if (dif < mejor.dif || (dif === mejor.dif && pasos < mejor.pasos)) {
        mejor = { dif, pasos, valor, camino: camino.slice() };
        alternativas = [];
        firmasAlternativas = new Set([expresion(numeros, mejor.camino)]);
      } else if (
        dif === 0 && mejor.dif === 0 && pasos === mejor.pasos &&
        alternativas.length < maxAlternativas
      ) {
        const firma = expresion(numeros, camino);
        if (!firmasAlternativas.has(firma)) {
          firmasAlternativas.add(firma);
          alternativas.push(camino.slice());
        }
      }
    }

    function explorar(estado) {
      if (estado.length < 2) return;
      const clave = estado.slice().sort((x, y) => x - y).join(',');
      if (visitados.has(clave)) return;
      visitados.add(clave);
      estadosExplorados++;

      for (let i = 0; i < estado.length; i++) {
        for (let j = i + 1; j < estado.length; j++) {
          // Ordenamos el par para que la resta y la división sean válidas.
          const iMayor = estado[i] >= estado[j] ? i : j;
          const iMenor = iMayor === i ? j : i;
          const a = estado[iMayor];
          const b = estado[iMenor];

          const resto = [];
          for (let k = 0; k < estado.length; k++) {
            if (k !== i && k !== j) resto.push(estado[k]);
          }

          probar(a + b, '+');
          if (a > b && a - b !== b) probar(a - b, '-');
          if (b > 1) probar(a * b, '*');
          if (b > 1 && a % b === 0 && a / b !== b) probar(a / b, '/');

          function probar(r, op) {
            camino.push({ i: iMayor, j: iMenor, op, a, b, r });
            registrar(r);
            if (resto.length > 0) {
              resto.push(r);
              explorar(resto);
              resto.pop();
            }
            camino.pop();
          }
        }
      }
    }

    numeros.forEach(registrar); // un número disponible ya puede ser la respuesta
    explorar(numeros.slice());

    const formatear = c => ({
      pasos: c.map(p => ({ a: p.a, b: p.b, op: p.op, simbolo: SIMBOLOS[p.op], resultado: p.r })),
      expresion: expresion(numeros, c),
    });

    return {
      objetivo,
      numeros: numeros.slice(),
      exacto: mejor.dif === 0,
      valor: mejor.valor,
      diferencia: mejor.dif,
      ...formatear(mejor.camino),
      alternativas: mejor.dif === 0 ? alternativas.map(formatear) : [],
      estadosExplorados,
      milisegundos: Date.now() - inicio,
    };
  }

  /*
   * Reconstruye la expresión con paréntesis mínimos reproduciendo el camino:
   * cada paso guarda los índices (i, j) que combinó en el estado de ese momento.
   */
  function expresion(numeros, camino) {
    if (camino.length === 0) {
      return null;
    }
    let estado = numeros.map(n => ({ texto: String(n), prec: 3 }));
    let ultimo = null;
    for (const p of camino) {
      const izq = estado[p.i];
      const der = estado[p.j];
      const prec = PRECEDENCIA[p.op];
      const textoIzq = izq.prec < prec ? `(${izq.texto})` : izq.texto;
      const necesitaDer = der.prec < prec || (der.prec === prec && (p.op === '-' || p.op === '/'));
      const textoDer = necesitaDer ? `(${der.texto})` : der.texto;
      ultimo = { texto: `${textoIzq} ${SIMBOLOS[p.op]} ${textoDer}`, prec };
      estado = estado.filter((_, k) => k !== p.i && k !== p.j);
      estado.push(ultimo);
    }
    return ultimo.texto;
  }

  /* Genera una ronda al estilo del concurso: grandes (25, 50, 75, 100) y pequeños (1–10, dos de cada). */
  function rondaAleatoria(cantidadGrandes, aleatorio) {
    const rnd = aleatorio || Math.random;
    const grandes = [25, 50, 75, 100];
    const pequenos = [];
    for (let n = 1; n <= 10; n++) pequenos.push(n, n);
    const g = cantidadGrandes == null ? Math.floor(rnd() * 5) : Math.max(0, Math.min(4, cantidadGrandes));
    const elegir = (bolsa) => bolsa.splice(Math.floor(rnd() * bolsa.length), 1)[0];
    const numeros = [];
    for (let k = 0; k < g; k++) numeros.push(elegir(grandes));
    while (numeros.length < 6) numeros.push(elegir(pequenos));
    const objetivo = 101 + Math.floor(rnd() * 899); // 101–999
    return { numeros, objetivo };
  }

  const api = { resolverCifras, rondaAleatoria };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
