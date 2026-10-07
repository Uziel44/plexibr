/* ============================================================
   APLICACIÓN
   ------------------------------------------------------------
   Se ocupa de dos cosas:
     1. Mostrar la pantalla que corresponde (navegación)
     2. Dibujar el contenido de cada pantalla

   NAVEGACIÓN POR DIRECCIÓN
   Cada pantalla tiene su propia dirección después del #:
     (vacío)              -> categorías
     #/categoria/frutas   -> listado de frutas (en el diseño restaurante:
                             baja a esa sección de la carta)
     #/producto/banana    -> detalle de la banana
     #/carrito            -> carrito

   Esto hace que el botón "atrás" del celular funcione solo,
   sin tener que programarlo.
   ============================================================ */


/* ------------------------------------------------------------
   Imagen de respaldo
   ------------------------------------------------------------
   Si una foto todavía no existe en la carpeta img/, en lugar
   de mostrar el ícono de imagen rota se muestra este dibujo
   gris. Así el catálogo se puede probar sin ninguna foto
   cargada.
   ------------------------------------------------------------ */

const IMAGEN_RESPALDO =
  'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    '<rect width="200" height="200" fill="#eef1f5"/>' +
    '<text x="100" y="112" font-size="54" text-anchor="middle" fill="#b8c1cc">?</text>' +
    '</svg>'
  );

/**
 * Las imágenes subidas se guardan como /uploads/... y las sirve el backend;
 * las del diseño restaurante vienen como /api/publico/.../imagen (ver /menu
 * en server.js). Las dos necesitan el prefijo del servidor.
 */
function urlImagen(ruta) {
  return ruta && (ruta.startsWith('/uploads/') || ruta.startsWith('/api/')) ? API_BASE + ruta : ruta;
}

function conRespaldo(rutaImagen) {
  // La imagen la carga el negocio (base64 o /uploads/...) y viaja directo
  // a un atributo src="", así que también hay que escaparla.
  return 'src="' + limpiar(urlImagen(rutaImagen)) + '" onerror="this.onerror=null;this.src=\'' + IMAGEN_RESPALDO + '\'"';
}


/* ------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------ */

function $(id) { return document.getElementById(id); }

/**
 * Escapa texto para insertarlo sin riesgo de XSS en HTML armado por
 * concatenación de strings — tanto como contenido de un elemento
 * (nombres/descripciones de producto y categoría, que los carga el
 * negocio y las ve cualquier visitante del catálogo) como dentro de un
 * atributo entre comillas (por eso también escapa comillas, no solo
 * &, < y >).
 */
function limpiar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Muestra un aviso flotante abajo, que se va solo. */
let temporizadorAviso = null;
function avisar(texto) {
  const caja = $('confirmacion');
  caja.textContent = texto;
  caja.classList.add('visible');

  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    caja.classList.remove('visible');
  }, 2000);
}


/* ------------------------------------------------------------
   Contador del carrito
   ------------------------------------------------------------ */

function actualizarContador() {
  const cantidad = cantidadItems();

  const contador = $('carrito-contador');
  contador.textContent = cantidad;
  contador.classList.toggle('oculto', cantidad === 0);

  const contadorFlotante = $('carrito-flotante-contador');
  contadorFlotante.textContent = cantidad;
  contadorFlotante.classList.toggle('oculto', cantidad === 0);
}


/* ============================================================
   NAVEGACIÓN
   ============================================================ */

// true solo si el negocio eligió el tipo de tienda "Restaurante / bar /
// cafetería" Y su carta completa se pudo cargar (ver iniciar() al final).
// Cambia el diseño de la portada: nav de categorías fijo + todos los
// productos en una sola pantalla. Los demás tipos de tienda no lo usan.
let MODO_RESTAURANTE = false;

/** Lee la dirección actual y devuelve qué hay que mostrar. */
function rutaActual() {
  const hash = location.hash.replace(/^#\/?/, '');
  const partes = hash.split('/');

  if (partes[0] === 'categoria' && partes[1]) {
    // En el diseño restaurante no hay una pantalla por categoría: la carta
    // es una sola pantalla y la categoría es una sección dentro de ella.
    if (MODO_RESTAURANTE) return { pantalla: 'categorias', seccion: partes[1] };
    return { pantalla: 'productos', id: partes[1] };
  }
  if (partes[0] === 'producto' && partes[1]) {
    return { pantalla: 'detalle', id: partes[1] };
  }
  if (partes[0] === 'carrito') {
    return { pantalla: 'carrito' };
  }
  return { pantalla: 'categorias' };
}

function irA(ruta) {
  location.hash = ruta;
}

// Se incrementa en cada navegación y se compara al final de cada
// dibujarProductos/dibujarDetalle async: si cambió mientras esperaba
// la respuesta del servidor (el cliente ya navegó a otro lado), esa
// respuesta vieja se descarta en vez de pintar una pantalla que ya no
// corresponde a la dirección actual.
let tokenNavegacion = 0;

// La barra superior pierde su color de fondo (solo el fondo: logo y
// botones quedan) para dejar ver el banner detrás, mientras el banner
// esté a la vista en la portada. Apenas se hace scroll más allá del
// banner, o en cualquier otra pantalla, recupera su color.
let pantallaVisible = 'categorias';
function actualizarBarraTransparente() {
  const conBanner = !!(CONFIG && CONFIG.barraSobreBanner && CONFIG.imagenFondo);
  let sobre = conBanner && pantallaVisible === 'categorias';
  if (sobre) {
    const saludo = document.querySelector('.saludo');
    sobre = saludo.getBoundingClientRect().bottom > document.querySelector('.barra').offsetHeight;
  }
  document.querySelector('.barra').classList.toggle('barra-transparente', sobre);
}
window.addEventListener('scroll', actualizarBarraTransparente, { passive: true });
window.addEventListener('resize', actualizarBarraTransparente);

// Diseño restaurante: al abrir un producto o el carrito se sale de la
// portada, y al volver tiene que quedar en el mismo lugar de la carta (no
// arriba de todo). Se guarda acá la posición al salir.
let posicionScrollMenu = 0;

/** Se ejecuta cada vez que cambia la dirección. */
async function navegar() {
  const miToken = ++tokenNavegacion;
  const ruta = rutaActual();

  // Se lee ANTES de tocar las pantallas: al ocultar la portada la página
  // se acorta y el navegador cambiaría el scroll por su cuenta.
  const pantallaAnterior = pantallaVisible;
  if (pantallaAnterior === 'categorias') posicionScrollMenu = window.scrollY;

  // El nombre del negocio queda siempre fijo en la barra superior
  $('barra-titulo').textContent = CONFIG.nombre;

  // Oculta todas las pantallas y muestra la que corresponde
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));

  // La subbarra de "volver" solo se ve fuera de la pantalla de inicio
  const hayVolver = ruta.pantalla !== 'categorias';
  $('subbarra-volver').classList.toggle('oculto', !hayVolver);
  document.querySelector('main').classList.toggle('con-subbarra', hayVolver);

  // El botón flotante de carrito solo tiene sentido mientras se está
  // explorando el catálogo (categorías o listado de productos) — en
  // detalle/carrito competiría por espacio con el formulario de checkout.
  const mostrarFlotante = ruta.pantalla === 'categorias' || ruta.pantalla === 'productos';
  $('btn-carrito-flotante').classList.toggle('oculto', !mostrarFlotante);
  // Los botones de redes para compartir, en cambio, solo en el menú de
  // categorías (la portada del catálogo). En el diseño restaurante la
  // portada es la carta entera y esos botones flotantes taparían las
  // tarjetas, así que ahí no se muestran.
  $('compartir-flotante').classList.toggle('oculto', ruta.pantalla !== 'categorias' || MODO_RESTAURANTE);

  pantallaVisible = ruta.pantalla;
  // En el siguiente cuadro: la pantalla recién pasa a .activa más abajo y
  // hasta entonces el banner no tiene medidas.
  requestAnimationFrame(actualizarBarraTransparente);

  if (ruta.pantalla === 'productos') {
    $('pantalla-productos').classList.add('activa');
    $('subbarra-texto').textContent = 'Categorias';
    trackPantalla('productos', '/categoria/' + ruta.id);
    trackVerCategoria(ruta.id);
    await dibujarProductos(ruta.id, miToken);

  } else if (ruta.pantalla === 'detalle') {
    $('pantalla-detalle').classList.add('activa');
    trackPantalla('detalle', '/producto/' + ruta.id);
    trackVerProducto(ruta.id);
    await dibujarDetalle(ruta.id, miToken);

  } else if (ruta.pantalla === 'carrito') {
    dibujarCarrito();
    $('pantalla-carrito').classList.add('activa');
    $('subbarra-texto').textContent = 'Meu pedido';
    trackPantalla('carrito', '/carrito');
    trackCarritoAbandonado();

  } else {
    $('pantalla-categorias').classList.add('activa');
    trackPantalla('categorias', '/');
  }

  if (miToken !== tokenNavegacion) return; // se navegó a otro lado mientras se esperaba

  // Cierra la medición de tiempo de la pantalla anterior (si había
  // una) y arranca el cronómetro de la nueva.
  marcarInicioPantalla(ruta.pantalla);

  if (ruta.pantalla === 'categorias' && MODO_RESTAURANTE) {
    if (ruta.seccion) {
      // Link a #/categoria/<id>: baja directo a esa sección de la carta.
      requestAnimationFrame(() => irASeccionMenu(ruta.seccion, false));
    } else if (pantallaAnterior !== 'categorias') {
      // Volviendo de un producto o del carrito: queda donde estaba.
      window.scrollTo(0, posicionScrollMenu);
      actualizarCategoriaActivaMenu();
    } else {
      window.scrollTo(0, 0);
    }
  } else {
    window.scrollTo(0, 0);
  }
  actualizarContador();
}


