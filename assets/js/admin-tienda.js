// assets/js/admin-tienda.js
import { ensureSeed, getProducts, upsertProduct, deleteProduct, createProductFromForm } from './store.js';

(function guard() {
  // Usa tu helper de auth.js si está disponible
  if (typeof requireAuth === 'function') {
    const s = requireAuth({ allow: ['admin'] });
    if (!s) return; // redirigido
  }
})();

function moneyCLP(num) {
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

function renderTable() {
  const tbody = document.querySelector('#tblProductos tbody');
  tbody.innerHTML = getProducts().map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.titulo}</td>
      <td>${moneyCLP(p.precio)}</td>
      <td>${(p.categorias || []).join(', ')}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-edit="${p.id}">Editar</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${p.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function loadToForm(p) {
  const f = document.getElementById('frmProducto');
  f.id.value = p.id;
  f.titulo.value = p.titulo;
  f.precio.value = p.precio;
  f.slug.value = p.slug || '';
  f.categorias.value = (p.categorias || []).join(', ');
  f.includes.value = (p.includes || []).join(', ');
  f.thumbnail.value = p.thumbnail || '';
  f.descripcion.value = p.descripcion || '';
}

function bind() {
  const f = document.getElementById('frmProducto');

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const p = createProductFromForm(fd);
    upsertProduct(p);
    f.reset();
    renderTable();
  });

  document.getElementById('tblProductos').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');

    if (edit) {
      const id = edit.dataset.edit;
      const p = getProducts().find(x => x.id === id);
      if (p) loadToForm(p);
    }
    if (del) {
      const id = del.dataset.del;
      if (confirm('¿Eliminar producto?')) {
        deleteProduct(id);
        renderTable();
      }
    }
  });
}

(function init() {
  ensureSeed();
  renderTable();
  bind();
})();
