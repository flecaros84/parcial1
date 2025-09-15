// assets/js/admin.js
// Panel Admin (Bootstrap) - Dashboard + Órdenes + Inventario (Planos) + Usuarios
// Lee/escribe de LocalStorage. Ajusta las CLAVES si tus scripts usan otras.

import { getCatalogProducts } from './cart.js';

const LS = {
  USERS: 'app_users',        // [{id,nombre,correo|email,rol|role,active,creadoEn|createdAt}]
  ORDERS: 'shop_orders',     // [{id,date,email,items:[{productId,qty,price}],total,status}]
  PRODUCTS: 'store_products' // [{id,modelo,precio,categoria,img}]
};

// ---------- Utiles ----------
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
const read  = (k, fallback=[]) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const fmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// ---------- Guard de acceso (usa helpers de auth.js) ----------
const _session =
  (typeof window.requireAuth === 'function')
    ? window.requireAuth({ allow: ['admin'] })   // redirige si NO eres admin
    : JSON.parse(localStorage.getItem('app_session') || 'null'); // fallback para pruebas

if (!_session) {
  // requireAuth ya guardó el retorno y redirigió a login; detenemos el script
  throw new Error('Redirecting to login');
}

// ---------- Sidebar / navegación de vistas ----------
const views = $$('[data-view]');
const links = $$('a.nav-link[data-section]');
function show(section){
  views.forEach(v => v.classList.toggle('d-none', v.getAttribute('data-view') !== section));
  links.forEach(a => a.classList.toggle('active', a.getAttribute('data-section') === section));
  localStorage.setItem('admin_last_view', section);
}
links.forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.section); }));
show(localStorage.getItem('admin_last_view') || 'dashboard');

// Sidebar móvil
$$('[data-admin="toggle"]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    $('#sidebar').classList.toggle('show');
    $('#backdrop').classList.toggle('show');
  });
});
$('#backdrop')?.addEventListener('click',()=>{
  $('#sidebar')?.classList.remove('show');
  $('#backdrop')?.classList.remove('show');
});

// Logout (usa auth.js)
$('#logoutBtn')?.addEventListener('click', (e)=>{
  e.preventDefault();
  if (typeof window.logout === 'function') window.logout();
  else { localStorage.removeItem('app_session'); location.href = '../index.html'; }
});

