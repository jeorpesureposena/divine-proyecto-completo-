class AdminVerifyEmailController {
  constructor() {
    this.form = document.querySelector('form');
    this.inputs = this.form ? this.form.querySelectorAll('input[type="text"]') : [];
    this.init();
  }

  init() {
    const email = sessionStorage.getItem('admin_recovery_email');
    if (!email) {
      alert('No se encontró un correo para verificar.');
      window.location.href = 'admin-forgot-password.html';
      return;
    }

    if (this.form) {
      this.form.addEventListener('submit', this.handleVerify.bind(this));
    }
  }

  async handleVerify(event) {
    event.preventDefault();
    
    let code = '';
    this.inputs.forEach(input => code += input.value);
    
    if (code.length !== 6) {
        alert('Por favor ingrese el código completo de 6 dígitos');
        return;
    }

    const email = sessionStorage.getItem('admin_recovery_email');
    const response = await apiService.verifyEmailCode(email, code);
    
    if (response.success) {
      sessionStorage.setItem('admin_recovery_code', code);
      window.location.href = 'admin-change-password.html';
    } else {
      alert(response.error || 'Código incorrecto');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminVerifyEmailController();
});
