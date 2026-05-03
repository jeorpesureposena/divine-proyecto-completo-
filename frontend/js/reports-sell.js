// ─── REPORTE DE VENTAS ─────────────────────────────────────────────
// Controlador para reports-sell-admin.html
// Endpoint: GET /api/estadisticas/ventas/

class SellReportsController {
    constructor() {
        this.data = null;
        this.page = 1;
        this.perPage = 5;
        this.init();
    }

    async init() {
        this.checkAuth();
        await this.loadData();
        this.setupPagination();
    }

    checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = 'admin-login.html';
        }
    }

    async loadData() {
        const tbody = document.getElementById('sell-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.loading')}</td></tr>`;
        }

        try {
            this.data = await window.apiFetch('/estadisticas/ventas/');

            // KPIs
            this.setKpi('kpi-ventas', this.formatCOP(this.data.total_ventas));
            this.setKpi('kpi-facturas', (this.data.total_facturas ?? 0).toLocaleString('es-CO'));
            this.setKpi('kpi-promedio', this.formatCOP(this.data.promedio_venta));
            this.setKpi('kpi-ocupacion', `${this.data.ocupacion_maxima ?? 0}%`);

            // Tendencia (placeholder positivo si hay ventas)
            const tendenciaEl = document.getElementById('kpi-ventas-tendencia');
            if (tendenciaEl && this.data.total_ventas > 0) {
                tendenciaEl.textContent = '+activo este mes';
                tendenciaEl.className = 'text-[10px] font-bold text-green-500 mt-1';
            }

            // Barra de ocupacion
            const barOcupacion = document.getElementById('bar-ocupacion');
            if (barOcupacion) {
                barOcupacion.style.width = `${this.data.ocupacion_maxima}%`;
            }

            // Grafico de barras
            this.renderChart(this.data.ventas_diarias || []);

            // Tabla de pagos
            this.renderTable();
        } catch (err) {
            console.error('Error cargando ventas:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-red-400 font-semibold">Error al cargar los datos. Verifica tu sesión.</td></tr>`;
            }
            ['kpi-ventas', 'kpi-facturas', 'kpi-promedio', 'kpi-ocupacion'].forEach(id => this.setKpi(id, '--'));
        }
    }

    formatCOP(valor) {
        if (!valor && valor !== 0) return '--';
        return new Intl.NumberFormat('es-CO', { style: 'decimal' }).format(Math.round(valor)) + ' cop';
    }

    setKpi(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    renderChart(ventas_diarias) {
        const container = document.getElementById('chart-bars');
        if (!container || !ventas_diarias.length) return;

        const maxVal = Math.max(...ventas_diarias.map(v => v.total), 1);

        container.innerHTML = ventas_diarias.map((v, idx) => {
            const heightPct = maxVal > 0 ? Math.round((v.total / maxVal) * 100) : 2;
            const isMax = v.total === maxVal && maxVal > 0;
            const barColor = isMax ? 'bg-divine-cyan shadow-[0_0_20px_rgba(0,212,255,0.4)]' : 'bg-divine-blue';
            const tooltip = isMax
                ? `<div class="absolute -top-12 bg-divine-cyan text-divine-blue px-3 py-1 rounded-md text-xs font-bold shadow-lg">${this.formatCOP(v.total)}<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-divine-cyan rotate-45"></div></div>`
                : '';
            return `
            <div class="flex-1 flex flex-col items-center ${isMax ? 'relative' : 'group'}">
                ${tooltip}
                <div class="w-full ${barColor} rounded-t-sm transition-all hover:opacity-80" style="height:${heightPct}%"></div>
                <span class="mt-4 text-xs font-bold text-gray-400">${v.dia.substring(0, 3)}</span>
            </div>`;
        }).join('');
    }

    setupPagination() {
        const btnPrev = document.getElementById('btn-prev-sell');
        const btnNext = document.getElementById('btn-next-sell');

        if (btnPrev) btnPrev.addEventListener('click', () => {
            if (this.page > 1) { this.page--; this.renderTable(); }
        });
        if (btnNext) btnNext.addEventListener('click', () => {
            if (!this.data) return;
            const totalPages = Math.ceil((this.data.ultimos_pagos || []).length / this.perPage);
            if (this.page < totalPages) { this.page++; this.renderTable(); }
        });
    }

    renderTable() {
        const tbody = document.getElementById('sell-table-body');
        if (!tbody || !this.data) return;

        const pagos = this.data.ultimos_pagos || [];
        const start = (this.page - 1) * this.perPage;
        const items = pagos.slice(start, start + this.perPage);

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-gray-400 font-semibold">${window.getTranslation('status.no_data')}</td></tr>`;
            return;
        }

        const metodoIcono = { 'tarjeta': 'CARD', 'efectivo': 'CASH', 'app': 'APP' };
        const metodoLabel = { 'tarjeta': 'Tarjeta de Crédito', 'efectivo': 'Efectivo', 'app': 'App Móvil' };

        tbody.innerHTML = items.map(p => {
            const estadoClass = p.estado === 'aprobado'
                ? 'bg-green-400 text-white'
                : p.estado === 'pendiente'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-red-400 text-white';
            const estadoLabel = window.getTranslation('status.' + p.estado) || p.estado;
            const icono = metodoIcono[p.metodo] || 'OTR';
            const label = metodoLabel[p.metodo] || p.metodo;
            return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 text-sm font-semibold text-slate-700">${p.fecha}</td>
                <td class="px-6 py-4 text-sm font-bold text-slate-500">#${p.ticket_id}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-10 h-5 bg-gray-100 rounded flex items-center justify-center text-[8px] font-bold text-gray-500 border border-gray-200">${icono}</div>
                        <span class="text-sm font-semibold text-slate-700">${label}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 ${estadoClass} rounded-md text-[10px] font-bold">${estadoLabel}</span>
                </td>
                <td class="px-6 py-4 text-right text-sm font-extrabold text-slate-800">${this.formatCOP(p.monto)}</td>
            </tr>`;
        }).join('');

        // Estado botones paginación
        const totalPages = Math.ceil(pagos.length / this.perPage);
        const btnPrev = document.getElementById('btn-prev-sell');
        const btnNext = document.getElementById('btn-next-sell');
        if (btnPrev) btnPrev.classList.toggle('opacity-40', this.page <= 1);
        if (btnNext) btnNext.classList.toggle('opacity-40', this.page >= totalPages);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SellReportsController();
});
