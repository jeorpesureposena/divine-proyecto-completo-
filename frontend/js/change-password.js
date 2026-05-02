// Eliminado import './api.js' para permitir uso sin servidor local (file://)

// Controlador para la página de cambio de contraseña (flujo de recuperación)
// - Espera que `sessionStorage` contenga `recovery_email` y `verification_code`
//   establecidos durante los pasos anteriores (forgot-password / verify-email).
// - Maneja toggles de visibilidad de contraseñas y envía la nueva contraseña
//   al backend vía `apiService.changePassword(email, code, newPassword)`.
class ChangePasswordController {
  constructor() {
    this.form = document.getElementById('changePasswordForm');
    this.init();
  }

  // Inicializa eventos si el formulario existe en la página.
  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleChangePassword.bind(this));
      this.setupPasswordToggles();
    }
  }

  // Añade comportamiento a botones `.password-toggle` para mostrar/ocultar
  // la contraseña adjacent al botón. Espera que el input sea el elemento
  // anterior (`previousElementSibling`). Actualiza también el icono.
  setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle');

    toggleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const input = button.previousElementSibling;
        const icon = button.querySelector('i');

        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    });
  }

  // Handler principal del submit del formulario.
  // - Valida que las contraseñas coincidan en el cliente.
  // - Recupera `email` y `code` de `sessionStorage` (establecido previamente).
  // - Llama a `apiService.changePassword` y maneja la respuesta.
  async handleChangePassword(event) {
    event.preventDefault();

    const formData = new FormData(this.form);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');

    // Validación cliente: confirmar que las dos entradas coinciden.
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    // Se espera que el flujo de recuperación haya guardado estos valores en sessionStorage.
    const email = sessionStorage.getItem('recovery_email');
    const code = sessionStorage.getItem('verification_code');

    if (!email || !code) {
      // Si faltan, el flujo expiró: redirigir al inicio del proceso.
      alert('Sesión expirada. Por favor inicia el proceso de recuperación nuevamente.');
      window.location.href = 'forgot-password.html';
      return;
    }

    // Llamada al backend para cambiar la contraseña.
    const response = await apiService.changePassword(email, code, newPassword);

    if (response.success) {
      // Limpiar sessionStorage y redirigir al login tras éxito.
      sessionStorage.removeItem('recovery_email');
      sessionStorage.removeItem('verification_code');

      alert('Contraseña actualizada exitosamente');
      window.location.href = 'operador-login.html';
    } else {
      // Mostrar error retornado por el backend o mensaje genérico.
      alert(response.error || 'Error al cambiar contraseña');
    }
  }
}

// Instancia el controlador cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', () => {
  new ChangePasswordController();
});
