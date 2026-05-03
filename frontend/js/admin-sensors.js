// ─── MONITOREO Y SENSORES ──────────────────────────────────────────
// Controlador dinámico para Monitoring-and-Sensors.html

class SensorsController {
    constructor() {
        this.init();
        // Recargar datos cada 30 segundos
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
            // Reutilizamos el endpoint de tablero para KPIs rápidos
            const stats = await window.apiFetch('/estadisticas/tablero/');
            this.updateKPIs(stats);

            // Obtener espacios de parqueo (que actúan como sensores de ultrasonido)
            const espacios = await window.apiFetch('/espacios/');
            
            // Obtener sensores reales para verificar su estado electrónico
            let sensores = [];
            try {
                sensores = await window.apiFetch('/sensores/');
            } catch (e) {
                console.log("No se pudieron cargar los sensores", e);
            }

            // Obtener cámaras OCR
            let camaras = [];
            try {
                camaras = await window.apiFetch('/camaras/');
            } catch (e) {
                console.log("No se pudieron cargar las cámaras", e);
            }
            
            this.renderTable(espacios, sensores, camaras);
        } catch (error) {
            console.error('Error cargando sensores:', error);
            const tbody = document.getElementById('devices-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">${window.getTranslation('status.error_loading') || 'Error al cargar los dispositivos.'}</td></tr>`;
            }
        }
    }

    updateKPIs(stats) {
        // En este diseño tenemos 4 cards: Sensores Activos, Sensores Inactivos, Alertas Críticas, Última Actualización
        
        // 1. Sensores Activos (del tablero de estadísticas)
        const activosEl = document.getElementById('stat-sensores-activos');
        if (activosEl && stats.sensores_activos !== undefined) {
            activosEl.textContent = stats.sensores_activos + (stats.camaras_activas || 0);
        }

        // 2. Sensores Inactivos (Total - Activos)
        const inactivosEl = document.getElementById('stat-sensores-inactivos');
        if (inactivosEl && stats.sensores_total !== undefined) {
            const inactivos = stats.sensores_total - stats.sensores_activos;
            inactivosEl.textContent = inactivos > 0 ? inactivos : 0;
        }

        // 3. Alertas Críticas (Simulado si hay sensores inactivos, o barreras bloqueadas)
        const alertasEl = document.getElementById('stat-alertas');
        if (alertasEl) {
            let alertas = 0;
            if (stats.sensores_total > stats.sensores_activos) alertas++;
            if (stats.barrera_entrada_estado === 'bloqueada') alertas++;
            if (stats.barrera_salida_estado === 'bloqueada') alertas++;
            alertasEl.textContent = alertas;
        }

        // 4. Última Actualización
        const updateEl = document.getElementById('stat-update');
        if (updateEl) {
            const now = new Date();
            updateEl.textContent = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        }
    }

    renderTable(espacios, sensores, camaras) {
        const tbody = document.getElementById('devices-tbody');
        if (!tbody) return;

        let html = '';

        // Mapa de sensores para acceso rápido por ID de espacio
        const sensoresMap = {};
        if (sensores && sensores.length > 0) {
            sensores.forEach(s => {
                sensoresMap[s.espacio] = s;
            });
        }

        // Mapear los espacios de parqueo como sensores de ultrasonido
        if (espacios && espacios.length > 0) {
            espacios.forEach(esp => {
                const sensorReal = sensoresMap[esp.id];
                
                let statusClass = 'bg-status-green/30 text-green-700';
                let statusText = 'ACTIVO';
                let valueText = esp.estado === 'ocupado' ? 'Ocupado' : (esp.estado === 'libre' ? 'Disponible' : esp.estado);
                let valueClass = esp.estado === 'ocupado' ? 'text-red-500' : 'text-blue-900';

                // Si el espacio está en mantenimiento
                if (esp.estado === 'mantenimiento') {
                    statusClass = 'bg-status-gray/20 text-gray-500';
                    statusText = 'INACTIVO';
                    valueClass = 'text-gray-400';
                    valueText = 'Sin lectura (Mantenimiento)';
                }
                // Si el sensor electrónico falló o dejó de mandar señal (Watchdog / Heartbeat)
                else if (sensorReal && sensorReal.estado_sensor === false) {
                    statusClass = 'bg-status-red text-white';
                    statusText = 'ERROR';
                    valueClass = 'text-red-500 font-bold';
                    valueText = 'Sin señal / Falló';
                }

                html += `
                <tr class="border-b border-gray-50/50 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-2 font-bold">US-${esp.zona}-${esp.numero}</td>
                    <td class="py-4 px-2 text-gray-600">Ultrasonido</td>
                    <td class="py-4 px-2 text-gray-600">Zona ${esp.zona}</td>
                    <td class="py-4 px-2">
                        <span class="${statusClass} px-3 py-1 rounded text-xs font-bold">${window.getTranslation('status.' + statusText.toLowerCase()) || statusText}</span>
                    </td>
                    <td class="py-4 px-2 ${valueClass} font-semibold capitalize">${window.getTranslation('status.' + valueText.toLowerCase().replace(/ /g, '_')) || valueText}</td>
                </tr>
                `;
            });
        }

        // Mapear cámaras OCR
        if (camaras && camaras.length > 0) {
            camaras.forEach((cam, index) => {
                let statusClass = cam.activa ? 'bg-status-green/30 text-green-700' : 'bg-status-red text-white';
                let statusText = cam.activa ? 'ACTIVO' : 'ERROR';
                let valueText = cam.activa ? 'En línea' : 'Sin señal';
                let valueClass = cam.activa ? 'text-blue-900' : 'text-red-500';

                html += `
                <tr class="border-b border-gray-50/50 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-2 font-bold">CAM-OCR-${index + 1}</td>
                    <td class="py-4 px-2 text-gray-600">Cámara LPR</td>
                    <td class="py-4 px-2 text-gray-600">${cam.ubicacion}</td>
                    <td class="py-4 px-2">
                        <span class="${statusClass} px-3 py-1 rounded text-xs font-bold">${window.getTranslation('status.' + statusText.toLowerCase()) || statusText}</span>
                    </td>
                    <td class="py-4 px-2 ${valueClass} font-semibold">${window.getTranslation('status.' + valueText.toLowerCase().replace(' ', '_')) || valueText}</td>
                </tr>
                `;
            });
        }

        if (html === '') {
            html = `<tr><td colspan="5" class="text-center py-8 text-gray-500 font-semibold">${window.getTranslation('status.no_data') || 'No hay dispositivos registrados'}</td></tr>`;
        }

        tbody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sensorsCtrl = new SensorsController();
});