/* ============================================================
   PANTALLA 1 - CATEGORÍAS
   ============================================================ */

// Tarjeta promocional de venta del servicio: por ahora solo se muestra en
// el catálogo de UN negocio, a modo de prueba. Este slug ya cambió una vez
// (verduleria01 -> tunegocio, ver historial de commits) y quedó hardcodeado
// en el medio de dibujarCategorias() sin que nadie lo notara hasta la
// próxima vez que hiciera falta cambiarlo — por eso ahora es una constante
// separada y bien visible: el próximo rename solo necesita tocar esta línea.
const SLUG_CON_TARJETA_PROMO = 'tunegocio';

// Formas válidas: misma lista blanca que el servidor (ver server.js).
// Un valor fuera de esta lista (dato viejo, o un negocio que nunca
// configuró nada) cae al default de siempre en vez de aplicar una
// clase CSS que no existe.
const CLASES_FORMA_CATEGORIA = { circular: '', cuadrada: 'cuadrada', columna: 'columna' };
const CLASES_FORMA_PRODUCTO = { 'grid-cuadrado': '', 'grid-circular': 'grid-circular', columna: 'columna' };

/** Agrega al <head> el <link> de Google Fonts para UNA sola familia
 *  tipográfica — la que el negocio eligió en Apariencia. A diferencia
 *  de admin.html (que carga las 10 fijas, para mostrar el preview de
 *  todas antes de elegir), el catálogo público solo necesita bajar la
 *  UNA que realmente va a usar: así no se le suma peso de carga a cada
 *  visita del catálogo por las 9 tipografías que ese negocio no eligió.
 *  Ver TIPOGRAFIAS_DISPONIBLES/urlGoogleFontsPara en tipografias.js. */
function cargarFuenteGoogle(tipografia) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = urlGoogleFontsPara(tipografia);
  document.head.appendChild(link);
}

/** Aplica una sola vez, al cargar, la apariencia elegida por el negocio
 *  (tipografía, forma de categorías/productos, imagen de fondo). */
function aplicarPersonalizacion() {
  const main = $('contenido-principal');

  // Si el negocio eligió una tipografía, se carga su fuente de Google
  // y se pisan las 2 variables CSS (título/cuerpo) que style.css ya usa
  // con fallback a IBM Plex Sans (ver bloque "PERSONALIZACIÓN POR
  // NEGOCIO" en style.css) — si no eligió ninguna, no se toca nada y
  // el catálogo sigue con la tipografía base de siempre.
  const tipografia = CONFIG.tipografia && buscarTipografia(CONFIG.tipografia);
  if (tipografia) {
    cargarFuenteGoogle(tipografia);
    document.body.style.setProperty('--fuente-titulo', tipografia.pilaTitulo);
    document.body.style.setProperty('--fuente-cuerpo', tipografia.pilaCuerpo);
  }

  const claseCategorias = CLASES_FORMA_CATEGORIA[CONFIG.formaCategorias];
  if (claseCategorias) $('lista-categorias').classList.add(claseCategorias);

  const claseProductos = CLASES_FORMA_PRODUCTO[CONFIG.formaProductos];
  if (claseProductos) $('lista-productos').classList.add(claseProductos);

  // El fondo de página ahora sale solo de la imagen de escritorio:
  // imagenFondo (mobile) pasó a ser el banner de la portada.
  if (CONFIG.imagenFondoDesktop) {
    // La clase va en <body>, no en <main>: la imagen la pinta un
    // ::before de body (fixed, no se mueve con el scroll — ver
    // style.css), así que tiene que ser body quien la reciba. El
    // overlay que hace legible el contenido encima sí sigue siendo el
    // background propio de main (ese sí se mueve con el scroll, tapando
    // cada vez más de la imagen fija a medida que se hace scroll).
    document.body.classList.add('con-fondo-personalizado');
    main.classList.add('con-fondo-personalizado');
    // Se setean como variables CSS, no como background-image directo:
    // así se le puede bajar la opacidad al ::before sin afectar al
    // contenido de encima — background-image no tiene una propiedad de
    // opacidad propia. Son dos variables distintas (mobile/desktop);
    // cuál se usa lo decide el @media de style.css.
    //
    // Si el negocio cargó las dos imágenes, cada una se usa en su
    // rango de ancho (responsive real). Si solo cargó una, esa misma
    // se usa siempre, en mobile y en desktop por igual — por eso cada
    // variable cae al valor de la otra cuando la suya está vacía, en
    // vez de dejar de pintar fondo en el rango que quedó sin configurar.
    const imagenMobile = CONFIG.imagenFondoDesktop;
    const imagenDesktop = CONFIG.imagenFondoDesktop;
    document.body.style.setProperty('--imagen-fondo-personalizada', "url('" + imagenMobile + "')");
    document.body.style.setProperty('--imagen-fondo-desktop-personalizada', "url('" + imagenDesktop + "')");

    // "Sin atenuar" (panel Apariencia): por defecto la imagen se ve al
    // 50% de opacidad (fallback fijo en style.css); si el negocio activó
    // el interruptor para ESA imagen puntual, se pisa a 1 (nítida).
    //
    // Mismo fallback cruzado que las variables de imagen de arriba: si
    // el negocio solo cargó UNA imagen (el caso típico), esa imagen se
    // usa en los dos anchos (líneas 268-269) — pero antes su switch de
    // "Sin atenuar" solo se aplicaba en el ancho de la imagen que
    // realmente cargó, y el otro ancho quedaba atenuado igual aunque
    // fuera la misma imagen (el switch del otro campo, que ni siquiera
    // tiene sentido tocar sin una 2da imagen propia, se quedaba en su
    // default false). Por eso cada switch ahora cae al del otro campo
    // cuando ESE campo no tiene imagen propia cargada, igual que ya
    // hacía imagenMobile/imagenDesktop más arriba.
    const sinAtenuarMobile = CONFIG.fondoDesktopSinAtenuar;
    const sinAtenuarDesktop = CONFIG.fondoDesktopSinAtenuar;
    document.body.style.setProperty('--opacidad-fondo-personalizada', sinAtenuarMobile ? '1' : '0.5');
    document.body.style.setProperty('--opacidad-fondo-desktop-personalizada', sinAtenuarDesktop ? '1' : '0.5');
  }

  // Colores configurables de la barra superior + fondo de página (panel
  // Apariencia → "Colores"). Cada uno se setea solo si el negocio lo
  // configuró; si no, no se toca la variable y CSS cae a su fallback
  // fijo (ver .barra y body en style.css) — el catálogo se ve igual que
  // si esto no existiera.
  if (CONFIG.colorBarraFondo) {
    document.body.style.setProperty('--barra-fondo', CONFIG.colorBarraFondo);
  }
  if (CONFIG.colorBarraTexto) {
    document.body.style.setProperty('--barra-texto', CONFIG.colorBarraTexto);
  }
  if (CONFIG.colorFondoPagina) {
    document.body.style.setProperty('--gris-fondo', CONFIG.colorFondoPagina);
  }

  // Logo del negocio en la barra superior: si configuró uno propio en
  // Apariencia, reemplaza al logo de Plexi que se ve por defecto. El
  // footer NUNCA se toca acá — el crédito de Plexi ahí es fijo siempre,
  // sin excepción por negocio.
  if (CONFIG.logoFooter) {
    $('barra-logo').src = urlImagen(CONFIG.logoFooter);
  }
}

