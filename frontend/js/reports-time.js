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
            tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.loading')}</td></tr>`;
        }

        try {
            this.data = await window.apiFetch('/estadisticas/alertas_tiempo/');
            this.filteredData = [...(this.data.incidencias || [])];

            // KPIs
            this.setKpi('kpi-infracciones', this.data.total_infracciones ?? 0);
            this.setKpi('kpi-promedio', `${this.data.promedio_excedido_min ?? 0} min`);
            this.setKpi('kpi-zona', this.data.zona_mas_incidencias ?? 'N/A');

            this.renderTable();
        } catch (err) {
            console.error('Error cargando alertas de tiempo:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-red-400 font-semibold">Error al cargar los datos. Verifica tu sesión.</td></tr>`;
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

    setupFilters() {
        const btnLimpiar = document.getElementById('btn-limpiar-filtros');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.filtroFechaInicio = null;
                this.filtroFechaFin = null;
                this.filtroZona = null;
                this.filtroEstado = null;

                const selZona = document.getElementById('filtro-zona');
                const selEstado = document.getElementById('filtro-estado');
                if (selZona) selZona.value = '';
                if (selEstado) selEstado.value = '';

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

        if (this.filtroZona) {
            result = result.filter(r => r.ubicacion.includes(this.filtroZona));
        }
        if (this.filtroEstado) {
            result = result.filter(r => r.estado.toLowerCase() === this.filtroEstado.toLowerCase());
        }

        this.filteredData = result;
        this.page = 1;
        this.renderTable();
    }

    setupPagination() {
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');

        if (btnPrev) btnPrev.addEventListener('click', () => {
            if (this.page > 1) { this.page--; this.renderTable(); }
        });
        if (btnNext) btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.perPage);
            if (this.page < totalPages) { this.page++; this.renderTable(); }
        });
    }

    renderTable() {
        const tbody = document.getElementById('time-table-body');
        if (!tbody) return;

        const start = (this.page - 1) * this.perPage;
        const items = this.filteredData.slice(start, start + this.perPage);

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.no_data')}</td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(inc => {
            const badgeClass = inc.estado === 'En Proceso'
                ? 'bg-[#FF5C5C] text-white'
                : 'bg-[#70FF8F] text-[#1A1A1A]';
            const estadoKey = inc.estado === 'En Proceso' ? 'status.in_process' : 'status.resolved';
            const estadoStr = window.getTranslation(estadoKey);
            return `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="py-5 px-4">${inc.fecha}</td>
                <td class="py-5 px-4 text-center font-bold">${inc.placa}</td>
                <td class="py-5 px-4 text-center">${inc.ubicacion}</td>
                <td class="py-5 px-4 text-center">${inc.tiempo_total}</td>
                <td class="py-5 px-4 text-center">
                    <span class="${badgeClass} px-3 py-1 rounded text-xs font-bold uppercase">${estadoStr}</span>
                </td>
                <td class="py-5 px-4 text-right">
                    <div class="flex justify-end gap-4">
                        <button title="Ver detalle" class="text-gray-400 hover:text-[#001D8F] transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                        </button>
                    </div>
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
