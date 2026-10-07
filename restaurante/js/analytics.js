/* ============================================================
   ANALYTICS (Google Tag Manager)
   ------------------------------------------------------------
   Capa fina sobre dataLayer.push(): agrega el slug del negocio
   a todos los eventos (para poder filtrar por negocio en GA4,
   ya que el sitio es multi-cliente vía ?cliente=slug) y define
   los eventos propios de esta app.

   GTM (contenedor GTM-W9FHZC3Q) ya está cargado en el <head> de
   index.html. Estos eventos quedan en el dataLayer; para que
   lleguen a GA4 hay que crear, DENTRO de GTM, un trigger de
   "Evento personalizado" por cada nombre de evento de acá y un
   tag de "Evento de GA4" que lo dispare.

   Como esto es una SPA por hash (categorías -> productos ->
   detalle -> carrito sin recargar la página), el "Page View"
   automático de GTM/GA4 solo ve la carga inicial. Por eso acá
   se manda un evento propio (pantalla_vista) en cada cambio de
   pantalla, llamado desde navegar() en app.js.
   ============================================================ */

function paramsAnalytics(extra) {
  return Object.assign({ negocio_slug: obtenerSlugCliente() }, extra || {});
}

/* ------------------------------------------------------------
   ID anónimo de visitante
   ------------------------------------------------------------
   Vive en localStorage (no identifica a la persona, es un ID
   random). Namespaced por negocio, igual que el carrito y el
   token de admin: así "visitante nuevo" se calcula por negocio,
   no de forma global entre todos los catálogos.
   ------------------------------------------------------------ */
function idVisitante() {
  const clave = 'visitante_id_' + obtenerSlugCliente();
  try {
    let id = localStorage.getItem(clave);
    if (!id) {
      id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(clave, id);
    }
    return id;
  } catch (e) {
    // Modo privado / storage bloqueado: cuenta como visitante nuevo siempre.
    return 'sin_storage';
  }
}

/**
 * Guarda un evento de negocio en Postgres (propio, complementa a
 * GA4). "Fire and forget": si falla, no interrumpe al cliente que
 * está armando su pedido.
 *
 * Si "beacon" es true, usa navigator.sendBeacon en vez de fetch: hace
 * falta para el evento de tiempo en pantalla, que se dispara cuando
 * el visitante ya está saliendo de la página (fetch normal puede
 * cancelarse a mitad de camino si la pestaña se cierra).
 */
function enviarMetrica(tipo, datos, beacon) {
  const slug = obtenerSlugCliente();
  if (!slug) return;

  const url = API_BASE + '/api/metricas/' + encodeURIComponent(slug);
  const body = JSON.stringify(Object.assign({ tipo: tipo }, datos || {}));

  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  }).catch(() => {});
}

/**
 * Página externa desde la que llegó el visitante (buscador, red
 * social, otro sitio) la PRIMERA vez que entró en esta sesión de
 * navegador. Se calcula una sola vez: document.referrer solo tiene
 * sentido en la carga inicial, no en la navegación interna por hash.
 * "directo" cubre acceso tecleado, favoritos, o apps que no mandan
 * referrer (como WhatsApp en algunos casos).
 */
function origenExterno() {
  const ref = document.referrer;
  if (!ref) return 'directo';
  try {
    const host = new URL(ref).hostname;
    return host === location.hostname ? 'directo' : host;
  } catch (e) {
    return 'directo';
  }
}

/**
 * Visita al catálogo: se llama UNA vez por carga de página (no en
 * cada cambio de pantalla de la SPA), desde iniciar() en app.js.
 * Manda el id anónimo del visitante para poder distinguir después,
 * en el backend, cuántas de las visitas son de gente que ya había
 * entrado antes a ESTE negocio, y de dónde vino (para ver canales
 * de tráfico más frecuentes).
 */
function trackVisita() {
  enviarMetrica('visita', { visitanteId: idVisitante(), origen: origenExterno() });
}

