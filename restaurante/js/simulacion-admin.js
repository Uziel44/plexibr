/* ============================================================
   SIMULACIÓN DEL PANEL ADMIN (demo, sin persistencia)
   ------------------------------------------------------------
   Réplica visual e interactiva de admin.html/js/admin.js pensada
   para que un dueño de negocio potencial pruebe cómo sería
   administrar su catálogo, SIN tocar el admin real ni el servidor:
     - Todo el estado vive en memoria (SIM_ESTADO, más abajo).
     - Nunca hace fetch. Nunca escribe en localStorage/sessionStorage.
     - Al cerrar el overlay se descarta todo; al reabrir, vuelve a
       arrancar del mismo set de ejemplo (ver crearEstadoInicial()).
   No comparte código ni estado con js/admin.js: solo reutiliza las
   clases CSS de css/admin.css para verse idéntico.
   ============================================================ */

const $sim = (id) => document.getElementById(id);

// Escapa HTML antes de insertar texto de usuario en innerHTML (mismo
// propósito que limpiar() en js/admin.js, reimplementado acá porque
// admin.js no se carga en index.html).
function simLimpiar(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

let SIM_ESTADO = null;
let simOverlayCreado = false;

function crearEstadoInicial() {
  return {
    categorias: [
      { id: 1, nombre: 'Bebidas', color: '#3b82f6' },
      { id: 2, nombre: 'Pizzas', color: '#ef4444' },
      { id: 3, nombre: 'Sobremesas', color: '#f59e0b' },
    ],
    productos: [
      { id: 1, categoria_id: 1, nombre: 'Coca-Cola 500ml', precio: 6, descripcion: '', unidad: 'un', oferta: false, agotado: false, permiteObservaciones: true },
      { id: 2, categoria_id: 1, nombre: 'Água mineral 500ml', precio: 4, descripcion: '', unidad: 'un', oferta: false, agotado: false, permiteObservaciones: true },
      { id: 3, categoria_id: 2, nombre: 'Mussarela', precio: 45, descripcion: 'Com molho de tomate e mussarela', unidad: 'un', oferta: true, agotado: false, permiteObservaciones: true },
      { id: 4, categoria_id: 2, nombre: 'Napolitana', precio: 52, descripcion: '', unidad: 'un', oferta: false, agotado: true, permiteObservaciones: true },
      { id: 5, categoria_id: 3, nombre: 'Pudim caseiro', precio: 14, descripcion: '', unidad: 'un', oferta: false, agotado: false, permiteObservaciones: false },
    ],
    apariencia: {
      colorBarraFondo: '#1f4a38',
      colorBarraTexto: '#ffffff',
      colorFondoPagina: '#f5f2ec',
      tipografia: 'inter',
      formaCategorias: 'circular',
      formaProductos: 'grid-cuadrado',
    },
    proximoIdCategoria: 4,
    proximoIdProducto: 6,
    categoriaEditando: null,
    productoEditando: null,
    categoriaProductosAbierta: null,
  };
}

const SIM_LIMITE_CATEGORIAS = 10;

const SIM_HTML_OVERLAY = '' +
  '<div class="sim-overlay oculto" id="sim-overlay">' +
    '<div class="sim-barra">' +
      '<span class="sim-barra-titulo">Simulação do seu painel</span>' +
      '<span class="sim-barra-aviso">É uma demonstração: nada disso é salvo</span>' +
      '<button type="button" class="sim-btn-cerrar" id="sim-btn-cerrar" aria-label="Fechar simulação">&#10005;</button>' +
    '</div>' +
    '<div class="sim-main">' +
      '<div class="admin-tabs">' +
        '<button class="admin-tab activa" data-sim-tab="categorias">Categorias</button>' +
        '<button class="admin-tab" data-sim-tab="productos">Produtos</button>' +
        '<button class="admin-tab" data-sim-tab="apariencia">Aparência</button>' +
        '<button class="admin-tab" data-sim-tab="metricas">Métricas</button>' +
      '</div>' +

      '<div id="sim-tab-categorias" class="admin-tab-contenido">' +
        '<div class="admin-tab-header">' +
          '<span id="sim-contador-categorias"></span>' +
          '<button class="admin-btn-agregar" id="sim-btn-agregar-categoria">+ Adicionar categoria</button>' +
        '</div>' +
        '<div id="sim-lista-categorias"></div>' +
      '</div>' +

      '<div id="sim-tab-productos" class="admin-tab-contenido oculto">' +
        '<div class="admin-tab-header">' +
          '<span id="sim-contador-productos"></span>' +
          '<button class="admin-btn-agregar" id="sim-btn-agregar-producto">+ Adicionar produto</button>' +
        '</div>' +
        '<div id="sim-lista-productos"></div>' +
      '</div>' +

      '<div id="sim-tab-apariencia" class="admin-tab-contenido oculto">' +
        '<div class="sim-apariencia-layout">' +
          '<div class="sim-apariencia-form" id="sim-apariencia-form"></div>' +
          '<div class="sim-preview-marco">' +
            '<div class="sim-preview-etiqueta">Pré-visualização</div>' +
            '<div class="sim-preview" id="sim-preview"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="sim-tab-metricas" class="admin-tab-contenido oculto">' +
        '<div class="admin-tab-header">' +
          '<span>Últimos 30 dias</span>' +
        '</div>' +
        '<div id="sim-metricas"></div>' +
      '</div>' +
    '</div>' +
  '</div>';

function construirOverlaySiHaceFalta() {
  if (simOverlayCreado) return;
  document.body.insertAdjacentHTML('beforeend', SIM_HTML_OVERLAY);
  simOverlayCreado = true;

  $sim('sim-btn-cerrar').addEventListener('click', cerrarSimulacion);
  document.querySelectorAll('#sim-overlay [data-sim-tab]').forEach(btn => {
    btn.addEventListener('click', () => simCambiarTab(btn.dataset.simTab));
  });
  $sim('sim-btn-agregar-categoria').addEventListener('click', () => abrirModalCategoriaSim(null));
  $sim('sim-btn-agregar-producto').addEventListener('click', () => abrirModalProductoSim(null));
}

function abrirSimulacion() {
  SIM_ESTADO = crearEstadoInicial();
  construirOverlaySiHaceFalta();
  simCambiarTab('categorias');
  simDibujarCategorias();
  simDibujarTarjetasCategoriasProductos();
  simPintarFormularioApariencia();
  simActualizarPreview();
  $sim('sim-overlay').classList.remove('oculto');
  document.body.style.overflow = 'hidden';
}

function cerrarSimulacion() {
  $sim('sim-overlay').classList.add('oculto');
  document.body.style.overflow = '';
  SIM_ESTADO = null;
}

function simCambiarTab(nombre) {
  document.querySelectorAll('#sim-overlay .admin-tab').forEach(t =>
    t.classList.toggle('activa', t.dataset.simTab === nombre));
  ['categorias', 'productos', 'apariencia', 'metricas'].forEach(t =>
    $sim('sim-tab-' + t).classList.toggle('oculto', t !== nombre));
  // Se redibuja cada vez que se abre: sus listas salen de lo que haya en SIM_ESTADO.
  if (nombre === 'metricas') simDibujarMetricas();
}

/* ============================================================
   CATEGORÍAS - listado, alta, edición, borrado, orden
   ============================================================ */

function simDibujarCategorias() {
  const cats = SIM_ESTADO.categorias;
  $sim('sim-contador-categorias').textContent =
    cats.length + '/' + SIM_LIMITE_CATEGORIAS + (cats.length === 1 ? ' categoria' : ' categorias');
  $sim('sim-btn-agregar-categoria').disabled = cats.length >= SIM_LIMITE_CATEGORIAS;

  if (cats.length === 0) {
    $sim('sim-lista-categorias').innerHTML =
      '<div class="admin-vacio">Você ainda não tem categorias. Adicione a primeira com o botão acima.</div>';
    return;
  }

  $sim('sim-lista-categorias').innerHTML = cats.map((cat, i) => {
    const cantidadProductos = SIM_ESTADO.productos.filter(p => p.categoria_id === cat.id).length;
    const esPrimera = i === 0;
    const esUltima = i === cats.length - 1;

    return '' +
      '<div class="admin-fila" data-sim-cat-id="' + cat.id + '">' +
        '<div class="admin-fila-color" style="background-color:' + simLimpiar(cat.color) + '"></div>' +
        '<div class="admin-fila-datos">' +
          '<div class="admin-fila-nombre">' + simLimpiar(cat.nombre) + '</div>' +
          '<div class="admin-fila-sub">' + cantidadProductos + (cantidadProductos === 1 ? ' produto' : ' produtos') + '</div>' +
        '</div>' +
        '<div class="admin-fila-orden">' +
          '<button class="admin-fila-boton" data-sim-mover="' + cat.id + '" data-sim-dir="-1" aria-label="Subir"' + (esPrimera ? ' disabled' : '') + '>&#9650;</button>' +
          '<button class="admin-fila-boton" data-sim-mover="' + cat.id + '" data-sim-dir="1" aria-label="Descer"' + (esUltima ? ' disabled' : '') + '>&#9660;</button>' +
        '</div>' +
        '<div class="admin-fila-acciones">' +
          '<button class="admin-fila-boton" data-sim-editar-cat="' + cat.id + '" aria-label="Editar">&#9998;</button>' +
          '<button class="admin-fila-boton borrar" data-sim-borrar-cat="' + cat.id + '" aria-label="Excluir">&#128465;</button>' +
        '</div>' +
      '</div>';
  }).join('');

  document.querySelectorAll('#sim-lista-categorias [data-sim-mover]').forEach(btn => {
    btn.addEventListener('click', () => simMoverCategoria(Number(btn.dataset.simMover), Number(btn.dataset.simDir)));
  });
  document.querySelectorAll('#sim-lista-categorias [data-sim-editar-cat]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCategoriaSim(Number(btn.dataset.simEditarCat)));
  });
  document.querySelectorAll('#sim-lista-categorias [data-sim-borrar-cat]').forEach(btn => {
    btn.addEventListener('click', () => simBorrarCategoria(Number(btn.dataset.simBorrarCat)));
  });
}

