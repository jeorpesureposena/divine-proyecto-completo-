class AdminRegisterController {
  constructor() {
    this.form = document.getElementById('admin-registration-form');
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleRegister.bind(this));
      this.checkAuth();
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const data = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone_number: formData.get('phone_number'),
      password: formData.get('password'),
      auth_code: formData.get('auth_code')
    };

    const response = await apiService.registerAdmin(data);
    
    if (response.success) {
      alert('Administrador registrado correctamente');
      window.location.href = 'admin-login.html';
    } else {
      alert(response.error || 'Error en registro de administrador');
    }
  }

  checkAuth() {
    if (localStorage.getItem('auth_token')) {
      window.location.href = 'dashboard-admin.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminRegisterController();
});
