// assets/js/auth.js
// ======================================================
// Login/Registro con LocalStorage + roles (admin/usuario)
// ======================================================

// -------- Utilidades de ruta (NORMALIZADAS A APP_ROOT) --------
// Evita problemas de "../" o "doble /partials/" al navegar entre páginas.
const APP_ROOT = (()=>{
  const p = location.pathname;
  if (p.includes('/partials/')) return p.split('/partials/')[0] || '';
  // quita /index.html si está en raíz
  return p.replace(/\/index\.html?$/,'').replace(/\/$/,'');
})();
const PATHS = {
  home:     `${APP_ROOT}/index.html`,
  login:    `${APP_ROOT}/partials/login.html`,
  registro: `${APP_ROOT}/partials/registro.html`,
  cuenta:   `${APP_ROOT}/partials/cuenta.html`,
  admin:    `${APP_ROOT}/partials/admin.html`,
  tienda:   `${APP_ROOT}/partials/tienda.html`,
  carro:    `${APP_ROOT}/partials/carro.html`,
};
// Redirección segura: acepta keys de PATHS o URLs; normaliza relativas a APP_ROOT.
function go(pathKeyOrUrl) {
  const target = PATHS[pathKeyOrUrl] || pathKeyOrUrl || PATHS.home;
  // Si es una ruta relativa, resolverla contra APP_ROOT
  try {
    const abs = new URL(target, window.location.origin + (APP_ROOT || ''));
    window.location.href = abs.pathname + abs.search + abs.hash;
  } catch {
    window.location.href = target;
  }
}

// -------- Claves LocalStorage --------
const LS_KEYS = {
  USERS:   'app_users',
  SESSION: 'app_session'
};

// -------- Acceso a LocalStorage (usuarios/sesión) --------
function getUsers() {
  const raw = localStorage.getItem(LS_KEYS.USERS);
  return raw ? JSON.parse(raw) : [];
}
function setUsers(list) {
  localStorage.setItem(LS_KEYS.USERS, JSON.stringify(list || []));
}
function getSession() {
  const raw = localStorage.getItem(LS_KEYS.SESSION);
  return raw ? JSON.parse(raw) : null;
}
function setSession(obj) {
  if (obj) localStorage.setItem(LS_KEYS.SESSION, JSON.stringify(obj));
  else localStorage.removeItem(LS_KEYS.SESSION);
}

// ---- Post-login redirect helpers (NORMALIZA a ruta absoluta) ----
function setPostLoginRedirect(url) {
  try {
    const abs = new URL(url, window.location.href);
    const normalized = abs.pathname + abs.search + abs.hash;
    localStorage.setItem('post_login_redirect', normalized);
  } catch {
    localStorage.setItem('post_login_redirect', location.pathname + location.search + location.hash);
  }
}
function consumePostLoginRedirect() {
  const url = localStorage.getItem('post_login_redirect');
  if (url) localStorage.removeItem('post_login_redirect');
  return url;
}