function simMoverCategoria(id, direccion) {
  const cats = SIM_ESTADO.categorias;
  const i = cats.findIndex(c => c.id === id);
  const j = i + direccion;
  if (i === -1 || j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  simDibujarCategorias();
}

function simBorrarCategoria(id) {
  const cat = SIM_ESTADO.categorias.find(c => c.id === id);
  if (!cat || !confirm('Excluir a categoria "' + cat.nombre + '"? Os produtos dela na demonstração também serão excluídos.')) return;
  SIM_ESTADO.categorias = SIM_ESTADO.categorias.filter(c => c.id !== id);
  SIM_ESTADO.productos = SIM_ESTADO.productos.filter(p => p.categoria_id !== id);
  if (SIM_ESTADO.categoriaProductosAbierta === id) SIM_ESTADO.categoriaProductosAbierta = null;
  simDibujarCategorias();
  simDibujarTarjetasCategoriasProductos();
}

const SIM_MODAL_CATEGORIA_HTML = '' +
  '<div id="sim-modal-categoria" class="admin-modal oculto">' +
    '<div class="admin-modal-caja">' +
      '<h2 id="sim-modal-categoria-titulo">Nova categoria</h2>' +
      '<div class="campo">' +
        '<label for="sim-cat-nombre">Nome <span class="obligatorio">*</span></label>' +
        '<input type="text" id="sim-cat-nombre" placeholder="Ex.: Bebidas">' +
      '</div>' +
      '<div class="campo">' +
        '<label for="sim-cat-color">Cor de fundo</label>' +
        '<input type="color" id="sim-cat-color" value="#6b7280" class="admin-input-color">' +
      '</div>' +
      '<div id="sim-modal-categoria-error" class="aviso error oculto"></div>' +
      '<div class="admin-modal-acciones">' +
        '<button class="boton-secundario" id="sim-btn-cancelar-categoria">Cancelar</button>' +
        '<button class="boton-principal" id="sim-btn-guardar-categoria" style="justify-content:center">Salvar</button>' +
      '</div>' +
    '</div>' +
  '</div>';

let simModalCategoriaCreado = false;

function construirModalCategoriaSiHaceFalta() {
  if (simModalCategoriaCreado) return;
  document.body.insertAdjacentHTML('beforeend', SIM_MODAL_CATEGORIA_HTML);
  simModalCategoriaCreado = true;
  $sim('sim-btn-cancelar-categoria').addEventListener('click', cerrarModalCategoriaSim);
  $sim('sim-btn-guardar-categoria').addEventListener('click', guardarCategoriaSim);
}

function abrirModalCategoriaSim(id) {
  if (!id && SIM_ESTADO.categorias.length >= SIM_LIMITE_CATEGORIAS) return;
  construirModalCategoriaSiHaceFalta();
  SIM_ESTADO.categoriaEditando = id || null;
  const cat = id ? SIM_ESTADO.categorias.find(c => c.id === id) : null;

  $sim('sim-modal-categoria-titulo').textContent = cat ? 'Editar categoria' : 'Nova categoria';
  $sim('sim-cat-nombre').value = cat ? cat.nombre : '';
  $sim('sim-cat-color').value = cat ? cat.color : '#6b7280';
  $sim('sim-modal-categoria-error').classList.add('oculto');
  $sim('sim-modal-categoria').classList.remove('oculto');
}

function cerrarModalCategoriaSim() {
  $sim('sim-modal-categoria').classList.add('oculto');
}

function guardarCategoriaSim() {
  const nombre = $sim('sim-cat-nombre').value.trim();
  const color = $sim('sim-cat-color').value;
  const cajaError = $sim('sim-modal-categoria-error');

  if (!nombre) {
    cajaError.textContent = 'O nome é obrigatório.';
    cajaError.classList.remove('oculto');
    return;
  }

  if (SIM_ESTADO.categoriaEditando) {
    const cat = SIM_ESTADO.categorias.find(c => c.id === SIM_ESTADO.categoriaEditando);
    cat.nombre = nombre;
    cat.color = color;
  } else {
    SIM_ESTADO.categorias.push({ id: SIM_ESTADO.proximoIdCategoria++, nombre, color });
  }

  cerrarModalCategoriaSim();
  simDibujarCategorias();
  simDibujarTarjetasCategoriasProductos();
}

/* ============================================================
   PRODUCTOS - tarjetas por categoría, lista, alta, edición, borrado
   ============================================================ */

const SIM_LIMITE_PRODUCTOS = 2000;
const SIM_LIMITE_DESCRIPCION = 500;

function simTextoUnidad(unidad) {
  if (unidad === 'kg') return 'kg';
  if (unidad === 'paq') return 'pacote';
  return 'unidade';
}

function simDibujarTarjetasCategoriasProductos() {
  if (SIM_ESTADO.categoriaProductosAbierta != null) {
    simDibujarListaProductosDeCategoria(SIM_ESTADO.categoriaProductosAbierta);
    return;
  }

  const total = SIM_ESTADO.productos.length;
  $sim('sim-contador-productos').textContent =
    total + '/' + SIM_LIMITE_PRODUCTOS + (total === 1 ? ' produto' : ' produtos') + ' no total';

  if (SIM_ESTADO.categorias.length === 0) {
    $sim('sim-lista-productos').innerHTML =
      '<div class="admin-vacio">Primeiro crie uma categoria na aba Categorias.</div>';
    return;
  }

  $sim('sim-lista-productos').innerHTML = SIM_ESTADO.categorias.map(cat => {
    const cantidad = SIM_ESTADO.productos.filter(p => p.categoria_id === cat.id).length;
    return '' +
      '<button class="admin-tarjeta-categoria" data-sim-abrir-cat="' + cat.id + '">' +
        '<span class="admin-tarjeta-categoria-nombre">' + simLimpiar(cat.nombre) + '</span>' +
        '<span class="admin-tarjeta-categoria-sub">' + cantidad + (cantidad === 1 ? ' produto' : ' produtos') + '</span>' +
      '</button>';
  }).join('');

  document.querySelectorAll('#sim-lista-productos [data-sim-abrir-cat]').forEach(btn => {
    btn.addEventListener('click', () => simAbrirCategoriaProductos(Number(btn.dataset.simAbrirCat)));
  });
}

function simAbrirCategoriaProductos(id) {
  SIM_ESTADO.categoriaProductosAbierta = id;
  simDibujarTarjetasCategoriasProductos();
}

function simVolverATarjetasProductos() {
  SIM_ESTADO.categoriaProductosAbierta = null;
  simDibujarTarjetasCategoriasProductos();
}

function simDibujarListaProductosDeCategoria(categoriaId) {
  const cat = SIM_ESTADO.categorias.find(c => c.id === categoriaId);
  if (!cat) {
    SIM_ESTADO.categoriaProductosAbierta = null;
    simDibujarTarjetasCategoriasProductos();
    return;
  }
  const productos = SIM_ESTADO.productos.filter(p => p.categoria_id === categoriaId);

  $sim('sim-contador-productos').innerHTML =
    '<button class="admin-btn-volver" id="sim-btn-volver-productos" aria-label="Voltar para categorias">&#8592;</button>' +
    '<span>' + simLimpiar(cat.nombre) + ' &middot; ' + productos.length + (productos.length === 1 ? ' produto' : ' produtos') + '</span>';
  $sim('sim-btn-volver-productos').addEventListener('click', simVolverATarjetasProductos);

  if (productos.length === 0) {
    $sim('sim-lista-productos').innerHTML =
      '<div class="admin-vacio">Esta categoria ainda não tem produtos. Adicione o primeiro com o botão acima.</div>';
    return;
  }

  $sim('sim-lista-productos').innerHTML = productos.map(prod => {
    const etiquetas =
      (prod.agotado ? '<span class="admin-etiqueta-chica agotado">Sem estoque</span>' : '') +
      (prod.oferta ? '<span class="admin-etiqueta-chica oferta">Oferta</span>' : '');

    return '' +
      '<div class="admin-fila">' +
        '<div class="admin-fila-color" style="background-color:var(--gris-fondo)"></div>' +
        '<div class="admin-fila-datos">' +
          '<div class="admin-fila-nombre">' + simLimpiar(prod.nombre) + etiquetas + '</div>' +
          '<div class="admin-fila-sub">R$' + prod.precio + ' por ' + simTextoUnidad(prod.unidad) + '</div>' +
        '</div>' +
        '<div class="admin-fila-acciones">' +
          '<button class="admin-fila-boton" data-sim-editar-prod="' + prod.id + '" aria-label="Editar">&#9998;</button>' +
          '<button class="admin-fila-boton borrar" data-sim-borrar-prod="' + prod.id + '" aria-label="Excluir">&#128465;</button>' +
        '</div>' +
      '</div>';
  }).join('');

  document.querySelectorAll('#sim-lista-productos [data-sim-editar-prod]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProductoSim(Number(btn.dataset.simEditarProd)));
  });
  document.querySelectorAll('#sim-lista-productos [data-sim-borrar-prod]').forEach(btn => {
    btn.addEventListener('click', () => simBorrarProducto(Number(btn.dataset.simBorrarProd)));
  });
}

