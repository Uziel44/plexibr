document.addEventListener('DOMContentLoaded', () => {
  const lenis = initSmoothScroll();
  initMobileNav();
  initPortfolioColumns();
  initClickTracking();
  initRevealAnimations();
  initParallax(lenis);
});

/**
 * Scroll suave con inercia (mismo patrón que "02 electrotest", ahí vía Lenis
 * + npm/Vite; acá vía Lenis cargado por CDN como script clásico, porque este
 * sitio no tiene build step). Se omite si el usuario pide movimiento
 * reducido, dejando el scroll nativo del navegador.
 * @returns {object|null} instancia de Lenis, o null si no se activó
 */
function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (typeof window.Lenis !== 'function') return null;

  const lenis = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    autoRaf: true,
    // En táctil se mantiene el scroll nativo: es más fluido y no rompe gestos.
    syncTouch: false,
    touchMultiplier: 1.6,
  });

  return lenis;
}

/**
 * Animaciones de entrada al hacer scroll (fade + slide), mismo gesto que
 * "02 electrotest" pero con IntersectionObserver nativo en vez de GSAP +
 * ScrollTrigger, ya que acá no hay esas dependencias instaladas.
 *
 * Marcado en el HTML:
 *   data-reveal="up|left|right|fade"  → dirección de la entrada (default: up)
 *   data-reveal-delay="0.15"          → retardo en segundos
 *   data-reveal-group="up"            → anima a los [data-reveal] hijos en cascada
 */
function initRevealAnimations() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const singles = Array.from(document.querySelectorAll('[data-reveal]:not([data-reveal-group] [data-reveal])'));
  const groups = Array.from(document.querySelectorAll('[data-reveal-group]'));

  if (prefersReducedMotion) {
    singles.forEach((el) => el.classList.add('is-revealed'));
    groups.forEach((group) => {
      group.classList.add('is-revealed');
      group.querySelectorAll('[data-reveal]').forEach((child) => child.classList.add('is-revealed'));
    });
    return;
  }

  singles.forEach((el) => {
    el.classList.add('reveal', `reveal-${el.dataset.reveal || 'up'}`);
    const delay = parseFloat(el.dataset.revealDelay || '0');
    if (delay) el.style.transitionDelay = `${delay}s`;
  });

  groups.forEach((group) => {
    const direction = group.dataset.revealGroup || 'up';
    const children = Array.from(group.querySelectorAll('[data-reveal]'));
    children.forEach((child, i) => {
      child.classList.add('reveal', `reveal-${direction}`);
      child.style.transitionDelay = `${i * 0.12}s`;
    });
  });

  const reveal = (el) => {
    // will-change recién se agrega acá (justo antes de animar) y se saca al
    // terminar la transición: así el navegador sólo promueve a capa GPU los
    // elementos que están animando en ese momento, no todos los [data-reveal]
    // de la página desde que carga.
    el.style.willChange = 'opacity, transform';
    el.classList.add('is-revealed');
    const clearWillChange = () => { el.style.willChange = ''; };
    el.addEventListener('transitionend', clearWillChange, { once: true });
    // Respaldo: si el elemento ya estaba fuera de layout/con la transición
    // cortada por un salto grande de scroll, "transitionend" puede no llegar
    // a disparar nunca. 1s cubre de sobra la transición de 0.9s declarada.
    window.setTimeout(clearWillChange, 1000);
  };

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        if (entry.target.hasAttribute('data-reveal-group')) {
          entry.target.querySelectorAll('[data-reveal]').forEach(reveal);
        } else {
          reveal(entry.target);
        }

        obs.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
  );

  singles.forEach((el) => observer.observe(el));
  groups.forEach((group) => observer.observe(group));

  // Salvaguarda: si por lo que sea el observer no disparó a tiempo (layout
  // inestable, navegador lento), se revela igual pasado un margen. Preferimos
  // perder la animación a que quede contenido invisible.
  window.setTimeout(() => {
    document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(reveal);
  }, 2500);
}

