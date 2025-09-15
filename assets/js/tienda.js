// assets/js/tienda.js

requireAuth(); // acceso normal

// 1) Mantenemos tu seed estático por compatibilidad
import { ensureSeed, getProducts as getStaticProducts } from './store.js';

// 2) Catálogo unificado (Admin + estáticos) y Add to cart
import { getCatalogProducts, addToCart } from './cart.js';

function moneyCLP(num) {
  return Number(num || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// Adaptador a tu tarjeta (titulo, precio, thumbnail, descripcion)
function toCardModel(p) {
  // p puede venir del Admin (title, price, image, category)
  // o del estático (titulo, precio, thumbnail, descripcion)
  return {
    id: String(p.id),
    titulo: p.titulo ?? p.title ?? 'Producto',
    precio: Number(p.precio ?? p.price ?? 0),
    thumbnail: p.thumbnail ?? p.image ?? 'assets/img/placeholder.jpg',
    descripcion: p.descripcion ?? p.category ?? ''
  };
}

function card(p) {
  const base = location.pathname.includes('/partials/') ? '..' : '.';
  return `
  <div class="col-12 col-sm-6 col-lg-4">
    <div class="card h-100">
      <img src="${base}/${p.thumbnail}" class="card-img-top" alt="${p.titulo}">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title">${p.titulo}</h5>
        <p class="text-muted mb-2">${moneyCLP(p.precio)}</p>
        <p class="small flex-grow-1">${p.descripcion || ''}</p>
        <button type="button" class="btn btn-dark w-100" data-add="${p.id}">Agregar al carro</button>
      </div>
    </div>
  </div>`;
}

function bindEvents(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    addToCart(btn.dataset.add, 1);

    // feedback rápido
    const old = btn.textContent;
    btn.textContent = '¡Agregado!';
    setTimeout(() => (btn.textContent = old), 900);

    if (navigator.vibrate) navigator.vibrate(15);
  });
}

(function init() {
  // 1) Mantiene tu semilla (por si no hay nada en Admin)
  ensureSeed?.();

  // 2) Toma productos del Admin (store_products) y mezcla con estáticos
  const adminProds = getCatalogProducts(); // [{id,title,price,image,category}] + estáticos detectados si definiste window.bikeData/shopProducts
  // Si quieres FORZAR a incluir explícitamente tus estáticos de store.js además del admin:
  const staticProds = getStaticProducts?.() || []; // [{id,titulo,precio,thumbnail,descripcion}]

  // Merge por id (prioriza Admin sobre estáticos de store.js)
  const byId = new Map();
  staticProds.forEach(p => byId.set(String(p.id), toCardModel(p)));
  adminProds.forEach(p => byId.set(String(p.id), toCardModel(p)));

  const items = Array.from(byId.values());

  const grid = document.getElementById('gridTienda');
  grid.innerHTML = items.map(card).join('');
  bindEvents(grid);
})();

document.getElementById('app-main')?.removeAttribute('hidden');