function dibujarCategorias() {
  $('nombre-negocio').textContent = CONFIG.nombre;

  // Banner propio del negocio detrás del saludo (usa la columna
  // imagen_fondo, que antes era el fondo mobile). Sin banner no se toca
  // nada: el encabezado queda como siempre.
  const saludo = document.querySelector('.saludo');
  saludo.classList.toggle('con-banner', !!CONFIG.imagenFondo);
  saludo.classList.toggle('sobre-barra', !!(CONFIG.imagenFondo && CONFIG.barraSobreBanner));
  saludo.style.backgroundImage = CONFIG.imagenFondo
    ? 'url(' + JSON.stringify(urlImagen(CONFIG.imagenFondo)) + ')'
    : '';
  document.title = CONFIG.nombre + ' | Peça pelo WhatsApp';

  const esNegocioConPromo = obtenerSlugCliente() === SLUG_CON_TARJETA_PROMO;
  $('tarjeta-promo').classList.toggle('oculto', !esNegocioConPromo);
  $('boton-simulacion-admin').classList.toggle('oculto', !esNegocioConPromo);
  $('boton-contacto-negocio').classList.toggle('oculto', !esNegocioConPromo);

  // El banner y el nav del diseño restaurante van de borde a borde (ver
  // style.css): body recorta lo que sobresale para que no aparezca scroll
  // horizontal cuando la ventana tiene barra de desplazamiento propia.
  document.body.classList.toggle('con-ancho-completo', !!CONFIG.imagenFondo || MODO_RESTAURANTE);

  // Diseño restaurante: en vez de la grilla de categorías, nav fijo + carta.
  document.body.classList.toggle('modo-restaurante', MODO_RESTAURANTE);
  $('menu-restaurante').classList.toggle('oculto', !MODO_RESTAURANTE);
  if (MODO_RESTAURANTE) {
    dibujarMenuRestaurante();
    return;
  }

  $('lista-categorias').innerHTML = CATEGORIAS.map(cat => {

    // Si la categoría de ofertas no tiene productos marcados,
    // no tiene sentido mostrarla.
    if (cat.esOfertas && productosDeCategoria(cat.id).length === 0) return '';

    // El color queda de fondo por si la imagen todavía no existe.
    // Escapado igual que el nombre: color/imagen los carga el negocio y
    // van directo a un atributo style="", así que también son un vector
    // de inyección si no se limpian.
    const fondo = 'background-color:' + limpiar(cat.color) +
                  ';background-image:url(\'' + limpiar(urlImagen(cat.imagen)) + '\')';

    return '' +
      '<button class="categoria" style="' + fondo + '" onclick="irA(\'#/categoria/' + cat.id + '\')">' +
        '<span class="categoria-nombre">' + limpiar(cat.nombre) + '</span>' +
      '</button>';

  }).join('');
}


/* ============================================================
   PANTALLA 1 (variante restaurante) - CARTA COMPLETA
   ------------------------------------------------------------
   Para negocios con tipo de tienda "restaurante". En lugar de la grilla
   de categorías (y de una pantalla de productos por categoría) la portada
   muestra, debajo del banner, un nav de categorías que queda fijo al
   scrollear, y debajo TODOS los productos de una vez, agrupados por
   categoría, en tarjetas rectangulares con imagen cuadrada. Tocar una
   categoría del nav baja a su sección; al scrollear, la categoría
   visible se resalta sola. Los productos llegan de una sola request
   (cargarMenuCompleto en catalogo.js) y sus imágenes se bajan de a una,
   a medida que aparecen (loading="lazy").
   ============================================================ */

function dibujarMenuRestaurante() {
  // Una categoría sin productos no tiene nada que mostrar en la carta.
  const secciones = CATEGORIAS
    .map(cat => ({ cat, productos: productosDeCategoria(cat.id) }))
    .filter(seccion => seccion.productos.length > 0);

  if (secciones.length === 0) {
    $('menu-nav').innerHTML = '';
    $('menu-secciones').innerHTML = '<div class="vacio"><p>Ainda não há produtos cadastrados.</p></div>';
    return;
  }

  $('menu-nav').innerHTML = secciones.map(({ cat }) =>
    '<button type="button" class="menu-chip" data-seccion="' + limpiar(cat.id) + '">' + limpiar(cat.nombre) + '</button>'
  ).join('');

  $('menu-secciones').innerHTML = secciones.map(({ cat, productos }) =>
    '<section class="menu-seccion" id="seccion-' + limpiar(cat.id) + '" data-seccion="' + limpiar(cat.id) + '">' +
      '<h2 class="menu-seccion-titulo">' + limpiar(cat.nombre) + '</h2>' +
      '<div class="menu-tarjetas">' + productos.map(tarjetaRestaurante).join('') + '</div>' +
    '</section>'
  ).join('');

  chipActivoActual = null;
  marcarChipActivo(secciones[0].cat.id);
}

