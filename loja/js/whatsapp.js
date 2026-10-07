/* ============================================================
   ARMADO DEL MENSAJE DE WHATSAPP
   ------------------------------------------------------------
   Este archivo es el corazón del sistema: convierte el carrito
   en un texto y ese texto en un enlace que abre WhatsApp con
   el pedido ya escrito.
   ============================================================ */


/* ------------------------------------------------------------
   Formato de números
   ------------------------------------------------------------ */

/** 3200 -> "3.200"   (formato brasileño) */
function formatearPrecio(valor) {
  return CONFIG.moneda + valor.toLocaleString('pt-BR');
}

/** 2 -> "2"    0.5 -> "0,5"    1.5 -> "1,5" */
function formatearCantidad(cantidad) {
  if (Number.isInteger(cantidad)) return String(cantidad);
  return String(cantidad).replace('.', ',');
}

/** Ej: "2 kg" / "1,5 kg" / "3 unidades" / "1 paquete" */
function cantidadConUnidad(linea) {
  const cant = formatearCantidad(linea.cantidad);

  // Los kilos no se pluralizan: se escribe "kg" siempre
  if (linea.unidad === 'kg') return cant + ' kg';

  const singular = linea.unidad === 'paq' ? 'pacote' : 'unidade';
  const plural   = linea.unidad === 'paq' ? 'pacotes' : 'unidades';

  return cant + ' ' + (linea.cantidad === 1 ? singular : plural);
}


/** "2026-09-20" -> "20/09/2026" */
function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return dia + '/' + mes + '/' + anio;
}

/* ------------------------------------------------------------
   Armado del texto del pedido
   ------------------------------------------------------------
   datos = {
     nombre:    'Juan Perez',
     telefono:  '3511234567',
     entrega:   'retiro' | 'envio',
     direccion: 'San Martin 450',   (solo si entrega === 'envio')
     pago:      'efectivo' | 'tarjeta' | 'transferencia',
     fecha:     '2026-09-20',       (opcional)
     hora:      '18:30'             (opcional)
   }
   ------------------------------------------------------------ */

function armarMensaje(datos) {
  const lineas = [];

  lineas.push('Olá! Gostaria de fazer este pedido:');
  lineas.push('');

  // Un renglón por producto, y otro debajo si tiene observación
  CARRITO.forEach((linea, i) => {
    lineas.push(
      (i + 1) + ') ' + linea.nombre +
      ' - ' + cantidadConUnidad(linea) +
      ' - ' + formatearPrecio(subtotalLinea(linea))
    );

    if (linea.obs) {
      lineas.push('   Obs: ' + linea.obs);
    }
  });

  lineas.push('');

  const hayEnvio = datos.entrega === 'envio';

  // El envío solo se detalla si corresponde y si tiene costo
  if (hayEnvio && CONFIG.costoEnvio > 0) {
    lineas.push('Subtotal: ' + formatearPrecio(subtotalCarrito()));
    lineas.push('Taxa de entrega: ' + formatearPrecio(CONFIG.costoEnvio));
  }

  lineas.push('TOTAL: ' + formatearPrecio(totalCarrito(hayEnvio)));
  lineas.push('');

  lineas.push('Nome: ' + datos.nombre);
  lineas.push('Telefone: ' + datos.telefono);

  lineas.push(
    'Entrega: ' + (hayEnvio ? 'Preciso que enviem para mim' : 'Vou retirar pessoalmente')
  );

  // La dirección solo se incluye si eligió envío
  if (hayEnvio && datos.direccion) {
    lineas.push('Endereço: ' + datos.direccion);
  }

  lineas.push(
    'Pagamento: ' + (
      datos.pago === 'tarjeta' ? 'Cartão de débito/crédito' :
      datos.pago === 'transferencia' ? 'Transferência (dados: ' + CONFIG.aliasTransferencia + ')' :
      'Dinheiro'
    )
  );

  // Fecha y hora deseadas son opcionales: solo se agregan si el cliente las completó
  if (datos.fecha) {
    lineas.push('Data desejada: ' + formatearFecha(datos.fecha));
  }
  if (datos.hora) {
    lineas.push('Horário desejado: ' + datos.hora);
  }

  return lineas.join('\n');
}


/* ------------------------------------------------------------
   Armado del enlace
   ------------------------------------------------------------
   encodeURIComponent es la función que convierte los espacios,
   saltos de línea, acentos y símbolos en algo que puede viajar
   dentro de una dirección web.

   Sin esto, el mensaje llega cortado en el primer espacio.
   ------------------------------------------------------------ */

function armarEnlaceWhatsApp(datos) {
  const mensaje = armarMensaje(datos);
  return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(mensaje);
}


/* ------------------------------------------------------------
   Control de longitud
   ------------------------------------------------------------
   Una dirección web muy larga puede truncarse según el
   navegador. Un pedido normal no llega ni cerca del límite,
   pero conviene avisar antes que mandar medio pedido.
   ------------------------------------------------------------ */

function mensajeDemasiadoLargo(datos) {
  return armarEnlaceWhatsApp(datos).length > CONFIG.limiteCaracteres;
}


/* ------------------------------------------------------------
   Envío
   ------------------------------------------------------------ */

/**
 * Abre WhatsApp con el pedido escrito.
 * IMPORTANTE: el mensaje queda escrito pero NO se envía solo.
 * El cliente tiene que presionar enviar. No hay forma técnica
 * de evitarlo, y además le permite revisar antes de mandar.
 */
function abrirWhatsApp(datos) {
  trackClickWhatsApp(totalCarrito(datos.entrega === 'envio'));
  window.open(armarEnlaceWhatsApp(datos), '_blank');
}

