/* ============================================================
   CARRITO
   ------------------------------------------------------------
   Guarda lo que el cliente va eligiendo mientras navega.
   Vive en el navegador del cliente. No se envía a ningún lado
   hasta que el cliente toca el botón de WhatsApp.
   ============================================================ */


/* Cada línea del carrito tiene esta forma:
   {
     id: 'banana',
     nombre: 'Banana',
     unidad: 'kg',
     precio: 3200,
     cantidad: 2,
     obs: 'que no esten muy maduras'
   }
*/

let CARRITO = [];

// Clave con la que se guarda en el navegador.
// Incluye el slug del negocio para que el carrito de un cliente
// no se mezcle con el de otro (localStorage es compartido por
// dominio, no por el "?cliente=" de la URL).
const CLAVE_GUARDADO = 'carrito_catalogo_web_' + (typeof obtenerSlugCliente === 'function' ? obtenerSlugCliente() : '');


/* ------------------------------------------------------------
   Guardado local
   ------------------------------------------------------------
   Permite que el carrito sobreviva si el cliente recarga la
   página sin querer. Va dentro de try/catch porque algunos
   navegadores en modo privado no lo permiten, y en ese caso
   el carrito simplemente funciona solo en memoria.
   ------------------------------------------------------------ */

function guardarCarrito() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(CARRITO));
  } catch (e) {
    // Sin guardado local. El carrito sigue funcionando igual.
  }
}

function recuperarCarrito() {
  try {
    // Limpieza de la clave vieja (sin slug), que mezclaba carritos
    // de distintos negocios en el mismo navegador.
    localStorage.removeItem('carrito_catalogo_web');

    const guardado = localStorage.getItem(CLAVE_GUARDADO);
    if (guardado) CARRITO = JSON.parse(guardado);
  } catch (e) {
    CARRITO = [];
  }
}


/* ------------------------------------------------------------
   Operaciones del carrito
   ------------------------------------------------------------ */

/**
 * Agrega un producto al carrito.
 *
 * Criterio adoptado: si el producto YA está en el carrito y la
 * observación es la misma, se suman las cantidades. Si la
 * observación es distinta, se agrega como una línea separada,
 * porque son dos pedidos distintos del mismo producto.
 */
function agregarAlCarrito(idProducto, cantidad, obs) {
  const producto = buscarProducto(idProducto);
  if (!producto) return;

  const observacion = (obs || '').trim();

  const existente = CARRITO.find(
    linea => linea.id === idProducto && linea.obs === observacion
  );

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    CARRITO.push({
      id: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      precio: producto.precio,
      cantidad: cantidad,
      obs: observacion
    });
  }

  guardarCarrito();
}

/** Cambia la cantidad de una línea. Si llega a cero, la elimina. */
function cambiarCantidad(indice, nuevaCantidad) {
  if (!CARRITO[indice]) return;

  if (nuevaCantidad <= 0) {
    quitarDelCarrito(indice);
    return;
  }

  CARRITO[indice].cantidad = nuevaCantidad;
  guardarCarrito();
}

function quitarDelCarrito(indice) {
  CARRITO.splice(indice, 1);
  guardarCarrito();
}

function vaciarCarrito() {
  CARRITO = [];
  guardarCarrito();
}


/* ------------------------------------------------------------
   Cálculos
   ------------------------------------------------------------ */

/** Cantidad de líneas distintas. Es lo que muestra el contador. */
function cantidadItems() {
  return CARRITO.length;
}

/** Cuánto cuesta una línea: precio por cantidad. */
function subtotalLinea(linea) {
  return linea.precio * linea.cantidad;
}

/** Suma de todos los productos, sin envío. */
function subtotalCarrito() {
  return CARRITO.reduce((suma, linea) => suma + subtotalLinea(linea), 0);
}

/**
 * Total final.
 * Solo suma el envío si el cliente eligió que se lo envíen.
 */
function totalCarrito(conEnvio) {
  const envio = conEnvio ? CONFIG.costoEnvio : 0;
  return subtotalCarrito() + envio;
}

function carritoVacio() {
  return CARRITO.length === 0;
}

/** Verifica si se alcanza el monto mínimo exigido por el negocio. */
function alcanzaMinimo() {
  if (!CONFIG.montoMinimo) return true;
  return subtotalCarrito() >= CONFIG.montoMinimo;
}
