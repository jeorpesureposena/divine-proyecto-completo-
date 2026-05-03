// ─── MONITOREO Y SENSORES ──────────────────────────────────────────
// Controlador para admin-Overcapacity-Alert.html
// Endpoint: GET /api/estadisticas/tablero/ y /api/espacios/

class MonitoringController {
    constructor() {
        this.init();
        // Recargar el mapa y KPIs cada 30 segundos
        this.refreshInterval = setInterval(() => this.loadData(), 30000);
    }

    async init() {
        this.checkAuth();
        await this.loadData();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = 'admin-login.html';
        }
    }

    async loadData() {
        try {
            // 1. Cargar KPIs del tablero
            const stats = await window.apiFetch('/estadisticas/tablero/');
            this.updateKPIs(stats);

            // 2. Cargar Espacios de Parqueo
            const espacios = await window.apiFetch('/espacios/');
            this.renderMap(espacios);

            // 3. Evaluar alerta de sobrecapacidad
            this.evaluateCapacity(stats.plazas_totales, stats.plazas_ocupadas);

        } catch (error) {
            console.error('Error cargando monitoreo:', error);
            const grid = document.getElementById('slots-grid');
            if (grid) {
                grid.innerHTML = `<div class="col-span-15 text-center text-red-500 font-semibold py-10">${window.getTranslation('status.error_loading') || 'Error cargando mapa'}</div>`;
            }
        }
    }

    updateKPIs(stats) {
        // Ingresos
        const ingEl = document.getElementById('stat-ingresos');
        if (ingEl) {
            ingEl.textContent = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(stats.ingresos_hoy);
        }

        // Ocupación
        const pctEl = document.getElementById('stat-ocupacion-percent');
        const detEl = document.getElementById('stat-ocupacion-detalle');
        if (pctEl && detEl) {
            const pct = stats.plazas_totales > 0 ? Math.round((stats.plazas_ocupadas / stats.plazas_totales) * 100) : 0;
            pctEl.textContent = `${pct}%`;
            detEl.textContent = `${stats.plazas_ocupadas} ${window.getTranslation('table.occupied_spaces') || 'espacios ocupados'}`;
        }

        // Reservas (Simulado o real si agregamos endpoint en tablero, pero podemos dejar pendiente o cargarlo si tuvieramos la data)
        const resEl = document.getElementById('stat-reservas');
        if (resEl) {
            // Actualmente no viene de tablero, ponemos un placeholder de estado del sistema real
            resEl.textContent = stats.sensores_activos || 0;
            // Cambiamos el subtexto manualmente en la próxima iteración, pero dejémoslo mostrando número de sensores.
            resEl.nextElementSibling.textContent = 'Sensores Activos';
        }

        // Estado
        const estEl = document.getElementById('stat-estado');
        if (estEl) {
            const isFull = stats.plazas_ocupadas >= stats.plazas_totales && stats.plazas_totales > 0;
            estEl.textContent = isFull ? 'Bloqueado' : 'Operativo';
            estEl.parentElement.className = isFull
                ? 'bg-red-600 p-6 rounded-2xl shadow-lg flex flex-col justify-between text-white'
                : 'bg-green-500 p-6 rounded-2xl shadow-lg flex flex-col justify-between text-white';
        }
    }

    evaluateCapacity(total, occupied) {
        const banner = document.getElementById('alert-banner');
        if (!banner) return;
        
        const isFull = (occupied >= total) && (total > 0);
        
        if (isFull) {
            banner.classList.remove('hidden');
            banner.classList.add('flex');
        } else {
            banner.classList.add('hidden');
            banner.classList.remove('flex');
        }
    }

    renderMap(espacios) {
        const grid = document.getElementById('slots-grid');
        if (!grid) return;

        if (!espacios || espacios.length === 0) {
            grid.innerHTML = `<div class="col-span-15 text-center text-gray-500 font-semibold py-10">${window.getTranslation('status.no_data')}</div>`;
            return;
        }

        // Ordenar espacios por zona y luego por numero
        espacios.sort((a, b) => {
            if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
            return a.numero - b.numero;
        });

        const html = espacios.map(esp => {
            let bgColor = 'bg-green-500 text-white border-transparent';
            
            if (esp.estado === 'ocupado') {
                bgColor = 'bg-red-600 text-white border-transparent';
            } else if (esp.estado === 'reservado') {
                bgColor = 'bg-yellow-300 text-black border-transparent';
            } else if (esp.estado === 'mantenimiento') {
                bgColor = 'bg-gray-200 text-black border-gray-300';
            }

            const label = `${esp.zona}-${esp.numero.toString().padStart(2, '0')}`;
            
            return `<div class="${bgColor} border text-[10px] font-bold py-3 rounded text-center transition-colors shadow-sm cursor-pointer hover:opacity-80" title="Estado: ${esp.estado.toUpperCase()}">
                ${label}
            </div>`;
        }).join('');

        grid.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.monitoringCtrl = new MonitoringController();
});