function simBorrarProducto(id) {
  const prod = SIM_ESTADO.productos.find(p => p.id === id);
  if (!prod || !confirm('Excluir o produto "' + prod.nombre + '"?')) return;
  SIM_ESTADO.productos = SIM_ESTADO.productos.filter(p => p.id !== id);
  simDibujarTarjetasCategoriasProductos();
  simDibujarCategorias();
}

const SIM_MODAL_PRODUCTO_HTML = '' +
  '<div id="sim-modal-producto" class="admin-modal oculto">' +
    '<div class="admin-modal-caja">' +
      '<h2 id="sim-modal-producto-titulo">Novo produto</h2>' +
      '<div class="campo">' +
        '<label for="sim-prod-nombre">Nome <span class="obligatorio">*</span></label>' +
        '<input type="text" id="sim-prod-nombre" placeholder="Ex.: Coca-Cola">' +
      '</div>' +
      '<div class="campo">' +
        '<label for="sim-prod-categoria">Categoria <span class="obligatorio">*</span></label>' +
        '<select id="sim-prod-categoria"></select>' +
      '</div>' +
      '<div class="campo">' +
        '<label for="sim-prod-precio">Preço <span class="obligatorio">*</span></label>' +
        '<input type="number" id="sim-prod-precio" min="0" step="0.01" placeholder="0">' +
      '</div>' +
      '<div class="campo">' +
        '<label for="sim-prod-descripcion">Descrição (opcional)</label>' +
        '<textarea id="sim-prod-descripcion" maxlength="500" rows="3" placeholder="Conte ao cliente mais detalhes do produto"></textarea>' +
        '<div class="contador-caracteres" id="sim-contador-prod-descripcion">0 / 500</div>' +
      '</div>' +
      '<div class="campo">' +
        '<label for="sim-prod-unidad">Vendido por</label>' +
        '<select id="sim-prod-unidad">' +
          '<option value="un">Unidade</option>' +
          '<option value="kg">Quilo (permite meio quilo)</option>' +
          '<option value="paq">Pacote</option>' +
        '</select>' +
      '</div>' +
      '<div class="admin-check-fila">' +
        '<label><input type="checkbox" id="sim-prod-oferta"> Está em oferta</label>' +
        '<label><input type="checkbox" id="sim-prod-agotado"> Sem estoque</label>' +
      '</div>' +
      '<div class="admin-check-fila">' +
        '<label><input type="checkbox" id="sim-prod-permite-observaciones" checked> Permitir que o cliente deixe uma observação ao pedir</label>' +
      '</div>' +
      '<div id="sim-modal-producto-error" class="aviso error oculto"></div>' +
      '<div class="admin-modal-acciones">' +
        '<button class="boton-secundario" id="sim-btn-cancelar-producto">Cancelar</button>' +
        '<button class="boton-principal" id="sim-btn-guardar-producto" style="justify-content:center">Salvar</button>' +
      '</div>' +
    '</div>' +
  '</div>';

