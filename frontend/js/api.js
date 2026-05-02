// API Service - Simple and focused
//
// Resumen:
// - Cliente HTTP ligero para llamadas POST al backend API.
// - Centraliza endpoints usados por los módulos de la interfaz (registro, login,
//   recuperación de contraseña, verificación de código, cambio de contraseña).
// - Devuelve el JSON parseado que el backend responda. En caso de error de
//   red, devuelve `{ success: false, error: <mensaje> }`.
//
// Notas de uso y extensión:
// - No añade cabeceras de autenticación por defecto. Si se requiere token,
//   considerar añadir un método `setAuthToken(token)` que guarde el token y lo
//   incluya en `headers` como `Authorization: Bearer <token>`.
// - Asegurarse de que el `baseURL` coincide con la URL del servidor (CORS).
// - Las rutas usadas aquí deben mapear a las rutas implementadas en el backend.
//
// Ejemplo rápido:
//   const res = await apiService.registerOperator({ full_name, email, ... });
//   if (res.success) { /*OK*/ } else { alert(res.error) }

class APIService {
  constructor() {
    // Apuntamos al backend en Django
    this.baseURL = 'http://127.0.0.1:8000/api';
    this.tokenKey = 'auth_token';
    this.userKey = 'operator_data';
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    const isOperator = window.location.pathname.includes('operador-');
    window.location.href = isOperator ? 'operador-login.html' : 'admin-login.html';
  }

  async post(endpoint, payload) {
    try {
      // Leer el token con la clave que usa login.js
      const token = localStorage.getItem(this.tokenKey);
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      // Adaptador para respuestas de Django
      if (response.ok) {
        // En login y registro Django devuelve tokens
        if (data.tokens) {
          return { 
            success: true, 
            data: {
              token: data.tokens.access, 
              user: data.usuario 
            }
          };
        }
        return { success: true, data: data, message: data.mensaje };
      } else {
        // Manejo de errores de DRF
        let errorMsg = data.error || data.detail || 'Error en la petición';
        if (typeof data === 'object' && !data.error && !data.detail) {
          errorMsg = Object.values(data).flat().join(', ');
        }
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, error: 'No se pudo conectar con el servidor' };
    }
  }

  async loginOperator(email, password) {
    // Django espera 'correo' y 'password'. Usamos endpoint específico para operadores.
    return this.post('/auth/operador-login/', { correo: email, password });
  }

  async loginAdmin(email, password) {
    // Endpoint específico para administradores
    return this.post('/auth/login-admin/', { correo: email, password });
  }

  async registerOperator(data) {
    // Mapeo de campos del frontend hacia Django
    const payload = {
      nombre: data.full_name,
      correo: data.email,
      password: data.password,
      password2: data.password, // Django requiere confirmación
      codigo_operador: data.operator_code,
      rol: 'operador'
    };
    return this.post('/auth/registro/', payload);
  }

  async sendEmailForgotPassword(email) {
    return this.post('/auth/recuperar-password/enviar-codigo/', { correo: email });
  }

  async verifyEmailCode(email, code) {
    return this.post('/auth/recuperar-password/verificar-codigo/', { correo: email, codigo: code });
  }

  async changePassword(email, code, newPassword) {
    return this.post('/auth/recuperar-password/restablecer/', { 
      correo: email, 
      codigo: code, 
      password_nuevo: newPassword 
    });
  }
}

const apiService = new APIService();
window.apiService = apiService;

// --- Funciones de Utilidad (Dashboard interactivo) ---

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { ...options, headers };

    try {
        const response = await fetch(`${apiService.baseURL}${endpoint}`, config);
        
        if (response.status === 401 && token) {
            // Si el token expira, redirigir al login correspondiente
            apiService.logout();
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.detail || 'Error en la petición');
        }
        return data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}
window.apiFetch = apiFetch;

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    if (type === 'error') icon = 'bx-x-circle';

    toast.innerHTML = `<i class='bx ${icon}'></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;