/** Tarjeta rectangular: datos a la izquierda, imagen cuadrada a la derecha. */
function tarjetaRestaurante(prod) {
  const agotado = prod.agotado === true;

  const etiqueta =
    agotado ? '<span class="etiqueta-agotado">Sem estoque</span>'
    : (prod.oferta ? '<span class="etiqueta-oferta">Oferta</span>' : '');

  // Los agotados se muestran pero no se pueden abrir
  const accion = agotado ? '' : 'onclick="irA(\'#/producto/' + prod.id + '\')"';

  // En un menú casi todo es "por unidad": solo se aclara cuando no lo es.
  const unidad = (prod.unidad === 'kg' || prod.unidad === 'paq')
    ? ' <span class="producto-unidad">por ' + textoUnidad(prod.unidad) + '</span>'
    : '';

  // Sin imagen cargada no se reserva el hueco: el texto usa todo el ancho.
  const imagen = prod.imagen
    ? '<img class="menu-tarjeta-imagen" loading="lazy" decoding="async" width="96" height="96" ' + conRespaldo(prod.imagen) + ' alt="">'
    : '';

  return '' +
    '<button type="button" class="menu-tarjeta' + (agotado ? ' agotado' : '') + '" ' + accion + '>' +
      '<div class="menu-tarjeta-datos">' +
        '<div class="menu-tarjeta-nombre">' + etiqueta + limpiar(prod.nombre) + '</div>' +
        (prod.descripcion ? '<div class="menu-tarjeta-descripcion">' + limpiar(prod.descripcion) + '</div>' : '') +
        '<div class="menu-tarjeta-precio">' + formatearPrecio(prod.precio) + unidad + '</div>' +
      '</div>' +
      imagen +
    '</button>';
}

let chipActivoActual = null;

/** Resalta la categoría en el nav y la deja a la vista (solo en horizontal). */
function marcarChipActivo(idCategoria) {
  if (chipActivoActual === idCategoria) return;
  chipActivoActual = idCategoria;

  const nav = $('menu-nav');
  nav.querySelectorAll('.menu-chip').forEach(chip => {
    const activo = chip.dataset.seccion === idCategoria;
    chip.classList.toggle('activa', activo);
    if (activo) {
      chip.setAttribute('aria-current', 'true');
      // scrollTo del propio nav y no scrollIntoView del chip: este último
      // también movería la página hacia arriba o abajo.
      const izquierda = chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, izquierda), behavior: 'smooth' });
    } else {
      chip.removeAttribute('aria-current');
    }
  });
}

// Mientras la página se desplaza por un toque en el nav, la categoría
// resaltada es la tocada: si no, el resaltado iría pasando por todas las
// categorías del medio. Termina cuando el scroll se detiene (o, por las
// dudas, a los 1,2 s: la página puede no moverse si ya no hay más lugar).
let desplazandoPorToque = false;
let temporizadorFinDesplazamiento = null;

function irASeccionMenu(idCategoria, animar = true) {
  const seccion = document.getElementById('seccion-' + idCategoria);
  if (!seccion) return;

  desplazandoPorToque = true;
  clearTimeout(temporizadorFinDesplazamiento);
  temporizadorFinDesplazamiento = setTimeout(() => { desplazandoPorToque = false; }, 1200);

  marcarChipActivo(idCategoria);

  // scroll-margin-top de .menu-seccion deja el título justo debajo del nav.
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  seccion.scrollIntoView({ behavior: animar && !sinMovimiento ? 'smooth' : 'auto', block: 'start' });
}

/** Resalta en el nav la categoría que está a la vista según el scroll. */
function actualizarCategoriaActivaMenu() {
  if (!MODO_RESTAURANTE || pantallaVisible !== 'categorias') return;

  const secciones = document.querySelectorAll('.menu-seccion');
  if (secciones.length === 0) return;

  // Línea de corte: justo debajo de la barra superior y del nav fijo.
  const corte = document.querySelector('.barra').offsetHeight + $('menu-nav').offsetHeight + 24;

  let activa = secciones[0];
  secciones.forEach(seccion => {
    if (seccion.getBoundingClientRect().top <= corte) activa = seccion;
  });

  // Al final de la página la última categoría puede ser tan corta que
  // nunca llega a la línea de corte: se la da por activa igual.
  const alFinal = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (alFinal) activa = secciones[secciones.length - 1];

  marcarChipActivo(activa.dataset.seccion);
}

let actualizacionMenuPendiente = false;
window.addEventListener('scroll', () => {
  if (!MODO_RESTAURANTE) return;

  if (desplazandoPorToque) {
    clearTimeout(temporizadorFinDesplazamiento);
    temporizadorFinDesplazamiento = setTimeout(() => { desplazandoPorToque = false; }, 150);
    return;
  }

  if (actualizacionMenuPendiente) return;
  actualizacionMenuPendiente = true;
  requestAnimationFrame(() => {
    actualizacionMenuPendiente = false;
    actualizarCategoriaActivaMenu();
  });
}, { passive: true });

$('menu-nav').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-seccion]');
  if (!chip) return;
  trackVerCategoria(chip.dataset.seccion);
  irASeccionMenu(chip.dataset.seccion);
});


/* ============================================================
   PANTALLA 2 - LISTADO DE PRODUCTOS
   ============================================================ */

// Observa el centinela al final de la lista: cuando entra en pantalla
// (el cliente hizo scroll hasta ahí), pide el siguiente lote de la
// categoría que esté activa en ese momento. Un solo observer para toda
// la pantalla — se reapunta a un centinela nuevo en cada repintado.
let observadorScrollProductos = null;

function dibujarProductos(idCategoria, miToken) {
  const categoria = buscarCategoria(idCategoria);

  // Si la dirección tiene una categoría que no existe, vuelve al inicio
  if (!categoria) { irA(''); return; }

  return pintarListaProductos(idCategoria, miToken);
}

async function pintarListaProductos(idCategoria, miToken) {
  // Primer lote: si esta categoría todavía no se pidió nunca, se
  // muestra un estado de carga breve mientras se espera.
  const yaHayAlgo = productosDeCategoria(idCategoria).length > 0;
  if (!yaHayAlgo) {
    $('contador-productos').textContent = '';
    $('lista-productos').innerHTML = '<div class="vacio"><p>Carregando produtos…</p></div>';
    await cargarLoteDeCategoria(idCategoria);
    if (miToken !== tokenNavegacion) return; // se navegó a otro lado mientras cargaba
  }

  repintarListaProductos(idCategoria);
}