let simModalProductoCreado = false;

function construirModalProductoSiHaceFalta() {
  if (simModalProductoCreado) return;
  document.body.insertAdjacentHTML('beforeend', SIM_MODAL_PRODUCTO_HTML);
  simModalProductoCreado = true;
  $sim('sim-btn-cancelar-producto').addEventListener('click', cerrarModalProductoSim);
  $sim('sim-btn-guardar-producto').addEventListener('click', guardarProductoSim);
  $sim('sim-prod-descripcion').addEventListener('input', simContarCaracteresDescripcion);
}

function simContarCaracteresDescripcion() {
  const texto = $sim('sim-prod-descripcion').value;
  $sim('sim-contador-prod-descripcion').textContent = texto.length + ' / ' + SIM_LIMITE_DESCRIPCION;
}

function simLlenarSelectCategorias(categoriaSeleccionada) {
  $sim('sim-prod-categoria').innerHTML = SIM_ESTADO.categorias.map(cat =>
    '<option value="' + cat.id + '"' + (cat.id === categoriaSeleccionada ? ' selected' : '') + '>' + simLimpiar(cat.nombre) + '</option>'
  ).join('');
}

function abrirModalProductoSim(id) {
  if (SIM_ESTADO.categorias.length === 0) {
    alert('Primeiro crie uma categoria');
    return;
  }
  if (!id && SIM_ESTADO.productos.length >= SIM_LIMITE_PRODUCTOS) return;

  construirModalProductoSiHaceFalta();
  SIM_ESTADO.productoEditando = id || null;
  const prod = id ? SIM_ESTADO.productos.find(p => p.id === id) : null;

  const categoriaPorDefecto = SIM_ESTADO.categoriaProductosAbierta &&
    SIM_ESTADO.categorias.some(c => c.id === SIM_ESTADO.categoriaProductosAbierta)
    ? SIM_ESTADO.categoriaProductosAbierta
    : SIM_ESTADO.categorias[0].id;

  $sim('sim-modal-producto-titulo').textContent = prod ? 'Editar produto' : 'Novo produto';
  simLlenarSelectCategorias(prod ? prod.categoria_id : categoriaPorDefecto);
  $sim('sim-prod-nombre').value = prod ? prod.nombre : '';
  $sim('sim-prod-precio').value = prod ? prod.precio : '';
  $sim('sim-prod-descripcion').value = prod ? (prod.descripcion || '') : '';
  simContarCaracteresDescripcion();
  $sim('sim-prod-unidad').value = prod ? prod.unidad : 'un';
  $sim('sim-prod-oferta').checked = prod ? !!prod.oferta : false;
  $sim('sim-prod-agotado').checked = prod ? !!prod.agotado : false;
  $sim('sim-prod-permite-observaciones').checked = prod ? !!prod.permiteObservaciones : true;
  $sim('sim-modal-producto-error').classList.add('oculto');
  $sim('sim-modal-producto').classList.remove('oculto');
}

