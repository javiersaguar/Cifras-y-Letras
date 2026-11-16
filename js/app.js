/* Interfaz de Cifras y Letras. Los solvers están en cifras-solver.js y letras-solver.js. */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const siguienteFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

  /* ======================= Pestañas ======================= */
  function mostrarPestana(nombre) {
    $$('.pestana').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === nombre)));
    $('#panel-cifras').hidden = nombre !== 'cifras';
    $('#panel-letras').hidden = nombre !== 'letras';
    if (location.hash !== `#${nombre}`) history.replaceState(null, '', `#${nombre}`);
    if (nombre === 'letras') obtenerDiccionario(); // empieza a cargarlo en segundo plano
  }
  $$('.pestana').forEach(b => b.addEventListener('click', () => mostrarPestana(b.dataset.tab)));

  /* ======================= Cronómetro ======================= */
  function crearCrono(contenedor) {
    const barra = contenedor.querySelector('.crono-barra');
    const num = contenedor.querySelector('.crono-num');
    let id = null;
    return {
      iniciar(segundos, alTerminar) {
        this.parar();
        contenedor.hidden = false;
        const fin = performance.now() + segundos * 1000;
        const tic = ahora => {
          const resta = Math.max(0, fin - ahora);
          barra.style.transform = `scaleX(${resta / (segundos * 1000)})`;
          num.textContent = `${Math.ceil(resta / 1000)} s`;
          if (resta <= 0) { id = null; contenedor.hidden = true; alTerminar(); return; }
          id = requestAnimationFrame(tic);
        };
        id = requestAnimationFrame(tic);
      },
      parar() {
        if (id) cancelAnimationFrame(id);
        id = null;
        contenedor.hidden = true;
      },
    };
  }

  /* ======================= CIFRAS ======================= */
  const NUM_CASILLAS = 6;
  const inputObjetivo = $('#objetivo');
  const contNumeros = $('#numeros');
  const avisoCifras = $('#avisoCifras');
  const resultadoCifras = $('#resultadoCifras');
  const cronoCifras = crearCrono($('#cronoCifras'));
  let grandes = 2;

  for (let i = 0; i < NUM_CASILLAS; i++) {
    const inp = document.createElement('input');
    inp.className = 'numero';
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.maxLength = 3;
    inp.placeholder = '·';
    inp.autocomplete = 'off';
    inp.setAttribute('aria-label', `Número ${i + 1}`);
    contNumeros.appendChild(inp);
  }
  const casillas = $$('.numero');

  function soloDigitos(inp, max) {
    inp.addEventListener('input', () => {
      const limpio = inp.value.replace(/\D/g, '').slice(0, max);
      if (limpio !== inp.value) inp.value = limpio;
    });
  }
  soloDigitos(inputObjetivo, 4);
  casillas.forEach(c => soloDigitos(c, 3));
  [inputObjetivo, ...casillas].forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') resolverCifrasUI(); })
  );

  $$('#chipsGrandes .chip').forEach(chip => chip.addEventListener('click', () => {
    grandes = Number(chip.dataset.grandes);
    $$('#chipsGrandes .chip').forEach(c => c.classList.toggle('activo', c === chip));
  }));

  function ponerRonda() {
    const { numeros, objetivo } = rondaAleatoria(grandes);
    casillas.forEach((c, i) => { c.value = numeros[i]; });
    inputObjetivo.value = objetivo;
    resultadoCifras.hidden = true;
    avisoCifras.textContent = '';
  }

  $('#btnRondaCifras').addEventListener('click', () => { cronoCifras.parar(); ponerRonda(); });
  $('#btnJugarCifras').addEventListener('click', () => {
    ponerRonda();
    cronoCifras.iniciar(30, resolverCifrasUI);
  });
  $('#btnResolverCifras').addEventListener('click', resolverCifrasUI);

  async function resolverCifrasUI() {
    cronoCifras.parar();
    avisoCifras.textContent = '';
    const numeros = casillas.map(c => parseInt(c.value, 10)).filter(n => Number.isInteger(n) && n > 0);
    const objetivo = parseInt(inputObjetivo.value, 10);

    if (!Number.isInteger(objetivo) || objetivo <= 0) {
      avisoCifras.textContent = 'Escribe el número objetivo.';
      inputObjetivo.focus();
      return;
    }
    if (numeros.length < 2) {
      avisoCifras.textContent = 'Necesitas al menos 2 números.';
      return;
    }

    const boton = $('#btnResolverCifras');
    boton.disabled = true;
    resultadoCifras.hidden = false;
    resultadoCifras.innerHTML = '<div class="cargando">Calculando…</div>';
    await siguienteFrame();

    try {
      pintarCifras(resolverCifras(numeros, objetivo));
    } catch (e) {
      resultadoCifras.hidden = true;
      avisoCifras.textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  }

  function pintarCifras(r) {
    const titulo = r.exacto
      ? '<span class="veredicto-titulo exacto">¡Exacto!</span>'
      : `<span class="veredicto-titulo aprox">Más cerca: ${r.valor}</span>`;
    const meta = r.exacto
      ? `${r.pasos.length} operaci${r.pasos.length === 1 ? 'ón' : 'ones'} · ${r.milisegundos} ms`
      : `a ${r.diferencia} del ${r.objetivo} · no hay exacto · ${r.milisegundos} ms`;

    let html = `<div class="veredicto">${titulo}<span class="veredicto-meta">${meta}</span></div>`;

    if (r.pasos.length === 0) {
      html += '<div class="vacio">El objetivo ya está entre tus números.</div>';
    } else {
      html += `<div class="expresion">${escapar(r.expresion)} = <b>${r.valor}</b></div>`;
      html += '<ol class="pasos">';
      r.pasos.forEach((p, k) => {
        const ultimo = k === r.pasos.length - 1;
        html += `<li class="paso${ultimo && r.exacto ? ' final' : ''}" style="animation-delay:${k * 70}ms">
          <span class="paso-n">${k + 1}</span>
          <span class="paso-op">${p.a}<span class="simbolo">${p.simbolo}</span>${p.b} =</span>
          <span class="paso-r">${p.resultado}</span>
        </li>`;
      });
      html += '</ol>';
    }

    if (r.alternativas.length) {
      html += `<details class="mas"><summary>Otras soluciones igual de cortas (${r.alternativas.length})</summary>`;
      r.alternativas.forEach(a => { html += `<div class="alternativa">${escapar(a.expresion)} = ${r.objetivo}</div>`; });
      html += '</details>';
    }

    resultadoCifras.innerHTML = html;
    resultadoCifras.hidden = false;
  }

  /* ======================= LETRAS ======================= */
  const MAX_LETRAS = 12;
  const inputLetras = $('#letrasInput');
  const contFichas = $('#fichas');
  const avisoLetras = $('#avisoLetras');
  const resultadoLetras = $('#resultadoLetras');
  const cronoLetras = crearCrono($('#cronoLetras'));
  let promesaDiccionario = null;

  function obtenerDiccionario() {
    if (!promesaDiccionario) {
      promesaDiccionario = new Promise((resolver, rechazar) => {
        const s = document.createElement('script');
        s.src = 'data/diccionario.js';
        s.onload = () => setTimeout(() => {
          try { resolver(cargarDiccionario(window.DICCIONARIO_ES)); } catch (e) { rechazar(e); }
        }, 0);
        s.onerror = () => { promesaDiccionario = null; rechazar(new Error('No se pudo cargar el diccionario.')); };
        document.head.appendChild(s);
      });
    }
    return promesaDiccionario;
  }

  function letrasActuales() {
    return normalizar(inputLetras.value).slice(0, MAX_LETRAS);
  }

  function ponerLetras(texto) {
    inputLetras.value = normalizar(texto).slice(0, MAX_LETRAS).toUpperCase();
    pintarFichas();
  }

  function pintarFichas() {
    const letras = letrasActuales();
    const huecos = Math.max(10, letras.length);
    let html = '';
    for (let i = 0; i < huecos; i++) {
      html += letras[i]
        ? `<div class="ficha borrable" data-i="${i}" title="Quitar">${escapar(letras[i])}</div>`
        : '<div class="ficha vacia"></div>';
    }
    contFichas.innerHTML = html;
  }

  inputLetras.addEventListener('input', () => {
    const limpio = letrasActuales().toUpperCase();
    if (inputLetras.value !== limpio) inputLetras.value = limpio;
    pintarFichas();
  });
  inputLetras.addEventListener('keydown', e => { if (e.key === 'Enter') resolverLetrasUI(); });
  contFichas.addEventListener('click', e => {
    const ficha = e.target.closest('.ficha.borrable');
    if (!ficha) return;
    const letras = letrasActuales().split('');
    letras.splice(Number(ficha.dataset.i), 1);
    ponerLetras(letras.join(''));
  });

  function anadirLetra(tipo) {
    const letras = letrasActuales();
    if (letras.length >= MAX_LETRAS) return;
    ponerLetras(letras + letraAleatoria(tipo));
  }
  $('#btnVocal').addEventListener('click', () => anadirLetra('vocal'));
  $('#btnConsonante').addEventListener('click', () => anadirLetra('consonante'));
  $('#btnLetrasAleatorias').addEventListener('click', () => {
    cronoLetras.parar();
    ponerLetras(letrasAleatorias(10));
    resultadoLetras.hidden = true;
  });
  $('#btnBorrarLetras').addEventListener('click', () => {
    cronoLetras.parar();
    ponerLetras('');
    resultadoLetras.hidden = true;
    avisoLetras.textContent = '';
    inputLetras.focus();
  });
  $('#btnJugarLetras').addEventListener('click', () => {
    ponerLetras(letrasAleatorias(10));
    resultadoLetras.hidden = true;
    avisoLetras.textContent = '';
    cronoLetras.iniciar(30, resolverLetrasUI);
  });
  $('#btnResolverLetras').addEventListener('click', resolverLetrasUI);
  $('#soloLemas').addEventListener('change', () => { if (!resultadoLetras.hidden) resolverLetrasUI(); });

  async function resolverLetrasUI() {
    cronoLetras.parar();
    avisoLetras.textContent = '';
    const letras = letrasActuales();
    if (letras.length < 3) {
      avisoLetras.textContent = 'Introduce al menos 3 letras.';
      inputLetras.focus();
      return;
    }

    const boton = $('#btnResolverLetras');
    boton.disabled = true;
    resultadoLetras.hidden = false;
    resultadoLetras.innerHTML = '<div class="cargando">Consultando el diccionario…</div>';
    await siguienteFrame();

    try {
      const dic = await obtenerDiccionario();
      const r = resolverLetras(letras, dic, { soloLemas: $('#soloLemas').checked });
      pintarLetras(r);
    } catch (e) {
      resultadoLetras.hidden = true;
      avisoLetras.textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  }

  function pintarLetras(r) {
    if (r.total === 0) {
      resultadoLetras.innerHTML = '<div class="vacio">No hay ninguna palabra de 3 letras o más con estas letras.</div>';
      return;
    }

    const top = r.palabras.slice(0, 5);
    let html = `<div class="veredicto">
      <span class="veredicto-titulo exacto">${r.maxLongitud} letras</span>
      <span class="veredicto-meta">${r.total.toLocaleString('es-ES')} palabras posibles · ${r.milisegundos} ms</span>
    </div><div class="palabras">`;

    top.forEach((p, k) => {
      const sobran = letrasSobrantes(r.letras, p.palabra);
      const minis = p.palabra.split('').map(c => `<span class="mini usada">${escapar(c)}</span>`).join('') +
        sobran.map(c => `<span class="mini sobra">${escapar(c)}</span>`).join('');
      html += `<div class="palabra" style="animation-delay:${k * 70}ms">
        <div class="palabra-rank">${k + 1}</div>
        <div>
          <div class="palabra-texto">${escapar(p.palabra)}</div>
          <div class="palabra-fichas">${minis}</div>
          ${p.lema ? '<span class="etiqueta-lema">forma de diccionario</span>' : ''}
        </div>
        <div class="palabra-lado"><strong>${p.longitud}</strong>letras<br>
          <a href="https://dle.rae.es/${encodeURIComponent(p.palabra)}" target="_blank" rel="noopener">RAE ↗</a></div>
      </div>`;
    });
    html += '</div>';

    if (r.total > top.length) {
      const grupos = new Map();
      r.palabras.slice(top.length).forEach(p => {
        if (!grupos.has(p.longitud)) grupos.set(p.longitud, []);
        grupos.get(p.longitud).push(p.palabra);
      });
      html += `<details class="mas"><summary>Ver el resto (${(r.total - top.length).toLocaleString('es-ES')})</summary>`;
      const LIMITE = 80;
      for (const [longitud, lista] of grupos) {
        const visibles = lista.slice(0, LIMITE).map(escapar).join(' ');
        const extra = lista.length > LIMITE ? ` <em>… y ${lista.length - LIMITE} más</em>` : '';
        html += `<div class="grupo"><h4>${longitud} letras · ${lista.length}</h4><p>${visibles}${extra}</p></div>`;
      }
      html += '</details>';
    }

    resultadoLetras.innerHTML = html;
  }

  /* ======================= Inicio ======================= */
  pintarFichas();
  mostrarPestana(location.hash === '#letras' ? 'letras' : 'cifras');
})();
