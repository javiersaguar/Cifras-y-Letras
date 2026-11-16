/* Interfaz de Cifras y Letras. Los solvers están en cifras-solver.js y letras-solver.js. */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const siguienteFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  let pestanaActual = 'cifras';

  /* ======================= Utilidades ======================= */
  let temporizadorToast = null;
  function toast(texto) {
    const t = $('#toast');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { t.hidden = true; }, 2000);
  }

  async function copiar(texto, mensaje) {
    try {
      await navigator.clipboard.writeText(texto);
      toast(mensaje || 'Copiado');
    } catch (e) {
      toast('No se pudo copiar');
    }
  }

  async function compartir(url, titulo) {
    if (navigator.share && tactil) {
      try { await navigator.share({ title: titulo, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    copiar(url, 'Enlace copiado');
  }

  const almacen = {
    leer(clave) { try { return JSON.parse(localStorage.getItem(`cyl.${clave}`)); } catch (e) { return null; } },
    guardar(clave, valor) { try { localStorage.setItem(`cyl.${clave}`, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ } },
  };

  function mostrarResultado(el) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // cierra el teclado del móvil
    const arriba = el.getBoundingClientRect().top;
    if (arriba > window.innerHeight * 0.55 || arriba < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function urlCon(params, pestana) {
    const u = new URL(location.href);
    u.search = new URLSearchParams(params).toString();
    u.hash = pestana;
    return u.toString();
  }

  /* ======================= Pestañas ======================= */
  function mostrarPestana(nombre) {
    pestanaActual = nombre;
    $$('.pestana').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === nombre)));
    $('#panel-cifras').hidden = nombre !== 'cifras';
    $('#panel-letras').hidden = nombre !== 'letras';
    if (location.hash !== `#${nombre}`) history.replaceState(null, '', `${location.pathname}${location.search}#${nombre}`);
    if (nombre === 'letras') obtenerDiccionario().catch(() => {}); // precarga en segundo plano
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
      activo: () => id !== null,
    };
  }

  /* ======================= CIFRAS ======================= */
  const NUM_CASILLAS = 6;
  const PEQUENOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const GRANDES = [25, 50, 75, 100];
  const inputObjetivo = $('#objetivo');
  const avisoCifras = $('#avisoCifras');
  const resultadoCifras = $('#resultadoCifras');
  const cronoCifras = crearCrono($('#cronoCifras'));
  let grandes = 2;
  let activa = 0;
  let ultimoToque = { i: -1, t: 0 };

  // Casillas
  for (let i = 0; i < NUM_CASILLAS; i++) {
    const inp = document.createElement('input');
    inp.className = 'numero';
    inp.type = 'text';
    inp.inputMode = tactil ? 'none' : 'numeric'; // en el móvil se usa el teclado en pantalla
    inp.maxLength = 3;
    inp.placeholder = '·';
    inp.autocomplete = 'off';
    inp.setAttribute('aria-label', `Número ${i + 1}`);
    $('#numeros').appendChild(inp);
  }
  const casillas = $$('.numero');

  function marcarActiva(i) {
    activa = Math.max(0, Math.min(NUM_CASILLAS - 1, i));
    casillas.forEach((c, k) => c.classList.toggle('activa', k === activa));
  }

  casillas.forEach((c, i) => {
    c.addEventListener('focus', () => marcarActiva(i));
    c.addEventListener('pointerup', () => {
      // Doble toque en el móvil: abre el teclado numérico para escribir cualquier número.
      const ahora = Date.now();
      if (tactil && ultimoToque.i === i && ahora - ultimoToque.t < 450) {
        c.inputMode = 'numeric';
        c.blur();
        setTimeout(() => { c.focus(); c.select(); }, 30);
      }
      ultimoToque = { i, t: ahora };
    });
    c.addEventListener('blur', () => { if (tactil) c.inputMode = 'none'; });
  });

  function soloDigitos(inp, max) {
    inp.addEventListener('input', () => {
      const limpio = inp.value.replace(/\D/g, '').slice(0, max);
      if (limpio !== inp.value) inp.value = limpio;
      guardarCifras();
      pintarTecladoNum();
    });
  }
  soloDigitos(inputObjetivo, 4);
  casillas.forEach(c => soloDigitos(c, 3));

  // Teclado de números en pantalla
  const tecladoNum = $('#tecladoNum');
  [...PEQUENOS, ...GRANDES].forEach(n => {
    const b = document.createElement('button');
    b.className = `tecla${n > 10 ? ' grande' : ''}`;
    b.textContent = n;
    b.dataset.n = n;
    tecladoNum.appendChild(b);
  });
  const btnBorrarNum = document.createElement('button');
  btnBorrarNum.className = 'tecla borrar';
  btnBorrarNum.textContent = '⌫';
  btnBorrarNum.setAttribute('aria-label', 'Borrar número');
  tecladoNum.appendChild(btnBorrarNum);

  tecladoNum.addEventListener('pointerdown', e => e.preventDefault()); // no robar el foco
  tecladoNum.addEventListener('click', e => {
    const tecla = e.target.closest('.tecla');
    if (!tecla) return;
    if (tecla === btnBorrarNum) {
      if (!casillas[activa].value && activa > 0) marcarActiva(activa - 1);
      casillas[activa].value = '';
    } else {
      casillas[activa].value = tecla.dataset.n;
      // Salta a la siguiente casilla vacía (o a la siguiente, si están todas llenas).
      let sig = -1;
      for (let k = 1; k <= NUM_CASILLAS; k++) {
        const idx = (activa + k) % NUM_CASILLAS;
        if (!casillas[idx].value) { sig = idx; break; }
      }
      marcarActiva(sig === -1 ? Math.min(activa + 1, NUM_CASILLAS - 1) : sig);
    }
    guardarCifras();
    pintarTecladoNum();
  });

  // Atenúa los números que ya se han usado tantas veces como hay en el concurso.
  function pintarTecladoNum() {
    const usados = {};
    casillas.forEach(c => { if (c.value) usados[c.value] = (usados[c.value] || 0) + 1; });
    $$('#tecladoNum .tecla[data-n]').forEach(t => {
      const n = Number(t.dataset.n);
      t.classList.toggle('agotada', (usados[n] || 0) >= (n > 10 ? 1 : 2));
    });
  }

  $$('#chipsGrandes .chip').forEach(chip => chip.addEventListener('click', () => {
    grandes = Number(chip.dataset.grandes);
    $$('#chipsGrandes .chip').forEach(c => c.classList.toggle('activo', c === chip));
    almacen.guardar('grandes', grandes);
  }));

  function ponerCifras(numeros, objetivo) {
    casillas.forEach((c, i) => { c.value = numeros[i] ?? ''; });
    inputObjetivo.value = objetivo ?? '';
    const vacia = casillas.findIndex(c => !c.value);
    marcarActiva(vacia === -1 ? 0 : vacia);
    pintarTecladoNum();
    guardarCifras();
  }

  function guardarCifras() {
    almacen.guardar('cifras', { numeros: casillas.map(c => c.value), objetivo: inputObjetivo.value });
  }

  function limpiarCifras() {
    cronoCifras.parar();
    ponerCifras([], '');
    resultadoCifras.hidden = true;
    avisoCifras.textContent = '';
  }

  function nuevaRonda() {
    const { numeros, objetivo } = rondaAleatoria(grandes);
    ponerCifras(numeros, objetivo);
    resultadoCifras.hidden = true;
    avisoCifras.textContent = '';
  }

  $('#btnObjetivoAleatorio').addEventListener('click', () => {
    inputObjetivo.value = 101 + Math.floor(Math.random() * 899);
    guardarCifras();
  });
  $('#btnRondaCifras').addEventListener('click', () => { cronoCifras.parar(); nuevaRonda(); });
  $('#btnLimpiarCifras').addEventListener('click', limpiarCifras);
  $('#btnJugarCifras').addEventListener('click', () => {
    nuevaRonda();
    cronoCifras.iniciar(30, resolverCifrasUI);
  });
  $('#btnResolverCifras').addEventListener('click', resolverCifrasUI);

  async function resolverCifrasUI() {
    cronoCifras.parar();
    avisoCifras.textContent = '';
    const numeros = casillas.map(c => parseInt(c.value, 10)).filter(n => Number.isInteger(n) && n > 0);
    const objetivo = parseInt(inputObjetivo.value, 10);

    if (!Number.isInteger(objetivo) || objetivo <= 0) {
      avisoCifras.textContent = 'Escribe el número objetivo arriba (o pulsa 🎲).';
      if (!tactil) inputObjetivo.focus();
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
      const r = resolverCifras(numeros, objetivo);
      pintarCifras(r);
      history.replaceState(null, '', urlCon({ n: numeros.join('.'), o: objetivo }, 'cifras'));
      mostrarResultado(resultadoCifras);
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
      : `a ${r.diferencia} del ${r.objetivo} · no hay exacto`;

    let html = `<div class="veredicto"><div>${titulo}<span class="veredicto-meta">${meta}</span></div>
      <button class="mini-btn" data-accion="compartir">Compartir</button></div>`;

    if (r.pasos.length === 0) {
      html += '<div class="vacio">El objetivo ya está entre tus números.</div>';
    } else {
      html += `<button class="expresion" data-accion="copiar" title="Copiar">
        <span class="texto">${escapar(r.expresion)} = <b>${r.valor}</b></span><span class="copiar">Copiar</span></button>`;
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
    resultadoCifras.dataset.expresion = r.expresion ? `${r.expresion} = ${r.valor}` : '';
  }

  resultadoCifras.addEventListener('click', e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    if (accion.dataset.accion === 'copiar') copiar(resultadoCifras.dataset.expresion, 'Solución copiada');
    if (accion.dataset.accion === 'compartir') compartir(location.href, 'Cifras y Letras · Cifras');
  });

  /* ======================= LETRAS ======================= */
  const MAX_LETRAS = 12;
  const OBJETIVO_LETRAS = 10;
  const VOCALES = 'aeiou';
  const avisoLetras = $('#avisoLetras');
  const resultadoLetras = $('#resultadoLetras');
  const cronoLetras = crearCrono($('#cronoLetras'));
  let letras = '';
  let promesaDiccionario = null;

  function obtenerDiccionario() {
    if (!promesaDiccionario) {
      promesaDiccionario = new Promise((resolver, rechazar) => {
        const s = document.createElement('script');
        s.src = 'data/diccionario.js';
        s.onload = () => setTimeout(() => {
          try { resolver(cargarDiccionario(window.DICCIONARIO_ES)); } catch (e) { rechazar(e); }
        }, 0);
        s.onerror = () => { promesaDiccionario = null; rechazar(new Error('No se pudo cargar el diccionario. Revisa la conexión.')); };
        document.head.appendChild(s);
      });
    }
    return promesaDiccionario;
  }

  // Teclado de letras en pantalla (QWERTY español)
  const tecladoLetras = $('#tecladoLetras');
  const FILAS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
  FILAS.forEach((fila, f) => {
    if (f === 2) tecladoLetras.insertAdjacentHTML('beforeend', '<span class="hueco"></span>');
    for (const c of fila) {
      tecladoLetras.insertAdjacentHTML('beforeend',
        `<button class="tecla${VOCALES.includes(c) ? ' vocal' : ''}" data-letra="${c}">${c}</button>`);
    }
  });
  tecladoLetras.insertAdjacentHTML('beforeend', '<button class="tecla borrar ancha" data-letra="borrar" aria-label="Borrar letra">⌫</button>');

  tecladoLetras.addEventListener('pointerdown', e => e.preventDefault());
  tecladoLetras.addEventListener('click', e => {
    const tecla = e.target.closest('.tecla');
    if (!tecla) return;
    if (tecla.dataset.letra === 'borrar') borrarLetra();
    else anadirLetras(tecla.dataset.letra);
  });

  function ponerLetras(texto) {
    const anterior = letras;
    letras = normalizar(texto).slice(0, MAX_LETRAS);
    // Solo se animan las fichas nuevas (las que no estaban antes en la misma posición).
    const desde = letras.startsWith(anterior) ? anterior.length : 0;
    pintarFichas(desde);
    almacen.guardar('letras', letras);
  }
  function anadirLetras(texto) {
    if (letras.length >= MAX_LETRAS) { toast(`Máximo ${MAX_LETRAS} letras`); return; }
    ponerLetras(letras + normalizar(texto));
  }
  function borrarLetra() { ponerLetras(letras.slice(0, -1)); }

  function pintarFichas(animarDesde) {
    const huecos = Math.min(MAX_LETRAS, Math.max(OBJETIVO_LETRAS, letras.length + 1));
    let html = '';
    for (let i = 0; i < huecos; i++) {
      if (letras[i]) {
        const nueva = animarDesde != null && i >= animarDesde ? ' nueva' : '';
        html += `<button class="ficha borrable${nueva}" data-i="${i}" aria-label="Quitar ${escapar(letras[i])}">${escapar(letras[i])}</button>`;
      } else {
        const clases = ['ficha', 'vacia'];
        if (i === letras.length) clases.push('cursor');
        if (i >= OBJETIVO_LETRAS) clases.push('extra');
        html += `<div class="${clases.join(' ')}"></div>`;
      }
    }
    $('#fichas').innerHTML = html;

    const v = [...letras].filter(c => VOCALES.includes(c)).length;
    $('#contadorLetras').innerHTML = letras.length
      ? `<strong>${letras.length}</strong>/${OBJETIVO_LETRAS} letras · ${v} vocal${v === 1 ? '' : 'es'}, ${letras.length - v} consonante${letras.length - v === 1 ? '' : 's'} · toca una ficha para quitarla`
      : 'Escribe o toca las letras, o pide vocal / consonante';
  }

  $('#fichas').addEventListener('click', e => {
    const ficha = e.target.closest('.ficha.borrable');
    if (!ficha) return;
    const lista = letras.split('');
    lista.splice(Number(ficha.dataset.i), 1);
    ponerLetras(lista.join(''));
  });

  function limpiarLetras() {
    cronoLetras.parar();
    ponerLetras('');
    resultadoLetras.hidden = true;
    avisoLetras.textContent = '';
  }

  $('#btnVocal').addEventListener('click', () => anadirLetras(letraAleatoria('vocal')));
  $('#btnConsonante').addEventListener('click', () => anadirLetras(letraAleatoria('consonante')));
  $('#btnLetrasAleatorias').addEventListener('click', () => {
    cronoLetras.parar();
    ponerLetras(letrasAleatorias(OBJETIVO_LETRAS));
    resultadoLetras.hidden = true;
  });
  $('#btnBorrarLetras').addEventListener('click', limpiarLetras);
  $('#btnJugarLetras').addEventListener('click', () => {
    ponerLetras(letrasAleatorias(OBJETIVO_LETRAS));
    resultadoLetras.hidden = true;
    avisoLetras.textContent = '';
    cronoLetras.iniciar(30, resolverLetrasUI);
  });
  $('#btnResolverLetras').addEventListener('click', resolverLetrasUI);
  $('#soloLemas').addEventListener('change', () => {
    almacen.guardar('soloLemas', $('#soloLemas').checked);
    if (!resultadoLetras.hidden) resolverLetrasUI();
  });

  async function resolverLetrasUI() {
    cronoLetras.parar();
    avisoLetras.textContent = '';
    if (letras.length < 3) {
      avisoLetras.textContent = 'Introduce al menos 3 letras.';
      return;
    }

    const boton = $('#btnResolverLetras');
    boton.disabled = true;
    resultadoLetras.hidden = false;
    resultadoLetras.innerHTML = '<div class="cargando">Consultando el diccionario…</div>';
    await siguienteFrame();

    try {
      const dic = await obtenerDiccionario();
      const soloLemas = $('#soloLemas').checked;
      const r = resolverLetras(letras, dic, { soloLemas });
      pintarLetras(r);
      const params = { l: letras };
      if (soloLemas) params.f = '1';
      history.replaceState(null, '', urlCon(params, 'letras'));
      mostrarResultado(resultadoLetras);
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
    let html = `<div class="veredicto"><div>
      <span class="veredicto-titulo exacto">${r.maxLongitud} letras</span>
      <span class="veredicto-meta">${r.total.toLocaleString('es-ES')} palabras posibles · ${r.milisegundos} ms</span></div>
      <button class="mini-btn" data-accion="compartir">Compartir</button>
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
          <a class="enlace-rae" href="https://dle.rae.es/${encodeURIComponent(p.palabra)}" target="_blank" rel="noopener">RAE ↗</a></div>
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

  resultadoLetras.addEventListener('click', e => {
    const accion = e.target.closest('[data-accion="compartir"]');
    if (accion) compartir(location.href, 'Cifras y Letras · Letras');
  });

  /* ======================= Teclado físico ======================= */
  function pulsarTeclaVisual(selector) {
    const t = document.querySelector(selector);
    if (!t) return;
    t.classList.add('pulsada');
    setTimeout(() => t.classList.remove('pulsada'), 120);
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const enCampoTexto = e.target.matches && e.target.matches('input[type="text"]');
    if (e.key === 'Enter' && e.target.closest && e.target.closest('button, a, summary')) return; // ya lo gestiona el propio botón

    if (pestanaActual === 'cifras') {
      if (e.key === 'Enter') { e.preventDefault(); resolverCifrasUI(); }
      else if (e.key === 'Escape') limpiarCifras();
      return;
    }

    // Letras
    if (enCampoTexto) return;
    if (e.key === 'Enter') { e.preventDefault(); resolverLetrasUI(); }
    else if (e.key === 'Escape') limpiarLetras();
    else if (e.key === 'Backspace') { e.preventDefault(); borrarLetra(); pulsarTeclaVisual('[data-letra="borrar"]'); }
    else if (e.key.length === 1) {
      const c = normalizar(e.key);
      if (c) { e.preventDefault(); anadirLetras(c); pulsarTeclaVisual(`[data-letra="${c}"]`); }
    }
  });

  // Tras un clic con ratón, el botón suelta el foco para que Enter siga resolviendo.
  document.addEventListener('click', e => {
    const boton = e.target.closest && e.target.closest('button');
    if (boton && e.detail > 0) boton.blur();
  });

  document.addEventListener('paste', e => {
    if (pestanaActual !== 'letras') return;
    const texto = normalizar((e.clipboardData || window.clipboardData).getData('text'));
    if (texto) { e.preventDefault(); anadirLetras(texto); }
  });

  /* ======================= Inicio ======================= */
  const params = new URLSearchParams(location.search);
  const grandesGuardados = almacen.leer('grandes');
  if (Number.isInteger(grandesGuardados)) $(`#chipsGrandes .chip[data-grandes="${grandesGuardados}"]`)?.click();
  $('#soloLemas').checked = params.has('l') ? params.get('f') === '1' : !!almacen.leer('soloLemas');

  if (params.has('n')) {
    ponerCifras(params.get('n').split('.').map(Number).filter(n => n > 0).slice(0, NUM_CASILLAS), Number(params.get('o')) || '');
  } else {
    const c = almacen.leer('cifras');
    if (c) ponerCifras(c.numeros || [], c.objetivo || '');
    else ponerCifras([], '');
  }

  ponerLetras(params.get('l') || almacen.leer('letras') || '');

  const inicial = location.hash === '#letras' || (params.has('l') && !params.has('n')) ? 'letras' : 'cifras';
  mostrarPestana(inicial);
  if (inicial === 'cifras' && params.has('n')) resolverCifrasUI();
  if (inicial === 'letras' && params.has('l')) resolverLetrasUI();
})();
