// assets/js/store.js
// ------------------------------------------------------
// Tienda: unir seed (shop_products) + Admin (store_products) sin romper checkout/carro
// - getProducts(): devuelve TODOS (seed + admin) en formato UI {id, titulo, precio, thumbnail, descripcion}
// - Si solo hay seed, lo refleja en Admin para que checkout encuentre precios
// - Sin cambiar cart/checkout
// ------------------------------------------------------

export const LS_PRODUCTS_OLD = 'shop_products';   // seed/legado: {id,titulo,precio,thumbnail,descripcion,...}
export const LS_PRODUCTS     = 'store_products';  // admin: {id,modelo,precio,categoria,img}

const readJSON = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v || []));

function readAdmin() { return readJSON(LS_PRODUCTS, []); }
function readSeed()  { return readJSON(LS_PRODUCTS_OLD, []); }

function seedDefaults() {
  return [
    { id: 'PLN-0001', titulo: 'Casa moderna 120 m²', precio: 129000, categorias:['residencial'], thumbnail: 'assets/img/planos/casa120.jpg', descripcion: 'Ideal para familias pequeñas.' },
    { id: 'PLN-0002', titulo: 'Casa compacta 80 m²', precio:  89000, categorias:['compacta'],    thumbnail: 'assets/img/planos/casa80.jpg',  descripcion: 'Ideal para terrenos pequeños.' }
  ];
}

// Si no hay NINGÚN inventario, crea seed en shop_products
function ensureSeedMinimal() {
  const a = readAdmin(), s = readSeed();
  if ((a?.length || 0) === 0 && (s?.length || 0) === 0) {
    writeJSON(LS_PRODUCTS_OLD, seedDefaults());
  }
}

// Mapea un producto seed -> esquema admin (para reflejar en store_products)
function mapSeedToAdmin(p) {
  return {
    id: String(p.id),
    modelo: p.titulo ?? 'Producto',
    precio: Number(p.precio || 0),
    categoria: Array.isArray(p.categorias) && p.categorias.length ? p.categorias[0] : 'General',
    img: p.thumbnail || p.img || 'assets/img/planos/placeholder.jpg',
    _legacy: { descripcion: p.descripcion || '' }
  };
}

// Asegura que todo lo del seed esté también en Admin (si falta)
// → así checkout (que ya te funciona) encuentra precios y evita totales 0
function ensureUnionInAdmin() {
  const admin = readAdmin();
  const seed  = readSeed();
  if (!Array.isArray(seed) || seed.length === 0) return;

  const adminIds = new Set(admin.map(p => String(p.id)));
  let changed = false;

  seed.forEach(p => {
    const id = String(p.id);
    if (!adminIds.has(id)) {
      admin.push(mapSeedToAdmin(p));
      adminIds.add(id);
      changed = true;
    }
  });

  if (changed) writeJSON(LS_PRODUCTS, admin);
}

// ---- API: devolver TODOS los productos en formato UI para la tienda ----
export function getProducts() {
  // 1) asegurar que exista algo
  ensureSeedMinimal();

  // 2) reflejar seed faltante en admin (no duplica IDs)
  ensureUnionInAdmin();

  // 3) unir ambos catálogos para la UI (prefiere Admin en choques)
  const admin = readAdmin(); // {id,modelo,precio,categoria,img}
  const seed  = readSeed();  // {id,titulo,precio,thumbnail,descripcion,...}

  const byId = new Map();

  // Primero seed…
  seed.forEach(p => {
    byId.set(String(p.id), {
      id: String(p.id),
      titulo: p.titulo ?? 'Producto',
      precio: Number(p.precio || 0),
      thumbnail: p.thumbnail || p.img || 'assets/img/planos/placeholder.jpg',
      descripcion: p.descripcion || (Array.isArray(p.categorias) ? p.categorias.join(', ') : '')
    });
  });

  // …luego Admin pisa (prioridad)
  admin.forEach(p => {
    byId.set(String(p.id), {
      id: String(p.id),
      titulo: p.modelo ?? 'Producto',
      precio: Number(p.precio || 0),
      thumbnail: p.img || 'assets/img/planos/placeholder.jpg',
      descripcion: p.categoria || ''
    });
  });

  return Array.from(byId.values());
}

// ---- Escritura: operan sobre el inventario del Admin ----
export function saveProducts(list) {
  writeJSON(LS_PRODUCTS, (list || []).map(toAdminSchema));
}
export function upsertProduct(p) {
  const items = readAdmin();
  const prod = toAdminSchema(p);
  const i = items.findIndex(x => String(x.id) === String(prod.id));
  if (i >= 0) items[i] = prod; else items.push(prod);
  writeJSON(LS_PRODUCTS, items);
}
export function deleteProduct(id) {
  writeJSON(LS_PRODUCTS, readAdmin().filter(x => String(x.id) !== String(id)));
}

// ---- Helpers de escritura ----
function nextId(prefix = 'PLN-') {
  const n = (readAdmin().length + 1);
  return prefix + String(n).padStart(4, '0');
}
function toAdminSchema(p) {
  return {
    id: String(p.id ?? nextId()),
    modelo: p.modelo ?? p.titulo ?? p.title ?? 'Producto',
    precio: Number(p.precio ?? p.price ?? 0),
    categoria: p.categoria ?? (Array.isArray(p.categorias) ? p.categorias[0] : (p.category || 'General')),
    img: p.img ?? p.thumbnail ?? p.image ?? 'assets/img/planos/placeholder.jpg'
  };
}

// ---- Creador desde form (compat) ----
export function createProductFromForm(formData) {
  const titulo = (formData.get('titulo') || formData.get('modelo') || '').trim();
  const precio = Number(formData.get('precio') || formData.get('price') || 0);
  const categoriasStr = (formData.get('categorias') || '').trim();
  const categoria = categoriasStr
    ? categoriasStr.split(',').map(s=>s.trim()).filter(Boolean)[0]
    : (formData.get('categoria') || 'General');
  const thumbnail = formData.get('thumbnail') || formData.get('img') || 'assets/img/planos/placeholder.jpg';

  return {
    id: formData.get('id') || nextId(),
    titulo,
    precio,
    categorias: categoriasStr ? categoriasStr.split(',').map(s=>s.trim()).filter(Boolean) : [],
    thumbnail,
    includes: (formData.get('includes') || '').split(',').map(s=>s.trim()).filter(Boolean),
    descripcion: formData.get('descripcion') || '',
    slug: (formData.get('slug') || titulo).toLowerCase().replaceAll(' ', '-').replace(/[^\w-]/g, '')
  };
}

// ---- Semilla pública: deja todo listo (seed + reflejo en admin) ----
export function ensureSeed() {
  ensureSeedMinimal();
  ensureUnionInAdmin();
}
