/* ============================================================
   SIMULACIÓN DEL CATÁLOGO (demo sin backend)
   ------------------------------------------------------------
   Lo carga index.html ANTES que el resto de los scripts. Esa página
   usa los mismos css/style.css y js/*.js que el catálogo real (el index.html de la app);
   lo único que cambia es quién responde "al servidor":
     - Los fetch() a /api/... se contestan acá, en el navegador, con datos
       de ejemplo de un restaurante (tipoTienda 'restaurante' = diseño de
       carta completa con nav fijo).
     - El pedido por WhatsApp no sale directo a wa.me: se muestra primero en
       un chat de WhatsApp simulado, con un botón explícito para abrir el
       link real (wa.me con el número de NUMERO_WHATSAPP).
     - Las métricas (/api/metricas) se descartan: la demo no registra nada.
   No modifica ningún archivo de la app real, no guarda nada en el servidor
   y no necesita Postgres, Node ni Docker: alcanza con servir los archivos
   estáticos (o abrir index.html con doble clic).

   Para ver el diseño clásico (grilla de categorías) con los mismos datos,
   cambiar tipoTienda a 'otro' en NEGOCIO.
   ============================================================ */

(function () {
  'use strict';

  // catalogo.js saca el "slug" del negocio de la dirección (subdominio, ruta o
  // ?cliente=) y se niega a cargar si no hay ninguno, que es lo que pasa al servir
  // esta página en la raíz de un dominio ("/" o "/index.html"). La demo muestra
  // siempre la misma tienda, así que en ese caso se agrega ?cliente=demo a la
  // dirección (sin recargar). Es la misma condición de obtenerSlugCliente().
  (function () {
    const ruta = location.pathname.replace(/^\/+|\/+$/g, '');
    const hayParametro = new URLSearchParams(location.search).get('cliente');
    if ((!ruta || ruta === 'index.html' || ruta === 'admin.html') && !hayParametro) {
      history.replaceState(null, '', location.pathname + '?cliente=demo' + location.hash);
    }
  })();

  // Latencia artificial de la "API": que los estados de "Carregando…" de la
  // app se vean como con un servidor de verdad.
  const LATENCIA_MS = 80;

  // WhatsApp de la demo: el número de todos los links wa.me de la página
  // (pedido, contacto y botón del chat). Formato internacional, solo dígitos.
  const NUMERO_WHATSAPP = '553181114961';
  const NUMERO_LEGIBLE = '+55 31 8111-4961';
  const SALUDO = 'Olá! Vi o cardápio e gostaria de fazer um pedido.';


  /* ------------------------------------------------------------
     Imágenes: fotos reales de Pexels guardadas en img/simulacion/
     (autores y licencia en CREDITOS.txt, en esa misma carpeta). Son
     rutas relativas a index.html; la app las trata como cualquier
     otra URL de imagen. Cada producto usa la foto que lleva su id como
     nombre de archivo. Solo el logo es un dibujo SVG embebido.
     ------------------------------------------------------------ */

  const FOTOS = 'img/simulacion/';

  function logoSvg(emoji, fondo) {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">' +
      '<rect width="240" height="240" fill="' + fondo + '"/>' +
      '<text x="120" y="126" font-size="128" text-anchor="middle" dominant-baseline="central">' + emoji + '</text>' +
      '</svg>'
    );
  }


  /* ------------------------------------------------------------
     Datos de ejemplo. Misma forma que devuelve server.js en
     GET /api/publico/:slug (negocio + categorias) y en
     GET /api/publico/:slug/menu (productos).
     ------------------------------------------------------------ */

  const NEGOCIO = {
    nombre: 'Cantina da Nonna',
    whatsapp: NUMERO_WHATSAPP,
    moneda: 'R$',
    costoEnvio: 8,
    montoMinimo: 20,
    limiteCaracteres: 1800,
    imagenFondo: FOTOS + 'banner.jpg',
    imagenFondoDesktop: '',
    fondoSinAtenuar: false,
    fondoDesktopSinAtenuar: false,
    tipografia: 'playfair',
    formaCategorias: 'circular',
    formaProductos: 'grid-cuadrado',
    tipoTienda: 'restaurante',
    ubicacion: 'Rua das Palmeiras, 123 - Centro, São Paulo - SP',
    horarios: 'Terça a domingo, das 11h às 23h',
    instagram: '@cantinadanonna',
    barraSobreBanner: true,
    logoFooter: logoSvg('🍝', '#1f4a38'),
    // Vacíos: sin colores propios, la barra y el fondo quedan con los de
    // siempre (verde botella y crema de style.css).
    colorBarraFondo: '',
    colorBarraTexto: '',
    colorFondoPagina: '',
    aliasTransferencia: 'Chave Pix (celular): (11) 98765-4321',
    pagoEfectivoHabilitado: true,
    pagoTarjetaHabilitado: true,
    pagoTransferenciaHabilitado: true
  };

  // En el diseño restaurante la imagen de la categoría no se usa; sí en el
  // clásico (grilla de categorías), donde se reaprovecha una foto de sus platos.
  const CATEGORIAS = [
    { id: 'entradas',   nombre: 'Entradas',   imagen: FOTOS + 'bruschetta-de-tomate.jpg', color: '#d4a24c' },
    { id: 'massas',     nombre: 'Massas',     imagen: FOTOS + 'espaguete-carbonara.jpg',  color: '#c0623a' },
    { id: 'pizzas',     nombre: 'Pizzas',     imagen: FOTOS + 'pizza-margherita.jpg',     color: '#a8392b' },
    { id: 'bebidas',    nombre: 'Bebidas',    imagen: FOTOS + 'suco-natural.jpg',         color: '#2f6f8f' },
    { id: 'sobremesas', nombre: 'Sobremesas', imagen: FOTOS + 'tiramisu.jpg',             color: '#7a4a6b' }
  ];

  function producto(id, categoria, nombre, precio, descripcion, extras) {
    return Object.assign({
      id: id,
      nombre: nombre,
      unidad: 'un',
      precio: precio,
      categoria: categoria,
      imagen: FOTOS + id + '.jpg',
      oferta: false,
      agotado: false,
      descripcion: descripcion || '',
      permiteObservaciones: true
    }, extras || {});
  }

  // Precios enteros a propósito: formatearPrecio() (whatsapp.js) no fuerza
  // los 2 decimales, así que 12,5 se vería "R$12,5" en vez de "R$ 12,50".
  const PRODUCTOS = [
    producto('bruschetta-de-tomate', 'entradas', 'Bruschetta de tomate', 22,
      'Pão italiano tostado, tomate, manjericão e azeite.'),
    producto('bolinho-de-queijo', 'entradas', 'Bolinho de queijo', 18,
      'Porção com 8 unidades, crocantes por fora e cremosos por dentro.'),
    producto('salada-caprese', 'entradas', 'Salada caprese', 28,
      'Tomate, mussarela de búfala, manjericão e azeite.'),

    producto('espaguete-carbonara', 'massas', 'Espaguete à carbonara', 46,
      'Bacon crocante, gema, queijo pecorino e pimenta-do-reino.', { oferta: true }),
    producto('lasanha-bolonhesa', 'massas', 'Lasanha à bolonhesa', 42,
      'Camadas de massa fresca, molho de carne e queijo gratinado.'),
    producto('fettuccine-alfredo', 'massas', 'Fettuccine Alfredo', 44,
      'Molho cremoso de manteiga e parmesão.', { agotado: true }),

    producto('pizza-margherita', 'pizzas', 'Pizza Margherita', 49,
      'Molho de tomate, mussarela e manjericão fresco.', { oferta: true }),
    producto('pizza-calabresa', 'pizzas', 'Pizza Calabresa', 52,
      'Calabresa fatiada, cebola e azeitonas.'),
    producto('pizza-quatro-queijos', 'pizzas', 'Pizza Quatro Queijos', 58,
      'Mussarela, provolone, gorgonzola e parmesão.'),

    producto('refrigerante-lata', 'bebidas', 'Refrigerante lata', 7,
      '350 ml. Diga o sabor na observação.'),
    producto('suco-natural', 'bebidas', 'Suco natural 500 ml', 12,
      'Laranja, limão ou maracujá.'),
    producto('agua-mineral', 'bebidas', 'Água mineral 500 ml', 5,
      '', { permiteObservaciones: false }),

    producto('pudim-caseiro', 'sobremesas', 'Pudim caseiro', 16,
      'Receita da casa, com calda de caramelo.', { oferta: true }),
    producto('tiramisu', 'sobremesas', 'Tiramisù', 24,
      'Camadas de biscoito, café e creme de mascarpone.')
  ];


  /* ------------------------------------------------------------
     "Servidor": reemplaza a fetch() para todo lo que sea /api/...
     ------------------------------------------------------------ */

  function json(datos, estado) {
    return new Response(JSON.stringify(datos), {
      status: estado || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function decodificar(texto) {
    try { return decodeURIComponent(texto); } catch (e) { return texto; }
  }

  // ruta = lo que sigue a "/api/", ej. "publico/mi-slug/categoria/pizzas".
  // El slug se ignora: cualquier dirección muestra este mismo restaurante.
  function responderApi(ruta, parametros) {
    const partes = ruta.split('/').filter(Boolean).map(decodificar);
    const recurso = partes[0];
    const seccion = partes[2];
    const id = partes[3];

    if (recurso === 'metricas') return json({ ok: true }, 201);

    if (recurso === 'publico') {
      if (!seccion) return json({ negocio: NEGOCIO, categorias: CATEGORIAS });

      if (seccion === 'menu') {
        return json({ total: PRODUCTOS.length, productos: PRODUCTOS });
      }

      // Diseños que piden de a una categoría (cualquier tipoTienda salvo 'restaurante').
      if (seccion === 'categoria' && id) {
        const deLaCategoria = PRODUCTOS.filter(p => p.categoria === id);
        const offset = Math.max(0, Number(parametros.get('offset')) || 0);
        const limite = Math.max(1, Number(parametros.get('limite')) || 30);
        return json({
          total: deLaCategoria.length,
          productos: deLaCategoria.slice(offset, offset + limite)
        });
      }

      if (seccion === 'producto' && id) {
        const prod = PRODUCTOS.find(p => p.id === id);
        return prod ? json(prod) : json({ error: 'Produto não encontrado.' }, 404);
      }
    }

    return json({ error: 'Demonstração: esta função não está disponível aqui.' }, 404);
  }

  const fetchReal = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (entrada, opciones) {
    const texto = entrada && entrada.url ? entrada.url : String(entrada);
    let url = null;
    try { url = new URL(texto, location.href); } catch (e) { /* no es una URL válida */ }

    // indexOf y no startsWith: al abrir el archivo con doble clic (file://)
    // en Windows, una ruta absoluta resuelve a "/C:/api/...".
    const posicion = url ? url.pathname.indexOf('/api/') : -1;
    if (posicion === -1) {
      return fetchReal ? fetchReal(entrada, opciones) : Promise.reject(new TypeError('fetch no disponible'));
    }

    const ruta = url.pathname.slice(posicion + '/api/'.length);
    return new Promise(function (resolver) {
      setTimeout(function () { resolver(responderApi(ruta, url.searchParams)); }, LATENCIA_MS);
    });
  };

  // analytics.js usa sendBeacon para el tiempo en pantalla (evento que se
  // dispara al salir de la página): también se descarta.
  if (navigator.sendBeacon) navigator.sendBeacon = function () { return true; };


  /* ------------------------------------------------------------
     Pedido por WhatsApp: antes de salir a wa.me, un chat simulado que
     muestra el mensaje; desde ahí, un botón explícito ("Abrir no WhatsApp")
     abre el link real. Cubre los dos caminos a wa.me con número:
     window.open() del botón "Pedir pelo WhatsApp" (whatsapp.js) y el link
     de WhatsApp del menú de contacto (<a href>, app.js). Los demás links
     (compartir, que no lleva número; Instagram; Maps) quedan como en la
     app real, y un <a data-wa-real> se deja pasar tal cual.
     ------------------------------------------------------------ */

  const ENLACE_WHATSAPP = /^https:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/;

  const abrirReal = window.open ? window.open.bind(window) : null;

  window.open = function (url, destino, caracteristicas) {
    const coincidencia = ENLACE_WHATSAPP.exec(String(url));
    if (coincidencia) {
      abrirChat(coincidencia[1], coincidencia[2] ? decodificar(coincidencia[2]) : SALUDO);
      return null;
    }
    return abrirReal ? abrirReal(url, destino, caracteristicas) : null;
  };

  // En fase de captura: corre antes que cualquier otro handler y evita que
  // el <a> navegue a wa.me.
  document.addEventListener('click', function (e) {
    const enlace = e.target.closest ? e.target.closest('a[href]') : null;
    if (!enlace || enlace.hasAttribute('data-wa-real')) return;
    const coincidencia = ENLACE_WHATSAPP.exec(enlace.getAttribute('href') || '');
    if (!coincidencia) return;

    e.preventDefault();
    e.stopPropagation();
    abrirChat(coincidencia[1], coincidencia[2] ? decodificar(coincidencia[2]) : SALUDO);
  }, true);

  let chat = null;
  let focoPrevio = null;

  function construirChat() {
    if (chat) return;

    chat = document.createElement('div');
    chat.className = 'sim-chat-fondo oculto';
    // Solo HTML fijo: el nombre y el texto del pedido (que escribe quien
    // prueba la demo) se ponen con textContent, nunca por innerHTML.
    chat.innerHTML =
      '<div class="sim-chat" role="dialog" aria-modal="true" aria-labelledby="sim-chat-nombre">' +
        '<div class="sim-chat-barra">' +
          '<img class="sim-chat-avatar" id="sim-chat-avatar" alt="">' +
          '<div class="sim-chat-quien">' +
            '<strong id="sim-chat-nombre"></strong>' +
            '<small id="sim-chat-numero"></small>' +
          '</div>' +
          '<button type="button" class="sim-chat-cerrar" id="sim-chat-cerrar" aria-label="Fechar">&#10005;</button>' +
        '</div>' +
        '<div class="sim-chat-cuerpo">' +
          '<div class="sim-chat-burbuja">' +
            '<div class="sim-chat-texto" id="sim-chat-texto"></div>' +
            '<div class="sim-chat-hora" id="sim-chat-hora"></div>' +
          '</div>' +
        '</div>' +
        '<p class="sim-chat-aviso">Simulação: nada foi enviado. Para ver como chega no WhatsApp de verdade, toque em “Abrir no WhatsApp”; o pedido só sai quando você apertar enviar.</p>' +
        '<a class="sim-chat-real" id="sim-chat-real" data-wa-real href="#" target="_blank" rel="noopener">Abrir no WhatsApp</a>' +
        '<button type="button" class="sim-chat-voltar" id="sim-chat-voltar">Voltar ao cardápio</button>' +
      '</div>';
    document.body.appendChild(chat);

    chat.addEventListener('click', function (e) { if (e.target === chat) cerrarChat(); });
    document.getElementById('sim-chat-cerrar').addEventListener('click', cerrarChat);
    document.getElementById('sim-chat-voltar').addEventListener('click', cerrarChat);
    // En fase de captura y cortando la propagación: app.js también cierra el
    // menú lateral con Escape, y si el chat se abrió desde ese menú se cerrarían
    // las dos capas juntas en vez de solo la de arriba.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || chat.classList.contains('oculto')) return;
      e.stopPropagation();
      cerrarChat();
    }, true);
  }

  function abrirChat(numero, texto) {
    construirChat();
    focoPrevio = document.activeElement;

    document.getElementById('sim-chat-avatar').src = NEGOCIO.logoFooter;
    document.getElementById('sim-chat-nombre').textContent = NEGOCIO.nombre;
    document.getElementById('sim-chat-numero').textContent =
      numero === NUMERO_WHATSAPP ? NUMERO_LEGIBLE : '+' + numero;
    document.getElementById('sim-chat-texto').textContent = texto;
    document.getElementById('sim-chat-real').href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
    document.getElementById('sim-chat-hora').textContent =
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ✓✓';

    chat.classList.remove('oculto');
    document.body.classList.add('sim-chat-abierto');
    document.getElementById('sim-chat-cerrar').focus();
  }

  function cerrarChat() {
    chat.classList.add('oculto');
    document.body.classList.remove('sim-chat-abierto');
    if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
  }

  /* ------------------------------------------------------------
     Simulación del panel admin (js/simulacion-admin.js, copia del de la app)
     ------------------------------------------------------------ */

  // app.js muestra el botón "Quero ver como ficaria o meu perfil" solo para el negocio
  // demo de plexi (por su slug). Esta página ES esa demo, así que se lo mantiene
  // visible aunque app.js lo vuelva a ocultar al redibujar la portada.
  (function () {
    const boton = document.getElementById('boton-simulacion-admin');
    if (!boton) return;
    // Solo si la clase está puesta: classList.remove() reescribe el atributo aunque no
    // esté, y eso volvería a disparar este mismo observador sin parar.
    const mostrar = function () { if (boton.classList.contains('oculto')) boton.classList.remove('oculto'); };
    new MutationObserver(mostrar).observe(boton, { attributes: true, attributeFilter: ['class'] });
    mostrar();
  })();
})();