function repintarListaProductos(idCategoria) {
  const productos = productosDeCategoria(idCategoria);

  $('contador-productos').textContent =
    productos.length + (productos.length === 1 ? ' produto' : ' produtos');

  if (productos.length === 0) {
    $('lista-productos').innerHTML =
      '<div class="vacio"><p>Ainda não há produtos nesta categoria.</p></div>';
    return;
  }

  const filas = productos.map(prod => {

    const agotado = prod.agotado === true;

    const etiqueta =
      agotado ? '<span class="etiqueta-agotado">Sem estoque</span>'
      : (prod.oferta ? '<span class="etiqueta-oferta">Oferta</span>' : '');

    // Los agotados se muestran pero no se pueden abrir
    const accion = agotado ? '' : 'onclick="irA(\'#/producto/' + prod.id + '\')"';

    return '' +
      '<button class="producto-fila' + (agotado ? ' agotado' : '') + '" ' + accion + '>' +
        '<img class="producto-miniatura" ' + conRespaldo(prod.imagen) + ' alt="' + limpiar(prod.nombre) + '">' +
        '<div class="producto-datos">' +
          '<div class="producto-nombre">' + limpiar(prod.nombre) + etiqueta + '</div>' +
          '<div class="producto-precio">' + formatearPrecio(prod.precio) +
            ' <span class="producto-unidad">por ' + textoUnidad(prod.unidad) + '</span>' +
          '</div>' +
        '</div>' +
      '</button>';

  }).join('');

  const hayMas = hayMasProductosEnCategoria(idCategoria);
  const centinela = hayMas ? '<div class="productos-centinela" id="productos-centinela"></div>' : '';

  $('lista-productos').innerHTML = filas + centinela;

  if (observadorScrollProductos) observadorScrollProductos.disconnect();
  if (!hayMas) return;

  observadorScrollProductos = new IntersectionObserver(async (entradas) => {
    if (!entradas[0].isIntersecting) return;
    if (categoriaEstaCargando(idCategoria)) return;

    observadorScrollProductos.disconnect();
    await cargarLoteDeCategoria(idCategoria);
    // Si mientras cargaba el cliente navegó a otra categoría/pantalla,
    // este repintado ya no corresponde — se descarta.
    if (rutaActual().pantalla !== 'productos' || rutaActual().id !== idCategoria) return;
    repintarListaProductos(idCategoria);
  });
  observadorScrollProductos.observe($('productos-centinela'));
}


/* ============================================================
   PANTALLA 3 - DETALLE DEL PRODUCTO
   ============================================================ */

// Cantidad que el cliente está eligiendo en este momento
let cantidadElegida = 1;

async function dibujarDetalle(idProducto, miToken) {
  // buscarProducto (síncrono) alcanza casi siempre: el cliente llegó
  // navegando desde el listado, así que el producto ya está en
  // memoria. El fallback al servidor es solo para cuando no está —
  // típicamente un link directo a este producto, sin haber pasado
  // antes por su categoría.
  let prod = buscarProducto(idProducto);
  if (!prod) {
    $('detalle-contenido').innerHTML = '<div class="vacio"><p>Carregando…</p></div>';
    prod = await buscarProductoConFallback(idProducto);
    if (miToken !== tokenNavegacion) return; // se navegó a otro lado mientras cargaba
  }
  if (!prod) { irA(''); return; }

  const categoria = buscarCategoria(prod.categoria);
  // En el diseño restaurante "volver" lleva a la carta, no a una categoría.
  $('subbarra-texto').textContent = MODO_RESTAURANTE ? 'Cardápio' : (categoria ? categoria.nombre : 'Categorias');

  // Arranca en 1 kg, o en 1 unidad según corresponda
  cantidadElegida = pasoCantidad(prod.unidad) === 0.5 ? 1 : 1;

  $('detalle-contenido').innerHTML = '' +
    '<img class="detalle-imagen" ' + conRespaldo(prod.imagen) + ' alt="' + limpiar(prod.nombre) + '">' +

    '<div class="detalle-nombre">' + limpiar(prod.nombre) + '</div>' +
    '<div class="detalle-precio">' + formatearPrecio(prod.precio) + '</div>' +
    '<div class="detalle-unidad">por ' + textoUnidad(prod.unidad) + '</div>' +

    (prod.descripcion ? '<div class="detalle-descripcion">' + limpiar(prod.descripcion) + '</div>' : '') +

    // El negocio puede desactivar esto por producto (panel admin, "Permitir
    // que el cliente aclare algo al pedirlo") — para productos donde no
    // tiene sentido ninguna aclaración. Por defecto viene activado.
    (prod.permiteObservaciones !== false ?
      '<div class="bloque">' +
        '<div class="bloque-titulo">Quer deixar alguma observação?</div>' +
        '<textarea class="observaciones" id="obs" maxlength="150" ' +
          'placeholder="Escreva alguma observação (opcional)"' +
          'oninput="contarCaracteres()"></textarea>' +
        '<div class="contador-caracteres" id="contador-obs">0 / 150</div>' +
      '</div>'
    : '') +

    '<div class="bloque">' +
      '<div class="bloque-titulo">Quantidade</div>' +
      '<div class="selector">' +
        '<button class="selector-boton" onclick="cambiarCantidadDetalle(\'' + prod.id + '\', -1)">&minus;</button>' +
        '<div class="selector-valor" id="cantidad-valor"></div>' +
        '<button class="selector-boton" onclick="cambiarCantidadDetalle(\'' + prod.id + '\', 1)">+</button>' +
      '</div>' +
    '</div>' +

    '<div class="barra-accion">' +
      '<button class="boton-principal" onclick="agregarDesdeDetalle(\'' + prod.id + '\')">' +
        '<span>Adicionar ao carrinho</span>' +
        '<span id="subtotal-detalle"></span>' +
      '</button>' +
    '</div>';

  actualizarDetalle(prod);
}

/** Refresca el número de cantidad y el subtotal del botón. */
function actualizarDetalle(prod) {
  $('cantidad-valor').innerHTML =
    formatearCantidad(cantidadElegida) +
    '<small>' + textoUnidad(prod.unidad) + '</small>';

  $('subtotal-detalle').textContent = formatearPrecio(prod.precio * cantidadElegida);
}

function cambiarCantidadDetalle(idProducto, direccion) {
  const prod = buscarProducto(idProducto);
  const paso = pasoCantidad(prod.unidad);

  const nueva = cantidadElegida + (paso * direccion);

  // No se puede bajar de la cantidad mínima
  if (nueva < paso) return;

  // Se redondea para evitar números como 1.5000000002
  cantidadElegida = Math.round(nueva * 100) / 100;

  actualizarDetalle(prod);
}

function contarCaracteres() {
  const texto = $('obs').value;
  $('contador-obs').textContent = texto.length + ' / 150';
}

function agregarDesdeDetalle(idProducto) {
  const obs = $('obs') ? $('obs').value : '';

  agregarAlCarrito(idProducto, cantidadElegida, obs);
  actualizarContador();
  trackAgregarCarrito(idProducto, cantidadElegida);

  const prod = buscarProducto(idProducto);
  avisar(prod.nombre + ' adicionado ao carrinho');

  // Vuelve al listado para que pueda seguir eligiendo
  history.back();
}


/* ============================================================
   PANTALLA 4 - CARRITO
   ============================================================ */

// Datos que el cliente va completando en el formulario
let datosPedido = {
  nombre: '',
  telefono: '',
  entrega: '',
  direccion: '',
  pago: '',
  fecha: '',
  hora: ''
};

function vaciarTodo() {
  if (confirm('Tem certeza de que quer esvaziar o carrinho? Todos os itens serão removidos.')) {
    vaciarCarrito();
    actualizarContador();
    dibujarCarrito();
  }
}

