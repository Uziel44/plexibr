/* Gestos de landing.html, sin librerías. Las animaciones son CSS
   (css/landing.css); acá solo se decide cuándo se dispara cada una. */
(function () {
  'use strict';

  const raiz = document.documentElement;

  // Avisa al <head> de landing.html que este archivo corrió; si no, a los 4 s muestra todo.
  raiz.dataset.landing = 'listo';

  function iniciarScroll() {
    const barra = document.querySelector('.barra');
    const progreso = document.querySelector('[data-scroll-progress]');
    let esperandoFrame = false;

    function actualizar() {
      esperandoFrame = false;
      const y = window.scrollY;
      if (barra) barra.dataset.scrolled = String(y > 40);
      if (progreso) {
        const maximo = raiz.scrollHeight - window.innerHeight;
        progreso.style.transform = 'scaleX(' + (maximo > 0 ? Math.min(y / maximo, 1) : 0) + ')';
      }
    }

    window.addEventListener('scroll', () => {
      if (esperandoFrame) return;
      esperandoFrame = true;
      requestAnimationFrame(actualizar);
    }, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
  }

  function animarHero() {
    document.querySelectorAll('[data-hero-item]').forEach((el, i) => {
      el.style.setProperty('--retardo', (0.1 + i * 0.14) + 's');
      el.classList.add('revelado');
    });
  }

  function animarAlScrollear() {
    const elementos = Array.from(document.querySelectorAll('[data-reveal]'));

    function revelar(el, retardo) {
      el.style.setProperty('--retardo', retardo + 's');
      el.classList.add('revelado');
      observador.unobserve(el);
    }

    // Los que ya están a la vista al cargar esperan a que termine el hero, para
    // que no corran dos efectos a la vez. Los que entran a la vez (las 3 tarjetas
    // de plan en escritorio) van en cascada.
    let primeraTanda = true;
    const esperaHero = document.querySelectorAll('[data-hero-item]').length * 0.14 + 0.6;
    const observador = new IntersectionObserver((entradas) => {
      const base = primeraTanda ? esperaHero : 0;
      primeraTanda = false;
      let orden = 0;
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) revelar(entrada.target, base + orden++ * 0.12);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    elementos.forEach((el) => observador.observe(el));

    // Red de seguridad: revela lo que ya está en pantalla aunque el observer no avise.
    const vigilante = setInterval(() => {
      const ocultos = elementos.filter((el) => !el.classList.contains('revelado'));
      if (!ocultos.length) return clearInterval(vigilante);
      ocultos.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) revelar(el, 0);
      });
    }, 1000);
  }

  iniciarScroll();

  // El <head> ya quitó la clase (este archivo tardó más de 4 s): no hay nada que animar.
  if (!raiz.classList.contains('landing-js')) return;

  if (!('IntersectionObserver' in window)) {
    raiz.classList.remove('landing-js');
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  animarHero();
  animarAlScrollear();
})();
