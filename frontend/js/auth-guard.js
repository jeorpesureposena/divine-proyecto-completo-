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
    window.location.href = 'operador-dashboard.html';
  }

  // Redirección hacia la página de login si no hay sesión válida.
  static redirectToLogin() {
    window.location.href = 'operador-login.html';
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
    'operador-login.html',
    'register.html',
    'forgot-password.html',
    'verify-email.html',
    'change-password.html'
  ];

  // ── Páginas PRIVADAS (redirige al login si NO está logueado) ──
  const privatePages = [
    'operador-dashboard.html',
    'operador-register-entry.html',
    'operador-register-exit.html'
  ];

  if (authPages.includes(currentPage)) {
    AuthGuard.protectAuthPages();
  }

  if (privatePages.includes(currentPage)) {
    AuthGuard.protectDashboard();
  }
});