// ---------- Dashboard ----------
function renderDashboard(){
  const users  = read(LS.USERS);
  const orders = read(LS.ORDERS);
  const prods  = read(LS.PRODUCTS);

  $('#kpiUsers').textContent = users.length;
  $('#kpiOrders').textContent = orders.length;
  $('#kpiProducts').textContent = prods.length;

  const tbody = $('#dashLastOrders');
  if (!tbody) return;
  tbody.innerHTML = '';
  orders.slice(-5).reverse().forEach(o=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${new Date(o.date||Date.now()).toLocaleString()}</td>
      <td>${o.email||'-'}</td>
      <td>${fmt.format(o.total||0)}</td>
      <td><span class="badge text-bg-${badgeFor(o.status)}">${o.status||'pending'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
const badgeFor = (status='pending')=>(
  { pending:'secondary', paid:'primary', shipped:'success', cancelled:'danger' }[status] || 'secondary'
);

// ---------- Órdenes ----------
const STATUS = ['pending','paid','shipped','cancelled'];

function renderOrders(filter=''){
  const tbody = $('#ordersTbody'); if (!tbody) return;
  const orders = read(LS.ORDERS);
  const term = filter.trim().toLowerCase();
  const catalog = getCatalogProducts();
  const byId = new Map(catalog.map(p => [String(p.id), p]));

  tbody.innerHTML = '';

  orders
    .filter(o => !term || String(o.id).includes(term) || (o.email||'').toLowerCase().includes(term))
    .sort((a,b)=> (b.date||0)-(a.date||0))
    .forEach(o=>{
      const itemsTxt = (o.items||[])
        .map(it => {
          const p = byId.get(String(it.productId));
          const title = p?.title || p?.titulo || it.productId;
          return `${title} ×${it.qty}`;
        })
        .join(', ');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.id}</td>
        <td>${new Date(o.date||Date.now()).toLocaleString()}</td>
        <td>${o.email||'-'}</td>
        <td class="small">${itemsTxt || '-'}</td>
        <td>${fmt.format(o.total||0)}</td>
        <td>
          <select class="form-select form-select-sm" data-act="status" data-id="${o.id}">
            ${STATUS.map(s=>`<option ${s===(o.status||'pending')?'selected':''} value="${s}">${s}</option>`).join('')}
          </select>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary me-1" data-act="view-order" data-id="${o.id}">
            Ver
          </button>
          <button class="btn btn-sm btn-outline-danger" data-act="del-order" data-id="${o.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

$('#searchOrders')?.addEventListener('input', e=> renderOrders(e.target.value));
$('#ordersTbody')?.addEventListener('change', e=>{
  const el = e.target.closest('[data-act="status"]'); if(!el) return;
  const id = el.dataset.id;
  const orders = read(LS.ORDERS);
  const ix = orders.findIndex(x=>String(x.id)===String(id));
  if (ix>=0){ orders[ix].status = el.value; write(LS.ORDERS, orders); renderDashboard(); }
});
$('#ordersTbody')?.addEventListener('click', e=>{
  const btn = e.target.closest('[data-act="del-order"]'); if(!btn) return;
  const id = btn.dataset.id;
  let orders = read(LS.ORDERS).filter(x=>String(x.id)!==String(id));
  write(LS.ORDERS, orders);
  renderOrders($('#searchOrders')?.value || '');
  renderDashboard();
});
$('#ordersTbody')?.addEventListener('click', (e)=>{
  const view = e.target.closest('[data-act="view-order"]');
  if (!view) return;

  const id = view.dataset.id;
  const o = read(LS.ORDERS).find(x=> String(x.id) === String(id));
  if (!o) return;

  const catalog = getCatalogProducts();
  const byId = new Map(catalog.map(p => [String(p.id), p]));
  const lines = (o.items||[]).map(it => {
    const p = byId.get(String(it.productId));
    const title = p?.title || p?.titulo || it.productId;
    const unit = Number(it.price||0);
    const sub = unit * Number(it.qty||0);
    return `• ${title} — ${it.qty} × ${fmt.format(unit)} = ${fmt.format(sub)}`;
  }).join('\n');

  alert(`Orden #${o.id}\nFecha: ${new Date(o.date).toLocaleString()}\nCliente: ${o.email}\n\n${lines}\n\nTotal: ${fmt.format(o.total||0)}\nEstado: ${o.status||'pending'}`);
});

// ---------- Inventario (Planos) ----------
function uid(){ return Math.floor(Date.now()/1000) + Math.floor(Math.random()*1000); }

function renderProducts(){
  const tbody = $('#productsTbody');
  if (!tbody) return;
  const prods = read(LS.PRODUCTS);
  tbody.innerHTML = '';
  prods.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.modelo}</td>
      <td>${fmt.format(p.precio||0)}</td>
      <td>${p.categoria||'-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-act="edit-prod" data-id="${p.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-act="del-prod" data-id="${p.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

$('#productsTbody')?.addEventListener('click', e=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const id  = btn.dataset.id;
  if (btn.dataset.act === 'del-prod'){
    const list = read(LS.PRODUCTS).filter(p=>String(p.id)!==String(id));
    write(LS.PRODUCTS, list);
    renderProducts(); renderDashboard();
  } else if (btn.dataset.act === 'edit-prod'){
    const p = read(LS.PRODUCTS).find(p=>String(p.id)===String(id));
    if (!p) return;
    $('#prodId').value = p.id;
    $('#prodModelo').value = p.modelo||'';
    $('#prodPrecio').value = p.precio||0;
    $('#prodCategoria').value = p.categoria||'';
    $('#prodImg').value = p.img||'';
    show('inventory');
    window.scrollTo({top:0,behavior:'smooth'});
  }
});

$('#btnFormReset')?.addEventListener('click',()=>{ $('#prodId').value = ''; });

$('#productForm')?.addEventListener('submit', e=>{
  e.preventDefault();
  const id = $('#prodId').value || uid();
  const next = {
    id,
    modelo: $('#prodModelo').value.trim(),
    precio: Number($('#prodPrecio').value || 0),
    categoria: $('#prodCategoria').value.trim(),
    img: $('#prodImg').value.trim()
  };
  const list = read(LS.PRODUCTS);
  const ix = list.findIndex(p=>String(p.id)===String(id));
  if (ix>=0) list[ix] = next; else list.push(next);
  write(LS.PRODUCTS, list);
  (e.target).reset(); $('#prodId').value='';
  renderProducts(); renderDashboard();
});

// ---------- Usuarios ----------
function normalizeUser(u){
  // Acepta ambos esquemas (compatibilidad hacia atrás)
  return {
    id: u.id,
    nombre: u.nombre || '—',
    correo: u.correo || u.email || '',
    rol: (u.rol || u.role || 'usuario'),
    active: (u.active !== false),
    creadoEn: u.creadoEn || u.createdAt || null
  };
}
function renderUsers(){
  const tbody = $('#usersTbody');
  if (!tbody) return;
  const users = read(LS.USERS).map(normalizeUser);
  tbody.innerHTML = '';
  users.forEach(u=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.nombre}</td>
      <td>${u.correo || '—'}</td>
      <td><span class="badge text-bg-${u.rol==='admin'?'dark':'secondary'}">${u.rol}</span></td>
      <td>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" data-act="toggle-active" data-id="${u.id}" ${u.active?'checked':''}>
        </div>
      </td>
      <td class="small">${u.creadoEn ? new Date(u.creadoEn).toLocaleDateString() : '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-act="del-user" data-id="${u.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

$('#usersTbody')?.addEventListener('click', e=>{
  const btn = e.target.closest('[data-act="del-user"]'); if(!btn) return;
  const id = btn.dataset.id;
  const users = read(LS.USERS).filter(u=>String(u.id)!==String(id));
  write(LS.USERS, users);
  renderUsers(); renderDashboard();
});
$('#usersTbody')?.addEventListener('change', e=>{
  const sw = e.target.closest('[data-act="toggle-active"]'); if(!sw) return;
  const id = sw.dataset.id;
  const users = read(LS.USERS).map(u=>{
    if (String(u.id) === String(id)) {
      u.active = sw.checked;
    }
    return u;
  });
  write(LS.USERS, users);
});

$('#btnNewUser')?.addEventListener('click', ()=>{
  const nombre = prompt('Nombre del usuario:');
  if (!nombre) return;
  const correo = prompt('Email del usuario:');
  if (!correo) return;
  const rol = (prompt('Rol (admin/usuario):','usuario')||'usuario').toLowerCase()==='admin'?'admin':'usuario';

  const users = read(LS.USERS);
  const id = uid();
  users.push({ id, nombre, correo, rol, active:true, creadoEn: new Date().toISOString() });
  write(LS.USERS, users);
  renderUsers(); renderDashboard();
});

// ---------- Seed opcional (si no hay estructuras, crea arrays vacíos) ----------
['USERS','ORDERS','PRODUCTS'].forEach(k=>{
  if (!localStorage.getItem(LS[k])) write(LS[k], []);
});

// Click en el logo -> Home
const goHome = (e) => {
  e.preventDefault();
  if (typeof window.go === 'function') {
    go('home'); // usa rutas normalizadas de auth.js
  } else {
    window.location.href = '../index.html'; // fallback
  }
};
document.getElementById('logoHome')?.addEventListener('click', goHome);
document.getElementById('logoHomeTop')?.addEventListener('click', goHome);

// ---------- Primera render ----------
renderDashboard();
renderOrders();
renderProducts();
renderUsers();
