/* ============================================================
   CATÁLOGO Y CONFIGURACIÓN
   ------------------------------------------------------------
   Los datos (negocio, categorías, productos) ya NO están
   escritos acá: se piden al servidor según el cliente indicado
   en la URL, por ejemplo:

     index.html?cliente=pizza-rapida

   Este archivo solo se ocupa de traerlos y de las funciones de
   consulta que usa el resto de la app (buscarProducto, etc.).
   ============================================================ */


/* ------------------------------------------------------------
   Dirección del servidor
   ------------------------------------------------------------
   En desarrollo local el backend corre en el puerto 3001.
   Si publicás el backend en otro dominio, cambiá esta línea.
   ------------------------------------------------------------ */
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : '';   // en producción, si front y back están en el mismo dominio, se deja vacío


/* ------------------------------------------------------------
   Identificar qué cliente hay que mostrar
   ------------------------------------------------------------
   Prioridad:
     1. Subdominio (tunegocio.plexi.com.ar -> "tunegocio"), para
        el o los negocios que sí están listados con su propio
        subdominio en el Caddyfile.
     2. Ruta (plexi.com.ar/kiosco01 -> "kiosco01"): la forma por
        defecto, no requiere tocar el Caddyfile por cada negocio.
     3. ?cliente=... en la URL (compatibilidad con links viejos).
   ------------------------------------------------------------ */
function obtenerSlugCliente() {
  const host = location.hostname;
  const esDominioPropio = host.endsWith('.plexi.com.ar');

  if (esDominioPropio) {
    const subdominio = host.replace('.plexi.com.ar', '');
    if (subdominio && subdominio !== 'www') return subdominio;
  }

  const slugDeRuta = location.pathname.replace(/^\/+|\/+$/g, '');
  if (slugDeRuta && slugDeRuta !== 'index.html' && slugDeRuta !== 'admin.html') {
    return slugDeRuta;
  }

  const params = new URLSearchParams(location.search);
  return params.get('cliente') || '';
}

/**
 * Arma el link "limpio" al catálogo del negocio actual — siempre
 * plexi.com.ar/<slug> (o el subdominio propio, si lo tiene), sin
 * importar por cuál de las 3 formas entró este visitante en particular
 * (subdominio, ruta, o el viejo ?cliente=) ni en qué pantalla del
 * catálogo esté parado (categoría, producto, carrito). Lo usan los
 * botones de compartir (ver app.js) para no propagar una URL fea con
 * query string o un link a una pantalla puntual en vez de la portada.
 * Misma lógica que urlCatalogoDe() en admin.js — no se comparte el
 * código porque admin.js y este bundle público no se cargan juntos.
 */
function urlCatalogoActual() {
  const slug = obtenerSlugCliente();
  if (!slug) return location.href; // por si acaso: sin slug detectado, no hay link limpio que armar

  if (slug === 'pizza01') {
    return location.protocol + '//pizza01.plexi.com.ar/';
  }
  const origenSinSubdominio = location.hostname.endsWith('.plexi.com.ar')
    ? location.protocol + '//' + location.hostname.split('.').slice(1).join('.')
    : location.origin;
  return origenSinSubdominio + '/' + encodeURIComponent(slug);
}

let CONFIG = null;
let CATEGORIAS = [];
let PRODUCTOS = [];   // se va llenando de a lotes, por categoría, a medida que el cliente navega

// Estado de paginación por categoría. Clave: id de categoría (su slug).
// Valor: { cargados: N, total: N, cargando: bool }. Sin entrada acá =
// esa categoría todavía no se pidió nunca.
const PAGINACION_CATEGORIA = {};
const PRODUCTOS_POR_LOTE = 30;

/**
 * Pide al servidor los datos del negocio actual (SIN productos: esos
 * se piden aparte, por categoría, recién cuando el cliente entra a
 * cada una — ver cargarLoteDeCategoria).
 * Devuelve true si salió bien, false si hubo un error
 * (negocio inexistente, servidor caído, etc.).
 */