function dibujarCarrito() {
  if (carritoVacio()) {
    $('carrito-contenido').innerHTML = '' +
      '<div class="vacio">' +
        '<div class="vacio-icono">&#128722;</div>' +
        '<p>Seu carrinho está vazio.</p>' +
        '<button class="boton-secundario" onclick="irA(\'\')">Ver o catálogo</button>' +
      '</div>';
    return;
  }

  const hayEnvio = datosPedido.entrega === 'envio';

  $('carrito-contenido').innerHTML =
    '<div class="carrito-acciones">' +
      '<button class="boton-vaciar" onclick="vaciarTodo()">Esvaziar carrinho</button>' +
    '</div>' +
    dibujarLineasCarrito() +
    dibujarFormulario() +
    dibujarResumen(hayEnvio);

  restaurarFormulario();
}


/* ---------- Productos del carrito ---------- */

function dibujarLineasCarrito() {
  return CARRITO.map((linea, i) => {

    const obs = linea.obs
      ? '<div class="carrito-linea-obs">' + limpiar(linea.obs) + '</div>'
      : '';

    return '' +
      '<div class="carrito-linea">' +
        '<div class="carrito-linea-arriba">' +
          '<div>' +
            '<div class="carrito-linea-nombre">' + limpiar(linea.nombre) + '</div>' + obs +
          '</div>' +
          '<div class="carrito-linea-subtotal">' + formatearPrecio(subtotalLinea(linea)) + '</div>' +
        '</div>' +
        '<div class="carrito-linea-abajo">' +
          '<div class="selector selector-chico">' +
            '<button class="selector-boton" onclick="ajustarLinea(' + i + ', -1)">&minus;</button>' +
            '<div class="selector-valor">' +
              formatearCantidad(linea.cantidad) +
              '<small>' + textoUnidad(linea.unidad) + '</small>' +
            '</div>' +
            '<button class="selector-boton" onclick="ajustarLinea(' + i + ', 1)">+</button>' +
          '</div>' +
          '<button class="quitar" onclick="quitarLinea(' + i + ')">Remover</button>' +
        '</div>' +
      '</div>';

  }).join('');
}

function ajustarLinea(indice, direccion) {
  const linea = CARRITO[indice];
  if (!linea) return;

  const paso = pasoCantidad(linea.unidad);
  const nueva = Math.round((linea.cantidad + paso * direccion) * 100) / 100;

  cambiarCantidad(indice, nueva);
  guardarFormulario();
  dibujarCarrito();
  actualizarContador();
}

function quitarLinea(indice) {
  quitarDelCarrito(indice);
  guardarFormulario();
  dibujarCarrito();
  actualizarContador();
}


/* ---------- Formulario ---------- */

/** Deja solo letras (con tildes/ñ) y espacios, borrando cualquier otro carácter mientras se escribe. */
function filtrarSoloLetras(input) {
  const inicio = input.selectionStart;
  const largoAntes = input.value.length;
  input.value = input.value.replace(/[^\p{L}\s]/gu, '');
  const diferencia = largoAntes - input.value.length;
  if (diferencia > 0) input.setSelectionRange(inicio - diferencia, inicio - diferencia);
}

/** Deja solo dígitos, borrando cualquier otro carácter mientras se escribe. */
function filtrarSoloNumeros(input) {
  const inicio = input.selectionStart;
  const largoAntes = input.value.length;
  input.value = input.value.replace(/[^0-9]/g, '');
  const diferencia = largoAntes - input.value.length;
  if (diferencia > 0) input.setSelectionRange(inicio - diferencia, inicio - diferencia);
}

function dibujarFormulario() {
  return '' +
    '<div class="bloque">' +
      '<div class="bloque-titulo">Seus dados</div>' +

      '<div class="campo">' +
        '<label for="in-nombre">Nome e sobrenome <span class="obligatorio">*</span></label>' +
        '<input type="text" id="in-nombre" placeholder="Precisamos saber como você se chama" ' +
          'oninput="filtrarSoloLetras(this); guardarFormulario()">' +
      '</div>' +

      '<div class="campo">' +
        '<label for="in-telefono">Telefone <span class="obligatorio">*</span></label>' +
        '<input type="tel" id="in-telefono" placeholder="Precisamos de um meio de contato" ' +
          'oninput="filtrarSoloNumeros(this); guardarFormulario()">' +
      '</div>' +
    '</div>' +

    '<div class="bloque">' +
      '<div class="bloque-titulo">Forma de entrega <span class="obligatorio">*</span></div>' +
      '<div class="opciones">' +
        '<button class="opcion" id="op-retiro" onclick="elegirEntrega(\'retiro\')">Vou retirar pessoalmente</button>' +
        '<button class="opcion" id="op-envio" onclick="elegirEntrega(\'envio\')">Entrega por delivery</button>' +
      '</div>' +

      // La dirección solo aparece si eligió envío
      '<div class="campo oculto" id="campo-direccion" style="margin-top:14px">' +
        '<label for="in-direccion">Endereço de entrega <span class="obligatorio">*</span></label>' +
        '<input type="text" id="in-direccion" placeholder="Rua, número e bairro" ' +
          'oninput="guardarFormulario()">' +
      '</div>' +
    '</div>' +

    '<div class="bloque">' +
      '<div class="bloque-titulo">Para quando você quer? (opcional)</div>' +
      '<div class="campo">' +
        '<label for="in-fecha">Data</label>' +
        '<input type="date" id="in-fecha" oninput="guardarFormulario()">' +
      '</div>' +
      '<div class="campo">' +
        '<label for="in-hora">Horário</label>' +
        '<input type="time" id="in-hora" oninput="guardarFormulario()">' +
      '</div>' +
    '</div>' +

    '<div class="bloque">' +
      '<div class="bloque-titulo">Forma de pagamento <span class="obligatorio">*</span></div>' +
      '<div class="opciones">' +
        (CONFIG.pagoEfectivoHabilitado
          ? '<button class="opcion" id="op-efectivo" onclick="elegirPago(\'efectivo\')">Dinheiro</button>'
          : '') +
        (CONFIG.pagoTarjetaHabilitado
          ? '<button class="opcion" id="op-tarjeta" onclick="elegirPago(\'tarjeta\')">Cartão de débito/crédito</button>'
          : '') +
        (CONFIG.pagoTransferenciaHabilitado && CONFIG.aliasTransferencia
          ? '<button class="opcion" id="op-transferencia" onclick="elegirPago(\'transferencia\')">Transferência</button>'
          : '') +
      '</div>' +

      // El alias solo aparece si eligió transferencia (mismo patrón que
      // campo-direccion en Forma de entrega, más arriba en esta función).
      (CONFIG.pagoTransferenciaHabilitado && CONFIG.aliasTransferencia
        ? '<div class="campo oculto" id="campo-alias-transferencia" style="margin-top:14px">' +
            '<label>Dados para transferência</label>' +
            '<div class="alias-transferencia-texto">' + limpiar(CONFIG.aliasTransferencia) + '</div>' +
          '</div>'
        : '') +
    '</div>';
}

/** Guarda lo que el cliente escribió, para no perderlo al redibujar. */
function guardarFormulario() {
  if ($('in-nombre'))    datosPedido.nombre    = $('in-nombre').value;
  if ($('in-telefono'))  datosPedido.telefono  = $('in-telefono').value;
  if ($('in-direccion')) datosPedido.direccion = $('in-direccion').value;
  if ($('in-fecha'))     datosPedido.fecha     = $('in-fecha').value;
  if ($('in-hora'))      datosPedido.hora      = $('in-hora').value;
}

