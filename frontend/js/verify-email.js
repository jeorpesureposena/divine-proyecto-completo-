// Eliminado import './api.js' para permitir uso sin servidor local (file://)

/**
 * VerifyEmailController
 * ---------------------
 * Controlador para la pantalla de verificación por correo.
 *
 * Responsabilidades:
 * - Poblar el campo `email` desde `sessionStorage.recovery_email` (si existe).
 * - Gestionar 6 inputs individuales para el código de verificación (auto-advance
 *   y backspace para retroceder).
 * - Iniciar un contador (60s) que habilita la opción de reenviar cuando expira.
 * - Enviar peticiones al backend para reenviar el código y para verificar el código
 *   mediante `apiService`.
 *
 * Asunciones / contrato:
 * - `sessionStorage.recovery_email` se guarda durante el flujo de "forgot password".
 * - `apiService.sendEmailForgotPassword(email)` -> { success: boolean, ... }
 * - `apiService.verifyEmailCode(email, code)` -> { success: boolean, ... }
 * - Al verificarse correctamente el código, se guarda `verification_code` en
 *   `sessionStorage` y se redirige a `change-password.html`.
 *
 * UX notes:
 * - El controlador muestra mensajes mediante `alert()` en errores/éxitos; se
 *   recomienda reemplazar por un sistema de notificaciones consistente.
 */
class VerifyEmailController {
  constructor() {
    this.form = document.getElementById('verifyCodeForm');
    this.resendButton = document.querySelector('.resend-link');
    this.timer = document.querySelector('.timer');
    this.timeLeft = 60;
    this.timerInterval = null;
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', this.handleVerifyCode.bind(this));
      this.setupCodeInputs();
      this.setEmailFromSession();
      this.startCountdown();
      this.setupResendButton();
    }
  }

  setEmailFromSession() {
    const email = sessionStorage.getItem('recovery_email');
    if (email) {
      document.getElementById('email').value = email;
    }
  }

  setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    
    inputs.forEach((input, index) => {
      // Avanza automáticamente al siguiente input cuando se introduce un dígito
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1) {
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        }
      });

      // Retrocede al input anterior si se presiona Backspace en un input vacío
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });
  }

  startCountdown() {
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      
      if (this.timeLeft <= 0) {
        this.stopCountdown();
        this.enableResendButton();
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timer.textContent = display;
  }

  enableResendButton() {
    this.resendButton.disabled = false;
    this.resendButton.innerHTML = 'Reenviar';
  }

  setupResendButton() {
    this.resendButton.addEventListener('click', this.handleResend.bind(this));
  }

  async handleResend() {
    if (this.resendButton.disabled) return;

    const email = document.getElementById('email').value;
    if (!email) {
      // El email debería haberse guardado en sessionStorage durante el flujo.
      alert('No se encontró el correo electrónico');
      return;
    }

    // Deshabilitar botón y mostrar estado de envío mientras la petición está en curso.
    this.resendButton.disabled = true;
    this.resendButton.innerHTML = 'Enviando...';

    try {
      const response = await apiService.sendEmailForgotPassword(email);
      
      if (response.success) {
        // Notificar y reiniciar el contador para evitar múltiples envíos.
        alert('Código reenviado exitosamente');
        this.resetCountdown();
      } else {
        // Mostrar error devuelto por el servidor y re-habilitar el botón.
        alert(response.error || 'Error al reenviar el código');
        this.enableResendButton();
      }
    } catch (error) {
      console.error('Error resending code:', error);
      alert('Error al reenviar el código');
      this.enableResendButton();
    }
  }

  resetCountdown() {
    this.stopCountdown();
    this.timeLeft = 60;
    this.resendButton.disabled = true;
    // Restaurar texto del botón con un temporizador embebido y re-seleccionar
    // el elemento `.timer` para que `updateTimerDisplay()` lo actualice.
    this.resendButton.innerHTML = 'Reenviar en <span class="timer">01:00</span>';
    this.timer = document.querySelector('.timer');
    this.startCountdown();
  }

  async handleVerifyCode(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const email = formData.get('email');
    const codeInputs = document.querySelectorAll('.code-input');
    const code = Array.from(codeInputs).map(input => input.value).join('');
    // Llamada al backend para verificar el código de 6 dígitos.
    const response = await apiService.verifyEmailCode(email, code);
    
    if (response.success) {
      // Guardar el código verificado en sessionStorage para el siguiente paso.
      sessionStorage.setItem('verification_code', code);
      alert('Código verificado');
      window.location.href = 'change-password.html';
    } else {
      // Mostrar error retornado por el servidor o genérico.
      alert(response.error || 'Error al verificar código');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VerifyEmailController();
});