function cerrarModalProductoSim() {
  $sim('sim-modal-producto').classList.add('oculto');
}

function guardarProductoSim() {
  const nombre = $sim('sim-prod-nombre').value.trim();
  const categoriaId = Number($sim('sim-prod-categoria').value);
  const precio = $sim('sim-prod-precio').value;
  const descripcion = $sim('sim-prod-descripcion').value.trim();
  const unidad = $sim('sim-prod-unidad').value;
  const oferta = $sim('sim-prod-oferta').checked;
  const agotado = $sim('sim-prod-agotado').checked;
  const permiteObservaciones = $sim('sim-prod-permite-observaciones').checked;
  const cajaError = $sim('sim-modal-producto-error');

  if (!nombre) {
    cajaError.textContent = 'O nome é obrigatório.';
    cajaError.classList.remove('oculto');
    return;
  }
  if (precio === '' || isNaN(Number(precio)) || Number(precio) < 0) {
    cajaError.textContent = 'Informe um preço válido.';
    cajaError.classList.remove('oculto');
    return;
  }
  if (descripcion.length > SIM_LIMITE_DESCRIPCION) {
    cajaError.textContent = 'A descrição não pode ter mais de ' + SIM_LIMITE_DESCRIPCION + ' caracteres.';
    cajaError.classList.remove('oculto');
    return;
  }

  if (SIM_ESTADO.productoEditando) {
    const prod = SIM_ESTADO.productos.find(p => p.id === SIM_ESTADO.productoEditando);
    Object.assign(prod, { nombre, categoria_id: categoriaId, precio: Number(precio), descripcion, unidad, oferta, agotado, permiteObservaciones });
  } else {
    SIM_ESTADO.productos.push({
      id: SIM_ESTADO.proximoIdProducto++, categoria_id: categoriaId, nombre,
      precio: Number(precio), descripcion, unidad, oferta, agotado, permiteObservaciones,
    });
  }

  cerrarModalProductoSim();
  simDibujarTarjetasCategoriasProductos();
  simDibujarCategorias();
}

