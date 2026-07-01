// Eliminado import './api.js' para permitir uso sin servidor local (file://)

// Controlador del formulario de registro de operadores.
// - Recolecta los campos del formulario y llama a `apiService.registerOperator`.
// - En caso de éxito guarda el token y datos del operador en localStorage y
//   redirige al `dashboard.html`.
class RegisterController {
  constructor() {
    this.form = document.getElementById('registerForm');
    this.init();
  }

  // Enlaza el submit y verifica si ya existe sesión para evitar mostrar el
  // formulario a usuarios ya autenticados.
  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleRegister.bind(this));
      this.checkAuth();
    }
  }

  // Maneja el envío del formulario: crea un objeto `data` con los campos
  // requeridos y llama al servicio API.
  async handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const data = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      operator_code: formData.get('operator_code'),
      password: formData.get('password')
    };

    // Se espera que `apiService.registerOperator(data)` devuelva
    // { success: true, token, operator } o { success: false, error }.
    const response = await apiService.registerOperator(data);
    
    if (response.success) {
      // Redirigir al login para que el usuario inicie sesión manualmente.
      window.location.href = 'operador-login.html';
    } else {
      // Mostrar error (recomendado: reemplazar alert por notificación UI).
      alert(response.error || 'Error en registro');
    }
  }

  // Evita que usuarios autenticados accedan a la página de registro.
  checkAuth() {
    if (localStorage.getItem('auth_token')) {
      window.location.href = 'operador-dashboard.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RegisterController();
});
