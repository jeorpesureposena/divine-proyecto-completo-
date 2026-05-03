class AdminForgotPasswordController {
  constructor() {
    this.form = document.querySelector('form'); // Selects the main form in admin-forgot-password.html
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
    
    const response = await apiService.sendEmailForgotPassword(email);
    
    if (response.success) {
      sessionStorage.setItem('admin_recovery_email', email);
      alert('Código de recuperación enviado al correo (Admin)');
      window.location.href = 'admin-verify-email.html';
    } else {
      alert(response.error || 'Error al enviar código');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminForgotPasswordController();
});
