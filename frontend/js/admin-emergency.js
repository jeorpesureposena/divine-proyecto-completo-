// ─── MODO DE EMERGENCIA ────────────────────────────────────────────
// Controlador para emergency-mode.html
// Consulta el estado de barreras y permite abrirlas/cerrarlas vía API

class EmergencyController {
    constructor() {
        this.barreras = []; // Lista de barreras desde el backend
        this.init();
    }

    async init() {
        this.checkAuth();
        await this.loadBarreras();
        this.bindButtons();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = 'admin-login.html';
        }
    }

    async loadBarreras() {
        try {
            this.barreras = await window.apiFetch('/barreras/');
            this.updateBarreraStatus();
        } catch (e) {
            console.error('Error al cargar barreras:', e);
            this.setStatusText('Error de conexión', 'No se pudo contactar al servidor.', true);
        }
    }

    updateBarreraStatus() {
        // Si no hay barreras registradas
        if (!this.barreras || this.barreras.length === 0) {
            this.setStatusText('Sin datos', 'No hay barreras registradas en el sistema.', false);
            return;
        }

        // Determinar estado general: si ALGUNA está abierta, mostramos alerta
        const hayAbierta = this.barreras.some(b => b.estado === 'abierta');
        const hayBloqueada = this.barreras.some(b => b.estado === 'bloqueada');
        const todasCerradas = this.barreras.every(b => b.estado === 'cerrada');

        if (hayBloqueada) {
            this.setStatusText('⚠️ BLOQUEADAS', 'Una o más barreras están bloqueadas. Requiere intervención técnica.', true);
        } else if (hayAbierta) {
            this.setStatusText('ABIERTAS', 'Modo evacuación activo — barreras abiertas para salida libre.', true);
        } else if (todasCerradas) {
            this.setStatusText('CERRADAS', 'Sistema en modo normal. Todas las barreras están cerradas.', false);
        }
    }

    setStatusText(statusText, subText, isAlert) {
        const statusEl = document.getElementById('barrier-status-text');
        const subEl = document.getElementById('barrier-status-sub');
        if (statusEl) {
            statusEl.textContent = statusText;
            statusEl.className = isAlert ? 'text-divine-red font-black' : 'text-green-600 font-black';
        }
        if (subEl) {
            subEl.textContent = `(${subText})`;
        }
    }

    bindButtons() {
        // Botón: Abrir Barrera (todas)
        const btnAbrir = document.getElementById('btn-abrir-barrera');
        if (btnAbrir) {
            btnAbrir.addEventListener('click', () => this.accionBarreras('abierta', btnAbrir));
        }

        // Botón: Cerrar Barreras (todas)
        const btnCerrar = document.getElementById('btn-cerrar-barrera');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => this.accionBarreras('cerrada', btnCerrar));
        }

        // Botón: Ver Cámaras
        const btnCamaras = document.getElementById('btn-ver-camaras');
        if (btnCamaras) {
            btnCamaras.addEventListener('click', () => {
                window.location.href = 'Monitoring-and-Sensors.html';
            });
        }
    }

    async accionBarreras(nuevoEstado, btn) {
        if (!this.barreras || this.barreras.length === 0) {
            alert('No hay barreras registradas para controlar.');
            return;
        }

        // Deshabilitar botón mientras se procesa
        btn.disabled = true;
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg> Procesando...';

        let errores = 0;
        for (const barrera of this.barreras) {
            try {
                await window.apiFetch(`/barreras/${barrera.id}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        estado: nuevoEstado,
                        ultima_accion: new Date().toISOString()
                    })
                });
            } catch (e) {
                console.error(`Error actualizando barrera ${barrera.id}:`, e);
                errores++;
            }
        }

        // Recargar estados
        await this.loadBarreras();

        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = textoOriginal;

        if (errores > 0) {
            alert(`⚠️ ${errores} barrera(s) no se pudieron actualizar. Verifique el servidor.`);
        } else {
            const accion = nuevoEstado === 'abierta' ? 'abiertas' : 'cerradas';
            alert(`✅ Todas las barreras han sido ${accion} exitosamente.`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.emergencyCtrl = new EmergencyController();
});
