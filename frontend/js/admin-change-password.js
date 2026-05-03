class AdminChangePasswordController {
  constructor() {
    this.form = document.querySelector('form');
    this.init();
  }

  init() {
    const email = sessionStorage.getItem('admin_recovery_email');
    const code = sessionStorage.getItem('admin_recovery_code');
    
    if (!email || !code) {
      alert('Sesión de recuperación inválida.');
      window.location.href = 'admin-forgot-password.html';
      return;
    }

    if (this.form) {
      this.form.addEventListener('submit', this.handleChangePassword.bind(this));
    }
  }

  async handleChangePassword(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    const email = sessionStorage.getItem('admin_recovery_email');
    const code = sessionStorage.getItem('admin_recovery_code');

    const response = await apiService.changePassword(email, code, newPassword);
    
    if (response.success) {
      sessionStorage.removeItem('admin_recovery_email');
      sessionStorage.removeItem('admin_recovery_code');
      alert('Contraseña cambiada exitosamente');
      window.location.href = 'admin-login.html';
    } else {
      alert(response.error || 'Error al cambiar la contraseña');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminChangePasswordController();
});