/* ------------------------------------------------------------
   Tiempo en cada pantalla
   ------------------------------------------------------------
   Cada vez que navegar() (en app.js) entra a una pantalla nueva,
   llama a marcarInicioPantalla(nombre). Cuando se sale de esa
   pantalla (siguiente navegación, cierre de pestaña, o pasar la
   página a segundo plano) se manda cuánto tiempo estuvo activa,
   junto con la pantalla anterior como "origen" interno — así se
   puede reconstruir tanto la permanencia como el recorrido dentro
   de la SPA (ej.: cuánto tiempo mira "productos" antes de ir a
   "detalle").
   ------------------------------------------------------------ */
let _pantallaActual = null;
let _inicioPantalla = 0;

function marcarInicioPantalla(pantalla) {
  cerrarPantallaActual();
  _pantallaActual = pantalla;
  _inicioPantalla = Date.now();
}

function cerrarPantallaActual(beacon) {
  if (!_pantallaActual || !_inicioPantalla) return;

  const ms = Date.now() - _inicioPantalla;
  // Menos de 300ms suele ser un rebote entre hashes (ej. redirects
  // en cadena), no tiempo real de lectura: no vale la pena guardarlo.
  if (ms >= 300) {
    enviarMetrica('tiempo_pantalla', { pantalla: _pantallaActual, msEnPantalla: ms }, beacon);
  }

  _pantallaActual = null;
  _inicioPantalla = 0;
}

// Cierra la medición de la última pantalla cuando el visitante se va
// (cerrar pestaña, navegar a otro sitio, poner la app en segundo
// plano en el celular). "visibilitychange" es más confiable que
// "pagehide" en mobile, donde a veces pagehide no llega a disparar.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cerrarPantallaActual(true);
});
window.addEventListener('pagehide', () => cerrarPantallaActual(true));

/** "Pageview" virtual: se llama una vez por cada pantalla que se muestra. */
function trackPantalla(pantalla, path) {
  window.dataLayer = window.dataLayer || [];
  dataLayer.push(Object.assign({ event: 'pantalla_vista' }, paramsAnalytics({
    page_title: document.title,
    page_location: location.href,
    page_path: path
  })));
}

/** Ver categoría de productos. */
function trackVerCategoria(idCategoria) {
  window.dataLayer = window.dataLayer || [];
  dataLayer.push(Object.assign({ event: 'view_item_list' }, paramsAnalytics({ item_list_id: idCategoria })));
  enviarMetrica('vista_categoria', { productoId: idCategoria });
}

/** Ver el detalle de un producto puntual. */
function trackVerProducto(idProducto) {
  window.dataLayer = window.dataLayer || [];
  dataLayer.push(Object.assign({ event: 'view_item' }, paramsAnalytics({ item_id: idProducto })));
  enviarMetrica('vista_producto', { productoId: idProducto });
}

/** Agregar un producto al carrito. */
function trackAgregarCarrito(idProducto, cantidad) {
  window.dataLayer = window.dataLayer || [];
  dataLayer.push(Object.assign({ event: 'add_to_cart' }, paramsAnalytics({ item_id: idProducto, quantity: cantidad })));
  enviarMetrica('agregado_carrito', { productoId: idProducto, cantidad: cantidad });
}

/**
 * Conversión principal del sitio: el cliente termina el pedido
 * y se abre WhatsApp con el mensaje ya armado.
 */
function trackClickWhatsApp(totalPedido) {
  window.dataLayer = window.dataLayer || [];
  dataLayer.push(Object.assign({ event: 'click_whatsapp' }, paramsAnalytics({ value: totalPedido, currency: 'BRL' })));
  enviarMetrica('pedido_enviado', { total: totalPedido, cantidad: CARRITO.length });
}

/**
 * Carrito abandonado: se llama cuando el cliente entra a la
 * pantalla de carrito con productos, para poder comparar después
 * cuántos "carrito_abandonado" hay contra cuántos "pedido_enviado".
 * No es 100% preciso (no sabemos si después sí completó el pedido
 * en la misma visita), pero da una señal útil de fricción.
 */
function trackCarritoAbandonado() {
  if (carritoVacio()) return;
  enviarMetrica('carrito_abandonado', { cantidad: CARRITO.length, total: totalCarrito(false) });
}
