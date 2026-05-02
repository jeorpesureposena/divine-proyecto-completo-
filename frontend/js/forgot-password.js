// Eliminado import './api.js' para permitir uso sin servidor local (file://)

class ForgotPasswordController {
  constructor() {
    this.form = document.getElementById('forgotPasswordForm');
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleForgotPassword.bind(this));
    }
  }

  async handleForgotPassword(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const email = formData.get('email');
    // Llamada al servicio API para iniciar flujo de recuperación de contraseña.
    // Se espera que `apiService.sendEmailForgotPassword(email)` devuelva
    // { success: true } o { success: false, error }.
    const response = await apiService.sendEmailForgotPassword(email);
    
    if (response.success) {
      // Guardar el email en sessionStorage para usarlo en pasos posteriores
      // (verify-email.html / change-password.html). No guardar token aquí.
      sessionStorage.setItem('recovery_email', email);
      // UX simple: mostrar confirmación y avanzar al paso de verificación.
      alert('Código enviado al correo');
      window.location.href = 'verify-email.html';
    } else {
      // Mostrar el error retornado por el backend o un mensaje genérico.
      alert(response.error || 'Error al enviar código');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ForgotPasswordController();
});
