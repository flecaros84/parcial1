// assets/js/layout.js

// ------------------------------
// Utilidades internas
// ------------------------------

// Inserta un parcial en el selector indicado
async function inject(selector, url) {
  const host = document.querySelector(selector);
  if (!host) return;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
    host.innerHTML = await res.text();
  } catch (err) {
    console.error('Error inyectando parcial:', selector, url, err);
  }
}

// Detecta si la página actual está en /partials/
function getBasePath() {
  return location.pathname.includes('/partials/') ? '..' : '.';
}

// Guarda el destino post-login normalizado (usa auth.js si existe)
function rememberPostLoginRedirect(url) {
  // Si auth.js ya está cargado, delega a su normalizador
  if (typeof window.setPostLoginRedirect === 'function') {
    window.setPostLoginRedirect(url);
    return;
  }
  // Fallback: normaliza aquí mismo
  try {
    const abs = new URL(url, window.location.href);
    const normalized = abs.pathname + abs.search + abs.hash; // solo path+query+hash
    localStorage.setItem('post_login_redirect', normalized);
  } catch {
    localStorage.setItem('post_login_redirect', location.pathname + location.search + location.hash);
  }
}

// Obtiene la URL de login respetando la base actual
function getLoginUrl() {
  const base = getBasePath();
  return `${base}/partials/login.html`;
}

// ------------------------------
// Header / Nav
// ------------------------------

// Reescribe los href del header usando data-nav y base actual
function wireHeaderNav() {
  const base = getBasePath();
  const P = `${base}/partials`;
  const map = {
    home: `${base}/index.html`,
    nosotros: `${P}/nosotros.html`,
    servicios: `${P}/servicios.html`,
    portafolio: `${P}/portafolio.html`,
    tienda: `${P}/tienda.html`,
    contacto: `${P}/contacto.html`,
    carro: `${P}/carro.html`
  };

  document.querySelectorAll('[data-nav]').forEach(a => {
    const key = a.getAttribute('data-nav');
    if (map[key]) a.setAttribute('href', map[key]);
  });

  // Marca activo por coincidencia de pathname
  const current = location.pathname.split('/').pop();
  if (current) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      const hrefLast = a.getAttribute('href')?.split('/').pop();
      if (hrefLast === current) a.classList.add('active');
      else a.classList.remove('active');
    });
  }
}

// Protege links marcados como "protegidos" (requieren sesión)
function protectMenuLinks(root = document) {
  root.querySelectorAll('[data-protected-link]').forEach(a => {
    a.addEventListener('click', (e) => {
      const hasGetSession = typeof window.getSession === 'function';
      const s = hasGetSession ? window.getSession() : null;
      if (!s) {
        e.preventDefault();
        const target = a.getAttribute('href') || a.dataset.href || location.pathname + location.search + location.hash;
        rememberPostLoginRedirect(target);
        // Si existe go() úsalo; si no, navega directo al login respetando base
        if (typeof window.go === 'function') window.go('login');
        else window.location.href = getLoginUrl();
      }
    });
  });
}

// Delegación de evento para Logout (resiste re-render del header)
function wireLogoutDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-logout,[data-logout]');
    if (!btn) return;
    e.preventDefault();
    try {
      if (typeof window.logout === 'function') window.logout();
      else console.warn('logout() no está disponible en window.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}

// ------------------------------
// Carro / Badge
// ------------------------------

// Lee el count desde localStorage (clave usada por cart.js)
function readCartCount() {
  const n = Number(localStorage.getItem('cartCount'));
  return Number.isFinite(n) ? n : 0;
}

// Actualiza el contador del carro en el badge del header
function updateCartBadge(countFromEvent) {
  const countEl = document.querySelector('#cart-count');
  if (!countEl) return;
  const count = (typeof countFromEvent === 'number') ? countFromEvent : readCartCount();
  countEl.textContent = String(count);
  // Opcional: ocultar cuando es 0
  // countEl.closest('[data-cart-wrapper]')?.classList.toggle('d-none', count === 0);
}

// Sincroniza el badge si cambia LocalStorage (otras pestañas/ventanas)
window.addEventListener('storage', (e) => {
  if (e.key === 'cartCount') updateCartBadge();
});

// Escucha cambios del carro en **esta** pestaña (evento emitido por cart.js)
window.addEventListener('cart:changed', (e) => {
  updateCartBadge(e.detail?.count);
});

// ------------------------------
// Layout dinámico: navbar fija + subbar opcional (tienda)
// ------------------------------

// Calcula padding-top total (navbar + subbar si existe)
function applyNavPadding() {
  const nav = document.querySelector('.navbar.fixed-top');
  const sub = document.getElementById('shop-subbar'); // solo existe en Tienda

  const navH = nav ? nav.offsetHeight : 0;

  // Fija el subbar justo bajo la navbar
  if (sub) {
    sub.style.position = 'sticky';
    sub.style.top = `${navH}px`;
    const total = navH + sub.offsetHeight;
    document.body.style.paddingTop = `${total}px`;
  } else {
    document.body.style.paddingTop = `${navH}px`;
  }

  // Expone var CSS útil en estilos
  document.documentElement.style.setProperty('--nav-height', `${navH}px`);
}

// Observa cambios de altura (logo responsive, toggler, etc.)
function observeHeaderHeights() {
  const nav = document.querySelector('.navbar.fixed-top');
  const sub = document.getElementById('shop-subbar');

  if (typeof ResizeObserver === 'undefined') return;

  if (nav) {
    const ron = new ResizeObserver(applyNavPadding);
    ron.observe(nav);
  }
  if (sub) {
    const ros = new ResizeObserver(applyNavPadding);
    ros.observe(sub);
  }
}

// ------------------------------
// Inicio
// ------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const base = getBasePath();

  // Inyecta header y footer
  await inject('#app-header', `${base}/partials/header.html`);
  await inject('#app-footer', `${base}/partials/footer.html`);

  // Enlaza navegación, badge del carro y auth (si existe)
  wireHeaderNav();
  updateCartBadge(); // pinta el valor persistido (o 0) tras inyectar el header

  // Si auth.js expone renderAuthLinks(), refresca la UI de sesión
  if (typeof window.renderAuthLinks === 'function') {
    window.renderAuthLinks();
  }

  // Protege enlaces de menú marcados y habilita logout por delegación
  protectMenuLinks(document);
  wireLogoutDelegation();

  // Ajusta padding (navbar + subbar si existe) y observa cambios
  applyNavPadding();
  observeHeaderHeights();

  // Recalcula en resize y al terminar de cargar (por imágenes como el logo)
  window.addEventListener('resize', applyNavPadding);
  window.addEventListener('load', applyNavPadding);
});