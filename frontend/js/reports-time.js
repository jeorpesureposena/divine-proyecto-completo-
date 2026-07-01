// ─── REPORTE DE ALERTAS DE TIEMPO ─────────────────────────────────
// Controlador para reports-of-time-admin.html
// Endpoint: GET /api/estadisticas/alertas_tiempo/

class TimeReportsController {
    constructor() {
        this.data = null;
        this.page = 1;
        this.perPage = 5;
        this.filteredData = [];

        // Filtros activos
        this.filtroFechaInicio = null;
        this.filtroFechaFin = null;
        this.filtroZona = null;
        this.filtroEstado = null;

        this.init();
    }

    async init() {
        this.checkAuth();
        await this.loadData();
        this.setupFilters();
        this.setupPagination();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = 'admin-login.html';
        }
    }

    async loadData() {
        const tbody = document.getElementById('time-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.loading')}</td></tr>`;
        }

        try {
            this.data = await window.apiFetch('/estadisticas/alertas_tiempo/');
            this.filteredData = [...(this.data.incidencias || [])];

            // Popular filtros dinámicos: zonas y estados
            try {
                const selZona = document.getElementById('filtro-zona');
                const selEstado = document.getElementById('filtro-estado');
                const incidencias = this.data.incidencias || [];

                let zonasRaw = incidencias.map(i => (i.ubicacion || i.zona || i.espacio_zona || '')).filter(Boolean);
                try {
                    const espacios = await window.apiFetch('/espacios/');
                    const zonasDesdeEspacios = espacios.map(e => e.zona || '').filter(Boolean);
                    zonasRaw = zonasRaw.concat(zonasDesdeEspacios);
                } catch (innerErr) {
                    console.warn('No se pudo cargar /espacios/ para zonas adicionales', innerErr);
                }

                if (selZona) {
                    const zonasNormalized = Array.from(new Set(zonasRaw
                        .map(z => this.normalizeZoneValue(z))
                        .filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b));
                    selZona.innerHTML = `<option value="">Todas</option>` + zonasNormalized.map(z => `<option value="${z}">${this.formatZoneLabel(z)}</option>`).join('');
                }

                if (selEstado) {
                    const estados = Array.from(new Set(incidencias.map(i => (i.estado || '').toLowerCase()))).filter(Boolean);
                    // capitalizar la primera letra
                    selEstado.innerHTML = `<option value="">Todos</option>` + estados.map(e => `<option value="${e}">${e.charAt(0).toUpperCase()+e.slice(1)}</option>`).join('');
                }
            } catch (e) {
                console.warn('No se pudieron popular los filtros dinámicos', e);
            }

            // KPIs
            this.setKpi('kpi-infracciones', this.data.total_infracciones ?? 0);
            this.setKpi('kpi-promedio', this.data.promedio_excedido_min ?? 0);
            this.setKpi('kpi-zona', this.data.zona_mas_incidencias ?? 'N/A');

            this.renderTable();
        } catch (err) {
            console.error('Error cargando alertas de tiempo:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-red-400 font-semibold">Error al cargar los datos. Verifica tu sesión.</td></tr>`;
            }
            this.setKpi('kpi-infracciones', '--');
            this.setKpi('kpi-promedio', '--');
            this.setKpi('kpi-zona', '--');
        }
    }

    setKpi(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    normalizeZoneValue(value) {
        if (value === null || value === undefined) return '';
        let zone = String(value).trim();
        if (!zone) return '';
        zone = zone.replace(/^(zona|z)[\s:-]*/i, '');
        const match = zone.match(/^([A-Za-z0-9]+)/);
        if (match) {
            zone = match[1];
        }
        return zone.toUpperCase();
    }

    formatZoneLabel(zone) {
        if (!zone) return 'Sin zona';
        if (/^[A-Z0-9]+$/.test(zone)) {
            return `Zona ${zone}`;
        }
        return zone;
    }

    setupFilters() {
        const btnLimpiar = document.getElementById('btn-limpiar-filtros');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.filtroFechaInicio = null;
                this.filtroFechaFin = null;
                this.filtroZona = null;
                this.filtroEstado = null;

                const fechaInicio = document.getElementById('filtro-fecha-inicio');
                const fechaFin = document.getElementById('filtro-fecha-fin');
                const selZona = document.getElementById('filtro-zona');
                const selEstado = document.getElementById('filtro-estado');
                if (fechaInicio) fechaInicio.value = '';
                if (fechaFin) fechaFin.value = '';
                if (selZona) selZona.value = '';
                if (selEstado) selEstado.value = '';

                this.applyFilters();
            });
        }

        const fechaInicio = document.getElementById('filtro-fecha-inicio');
        if (fechaInicio) {
            fechaInicio.addEventListener('change', (e) => {
                this.filtroFechaInicio = e.target.value || null;
                this.applyFilters();
            });
        }

        const fechaFin = document.getElementById('filtro-fecha-fin');
        if (fechaFin) {
            fechaFin.addEventListener('change', (e) => {
                this.filtroFechaFin = e.target.value || null;
                this.applyFilters();
            });
        }

        const selZona = document.getElementById('filtro-zona');
        if (selZona) {
            selZona.addEventListener('change', (e) => {
                this.filtroZona = e.target.value || null;
                this.applyFilters();
            });
        }

        const selEstado = document.getElementById('filtro-estado');
        if (selEstado) {
            selEstado.addEventListener('change', (e) => {
                this.filtroEstado = e.target.value || null;
                this.applyFilters();
            });
        }
    }

    applyFilters() {
        if (!this.data) return;
        let result = [...(this.data.incidencias || [])];

        const normalizeZona = (item) => {
            return this.normalizeZoneValue(item.ubicacion || item.zona || item.espacio_zona);
        };

        if (this.filtroFechaInicio) {
            const start = new Date(`${this.filtroFechaInicio}T00:00:00`);
            if (!isNaN(start.getTime())) {
                result = result.filter(r => {
                    const fecha = new Date(r.fecha);
                    return !isNaN(fecha.getTime()) && fecha >= start;
                });
            }
        }

        if (this.filtroFechaFin) {
            const end = new Date(`${this.filtroFechaFin}T23:59:59.999`);
            if (!isNaN(end.getTime())) {
                result = result.filter(r => {
                    const fecha = new Date(r.fecha);
                    return !isNaN(fecha.getTime()) && fecha <= end;
                });
            }
        }

        if (this.filtroZona) {
            result = result.filter(r => normalizeZona(r) === this.filtroZona);
        }
        if (this.filtroEstado) {
            result = result.filter(r => (r.estado || '').toString().toLowerCase() === this.filtroEstado.toLowerCase());
        }

        this.filteredData = result;
        this.page = 1;
        this.renderTable();
    }

    setupPagination() {
        // Attach listeners to any pagination button instances (top/bottom duplicates)
        const btnPrevs = document.querySelectorAll('#btn-prev');
        const btnNexts = document.querySelectorAll('#btn-next');

        btnPrevs.forEach(btn => btn.addEventListener('click', () => {
            if (this.page > 1) { this.page--; this.renderTable(); }
        }));
        btnNexts.forEach(btn => btn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.perPage);
            if (this.page < totalPages) { this.page++; this.renderTable(); }
        }));
    }

    renderTable() {
        const tbody = document.getElementById('time-table-body');
        if (!tbody) return;

        const start = (this.page - 1) * this.perPage;
        const items = this.filteredData.slice(start, start + this.perPage);

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.no_data')}</td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(inc => {
            const isEntrada = (inc.estado || '').toString().toLowerCase() === 'entrada';
            const badgeClass = isEntrada
                ? 'bg-green-400 text-white'
                : 'bg-blue-500 text-white';
            const estadoStr = inc.estado || 'N/A';
            const zona = this.formatZoneLabel(this.normalizeZoneValue(inc.ubicacion || inc.zona || inc.espacio_zona));
            return `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="py-5 px-4">${inc.fecha || '--'}</td>
                <td class="py-5 px-4 text-center font-bold">#${inc.placa || '--'}</td>
                <td class="py-5 px-4 text-center">${zona}</td>
                <td class="py-5 px-4 text-center font-medium text-slate-700">${inc.tiempo_total || '--'}</td>
                <td class="py-5 px-4 text-center">
                    <span class="${badgeClass} px-3 py-1 rounded text-xs font-bold uppercase">${estadoStr}</span>
                </td>
            </tr>`;
        }).join('');

        // Actualizar estado de botones
        const totalPages = Math.ceil(this.filteredData.length / this.perPage);
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if (btnPrev) btnPrev.classList.toggle('opacity-40', this.page <= 1);
        if (btnNext) btnNext.classList.toggle('opacity-40', this.page >= totalPages);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TimeReportsController();
});
