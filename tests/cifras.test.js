const test = require('node:test');
const assert = require('node:assert/strict');
const { resolverCifras, rondaAleatoria } = require('../js/cifras-solver.js');

/* Evalúa la expresión mostrada al usuario. */
function evaluar(expr) {
  const js = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  return Function(`"use strict"; return (${js});`)();
}

/* Comprueba que los pasos son válidos y que no se reutiliza ningún número. */
function comprobarPasos(numeros, pasos) {
  const bolsa = numeros.slice();
  const quitar = v => {
    const k = bolsa.indexOf(v);
    assert.notEqual(k, -1, `el número ${v} no estaba disponible`);
    bolsa.splice(k, 1);
  };
  for (const p of pasos) {
    quitar(p.a);
    quitar(p.b);
    const r = { '+': p.a + p.b, '-': p.a - p.b, '*': p.a * p.b, '/': p.a / p.b }[p.op];
    assert.equal(r, p.resultado);
    assert.ok(Number.isInteger(r) && r > 0, 'resultado intermedio no válido');
    bolsa.push(r);
  }
}

/* Fuerza bruta sin podas: devuelve {dif, pasos} óptimos. */
function fuerzaBruta(numeros, objetivo) {
  let mejor = { dif: Infinity, pasos: Infinity };
  const anotar = (v, pasos) => {
    const dif = Math.abs(v - objetivo);
    if (dif < mejor.dif || (dif === mejor.dif && pasos < mejor.pasos)) mejor = { dif, pasos };
  };
  numeros.forEach(n => anotar(n, 0));
  (function rec(estado, pasos) {
    for (let i = 0; i < estado.length; i++) {
      for (let j = 0; j < estado.length; j++) {
        if (i === j) continue;
        const a = estado[i], b = estado[j];
        const resto = estado.filter((_, k) => k !== i && k !== j);
        const candidatos = [a + b, a * b];
        if (a > b) candidatos.push(a - b);
        if (b !== 0 && a % b === 0) candidatos.push(a / b);
        for (const r of candidatos) {
          if (r <= 0) continue;
          anotar(r, pasos + 1);
          rec([...resto, r], pasos + 1);
        }
      }
    }
  })(numeros, 0);
  return mejor;
}

test('encuentra soluciones exactas conocidas', () => {
  const r = resolverCifras([75, 50, 2, 3, 8, 7], 812);
  assert.equal(r.exacto, true);
  assert.equal(r.valor, 812);
  assert.equal(evaluar(r.expresion), 812);
  comprobarPasos(r.numeros, r.pasos);
});

test('si el objetivo ya está entre los números, no hace operaciones', () => {
  const r = resolverCifras([100, 3, 7], 100);
  assert.equal(r.exacto, true);
  assert.equal(r.pasos.length, 0);
  assert.equal(r.expresion, null);
});

test('devuelve la mejor aproximación cuando no hay exacto', () => {
  const r = resolverCifras([1, 1, 2, 2, 3, 3], 999);
  assert.equal(r.exacto, false);
  assert.equal(r.valor, 81);
  assert.equal(evaluar(r.expresion), 81);
});

test('prefiere la solución con menos operaciones', () => {
  const r = resolverCifras([100, 25, 4, 1, 1, 1], 125);
  assert.equal(r.pasos.length, 1);
});

test('coincide con la fuerza bruta en rondas aleatorias de 5 números', () => {
  let semilla = 12345;
  const aleatorio = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 40; k++) {
    const { numeros, objetivo } = rondaAleatoria(null, aleatorio);
    const cinco = numeros.slice(0, 5);
    const r = resolverCifras(cinco, objetivo);
    const bf = fuerzaBruta(cinco, objetivo);
    assert.equal(r.diferencia, bf.dif, `diferencia distinta para ${cinco} → ${objetivo}`);
    assert.equal(r.pasos.length, bf.pasos, `longitud distinta para ${cinco} → ${objetivo}`);
    if (r.expresion) assert.equal(evaluar(r.expresion), r.valor);
    comprobarPasos(cinco, r.pasos);
    for (const alt of r.alternativas) {
      assert.equal(evaluar(alt.expresion), objetivo);
      comprobarPasos(cinco, alt.pasos);
    }
  }
});

test('valida la entrada', () => {
  assert.throws(() => resolverCifras([], 100));
  assert.throws(() => resolverCifras([1, -2], 100));
  assert.throws(() => resolverCifras([1, 2], 0));
});
