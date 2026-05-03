// admin-payments.js
// Conecta la página de Pagos y Facturación con el backend Django
// Endpoints:
//   GET /api/pagos/         → Lista de pagos
//   GET /api/estadisticas/tablero/ → Métricas generales

const PAGE_SIZE = 10;
let allPayments = [];
let filteredPayments = [];
let currentPage = 1;

// ─── Formatear monto ──────────────────────────────────────────────
function formatCOP(amount) {
    return Number(amount).toLocaleString('es-CO') + ' cop';
}

// ─── Estado badge ─────────────────────────────────────────────────
function estadoBadge(estado) {
    const map = {
        aprobado: 'bg-green-400 text-white',
        pagado:   'bg-green-400 text-white',
        fallido:  'bg-rose-500 text-white',
        pendiente:'bg-yellow-400 text-white',
    };
    const cls = map[(estado || '').toLowerCase()] || 'bg-slate-300 text-slate-700';
    const label = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : '—';
    return `<span class="px-3 py-1 ${cls} text-xs font-bold rounded">${label}</span>`;
}

// ─── Construir fila ───────────────────────────────────────────────
function buildRow(pago) {
    const fecha = pago.fecha ? new Date(pago.fecha).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const placa = pago.vehiculo_placa || pago.placa || '—';
    const usuario = pago.usuario_nombre || pago.usuario || '—';
    const metodo = pago.metodo_pago || pago.metodo || '—';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';
    tr.dataset.pagoId = pago.id;
    tr.innerHTML = `
        <td class="py-4 px-2 text-sm font-semibold text-slate-500">#PX-${String(pago.id).padStart(4,'0')}</td>
        <td class="py-4 px-2 text-sm font-bold text-slate-800">${placa}</td>
        <td class="py-4 px-2 text-sm font-medium text-slate-600">${usuario}</td>
        <td class="py-4 px-2 text-sm text-slate-500">${fecha}</td>
        <td class="py-4 px-2 text-sm text-slate-600">${metodo}</td>
        <td class="py-4 px-2 text-sm font-bold text-slate-800 text-right">${formatCOP(pago.monto || 0)}</td>
        <td class="py-4 px-2 text-center">${estadoBadge(pago.estado_pago || pago.estado)}</td>
        <td class="py-4 px-2 flex items-center justify-center gap-3">
            <button class="text-slate-400 hover:text-primary transition-colors btn-view" data-id="${pago.id}" title="Ver Detalle">
                <i class="fa-solid fa-eye text-lg"></i>
            </button>
            <button class="text-slate-400 hover:text-primary transition-colors btn-download" data-id="${pago.id}" title="Descargar Factura">
                <i class="fa-solid fa-download text-lg"></i>
            </button>
        </td>`;
    return tr;
}

// ─── Renderizar página ────────────────────────────────────────────
function renderPage() {
    const tbody = document.getElementById('payments-tbody');
    const info  = document.getElementById('pagos-info');
    if (!tbody) return;

    tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filteredPayments.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-slate-400">No hay pagos para mostrar.</td></tr>`;
    } else {
        page.forEach(p => tbody.appendChild(buildRow(p)));
        attachRowHandlers();
    }

    if (info) info.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filteredPayments.length)} de ${filteredPayments.length} transacciones`;

    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = start + PAGE_SIZE >= filteredPayments.length;
}

// ─── Cargar pagos ─────────────────────────────────────────────────
async function loadPayments() {
    try {
        const data = await window.apiFetch('/pagos/');
        allPayments = Array.isArray(data) ? data : [];
        filteredPayments = [...allPayments];

        // Métricas
        const hoy = new Date().toDateString();
        const recaudadoHoy = allPayments
            .filter(p => new Date(p.fecha).toDateString() === hoy && ['aprobado','pagado'].includes((p.estado_pago||'').toLowerCase()))
            .reduce((s, p) => s + parseFloat(p.monto || 0), 0);

        const mes = new Date().getMonth();
        const pagosDelMes = allPayments
            .filter(p => new Date(p.fecha).getMonth() === mes).length;

        const elRecaudado = document.getElementById('stat-recaudado');
        if (elRecaudado) elRecaudado.innerHTML = `${Number(recaudadoHoy).toLocaleString('es-CO')} <span class="text-lg font-bold uppercase">cop</span>`;

        const elMes = document.getElementById('stat-pagos-mes');
        if (elMes) elMes.textContent = pagosDelMes;

        const elFacturas = document.getElementById('stat-facturas');
        if (elFacturas) elFacturas.textContent = allPayments.filter(p => ['aprobado','pagado'].includes((p.estado_pago||'').toLowerCase())).length;

        const trend = document.getElementById('stat-recaudado-trend');
        if (trend) trend.textContent = `${allPayments.length} transacciones en total`;

        renderPage();
    } catch (err) {
        console.error('Error cargando pagos:', err);
        const tbody = document.getElementById('payments-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-red-400">Error al cargar datos. Verifica tu sesión.</td></tr>`;
    }
}

// ─── Botones por fila ─────────────────────────────────────────────
function attachRowHandlers() {
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const pago = allPayments.find(p => String(p.id) === String(btn.dataset.id));
            if (!pago) return;
            alert(`Detalle del Pago #PX-${String(pago.id).padStart(4,'0')}\n\nMonto: ${formatCOP(pago.monto)}\nEstado: ${pago.estado_pago || pago.estado}\nFecha: ${new Date(pago.fecha).toLocaleString('es-CO')}\nMétodo: ${pago.metodo_pago || '—'}`);
        });
    });

    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => {
            // Si el backend provee URL de factura, redirigir; si no, mostrar mensaje
            const pago = allPayments.find(p => String(p.id) === String(btn.dataset.id));
            if (pago?.factura_url) {
                window.open(pago.factura_url, '_blank');
            } else {
                alert('La factura no está disponible para este pago.');
            }
        });
    });
}

// ─── Búsqueda ─────────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('search-transactions');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        filteredPayments = allPayments.filter(p =>
            (p.vehiculo_placa || p.placa || '').toLowerCase().includes(q) ||
            (p.usuario_nombre || p.usuario || '').toLowerCase().includes(q) ||
            String(p.id).includes(q)
        );
        currentPage = 1;
        renderPage();
    });
}

// ─── Paginación ───────────────────────────────────────────────────
function setupPagination() {
    document.getElementById('btn-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
    document.getElementById('btn-next')?.addEventListener('click', () => { currentPage++; renderPage(); });
}

// ─── Logout ───────────────────────────────────────────────────────
function setupLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', () => window.apiService?.logout());
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupPagination();
    setupLogout();
    loadPayments();
    // Auto-refresh cada 60 s
    setInterval(loadPayments, 60000);
});