/* ============================================================
   APARIENCIA - formulario + mini-preview en vivo
   ============================================================ */

function simPintarFormularioApariencia() {
  const ap = SIM_ESTADO.apariencia;

  const opcionesTipografia = TIPOGRAFIAS_DISPONIBLES.map(t =>
    '<option value="' + t.id + '"' + (t.id === ap.tipografia ? ' selected' : '') + '>' + simLimpiar(t.nombre) + '</option>'
  ).join('');

  const opcionForma = (name, valorActual, valor, claseForma, etiqueta) =>
    '<label class="admin-apariencia-opcion">' +
      '<input type="radio" name="' + name + '" value="' + valor + '"' + (valorActual === valor ? ' checked' : '') + '>' +
      '<span class="admin-apariencia-forma-preview ' + claseForma + '"></span>' +
      '<span>' + etiqueta + '</span>' +
    '</label>';

  $sim('sim-apariencia-form').innerHTML = '' +
    '<div class="admin-apariencia-bloque">' +
      '<div class="admin-apariencia-titulo">Imagem de fundo e logo</div>' +
      '<p class="admin-apariencia-ayuda">Não disponível nesta demonstração.</p>' +
    '</div>' +

    '<div class="admin-apariencia-bloque">' +
      '<div class="admin-apariencia-titulo">Cores</div>' +
      '<div class="admin-apariencia-color-fila">' +
        '<label for="sim-color-barra-fondo">Cor da barra</label>' +
        '<input type="color" id="sim-color-barra-fondo" value="' + ap.colorBarraFondo + '">' +
      '</div>' +
      '<div class="admin-apariencia-color-fila">' +
        '<label for="sim-color-barra-texto">Cor das letras da barra</label>' +
        '<input type="color" id="sim-color-barra-texto" value="' + ap.colorBarraTexto + '">' +
      '</div>' +
      '<div class="admin-apariencia-color-fila">' +
        '<label for="sim-color-fondo-pagina">Cor de fundo do catálogo</label>' +
        '<input type="color" id="sim-color-fondo-pagina" value="' + ap.colorFondoPagina + '">' +
      '</div>' +
    '</div>' +

    '<div class="admin-apariencia-bloque">' +
      '<div class="admin-apariencia-titulo">Tipografia</div>' +
      '<div class="admin-apariencia-tipografia-fila">' +
        '<select id="sim-select-tipografia">' + opcionesTipografia + '</select>' +
      '</div>' +
    '</div>' +

    '<div class="admin-apariencia-bloque">' +
      '<div class="admin-apariencia-titulo">Formato das categorias</div>' +
      '<div class="admin-apariencia-opciones">' +
        opcionForma('sim-forma-categorias', ap.formaCategorias, 'circular', 'forma-circular', 'Circular') +
        opcionForma('sim-forma-categorias', ap.formaCategorias, 'cuadrada', 'forma-cuadrada', 'Quadrada') +
        opcionForma('sim-forma-categorias', ap.formaCategorias, 'columna', 'forma-columna', 'Em coluna') +
      '</div>' +
    '</div>' +

    '<div class="admin-apariencia-bloque">' +
      '<div class="admin-apariencia-titulo">Formato dos produtos</div>' +
      '<div class="admin-apariencia-opciones">' +
        opcionForma('sim-forma-productos', ap.formaProductos, 'grid-cuadrado', 'forma-cuadrada', 'Grade quadrada') +
        opcionForma('sim-forma-productos', ap.formaProductos, 'grid-circular', 'forma-circular', 'Grade circular') +
        opcionForma('sim-forma-productos', ap.formaProductos, 'columna', 'forma-columna', 'Em coluna') +
      '</div>' +
    '</div>';

  $sim('sim-color-barra-fondo').addEventListener('input', (e) => { ap.colorBarraFondo = e.target.value; simActualizarPreview(); });
  $sim('sim-color-barra-texto').addEventListener('input', (e) => { ap.colorBarraTexto = e.target.value; simActualizarPreview(); });
  $sim('sim-color-fondo-pagina').addEventListener('input', (e) => { ap.colorFondoPagina = e.target.value; simActualizarPreview(); });
  $sim('sim-select-tipografia').addEventListener('change', (e) => { ap.tipografia = e.target.value; simActualizarPreview(); });
  document.querySelectorAll('input[name="sim-forma-categorias"]').forEach(r =>
    r.addEventListener('change', (e) => { ap.formaCategorias = e.target.value; simActualizarPreview(); }));
  document.querySelectorAll('input[name="sim-forma-productos"]').forEach(r =>
    r.addEventListener('change', (e) => { ap.formaProductos = e.target.value; simActualizarPreview(); }));
}

