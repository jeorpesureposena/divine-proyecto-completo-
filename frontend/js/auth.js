// AuthService: helper para autenticación en el cliente
// - Gestiona el login, almacenamiento del token/usuario en localStorage,
//   y notificaciones simples en la UI.
// - `apiService` (global) es utilizado para las llamadas al backend.
class AuthService {
  constructor() {
    this.apiService = window.apiService;
    this.tokenKey = 'auth_token';
    this.userKey = 'operator_data';
  }

  // Realiza el login usando las credenciales proporcionadas.
  // `credentials` puede ser un objeto con { email, password } o la forma que
  // espere el backend. Retorna { success: true } o { success: false, error }.
  async login(email, password) {
    try {
      this.setLoadingState(true);
      
      // Llamada al servicio API centralizado.
      const response = await this.apiService.loginOperator(email, password);
      
      if (response.success) {
        // El backend debe devolver `response.data` con `token` y `user`.
        this.storeAuthData(response.data);
    
        this.showSuccessMessage('Login successful! Redirecting...');
        
        // Pequeña pausa para mostrar el mensaje antes de redirigir.
        setTimeout(() => {
          window.location.href = 'operador-dashboard.html';
        }, 1500);
        
        return { success: true };
      } else {
        this.showErrorMessage(response.error || 'Login failed');
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showErrorMessage('An unexpected error occurred');
      return { success: false, error: error.message };
    } finally {
      this.setLoadingState(false);
    }
  }

  // Guarda token y datos del usuario en localStorage.
  // Espera un objeto `data` con propiedades `token` y `user`.
  storeAuthData(data) {
    if (data.token) {
      localStorage.setItem(this.tokenKey, data.token);
    }
    
    if (data.user) {
      localStorage.setItem(this.userKey, JSON.stringify(data.user));
    }
  }

  // Recupera el token desde localStorage.
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  // Recupera los datos del usuario desde localStorage (parsing JSON).
  getUserData() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  // Indica si el usuario está autenticado (presencia de token).
  isAuthenticated() {
    return !!this.getToken();
  }

  // Cierra sesión: elimina token y datos de usuario y redirige al login.
  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    const isOperator = window.location.pathname.includes('operador-');
    window.location.href = 'operador-login.html';
  }

  // Actualiza el estado visual del formulario durante operaciones async.
  setLoadingState(isLoading) {
    const submitButton = document.querySelector('#loginForm .btn-primary');
    const form = document.getElementById('loginForm');
    
    if (submitButton) {
      submitButton.disabled = isLoading;
      submitButton.textContent = isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión';
    }
    
    if (form) {
      form.style.opacity = isLoading ? '0.7' : '1';
      form.style.pointerEvents = isLoading ? 'none' : 'auto';
    }
  }

  // Atajos para mostrar notificaciones.
  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  // Crea una notificación flotante en la esquina superior derecha y la
  // elimina automáticamente. `type` afecta el color de fondo.
  showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
      ${type === 'success' ? 'background-color: #28a745;' : ''}
      ${type === 'error' ? 'background-color: #dc3545;' : ''}
      ${type === 'info' ? 'background-color: #17a2b8;' : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}

const authService = new AuthService();

// Export compatible con Node y navegador global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { authService, AuthService };
} else {
  window.authService = authService;
  window.AuthService = AuthService;
}