async function cargarCatalogo() {
  const slug = obtenerSlugCliente();

  if (!slug) {
    mostrarErrorCarga('Falta indicar o negócio. O endereço deve incluir "?cliente=nome-do-negocio".');
    return false;
  }

  try {
    const respuesta = await fetch(API_BASE + '/api/publico/' + encodeURIComponent(slug));

    if (!respuesta.ok) {
      mostrarErrorCarga('Não encontramos esse negócio. Confira o link.');
      return false;
    }

    const datos = await respuesta.json();

    CONFIG = datos.negocio;
    CATEGORIAS = datos.categorias;

    return true;

  } catch (e) {
    mostrarErrorCarga('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    return false;
  }
}

/**
 * Trae el siguiente lote de productos de una categoría y lo agrega a
 * PRODUCTOS (sin descartar lo ya cargado de esa u otras categorías).
 * Si la categoría ya se agotó (cargados >= total) no pide nada más.
 * Devuelve true si pidió y sumó productos nuevos, false si no hizo
 * falta pedir nada (ya estaba todo cargado) o si falló la request.
 */
async function cargarLoteDeCategoria(idCategoria) {
  const slug = obtenerSlugCliente();
  const estado = PAGINACION_CATEGORIA[idCategoria] || { cargados: 0, total: Infinity, cargando: false };
  PAGINACION_CATEGORIA[idCategoria] = estado;

  if (estado.cargando || estado.cargados >= estado.total) return false;

  estado.cargando = true;
  try {
    const url = API_BASE + '/api/publico/' + encodeURIComponent(slug) +
      '/categoria/' + encodeURIComponent(idCategoria) +
      '?offset=' + estado.cargados + '&limite=' + PRODUCTOS_POR_LOTE;
    const respuesta = await fetch(url);
    if (!respuesta.ok) return false;

    const datos = await respuesta.json();
    PRODUCTOS.push(...datos.productos);
    estado.cargados += datos.productos.length;
    estado.total = datos.total;
    return datos.productos.length > 0;
  } catch (e) {
    return false;
  } finally {
    estado.cargando = false;
  }
}

/**
 * Diseño "restaurante": trae TODOS los productos del negocio en una sola
 * request (GET .../menu), sin las imágenes — cada producto trae la URL de
 * la suya, que el navegador pide de a una a medida que se hace scroll.
 * Marca cada categoría como ya completa en PAGINACION_CATEGORIA, así
 * cargarLoteDeCategoria no vuelve a pedir nada.
 * Devuelve true si salió bien, false si falló (el catálogo cae entonces al
 * diseño de siempre).
 */
async function cargarMenuCompleto() {
  const slug = obtenerSlugCliente();
  try {
    const respuesta = await fetch(API_BASE + '/api/publico/' + encodeURIComponent(slug) + '/menu');
    if (!respuesta.ok) return false;

    const datos = await respuesta.json();
    PRODUCTOS.length = 0;
    PRODUCTOS.push(...datos.productos);

    CATEGORIAS.forEach(cat => {
      const cantidad = datos.productos.filter(p => p.categoria === cat.id).length;
      PAGINACION_CATEGORIA[cat.id] = { cargados: cantidad, total: cantidad, cargando: false };
    });
    return true;
  } catch (e) {
    return false;
  }
}

function hayMasProductosEnCategoria(idCategoria) {
  const estado = PAGINACION_CATEGORIA[idCategoria];
  return !estado || estado.cargados < estado.total;
}

function categoriaEstaCargando(idCategoria) {
  const estado = PAGINACION_CATEGORIA[idCategoria];
  return !!(estado && estado.cargando);
}

/**
 * Busca un producto puntual en el servidor, sin importar su categoría
 * ni la página en la que caería — para links directos a un producto
 * (compartidos por WhatsApp, por ejemplo) cuando su categoría todavía
 * no se cargó en memoria. Devuelve el producto o null.
 */
async function buscarProductoEnServidor(idProducto) {
  const slug = obtenerSlugCliente();
  try {
    const respuesta = await fetch(
      API_BASE + '/api/publico/' + encodeURIComponent(slug) + '/producto/' + encodeURIComponent(idProducto)
    );
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch (e) {
    return null;
  }
}

function mostrarErrorCarga(mensaje) {
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;text-align:center;font-family:-apple-system,sans-serif;color:#333">' +
      '<div>' +
        '<div style="font-size:40px;margin-bottom:12px">⚠️</div>' +
        '<p style="font-size:15px;color:#555;max-width:320px">' + mensaje + '</p>' +
      '</div>' +
    '</div>';
}


/* ------------------------------------------------------------
   Funciones de consulta
   ------------------------------------------------------------
   Sin cambios respecto a la versión original: siguen leyendo
   de CATEGORIAS y PRODUCTOS, que ahora se llenan desde la API
   en vez de estar escritos acá arriba.
   ------------------------------------------------------------ */

function productosDeCategoria(idCategoria) {
  const cat = CATEGORIAS.find(c => c.id === idCategoria);
  if (cat && cat.esOfertas) {
    return PRODUCTOS.filter(p => p.oferta === true);
  }
  return PRODUCTOS.filter(p => p.categoria === idCategoria);
}

function buscarProducto(id) {
  return PRODUCTOS.find(p => p.id === id);
}

/**
 * Como buscarProducto, pero si el producto no está en memoria (porque
 * su categoría nunca se cargó — típico de un link directo compartido
 * por WhatsApp) lo pide al servidor antes de rendirse. Lo agrega a
 * PRODUCTOS si lo encuentra, así una segunda búsqueda ya lo tiene en
 * memoria sin pedirlo de nuevo.
 */
async function buscarProductoConFallback(id) {
  const enMemoria = buscarProducto(id);
  if (enMemoria) return enMemoria;

  const delServidor = await buscarProductoEnServidor(id);
  if (delServidor) PRODUCTOS.push(delServidor);
  return delServidor;
}

function buscarCategoria(id) {
  return CATEGORIAS.find(c => c.id === id);
}

function textoUnidad(unidad) {
  if (unidad === 'kg')  return 'kg';
  if (unidad === 'paq') return 'pacote';
  return 'unidade';
}

function pasoCantidad(unidad) {
  return unidad === 'kg' ? 0.5 : 1;
}
