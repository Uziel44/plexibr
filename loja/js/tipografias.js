/* ============================================================
   LISTA DE TIPOGRAFÍAS DISPONIBLES (panel admin, pestaña Apariencia)
   ------------------------------------------------------------
   Fuente única de verdad para las 10 tipografías que un negocio puede
   elegir para su catálogo. La usan:
     - admin.js, para armar las <option> del <select> de Apariencia.
     - app.js, para saber qué familia de Google Fonts cargar dinámicamente
       según lo que eligió el negocio (así el catálogo público solo baja
       UNA familia extra, no las 10 — ver cargarFuenteGoogle en app.js).

   Agregar una tipografía nueva es sumar un objeto acá: no hace falta
   tocar HTML ni CSS en ningún otro lado.

   - id: el valor que se guarda en negocios.tipografia (server.js valida
     contra esta misma lista, ver TIPOGRAFIAS_VALIDAS).
   - nombre: lo que ve el dueño del negocio en el <select>.
   - familiaGoogle: el nombre tal cual lo pide la URL de Google Fonts
     (con "+" en vez de espacios).
   - pesos: los grosores de fuente que se piden (más liviano que bajar
     todos los grosores disponibles).
   - pilaTitulo: font-family para títulos/nombres destacados (h1,
     .barra-titulo, .detalle-nombre, .tarjeta-promo-titulo).
   - pilaCuerpo: font-family para el texto general (main). En la
     mayoría de las tipografías es la misma familia que el título; en
     las serif (Playfair/Merriweather) se usa una serif más legible
     para párrafos largos, igual que ya pasaba con "elegante" antes de
     este cambio (títulos en Playfair, cuerpo en Lora).
   Ambas tienen SIEMPRE "IBM Plex Sans" (o una serif, en las serif) como
   último fallback: si Google Fonts no carga, el catálogo no se rompe.
   ============================================================ */

const TIPOGRAFIAS_DISPONIBLES = [
  { id: 'inter',         nombre: 'Inter',            familiaGoogle: 'Inter',            pesos: '500;600;700;800', pilaTitulo: '"Inter", "IBM Plex Sans", sans-serif',            pilaCuerpo: '"Inter", "IBM Plex Sans", sans-serif' },
  { id: 'poppins',       nombre: 'Poppins',          familiaGoogle: 'Poppins',          pesos: '500;600;700;800', pilaTitulo: '"Poppins", "IBM Plex Sans", sans-serif',          pilaCuerpo: '"Poppins", "IBM Plex Sans", sans-serif' },
  { id: 'montserrat',    nombre: 'Montserrat',       familiaGoogle: 'Montserrat',       pesos: '500;600;700;800', pilaTitulo: '"Montserrat", "IBM Plex Sans", sans-serif',       pilaCuerpo: '"Montserrat", "IBM Plex Sans", sans-serif' },
  { id: 'roboto',        nombre: 'Roboto',           familiaGoogle: 'Roboto',           pesos: '500;700;900',     pilaTitulo: '"Roboto", "IBM Plex Sans", sans-serif',           pilaCuerpo: '"Roboto", "IBM Plex Sans", sans-serif' },
  { id: 'lato',          nombre: 'Lato',             familiaGoogle: 'Lato',             pesos: '400;700;900',     pilaTitulo: '"Lato", "IBM Plex Sans", sans-serif',             pilaCuerpo: '"Lato", "IBM Plex Sans", sans-serif' },
  { id: 'nunito',        nombre: 'Nunito',           familiaGoogle: 'Nunito',           pesos: '500;700;800',     pilaTitulo: '"Nunito", "IBM Plex Sans", sans-serif',           pilaCuerpo: '"Nunito", "IBM Plex Sans", sans-serif' },
  { id: 'playfair',      nombre: 'Playfair Display', familiaGoogle: 'Playfair+Display', pesos: '600;700;800',     pilaTitulo: '"Playfair Display", "Lora", serif',               pilaCuerpo: '"Lora", "IBM Plex Sans", serif' },
  { id: 'merriweather',  nombre: 'Merriweather',     familiaGoogle: 'Merriweather',     pesos: '400;700;900',     pilaTitulo: '"Merriweather", "Lora", serif',                   pilaCuerpo: '"Merriweather", "IBM Plex Sans", serif' },
  { id: 'quicksand',     nombre: 'Quicksand',        familiaGoogle: 'Quicksand',        pesos: '500;600;700',     pilaTitulo: '"Quicksand", "Nunito", sans-serif',               pilaCuerpo: '"Nunito", "IBM Plex Sans", sans-serif' },
  { id: 'space-grotesk', nombre: 'Space Grotesk',    familiaGoogle: 'Space+Grotesk',    pesos: '500;600;700',     pilaTitulo: '"Space Grotesk", "IBM Plex Sans", sans-serif',    pilaCuerpo: '"IBM Plex Sans", sans-serif' }
];

// Compatibilidad con negocios creados antes de este cambio: la columna
// negocios.tipografia tenía solo 3 valores posibles ('moderna',
// 'elegante', 'amigable'), que ya no existen como id en la lista de 10
// de arriba. Se mapean al id nuevo que usa la MISMA fuente que ya
// tenían, así ningún catálogo existente cambia de aspecto sin que su
// dueño lo haya elegido.
const TIPOGRAFIAS_ANTIGUAS = { moderna: 'space-grotesk', elegante: 'playfair', amigable: 'quicksand' };

// Acceso rápido por id, usado tanto en admin.js como en app.js. Resuelve
// primero el mapeo de compatibilidad de arriba, si corresponde.
function buscarTipografia(id) {
  const idResuelto = TIPOGRAFIAS_ANTIGUAS[id] || id;
  return TIPOGRAFIAS_DISPONIBLES.find(t => t.id === idResuelto) || null;
}

// URL de Google Fonts para cargar UNA sola familia (la que el negocio
// eligió). Se arma acá para no repetir el formato en admin.js y app.js.
function urlGoogleFontsPara(tipografia) {
  return 'https://fonts.googleapis.com/css2?family=' + tipografia.familiaGoogle + ':wght@' + tipografia.pesos + '&display=swap';
}
