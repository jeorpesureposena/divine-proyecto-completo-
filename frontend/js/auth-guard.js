// AuthGuard: control básico de acceso en el frontend
// - Usa `localStorage.auth_token` para determinar si el usuario está autenticado.
// - Provee helpers para redirigir a páginas públicas/privadas según el estado.
// Nota: la verificación definitiva siempre debe hacerse en el backend.
class AuthGuard {
  // Comprueba si existe un token de sesión en localStorage.
  static checkAuth() {
    const token = localStorage.getItem('auth_token');
    return !!token;
  }

  // Redirección hacia el panel principal tras iniciar sesión.
  static redirectToDashboard() {
    const isOperator = window.location.pathname.includes('operador-') || window.location.pathname.includes('register.html') || window.location.pathname.includes('forgot-password');
    const isAdmin = window.location.pathname.includes('admin-') || window.location.pathname.includes('dashboard-admin');
    
    // Asumimos admin si no es claramente operador (se puede refinar con datos del usuario)
    if (isAdmin && !isOperator) {
        window.location.href = 'dashboard-admin.html';
    } else {
        window.location.href = 'operador-dashboard.html';
    }
  }

  // Redirección hacia la página de login si no hay sesión válida.
  static redirectToLogin() {
    const isAdmin = window.location.pathname.includes('admin-') || window.location.pathname.includes('dashboard-admin');
    if (isAdmin) {
        window.location.href = 'admin-login.html';
    } else {
        window.location.href = 'operador-login.html';
    }
  }

  // Protección para páginas públicas. Si ya está autenticado, va al dashboard.
  static protectAuthPages() {
    if (this.checkAuth()) {
      this.redirectToDashboard();
    }
  }

  // Protección para páginas privadas. Si no hay auth, va al login.
  static protectDashboard() {
    if (!this.checkAuth()) {
      this.redirectToLogin();
    }
  }
}

// Inicialización al cargar el DOM.
document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // ── Páginas PÚBLICAS (redirige al dashboard si ya está logueado) ──
  const authPages = [
    'operador-login.html',
    'register.html',
    'forgot-password.html',
    'verify-email.html',
    'change-password.html',
    'admin-login.html',
    'register-admin.html',
    'admin-forgot-password.html',
    'admin-verify-email.html',
    'admin-change-password.html'
  ];

  // ── Páginas PRIVADAS (redirige al login si NO está logueado) ──
  const privatePages = [
    'operador-dashboard.html',
    'operador-register-entry.html',
    'operador-register-exit.html',
    'dashboard-admin.html',
    'admin-User-Management.html',
    'admin-Payments-and-Billing.html',
    'admin-Overcapacity-Alert.html'
  ];

  if (authPages.includes(currentPage)) {
    AuthGuard.protectAuthPages();
  }

  if (privatePages.includes(currentPage)) {
    AuthGuard.protectDashboard();
  }
});
