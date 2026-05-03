class AdminLoginController {
  constructor() {
    this.form = document.getElementById('admin-login-form');
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
    const formData = new FormData(this.form);
    const email = formData.get('username') || formData.get('email'); // admin-login.html usa name="username"
    const password = formData.get('password');

    const response = await apiService.loginAdmin(email, password);
    
    if (response.success) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('admin_data', JSON.stringify(response.data.user));
      window.location.href = 'dashboard-admin.html';
    } else {
      alert(response.error || 'Error en login de administrador');
    }
  }

  checkAuth() {
    if (localStorage.getItem('auth_token')) {
      window.location.href = 'dashboard-admin.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminLoginController();
});