// Los radios de "forma de productos" usan los valores 'grid-cuadrado' /
// 'grid-circular' / 'columna' (mismos ids que el admin real), pero las
// clases CSS del mini-preview son las genéricas 'sim-forma-cuadrada' /
// 'sim-forma-circular' / 'sim-forma-columna' (compartidas con la forma
// de categorías, que sí usa esos nombres tal cual) — este mapeo evita
// generar una clase inexistente como "sim-forma-grid-circular".
const SIM_MAPA_FORMA_PRODUCTO = {
  'grid-cuadrado': 'cuadrada',
  'grid-circular': 'circular',
  'columna': 'columna',
};

function simActualizarPreview() {
  const ap = SIM_ESTADO.apariencia;
  const tipografia = buscarTipografia(ap.tipografia);
  const contenedor = $sim('sim-preview');

  contenedor.style.setProperty('--sim-color-barra', ap.colorBarraFondo);
  contenedor.style.setProperty('--sim-color-barra-texto', ap.colorBarraTexto);
  contenedor.style.setProperty('--sim-color-fondo', ap.colorFondoPagina);
  contenedor.style.fontFamily = tipografia ? tipografia.pilaCuerpo : 'inherit';

  const categoriasPreview = SIM_ESTADO.categorias.slice(0, 3).map(cat =>
    '<div class="sim-preview-categoria sim-forma-' + ap.formaCategorias + '" style="background-color:' + simLimpiar(cat.color) + '">' +
      '<span>' + simLimpiar(cat.nombre) + '</span>' +
    '</div>'
  ).join('');

  const productosPreview = SIM_ESTADO.productos.slice(0, 3).map(prod =>
    '<div class="sim-preview-producto sim-forma-' + SIM_MAPA_FORMA_PRODUCTO[ap.formaProductos] + '">' +
      '<div class="sim-preview-producto-img"></div>' +
      '<div class="sim-preview-producto-nombre">' + simLimpiar(prod.nombre) + '</div>' +
      '<div class="sim-preview-producto-precio">R$' + prod.precio + '</div>' +
    '</div>'
  ).join('');

  contenedor.innerHTML = '' +
    '<div class="sim-preview-barra" style="background:var(--sim-color-barra);color:var(--sim-color-barra-texto);font-family:' + (tipografia ? tipografia.pilaTitulo : 'inherit') + '">Seu Negócio</div>' +
    '<div class="sim-preview-cuerpo" style="background:var(--sim-color-fondo)">' +
      '<div class="sim-preview-seccion-titulo" style="font-family:' + (tipografia ? tipografia.pilaTitulo : 'inherit') + '">Categorias</div>' +
      '<div class="sim-preview-fila-categorias">' + categoriasPreview + '</div>' +
      '<div class="sim-preview-seccion-titulo" style="font-family:' + (tipografia ? tipografia.pilaTitulo : 'inherit') + '">Produtos</div>' +
      '<div class="sim-preview-fila-productos">' + productosPreview + '</div>' +
    '</div>';
}

/* ============================================================
   MÉTRICAS - mismos bloques que la pestaña real (js/admin.js,
   cargarMisMetricas) y mismas clases de css/admin.css, con números de
   ejemplo fijos. Las listas de categorías y productos se arman con lo
   que haya en SIM_ESTADO, así que acompañan lo que el visitante cree o
   borre en las otras pestañas.
   ============================================================ */