/** Vuelve a poner en pantalla lo que ya había completado. */
function restaurarFormulario() {
  if ($('in-nombre'))    $('in-nombre').value    = datosPedido.nombre;
  if ($('in-telefono'))  $('in-telefono').value  = datosPedido.telefono;
  if ($('in-direccion')) $('in-direccion').value = datosPedido.direccion;
  if ($('in-fecha'))     $('in-fecha').value     = datosPedido.fecha;
  if ($('in-hora'))      $('in-hora').value      = datosPedido.hora;

  if (datosPedido.entrega) marcarEntrega(datosPedido.entrega);
  if (datosPedido.pago)    marcarPago(datosPedido.pago);
}

function elegirEntrega(opcion) {
  guardarFormulario();
  datosPedido.entrega = opcion;
  dibujarCarrito();     // se redibuja porque el envío puede cambiar el total
}

function marcarEntrega(opcion) {
  $('op-retiro').classList.toggle('elegida', opcion === 'retiro');
  $('op-envio').classList.toggle('elegida', opcion === 'envio');
  $('campo-direccion').classList.toggle('oculto', opcion !== 'envio');
}

function elegirPago(opcion) {
  guardarFormulario();
  datosPedido.pago = opcion;
  marcarPago(opcion);
}

function marcarPago(opcion) {
  if ($('op-efectivo')) $('op-efectivo').classList.toggle('elegida', opcion === 'efectivo');
  if ($('op-tarjeta')) $('op-tarjeta').classList.toggle('elegida', opcion === 'tarjeta');
  if ($('op-transferencia')) $('op-transferencia').classList.toggle('elegida', opcion === 'transferencia');
  if ($('campo-alias-transferencia')) $('campo-alias-transferencia').classList.toggle('oculto', opcion !== 'transferencia');
}


/* ---------- Resumen y botón final ---------- */

function dibujarResumen(hayEnvio) {

  let filas = '';

  // El detalle de envío solo se muestra si corresponde
  if (hayEnvio && CONFIG.costoEnvio > 0) {
    filas =
      '<div class="resumen-fila"><span>Produtos</span><span>' +
        formatearPrecio(subtotalCarrito()) + '</span></div>' +
      '<div class="resumen-fila"><span>Taxa de entrega</span><span>' +
        formatearPrecio(CONFIG.costoEnvio) + '</span></div>';
  }

  // Aviso si no llega al monto mínimo del negocio
  let avisoMinimo = '';
  if (!alcanzaMinimo()) {
    avisoMinimo =
      '<div class="aviso error">O pedido mínimo é de ' +
      formatearPrecio(CONFIG.montoMinimo) + '. Faltam ' +
      formatearPrecio(CONFIG.montoMinimo - subtotalCarrito()) + '.</div>';
  }

  return '' +
    avisoMinimo +
    '<div class="resumen">' +
      filas +
      '<div class="resumen-total">' +
        '<span>Total</span>' +
        '<span>' + formatearPrecio(totalCarrito(hayEnvio)) + '</span>' +
      '</div>' +
    '</div>' +

    '<div id="aviso-validacion"></div>' +

    '<button class="boton-whatsapp" onclick="confirmarPedido()">' +
      'Pedir pelo WhatsApp' +
    '</button>' +

    '<p style="font-size:12.5px;color:var(--texto-suave);text-align:center;margin-top:11px">' +
      'O WhatsApp abre com o pedido já escrito. Você revisa e envia.' +
    '</p>';
}


/* ---------- Validación y envío ---------- */

function confirmarPedido() {
  guardarFormulario();

  const errores = [];

  if (!datosPedido.nombre.trim())   errores.push('seu nome');
  else if (!/^[\p{L}\s]+$/u.test(datosPedido.nombre)) errores.push('seu nome (somente letras)');

  if (!datosPedido.telefono.trim()) errores.push('seu telefone');
  else if (!/^[0-9]+$/.test(datosPedido.telefono)) errores.push('seu telefone (somente números)');

  if (!datosPedido.entrega)         errores.push('a forma de entrega');
  if (!datosPedido.pago)            errores.push('a forma de pagamento');

  if (datosPedido.entrega === 'envio' && !datosPedido.direccion.trim()) {
    errores.push('o endereço de entrega');
  }

  const caja = $('aviso-validacion');

  if (errores.length > 0) {
    caja.innerHTML =
      '<div class="aviso error">Antes de continuar, preencha ' + errores.join(', ') + '.</div>';
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!alcanzaMinimo()) {
    caja.innerHTML =
      '<div class="aviso error">Você ainda não atingiu o pedido mínimo.</div>';
    return;
  }

  // Aviso por pedido demasiado largo para el enlace
  if (mensajeDemasiadoLargo(datosPedido)) {
    caja.innerHTML =
      '<div class="aviso">O pedido está muito longo e pode ser cortado ao enviar. ' +
      'É melhor encurtar as observações ou fazer dois pedidos.</div>';
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  caja.innerHTML = '';
  abrirWhatsApp(datosPedido);
}


/* ============================================================
   ARRANQUE
   ============================================================ */

// Botón "volver" de la subbarra: navega según la pantalla en la que esté
$('btn-volver').addEventListener('click', () => {
  const ruta = rutaActual();
  // Si estamos en detalle de producto, volver a la categoría de ese producto
  if (ruta.pantalla === 'detalle') {
    const prod = buscarProducto(ruta.id);
    // En el diseño restaurante no hay pantalla por categoría: se vuelve a la carta.
    irA(prod && !MODO_RESTAURANTE ? '#/categoria/' + prod.categoria : '');
  } else {
    // Desde productos o carrito, volver siempre a categorías
    irA('');
  }
});

// Nombre del negocio en la barra superior: link fijo al inicio de su propio catálogo
$('link-nombre-negocio').addEventListener('click', (e) => {
  e.preventDefault();
  // Ya en la portada no cambia la dirección (no hay navegación): en el
  // diseño restaurante, donde la portada es larga, sube al principio.
  if (MODO_RESTAURANTE && rutaActual().pantalla === 'categorias') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  irA('');
});

// Menú lateral (las 3 rayitas): "Iniciar sesión" y "Contacto".
function irAlPanelAdmin() {
  if (location.hostname.endsWith('.plexi.com.ar')) {
    window.location.href = 'admin.html';
    return;
  }
  // Antes leía el slug solo de ?cliente=, así que en un catálogo abierto
  // por ruta (plexi.com.ar/kiosco01, sin ese query param — el modo por
  // defecto) mandaba a admin.html?cliente= vacío. obtenerSlugCliente()
  // (de catalogo.js) ya sabe resolver los 3 casos: subdominio, ruta y
  // ?cliente=.
  const cliente = obtenerSlugCliente();
  window.location.href = 'admin.html?cliente=' + encodeURIComponent(cliente);
}

function abrirMenu() {
  dibujarDatosContacto();
  $('menu-lateral').classList.add('abierto');
  $('menu-lateral').setAttribute('aria-hidden', 'false');
  $('menu-fondo').classList.remove('oculto');
  $('btn-menu').setAttribute('aria-expanded', 'true');
}

function cerrarMenu() {
  $('menu-lateral').classList.remove('abierto');
  $('menu-lateral').setAttribute('aria-hidden', 'true');
  $('menu-fondo').classList.add('oculto');
  $('btn-menu').setAttribute('aria-expanded', 'false');
}

/**
 * Datos del negocio que se cargan en el panel de Configuración (nombre,
 * WhatsApp, ubicación, horarios, pedido mínimo y formas de pago),
 * mostrados directo debajo de "Iniciar sesión". Todo viene de CONFIG,
 * que ya trae /api/publico/:slug.
 */
function dibujarDatosContacto() {
  const fila = (etiqueta, valor) =>
    '<div class="menu-dato"><span class="menu-dato-etiqueta">' + etiqueta + '</span>' +
    '<span class="menu-dato-valor">' + valor + '</span></div>';

  const pagos = [];
  if (CONFIG.pagoEfectivoHabilitado) pagos.push('Dinheiro');
  if (CONFIG.pagoTarjetaHabilitado) pagos.push('Cartão');
  if (CONFIG.pagoTransferenciaHabilitado) pagos.push('Transferência');

  let html = fila('Negócio', limpiar(CONFIG.nombre));

  // Acepta "@usuario", "usuario" o el link del perfil: se queda solo con
  // el nombre de usuario (letras, números, punto y guion bajo) y arma el
  // link siempre a instagram.com, así nunca termina en un destino ajeno.
  const usuarioIg = String(CONFIG.instagram || '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '').split(/[/?#]/)[0];
  if (/^[A-Za-z0-9._]{1,30}$/.test(usuarioIg)) {
    html += fila('Instagram', '<a href="https://www.instagram.com/' + usuarioIg + '" target="_blank" rel="noopener">@' + usuarioIg + '</a>');
  }

  const numero = String(CONFIG.whatsapp || '').replace(/\D/g, '');
  if (numero) {
    html += fila('WhatsApp', '<a href="https://wa.me/' + numero + '" target="_blank" rel="noopener">+' + numero + '</a>');
  }
  if (CONFIG.ubicacion) {
    html += fila('Localização', '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CONFIG.ubicacion) + '" target="_blank" rel="noopener">' + limpiar(CONFIG.ubicacion) + '</a>');
  }
  if (CONFIG.horarios) html += fila('Horário de atendimento', limpiar(CONFIG.horarios));
  if (CONFIG.montoMinimo > 0) html += fila('Pedido mínimo', formatearPrecio(CONFIG.montoMinimo));
  if (pagos.length) html += fila('Formas de pagamento', pagos.join(', '));
  if (CONFIG.pagoTransferenciaHabilitado && CONFIG.aliasTransferencia) {
    html += fila('Dados para transferência', limpiar(CONFIG.aliasTransferencia));
  }

  $('menu-contacto-detalle').innerHTML = html;
}

$('btn-menu').addEventListener('click', abrirMenu);
$('menu-cerrar').addEventListener('click', cerrarMenu);
$('menu-fondo').addEventListener('click', cerrarMenu);
$('menu-iniciar-sesion').addEventListener('click', irAlPanelAdmin);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('menu-lateral').classList.contains('abierto')) cerrarMenu();
});