/**
 * Parallax en elementos marcados con data-parallax="0.2" (intensidad; negativo
 * invierte la dirección). Usado por el showcase de portfolio (3 columnas a
 * distinta velocidad, igual que tiendanube.com) y queda disponible para
 * cualquier otro elemento. Se desactiva con movimiento reducido. Si Lenis
 * está activo se engancha a su evento de scroll; si no, usa el scroll nativo.
 * @param {object|null} lenis
 */
function initParallax(lenis) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const elements = Array.from(document.querySelectorAll('[data-parallax]')).map((el) => ({
    el,
    intensity: parseFloat(el.dataset.parallax || '0.15'),
  }));
  if (!elements.length) return;

  let ticking = false;

  function update() {
    ticking = false;
    const viewportHeight = window.innerHeight;

    elements.forEach(({ el, intensity }) => {
      const rect = el.getBoundingClientRect();
      // Progreso 0→1 de cuánto atravesó el elemento la pantalla, para que el
      // desplazamiento sea proporcional a su posición y no salte al entrar.
      const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      const offset = (progress - 0.5) * intensity * rect.height;
      el.style.transform = `translateY(${offset}px)`;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', onScroll);
  update();
}

/**
 * Portfolio en mobile (≤520px): de 3 columnas a 2, con las cards repartidas
 * en partes iguales (4 + 4 con las 8 webs actuales). Las cards de la 3ª
 * columna se pasan de a una a la 1ª y a la 2ª, y esa columna se oculta. Al
 * ensanchar la pantalla cada card vuelve a su columna original. Agregar una
 * card nueva en el HTML sigue bastando: no hace falta tocar este JS.
 */
function initPortfolioColumns() {
  const cols = Array.from(document.querySelectorAll('.portfolio-col'));
  if (cols.length < 3) return;

  // Columna original de cada card, para poder deshacer el reparto.
  const entries = cols.flatMap((col, colIndex) =>
    Array.from(col.children).map((card) => ({ card, colIndex })),
  );
  const mobileQuery = window.matchMedia('(max-width: 520px)');

  const layout = () => {
    const isMobile = mobileQuery.matches;
    let extra = 0;
    entries.forEach(({ card, colIndex }) => {
      let target = colIndex;
      if (isMobile && colIndex >= 2) {
        target = extra % 2;
        extra += 1;
      }
      cols[target].appendChild(card);
    });
    cols.slice(2).forEach((col) => { col.hidden = isMobile; });
  };

  layout();
  mobileQuery.addEventListener('change', layout);
}

function initMobileNav() {
  const menuLabel = (open) => (open ? 'Fechar menu' : 'Abrir menu');
  const header = document.querySelector('.site-header');
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!header || !toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', menuLabel(isOpen));
    toggle.innerHTML = isOpen
      ? '<i class="bi bi-x-lg" aria-hidden="true"></i>'
      : '<i class="bi bi-list" aria-hidden="true"></i>';
  });

  const closeMenu = () => {
    header.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', menuLabel(false));
    toggle.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
  };

  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });
}

/**
 * Eventos para GTM/GA4 vía dataLayer, con un único listener delegado:
 *   tel_click        → cualquier link tel:
 *   cta_click        → cualquier elemento con data-cta="ubicacion"
 *   portfolio_click  → cualquier .portfolio-card (con el nombre del proyecto)
 * Marcar tel_click y cta_click como conversiones en GA4.
 */
function initClickTracking() {
  window.dataLayer = window.dataLayer || [];

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const cta = link.dataset.cta;

    if (href.startsWith('tel:')) {
      window.dataLayer.push({ event: 'tel_click', cta_location: cta || 'other' });
    }
    if (cta) {
      window.dataLayer.push({ event: 'cta_click', cta_location: cta });
    }
    if (link.classList.contains('portfolio-card')) {
      const name = link.querySelector('.portfolio-name')?.textContent.trim();
      window.dataLayer.push({ event: 'portfolio_click', project: name });
    }
  });
}
