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
        this.setupExportButton();
        await this.loadData();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = 'admin-login.html';
        }
    }

    setupExportButton() {
        const btnExport = document.getElementById('btn-export-sensors');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
            const tbody = document.getElementById('devices-tbody');
            if (!tbody) return;

            const rows = tbody.querySelectorAll('tr');
            if (rows.length === 0 || tbody.textContent.includes('No hay dispositivos')) {
                alert('No hay dispositivos para exportar.');
                return;
            }

            let csvContent = "\ufeff"; // BOM para UTF-8
            csvContent += "ID Sensor,Tipo,Ubicación,Estado,Lectura\n";

            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                const rowData = [];
                cols.forEach(col => {
                    let text = col.innerText || col.textContent || '';
                    text = text.replace(/[\n\r]+/g, ' ').replace(/,/g, ';').trim();
                    rowData.push(text);
                });
                csvContent += rowData.join(",") + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `estado_dispositivos_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    async loadData() {
        try {
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

            // Obtener notificaciones
            let notificaciones = [];
            try {
                notificaciones = await window.apiFetch('/notificaciones/');
            } catch (e) {
                console.log("No se pudieron cargar las notificaciones", e);
            }

            // Reutilizamos el endpoint de tablero para KPIs rápidos
            const stats = await window.apiFetch('/estadisticas/tablero/');
            this.updateKPIs(stats, notificaciones);
            
            this.renderTable(espacios, sensores, camaras);
            this.renderNotificaciones(notificaciones);
        } catch (error) {
            console.error('Error cargando sensores:', error);
            const tbody = document.getElementById('devices-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">Error al cargar los dispositivos.</td></tr>`;
            }
        }
    }

    updateKPIs(stats, notificaciones) {
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

        // 3. Alertas Críticas (Conectado a las notificaciones reales)
        const alertasEl = document.getElementById('stat-alertas');
        if (alertasEl) {
            let alertas = 0;
            if (notificaciones && notificaciones.length > 0) {
                // Filtramos las que son críticas (alerta o sistema) y que no han sido leídas
                alertas = notificaciones.filter(n => (n.tipo === 'alerta' || n.tipo === 'sistema') && !n.leida).length;
            }
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
                    valueText = '<span data-i18n="status.no_reading">Sin lectura (Mantenimiento)</span>';
                }
                // Si el sensor electrónico falló o dejó de mandar señal (Watchdog / Heartbeat)
                else if (sensorReal && sensorReal.estado_sensor === false) {
                    statusClass = 'bg-status-red text-white';
                    statusText = 'ERROR';
                    valueClass = 'text-red-500 font-bold';
                    valueText = '<span data-i18n="status.no_signal">Sin señal / Falló</span>';
                } else {
                    if (esp.estado === 'ocupado') {
                        valueText = '<span data-i18n="status.occupied">Ocupado</span>';
                    } else if (esp.estado === 'libre') {
                        valueText = '<span data-i18n="status.available">Disponible</span>';
                    } else {
                        valueText = esp.estado;
                    }
                }

                html += `
                <tr class="border-b border-gray-50/50 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-2 font-bold">US-${esp.zona}-${esp.numero}</td>
                    <td class="py-4 px-2 text-gray-600"><span data-i18n="sensor.ultrasound">Ultrasonido</span></td>
                    <td class="py-4 px-2 text-gray-600"><span data-i18n="sensor.zone_prefix">Zona</span> ${esp.zona}</td>
                    <td class="py-4 px-2">
                        <span class="${statusClass} px-3 py-1 rounded text-xs font-bold" data-i18n="status.${statusText.toLowerCase()}">${statusText}</span>
                    </td>
                    <td class="py-4 px-2 ${valueClass} font-semibold capitalize">${valueText}</td>
                </tr>
                `;
            });
        }

        // Mapear cámaras OCR
        if (camaras && camaras.length > 0) {
            camaras.forEach((cam, index) => {
                let statusClass = cam.activa ? 'bg-status-green/30 text-green-700' : 'bg-status-red text-white';
                let statusText = cam.activa ? 'ACTIVO' : 'ERROR';
                let valueText = cam.activa ? '<span data-i18n="status.online">En línea</span>' : '<span data-i18n="status.no_signal_cam">Sin señal</span>';
                let valueClass = cam.activa ? 'text-blue-900' : 'text-red-500';

                html += `
                <tr class="border-b border-gray-50/50 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-2 font-bold">CAM-OCR-${index + 1}</td>
                    <td class="py-4 px-2 text-gray-600"><span data-i18n="sensor.lpr_camera">Cámara LPR</span></td>
                    <td class="py-4 px-2 text-gray-600">${cam.ubicacion}</td>
                    <td class="py-4 px-2">
                        <span class="${statusClass} px-3 py-1 rounded text-xs font-bold" data-i18n="status.${statusText.toLowerCase()}">${statusText}</span>
                    </td>
                    <td class="py-4 px-2 ${valueClass} font-semibold">${valueText}</td>
                </tr>
                `;
            });
        }

        if (html === '') {
            html = `<tr><td colspan="5" class="text-center py-8 text-gray-500 font-semibold" data-i18n="table.no_devices">No hay dispositivos registrados</td></tr>`;
        }

        tbody.innerHTML = html;
        if (window.i18n) window.i18n.applyLanguage();
    }

    renderNotificaciones(notificaciones) {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        if (!notificaciones || notificaciones.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 font-semibold text-sm py-10">No hay alertas recientes</div>`;
            return;
        }

        let html = '';
        notificaciones.slice(0, 5).forEach(notif => {
            let bgColor = 'bg-blue-100';
            let borderColor = 'border-blue-500';
            let titleColor = 'text-blue-700';
            let textColor = 'text-blue-800';
            let titleText = 'Informativa';

            if (notif.tipo === 'alerta' || notif.tipo === 'sistema') {
                bgColor = 'bg-red-200';
                borderColor = 'border-red-500';
                titleColor = 'text-red-600';
                textColor = 'text-red-700';
                titleText = 'Crítica';
            } else if (notif.tipo === 'pago') {
                bgColor = 'bg-green-200';
                borderColor = 'border-green-500';
                titleColor = 'text-green-700';
                textColor = 'text-green-800';
                titleText = 'Pago';
            }

            const timeString = new Date(notif.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

            html += `
            <div class="${bgColor} rounded-divine p-4 border-l-8 ${borderColor}">
                <div class="flex justify-between items-start mb-1">
                    <span class="${titleColor} font-bold text-sm">${titleText} ${timeString}</span>
                </div>
                <p class="${textColor} text-xs font-semibold leading-relaxed">${notif.mensaje}</p>
            </div>
            `;
        });

        container.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sensorsCtrl = new SensorsController();
});