/**
 * Si quien mira el catálogo es el dueño del negocio y ya tiene una
 * sesión de admin abierta (mismo token que usa admin.js, namespaced
 * por slug), muestra su nombre de negocio al lado del botón de
 * usuario. Es solo una etiqueta visual: no valida contra el servidor
 * si el token sigue vigente, así que en el peor caso (token vencido)
 * se ve el nombre un rato de más hasta que se intente entrar al panel.
 */
function marcarSiEstaLogueado() {
  const slug = obtenerSlugCliente();
  if (!slug || !CONFIG) return;

  const hayToken = !!sessionStorage.getItem('admin_token_' + slug);
  const badge = $('badge-negocio-logueado');
  badge.textContent = hayToken ? CONFIG.nombre : '';
  badge.classList.toggle('oculto', !hayToken);
}

/* ------------------------------------------------------------
   Compartir el catálogo
   ------------------------------------------------------------
   Siempre comparten el link LIMPIO a la portada del negocio actual
   (plexi.com.ar/<slug>, ver urlCatalogoActual en catalogo.js), no
   location.href tal cual — que podía ser la URL fea con ?cliente=
   (si el visitante entró por ese link viejo) o el link a una pantalla
   puntual en la que esté parado (una categoría, un producto), en vez
   de la portada.

   WhatsApp y Facebook tienen una URL web que abre directo con el
   link ya cargado. Messenger e Instagram no tienen una forma de
   compartir vía navegador sin credenciales propias de desarrollador,
   así que copiamos el link para que el usuario lo pegue a mano
   (Messenger sí abre la app directo cuando es celular).
   ------------------------------------------------------------ */
$('btn-compartir-whatsapp').addEventListener('click', () => {
  window.open('https://wa.me/?text=' + encodeURIComponent(urlCatalogoActual()), '_blank');
});

$('btn-compartir-facebook').addEventListener('click', () => {
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(urlCatalogoActual()), '_blank');
});

$('btn-compartir-messenger').addEventListener('click', async () => {
  // El diálogo web oficial de Messenger exige un App ID propio de Facebook
  // Developers (no tenemos uno registrado). En el celular abrimos la app
  // directo con su esquema; en escritorio, donde Messenger no tiene sitio
  // web, copiamos el link igual que hacemos con Instagram.
  const esMovil = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (esMovil) {
    window.location.href = 'fb-messenger://share?link=' + encodeURIComponent(urlCatalogoActual());
    return;
  }
  try {
    await navigator.clipboard.writeText(urlCatalogoActual());
    avisar('Link copiado: cole no Messenger');
  } catch (e) {
    avisar('Não conseguimos copiar o link. Copie manualmente da barra de endereço.');
  }
});

$('btn-compartir-instagram').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(urlCatalogoActual());
    avisar('Link copiado: cole no seu story ou mensagem do Instagram');
  } catch (e) {
    avisar('Não conseguimos copiar o link. Copie manualmente da barra de endereço.');
  }
});

// Ícono del carrito
$('btn-carrito').addEventListener('click', () => irA('#/carrito'));

// Botón flotante de carrito (visible en categorías y listado de productos)
$('btn-carrito-flotante').addEventListener('click', () => irA('#/carrito'));

// Cada vez que cambia la dirección, se cambia de pantalla
window.addEventListener('hashchange', navegar);

// Primer dibujado: espera a que lleguen los datos del negocio
// (CONFIG, CATEGORIAS) antes de mostrar nada. Los PRODUCTOS se piden
// aparte, por categoría, recién cuando el cliente entra a cada una
// (ver cargarLoteDeCategoria en catalogo.js).
(async function iniciar() {
  const cargoBien = await cargarCatalogo();
  if (!cargoBien) return;   // cargarCatalogo ya mostró el mensaje de error

  // Diseño restaurante: se trae la carta completa de una vez. Si esa
  // request falla, el catálogo cae al diseño de siempre en vez de quedar vacío.
  MODO_RESTAURANTE = CONFIG.tipoTienda === 'restaurante' && await cargarMenuCompleto();

  aplicarPersonalizacion();
  recuperarCarrito();
  dibujarCategorias();
  navegar();
  trackVisita();
  marcarSiEstaLogueado();
})();




