// assets/js/cart.js
// ======================================================
// Carrito de compras + sincronización de badge (#cart-count)
// + compatibilidad con Admin (productos/órdenes en LocalStorage)
// ======================================================

const LS_CART       = 'shop_cart';
const LS_CART_COUNT = 'cartCount';
const LS_ORDERS     = 'shop_orders';     // usado por Admin
const LS_PRODUCTS   = 'store_products';  // inventario desde Admin

// ---------- Helpers ----------
function saveCart(items) {
  localStorage.setItem(LS_CART, JSON.stringify(items));

  // Actualiza contador total (suma de cantidades numéricas)
  const count = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  localStorage.setItem(LS_CART_COUNT, String(count));

  // Notifica a la app que el carro cambió (misma pestaña)
  try {
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: { count, items } }));
  } catch (_) {
    // navegadores antiguos sin CustomEvent → ignorar
  }
  return count;
}

function uid() {
  return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
}

// ---------- CRUD del Carro ----------
export function getCart() {
  return JSON.parse(localStorage.getItem(LS_CART) || '[]'); // [{productId, qty}]
}

export function addToCart(productId, qty = 1) {
  const cart = getCart();
  const i = cart.findIndex(x => String(x.productId) === String(productId));
  if (i >= 0) {
    cart[i].qty = (Number(cart[i].qty) || 0) + (Number(qty) || 0);
  } else {
    cart.push({ productId: String(productId), qty: Number(qty) || 0 });
  }
  return saveCart(cart);
}

export function removeFromCart(productId) {
  return saveCart(getCart().filter(x => String(x.productId) !== String(productId)));
}

export function setQty(productId, qty) {
  const cart = getCart();
  const i = cart.findIndex(x => String(x.productId) === String(productId));
  if (i >= 0) {
    cart[i].qty = Math.max(1, Number(qty) | 0);
    return saveCart(cart);
  }
  return Number(localStorage.getItem(LS_CART_COUNT) || 0);
}

export function clearCart() {
  return saveCart([]);
}

// ---------- Catálogo (Admin + estáticos) ----------
function mapAdminProduct(p) {
  return {
    id: String(p.id),
    title: p.modelo,
    price: Number(p.precio || 0),
    image: p.img || '',
    category: p.categoria || 'General'
  };
}

/**
 * Retorna todos los productos disponibles (Admin + estáticos window.bikeData/shopProducts)
 */
export function getCatalogProducts() {
  const adminList = JSON.parse(localStorage.getItem(LS_PRODUCTS) || '[]').map(mapAdminProduct);

  const staticList =
    (Array.isArray(window.bikeData) ? window.bikeData :
    (Array.isArray(window.shopProducts) ? window.shopProducts : []));

  const normalizedStatic = staticList.map(x => ({
    id: String(x.id ?? x.productId ?? uid()),
    title: x.title ?? x.modelo ?? x.name ?? 'Producto',
    price: Number(x.price ?? x.precio ?? 0),
    image: x.image ?? x.img ?? '',
    category: x.category ?? x.categoria ?? 'General',
  }));

  // Merge por id (prioriza Admin)
  const byId = new Map();
  normalizedStatic.forEach(p => byId.set(String(p.id), p));
  adminList.forEach(p => byId.set(String(p.id), p));
  return Array.from(byId.values());
}

function findProductById(productId) {
  return getCatalogProducts().find(p => String(p.id) === String(productId));
}

// ---------- Checkout ----------
/**
 * Crea una orden a partir del carrito y la guarda en LocalStorage (shop_orders).
 * @param {Object} customer { email, name?, address? } → email es lo importante
 * @returns {Object} order creada
 */
export function checkout(customer = {}) {
  const cart = getCart(); // [{productId, qty}]
  if (!cart.length) throw new Error('El carro está vacío');

  const items = cart.map(it => {
    const p = findProductById(it.productId);
    const price = p ? Number(p.price || 0) : 0;
    return { productId: String(it.productId), qty: Number(it.qty || 0), price };
  });

  const total = items.reduce((acc, it) => acc + it.qty * it.price, 0);

  // Email del cliente: primero lo que pasen, luego sesión si existe
  let email = (customer.email || '').trim().toLowerCase();
  try {
    const s = JSON.parse(localStorage.getItem('app_session') || 'null');
    if (!email && s?.correo) email = String(s.correo).toLowerCase();
  } catch {}

  const order = {
    id: uid(),
    date: Date.now(),
    email: email || '-',
    items,
    total,
    status: 'pending'
  };

  const orders = JSON.parse(localStorage.getItem(LS_ORDERS) || '[]');
  orders.push(order);
  localStorage.setItem(LS_ORDERS, JSON.stringify(orders));

  // Limpia el carro
  saveCart([]);

  return order;
}
