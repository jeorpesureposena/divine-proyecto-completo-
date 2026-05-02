// Eliminado import './api.js' para permitir uso sin servidor local (file://)

class LoginController {
  constructor() {
    this.form = document.getElementById('loginForm');
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleLogin.bind(this));
      this.checkAuth();
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    // Previene el comportamiento por defecto y obtiene las credenciales del formulario.
    const formData = new FormData(this.form);
    const email = formData.get('email');
    const password = formData.get('password');

    // Llamada al API centralizado. `apiService.loginOperator` debe aceptar
    // (email, password) y devolver { success: true, token, operator } o
    // { success: false, error }.
    const response = await apiService.loginOperator(email, password);
    
    if (response.success) {
      // Guardar token y datos del operador en localStorage para sesión cliente.
      // Nota: el backend debería ser quien controle expiración/validación.
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('operator_data', JSON.stringify(response.operator));
      // Redirigir al dashboard tras inicio exitoso.
      window.location.href = 'operador-dashboard.html';
    } else {
      // Mostrar error (se recomienda reemplazar alert() por notificación UI).
      alert(response.error || 'Error en login');
    }
  }

  checkAuth() {
    // Si ya hay token, evitar que el usuario vea la pantalla de login.
    if (localStorage.getItem('auth_token')) {
      window.location.href = 'operador-dashboard.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LoginController();
});