const SIM_METRICAS = {
  visitasTotales: 1284,
  visitantesNuevos: 742,
  visitantesRecurrentes: 218,
  picoSimultaneo: 14,
  agregadosCarrito: 312,
  pedidosEnviados: 87,
  valorPedidos: 12430,
  carritosNoFinalizados: 61,
  // Vistas de cada categoría/producto según su posición en el panel (de mayor a menor).
  vistasCategorias: [310, 260, 190, 140, 90, 60, 40, 25, 15, 10],
  vistasProductos: [142, 118, 96, 71, 54, 39, 28, 20, 14, 9],
  // Últimos 14 días, del más viejo al más nuevo: [visitas, visitantes únicos, visitantes nuevos].
  diarias: [
    [38, 31, 24], [41, 33, 25], [35, 28, 21], [44, 35, 27], [52, 41, 31], [61, 48, 37], [58, 46, 35],
    [40, 32, 24], [43, 34, 26], [39, 31, 23], [47, 37, 28], [55, 44, 33], [66, 52, 40], [63, 50, 38],
  ],
};

function simFormatearNumero(n) {
  return n.toLocaleString('pt-BR');
}

function simFechaAAAAMMDD(fecha) {
  const dos = (n) => String(n).padStart(2, '0');
  return fecha.getFullYear() + '-' + dos(fecha.getMonth() + 1) + '-' + dos(fecha.getDate());
}

function simFilaMetrica(nombre, numero, detalle) {
  return '' +
    '<div class="metrica-fila">' +
      '<span class="metrica-nombre">' + nombre + '</span>' +
      '<span class="metrica-numero">' + simFormatearNumero(numero) + '</span>' +
      (detalle ? '<span class="metrica-detalle">' + detalle + '</span>' : '') +
    '</div>';
}

function simFilaPopulares(titulo, items) {
  const total = items.reduce((suma, it) => suma + it.vistas, 0);
  const lista = items.length
    ? '<ul class="metrica-populares-lista">' +
        items.map(it => '<li><span>' + simLimpiar(it.nombre) + '</span><span class="metrica-numero">' + it.vistas + '</span></li>').join('') +
      '</ul>'
    : '<p class="metrica-diaria-cargando">Sem dados nos últimos 30 dias.</p>';

  return '' +
    '<details class="metrica-fila metrica-populares">' +
      '<summary class="metrica-populares-resumen">' +
        '<span class="metrica-nombre">' + titulo + '</span>' +
        '<span class="metrica-numero">' + simFormatearNumero(total) + '</span>' +
      '</summary>' +
      '<div class="metrica-populares-cuerpo">' + lista + '</div>' +
    '</details>';
}

function simDibujarMetricas() {
  const m = SIM_METRICAS;

  const categorias = SIM_ESTADO.categorias.slice(0, m.vistasCategorias.length)
    .map((c, i) => ({ nombre: c.nombre, vistas: m.vistasCategorias[i] }));
  const productos = SIM_ESTADO.productos.slice(0, m.vistasProductos.length)
    .map((p, i) => ({ nombre: p.nombre, vistas: m.vistasProductos[i] }));

  const hoy = Date.now();
  const filasDias = m.diarias.map((d, i) => {
    const fecha = new Date(hoy - (m.diarias.length - 1 - i) * 86400000);
    return '<tr><td>' + simFechaAAAAMMDD(fecha) + '</td><td>' + d[0] + '</td><td>' + d[2] + '</td><td>' + (d[1] - d[2]) + '</td></tr>';
  }).join('');

  $sim('sim-metricas').innerHTML = '' +
    '<p class="admin-apariencia-ayuda">Números de exemplo. As métricas fazem parte do Plano Premium.</p>' +
    '<div class="metrica-negocio-cuerpo">' +
      simFilaMetrica('Visitas totais', m.visitasTotales) +
      simFilaMetrica('Visitantes novos', m.visitantesNuevos) +
      simFilaMetrica('Visitantes recorrentes', m.visitantesRecurrentes) +
      simFilaMetrica('Pico de usuários simultâneos (últimas 24h)', m.picoSimultaneo) +
      simFilaPopulares('Categorias visualizadas', categorias) +
      simFilaPopulares('Produtos visualizados', productos) +
      simFilaMetrica('Produtos adicionados ao carrinho', m.agregadosCarrito) +
      simFilaMetrica('Pedidos enviados pelo WhatsApp', m.pedidosEnviados, 'Valor total dos pedidos: R$' + simFormatearNumero(m.valorPedidos)) +
      simFilaMetrica('Carrinhos não finalizados', m.carritosNoFinalizados) +
      '<div class="metrica-diaria-header">' +
        '<span>Últimos 14 dias</span>' +
        '<button class="metrica-btn-exportar" id="sim-btn-exportar-metricas" type="button">Exportar para Excel</button>' +
      '</div>' +
      '<div class="metrica-diaria-cuerpo">' +
        '<table class="metrica-tabla-diaria">' +
          '<thead><tr><th>Dia</th><th>Visitas</th><th>Novos</th><th>Recorrentes</th></tr></thead>' +
          '<tbody>' + filasDias + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

  $sim('sim-btn-exportar-metricas').addEventListener('click', () => {
    alert('A exportação para Excel não está disponível nesta demonstração.');
  });
}