// -------- ID helper --------
function cryptoRandomId() {
  return Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

// -------- Semilla: crea un admin demo si no hay usuarios --------
(function seedAdmin() {
  const users = getUsers();
  if (users.length === 0) {
    users.push({
      id: cryptoRandomId(),
      nombre: 'Administrador',
      correo: 'admin@site.cl',
      password: '123456', // solo fines educativos
      telefono: '',
      region: 'Región Metropolitana de Santiago',
      comuna: 'Santiago',
      rol: 'admin',
      creadoEn: new Date().toISOString()
    });
    setUsers(users);
  }
})();

// -------- Render del header (links de sesión) --------
function renderAuthLinks() {
  const container = document.getElementById('auth-links');
  if (!container) return;

  const s = getSession();
  if (!s) {
    container.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <a class="nav-link p-0" href="${PATHS.login}">Iniciar sesión</a>
        <span class="text-muted">|</span>
        <a class="nav-link p-0" href="${PATHS.registro}">Registrar usuario</a>
      </div>
    `;
    return;
  }

  const firstName = s.nombre?.split(' ')[0] || 'Usuario';
  const primaryLink = s.rol === 'admin'
    ? `<a class="nav-link p-0" href="${PATHS.admin}">Admin</a>`
    : `<a class="nav-link p-0" href="${PATHS.cuenta}">Mi cuenta</a>`;

  container.innerHTML = `
    <div class="d-flex align-items-center gap-3">
      <span class="navbar-text">Hola, ${firstName}</span>
      ${primaryLink}
      <button class="btn btn-outline-secondary btn-sm" id="btn-logout">Salir</button>
    </div>
  `;

  const btn = document.getElementById('btn-logout');
  if (btn) btn.addEventListener('click', logout);
}

// -------- Login --------
function handleLoginSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const correo = (f.correo.value || '').trim().toLowerCase();
  const password = f.password.value || '';

  const user = getUsers().find(u => u.correo === correo && u.password === password);
  if (!user) {
    alert('Correo o contraseña incorrectos.');
    return;
  }

  setSession({ userId: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol });

  // Redirect al destino guardado si existía (ya normalizado)
  const back = consumePostLoginRedirect();
  if (back) { window.location.href = back; return; }

  // Fallback por rol
  if (user.rol === 'admin') go('admin');
  else go('cuenta');
}

// -------- Logout --------
function logout() {
  setSession(null);
  go('home');
}

// -------- Registro --------
function handleRegisterSubmit(e) {
  e.preventDefault();
  const f = e.target;

  const nombre = (f.nombre.value || '').trim();
  const correo = (f.correo.value || '').trim().toLowerCase();
  const pass1 = f.password.value || '';
  const pass2 = f.password2.value || '';
  const telefono = (f.telefono?.value || '').trim();
  const region = f.region?.value || '';
  const comuna = f.comuna?.value || '';
  const rol = (f.rol?.value || 'usuario'); // por defecto usuario

  if (!nombre || !correo || !pass1 || !pass2) {
    alert('Completa los campos obligatorios.');
    return;
  }
  if (pass1 !== pass2) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  const users = getUsers();
  if (users.some(u => u.correo === correo)) {
    alert('Ese correo ya está registrado.');
    return;
  }

  users.push({
    id: cryptoRandomId(),
    nombre, correo,
    password: pass1, // (no seguro en prod)
    telefono, region, comuna,
    rol,
    creadoEn: new Date().toISOString()
  });
  setUsers(users);

  alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
  go('login');
}

// -------- Protección de páginas --------
// Uso: requireAuth() | requireAuth({ allow:['admin'] }) | requireAuth({ soft:true })
function requireAuth(opts = {}) {
  const s = getSession();

  const goLogin = () => {
    setPostLoginRedirect(location.pathname + location.search + location.hash);
    alert('Debes iniciar sesión.');
    go('login');
  };

  if (!s) {
    if (opts.soft) {
      goLogin();
      return null;
    } else {
      goLogin();
      throw new Error('Auth required: navigation aborted');
    }
  }

  if (Array.isArray(opts.allow) && !opts.allow.includes(s.rol)) {
    alert('No tienes permisos para ver esta página.');
    go('home');
    if (!opts.soft) throw new Error('Forbidden: navigation aborted');
    return null;
  }

  renderAuthLinks();
  return s;
}

// -------- Regiones/Comunas de ejemplo para el formulario --------
const REGIONES = {
  'Región Metropolitana de Santiago': ['Santiago', 'Puente Alto', 'Maipú'],
  'Región de La Araucanía': ['Temuco', 'Padre Las Casas', 'Angol'],
  'Región de Ñuble': ['Chillán', 'San Carlos', 'Quirihue']
};
function fillRegionComuna(form) {
  const selRegion = form.region;
  const selComuna = form.comuna;
  if (!selRegion || !selComuna) return;

  selRegion.innerHTML = `<option value="" selected>-- Seleccione la región --</option>` +
    Object.keys(REGIONES).map(r => `<option value="${r}">${r}</option>`).join('');
  selComuna.innerHTML = `<option value="" selected>-- Seleccione la comuna --</option>`;

  selRegion.addEventListener('change', () => {
    const comunas = REGIONES[selRegion.value] || [];
    selComuna.innerHTML = `<option value="" selected>-- Seleccione la comuna --</option>` +
      comunas.map(c => `<option value="${c}">${c}</option>`).join('');
  });
}

// -------- Auto-inicialización en cada página --------
document.addEventListener('DOMContentLoaded', () => {
  renderAuthLinks();

  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  const registroForm = document.getElementById('form-registro');
  if (registroForm) {
    fillRegionComuna(registroForm);
    registroForm.addEventListener('submit', handleRegisterSubmit);
  }

  // Guard automático SOLO para la página admin (por si no llamas requireAuth() allí)
  if (/\/partials\/admin\.html$/.test(location.pathname)) {
    const s = getSession();
    if (!s || s.rol !== 'admin') {
      setPostLoginRedirect(location.pathname + location.search + location.hash);
      go('login');
    }
  }

  // Si caes en login/registro ya estando logueado, reubica:
  if (/\/partials\/(login|registro)\.html$/.test(location.pathname)) {
    const s = getSession();
    if (s) go(s.rol === 'admin' ? 'admin' : 'cuenta');
  }
});

// -------- Exponer funciones útiles globalmente --------
window.requireAuth = requireAuth;
window.logout = logout;
window.getUsers = getUsers;
window.getSession = getSession;
window.renderAuthLinks = renderAuthLinks;
window.setPostLoginRedirect = setPostLoginRedirect;
