/*
 * Interfaz del portfolio: scroll suave (Lenis), pantalla de carga, cursor propio,
 * animaciones de entrada y de scroll (GSAP + ScrollTrigger) y los detalles
 * pequeños (terminal, reloj de Málaga, huella SHA-256, copiar correo).
 *
 * No depende de la escena 3D: si WebGL falla, todo esto sigue funcionando. Se
 * comunica con escena.js por window.__escena (tono al pasar por un proyecto,
 * estallido del huevo de pascua) y por el evento «escena-lista».
 */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raton = matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  if (G && ST) { G.registerPlugin(ST); ST.clearScrollMemory('manual'); }

  // la visita siempre empieza arriba, con la pantalla de carga (salvo que se entre por un #ancla)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  // ── Abierta con doble clic (file://): el navegador bloquea el 3D ──
  if (location.protocol === 'file:') {
    const aviso = document.createElement('p');
    aviso.className = 'aviso-local mono';
    aviso.textContent = 'Abierta como archivo: el navegador bloquea el 3D y no verás el robot. Ábrela con «Ver en local.bat».';
    document.body.appendChild(aviso);
  }

  // ── Foto: si no existe, se quita el hueco ─────────────────────
  const fotoImg = $('#foto-slot img');
  if (fotoImg) {
    const sinFoto = () => { root.classList.add('no-foto'); ST && ST.refresh(); };
    if (fotoImg.complete && fotoImg.naturalWidth === 0) sinFoto();
    fotoImg.addEventListener('error', sinFoto);
  }

  // ── Scroll suave ──────────────────────────────────────────────
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    if (ST) lenis.on('scroll', ST.update);
    if (G) {
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    lenis.stop();
  }
  window.__lenis = lenis;

  const irA = (destino) => {
    if (lenis) return lenis.scrollTo(destino, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    const top = destino === 0 ? 0 : destino.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    irA(id === '#inicio' ? 0 : t);
  }));

  // ── Partir textos en letras y líneas ──────────────────────────
  $$('.split').forEach((el) => {
    const txt = el.textContent;
    el.textContent = '';
    for (const c of txt) {
      const m = document.createElement('span');
      m.className = 'ch-mask';
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c === ' ' ? ' ' : c;
      m.appendChild(s);
      el.appendChild(m);
    }
  });
  // títulos con <br>: cada línea en su máscara
  $$('.lines').forEach((el) => {
    const partes = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = partes.map((p) => `<span class="ln"><span>${p.trim()}</span></span>`).join('');
  });
  // manifiesto: palabra a palabra
  const manif = $('#manif');
  if (manif) manif.innerHTML = manif.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');

  // ── Nombre y «¿Hablamos?» siempre en una línea, midan lo que midan ──
  function encajar(el) {
    el.style.fontSize = '';
    const cs = getComputedStyle(el);
    const hueco = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const r = document.createRange();
    let ancho = 0;
    el.querySelectorAll(':scope > span').forEach((l) => {
      r.selectNodeContents(l);
      ancho = Math.max(ancho, r.getBoundingClientRect().width);
    });
    if (ancho > hueco) el.style.fontSize = (parseFloat(cs.fontSize) * hueco / ancho) * 0.98 + 'px';
  }
  const titulosGrandes = $$('.hero__name, .contact__title');
  const encajarTodo = () => titulosGrandes.forEach(encajar);
  encajarTodo();
  if (document.fonts) document.fonts.ready.then(encajarTodo);
  addEventListener('resize', encajarTodo);

  // ── Texto «descifrándose» ─────────────────────────────────────
  const GLIFOS = '!<>-_\\/[]{}=+*^?#01ABCDEF$%&';
  function descifrar(el) {
    if (reduce) return;
    const final = el.dataset.final || el.textContent;
    el.dataset.final = final;
    const total = 26;
    let f = 0;
    const paso = () => {
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const listo = f >= (i / final.length) * total * 0.75 + 5;
        out += listo || final[i] === ' ' ? final[i] : GLIFOS[(Math.random() * GLIFOS.length) | 0];
      }
      el.textContent = out;
      if (f++ < total + 5) requestAnimationFrame(paso);
      else el.textContent = final;
    };
    paso();
  }
  window.__descifrar = descifrar;

  // ── Pantalla de carga ─────────────────────────────────────────
  const pre = $('#pre');
  const num = $('#pre-num');
  const barra = $('#pre-bar');
  const hex = $('#pre-hex');
  let escenaLista = !!window.__escenaLista;
  let minimo = false;
  addEventListener('escena-lista', () => { escenaLista = true; });
  setTimeout(() => { minimo = true; }, reduce ? 200 : 2200);
  setTimeout(() => { escenaLista = true; }, 7000);   // si WebGL no llega, no se bloquea la web

  if (G && !reduce) G.set('.hero .ch', { yPercent: 115 });

  const hexAleatorio = () => '0x' + Array.from({ length: 32 }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
  // avanza por tiempo (no por fotogramas), para que en un equipo lento no se eternice
  let p = 0;
  const inicioCarga = performance.now();
  function cargar() {
    const tope = escenaLista ? 100 : 88;
    const x = Math.min(1, (performance.now() - inicioCarga) / (reduce ? 200 : 1900));
    p = Math.max(p, Math.min(tope, 100 * (1 - Math.pow(1 - x, 3))));
    if (escenaLista && x >= 1) p = 100;
    num.textContent = String(Math.floor(p)).padStart(3, '0');
    barra.style.transform = `scaleX(${p / 100})`;
    hex.textContent = hexAleatorio();
    if (p >= 99.9 && minimo) return entrar();
    requestAnimationFrame(cargar);
  }
  if (pre) requestAnimationFrame(cargar); else entrar();

  function entrar() {
    root.classList.add('is-loaded');
    if (hex) hex.textContent = 'ACCESO CONCEDIDO';
    const fin = () => {
      pre && pre.remove();
      if (!location.hash) { lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0); }
      lenis && lenis.start();
      ST && ST.refresh();
    };
    if (!G || reduce) { fin(); return; }
    const tl = G.timeline({ delay: 0.35 });
    tl.to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1.25, ease: 'expo.inOut' })
      .to('.hero .ch', { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.035 }, '-=0.55')
      .from('.hero__meta > *, .nav > *', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06 }, '-=1.1')
      .add(fin, '-=0.8');
  }

  // ── Animaciones con scroll ────────────────────────────────────
  if (G && ST && !reduce) {
    $$('.lines').forEach((el) => {
      G.from(el.querySelectorAll('.ln > span'), {
        yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
    $$('[data-reveal]').forEach((el) => {
      G.from(el, { y: 60, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });

    // manifiesto: las palabras se encienden al bajar
    if (manif) {
      G.fromTo(manif.querySelectorAll('.w'), { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: manif, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
    }

    // contadores
    $$('[data-count]').forEach((el) => {
      const fin = +el.dataset.count;
      const suf = el.dataset.suffix || '';
      const o = { v: 0 };
      G.to(o, {
        v: fin, duration: 2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onUpdate: () => { el.textContent = Math.round(o.v) + suf; },
      });
    });

    // línea de la trayectoria
    const linea = $('.steps__line span');
    if (linea) {
      G.fromTo(linea, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 60%', scrub: true },
      });
    }

    // título del contacto
    G.from('.contact__title .ch', {
      yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: 0.04,
      scrollTrigger: { trigger: '.contact__title', start: 'top 80%' },
    });

    // arsenal en horizontal (solo pantallas anchas)
    const mm = G.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const pista = $('.arsenal__track');
      const distancia = () => Math.max(0, pista.scrollWidth - innerWidth);
      G.to(pista, {
        x: () => -distancia(), ease: 'none',
        scrollTrigger: {
          trigger: '#arsenal', start: 'top top', end: () => '+=' + distancia(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
    });
  }

  // descifrado de etiquetas al entrar en pantalla
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (e.isIntersecting) { descifrar(e.target); io.unobserve(e.target); }
  }), { threshold: 0.6 });
  $$('[data-scramble]').forEach((el) => io.observe(el));

  // ── Terminal que se escribe sola ──────────────────────────────
  const term = $('#term');
  if (term && !reduce) {
    const html = term.innerHTML;
    const ioT = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      ioT.disconnect();
      // se escribe carácter a carácter respetando las etiquetas de color
      const trozos = html.split(/(<[^>]+>)/).filter(Boolean);
      term.innerHTML = '<span class="term__caret"></span>';
      let out = '', i = 0, j = 0;
      const escribir = () => {
        if (i >= trozos.length) { term.innerHTML = html + '<span class="term__caret"></span>'; return; }
        const t = trozos[i];
        if (t.startsWith('<')) { out += t; i++; j = 0; }
        else {
          const n = Math.min(t.length - j, 3);
          out += t.slice(j, j + n).replace(/&(?!amp;|lt;|gt;)/g, '&amp;');
          j += n;
          if (j >= t.length) { i++; j = 0; }
        }
        term.innerHTML = out + '<span class="term__caret"></span>';
        setTimeout(escribir, t.startsWith('<') ? 0 : (t.includes('\n') && j === 0 ? 140 : 16));
      };
      escribir();
    }, { threshold: 0.5 });
    ioT.observe(term);
  }

  // ── Cursor propio y botones magnéticos ────────────────────────
  if (raton && !reduce) {
    root.classList.add('has-cursor');
    const cur = $('.cur');
    const dot = $('.cur__dot');
    const ring = $('.cur__ring');
    const label = $('.cur__label');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    }, { passive: true });
    (function seguir() {
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(seguir);
    })();
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor]');
      cur.classList.toggle('is-link', !!t && !t.dataset.cursor);
      cur.classList.toggle('is-label', !!(t && t.dataset.cursor));
      label.textContent = t && t.dataset.cursor ? t.dataset.cursor : '';
    });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-link', 'is-label'));

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 700);
      });
    });

    // tarjetas: brillo bajo el ratón e inclinación
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
        el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 8}deg) rotateX(${(0.5 - py) * 8}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // ── Proyectos: tiñen los ojos del robot ───────────────────────
  $$('.row').forEach((row) => {
    row.style.setProperty('--tone', row.dataset.tone);
    row.addEventListener('pointerenter', () => window.__escena && window.__escena.tono(row.dataset.tone));
    row.addEventListener('pointerleave', () => window.__escena && window.__escena.tono(null));
  });

  // ── Navegación que se esconde, HUD y porcentaje ───────────────
  const nav = $('#nav');
  const hud = $('.hud');
  const pct = $('#hud-pct');
  let ultimo = 0;
  function alHacerScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('is-hidden', y > ultimo && y > innerHeight * 0.6);
    hud.classList.toggle('is-on', y > innerHeight * 0.5 && y < max - innerHeight * 0.5);
    pct.textContent = String(Math.round((y / Math.max(1, max)) * 100)).padStart(3, '0') + '%';
    ultimo = y;
  }
  if (lenis) lenis.on('scroll', alHacerScroll); else addEventListener('scroll', alHacerScroll, { passive: true });

  // ── Cinta infinita que acelera con el scroll ──────────────────
  const filas = $$('.marquee__row');
  if (filas.length && !reduce) {
    let avance = 0;
    const mover = () => {
      const v = lenis ? lenis.velocity : 0;
      avance += 0.035 + Math.min(Math.abs(v), 60) * 0.012;
      const sesgo = Math.max(-10, Math.min(10, v * 0.25));
      filas.forEach((f, i) => {
        const x = i % 2 ? (avance % 50) - 50 : -(avance % 50);
        f.style.transform = `translate3d(${x}%,0,0) skewX(${-sesgo}deg)`;
      });
      requestAnimationFrame(mover);
    };
    requestAnimationFrame(mover);
  }

  // ── Copiar correo ─────────────────────────────────────────────
  const toast = $('#toast');
  const avisar = (txt) => {
    toast.textContent = txt;
    toast.classList.add('is-on');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => toast.classList.remove('is-on'), 2200);
  };
  const copiar = $('#copy');
  if (copiar) copiar.addEventListener('click', () => {
    const correo = copiar.dataset.mail;
    const seleccionar = () => {
      const r = document.createRange();
      r.selectNodeContents($('.mail__addr'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      avisar('Correo seleccionado: pulsa Ctrl+C');
    };
    if (navigator.clipboard) navigator.clipboard.writeText(correo).then(() => avisar('Correo copiado'), seleccionar);
    else seleccionar();
  });

  // ── Reloj de Málaga ───────────────────────────────────────────
  const reloj = $('#clock');
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tic = () => { reloj.textContent = hora.format(new Date()); };
  tic(); setInterval(tic, 1000);

  // ── Huella SHA-256 del nombre (calculada de verdad) ───────────
  const huella = $('#hash');
  const nombre = ($('.hero__name') && $('.hero__name').getAttribute('aria-label')) || '';
  if (window.crypto && crypto.subtle && huella) {
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(nombre)).then((buf) => {
      const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      huella.textContent = h.slice(0, 12) + '…';
      huella.parentElement.title += ': ' + h;
    }).catch(() => { huella.textContent = '—'; });
  } else if (huella) huella.textContent = '—';

  // ── Huevo de pascua: escribir «sudo» ──────────────────────────
  let teclas = '';
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    teclas = (teclas + e.key.toLowerCase()).slice(-4);
    if (teclas === 'sudo') {
      root.classList.add('glitch');
      window.__escena && window.__escena.estallido();
      avisar('Permisos de root concedidos. Úsalos con cabeza.');
      setTimeout(() => root.classList.remove('glitch'), 1100);
    }
  });

  // re-medir cuando llegan las fuentes
  if (document.fonts && ST) document.fonts.ready.then(() => ST.refresh());
})();
