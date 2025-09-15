// assets/js/carro.js
// Vista del carro + pago con submit de formulario (sin pagos accidentales)

requireAuth?.({ soft: true }); // si no hay sesión, te enviará a login y guardará retorno

import {
  getCart,
  setQty,
  removeFromCart,
  clearCart,
  getCatalogProducts,
  checkout
} from './cart.js';

function moneyCLP(num) {
  return Number(num || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// email desde input #email o sesión
function getCustomerEmail() {
  const input = document.getElementById('email');
  if (input && input.value) return String(input.value).trim().toLowerCase();
  try {
    const s = JSON.parse(localStorage.getItem('app_session') || 'null');
    if (s?.correo) return String(s.correo).toLowerCase();
  } catch {}
  return '';
}

// Une carrito con catálogo (Admin + estáticos)
function computeLines() {
  const catalog = getCatalogProducts(); // [{id,title,price...}]
  return getCart().map(ci => {
    const p = catalog.find(x => String(x.id) === String(ci.productId));
    if (!p) return null;
    const precio = Number(p.price || 0);
    return {
      ...ci,
      titulo: p.title,
      precio,
      subtotal: precio * Number(ci.qty || 0),
    };
  }).filter(Boolean);
}

function render() {
  const container = document.getElementById('carroView');
  if (!container) return;

  const lines = computeLines();
  if (!lines.length) {
    container.innerHTML = `<div class="alert alert-info">Tu carro está vacío.</div>`;
    return;
  }

  const total = lines.reduce((a, b) => a + b.subtotal, 0);
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Plano</th>
            <th class="text-end">Precio</th>
            <th style="width:120px">Cantidad</th>
            <th class="text-end">Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${lines.map(l => `
            <tr>
              <td>${l.titulo}</td>
              <td class="text-end">${moneyCLP(l.precio)}</td>
              <td>
                <input type="number" min="1" value="${l.qty}" class="form-control form-control-sm" data-qty="${l.productId}">
              </td>
              <td class="text-end">${moneyCLP(l.subtotal)}</td>
              <td>
                <button type="button" class="btn btn-sm btn-outline-danger" data-del="${l.productId}">Quitar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="3" class="text-end">Total</th>
            <th class="text-end">${moneyCLP(total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function bind() {
  const root = document.getElementById('carroView');
  if (!root) return;

  // Cambiar cantidades
  root.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-qty]');
    if (!inp) return;
    const id = inp.dataset.qty;
    const qty = Number(inp.value || 1);
    setQty(id, qty);
    render();
  });

  // Quitar ítem
  root.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    removeFromCart(del.dataset.del);
    render();
  });

  // Vaciar (opcional)
  document.getElementById('btnVaciar')?.addEventListener('click', () => {
    clearCart();
    render();
  });

  // === Pago solo en submit del formulario ===
  const form = document.getElementById('formPagar');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Evitar “pago” si no hay ítems
      if (!getCart().length) {
        alert('Tu carro está vacío.');
        return;
      }

      // Confirmación explícita
      if (!confirm('¿Confirmar pago?')) return;

      try {
        const email = getCustomerEmail();
        const order = checkout({ email }); // guarda en localStorage['shop_orders'] y limpia carro
        render();
        alert(`¡Gracias! Orden #${order.id} registrada.`);
        window.location.href = '../partials/cuenta.html'; // o página de "gracias"
      } catch (err) {
        alert(err?.message || 'No se pudo completar la compra');
      }
    });
  }
}

(function init() {
  render();
  bind();
})();
