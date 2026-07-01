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

// ─── Formatear método ─────────────────────────────────────────────
function formatMetodo(metodoRaw) {
    if (!metodoRaw) return '—';
    const m = metodoRaw.toLowerCase();
    const map = {
        'tarjeta': 'Tarjeta',
        'excepcion': 'Excepciones',
        'app': 'App',
        'efectivo': 'Excepciones'
    };
    return map[m] || (metodoRaw.charAt(0).toUpperCase() + metodoRaw.slice(1));
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
    const metodo = formatMetodo(pago.metodo_pago || pago.metodo);

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
        tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-slate-400" data-i18n="table.no_payments">No hay pagos para mostrar.</td></tr>`;
    } else {
        page.forEach(p => tbody.appendChild(buildRow(p)));
        attachRowHandlers();
    }

    if (info) info.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filteredPayments.length)} de ${filteredPayments.length} transacciones`;

    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = start + PAGE_SIZE >= filteredPayments.length;

    if (window.i18n) window.i18n.applyLanguage();
}

// Filter states
let currentFilters = {
    date: 'all',
    status: 'all',
    method: 'all'
};

function getTranslatedText(key, fallback) {
    if (window.getTranslation) {
        const val = window.getTranslation(key);
        if (val) return val;
    }
    return fallback;
}

function updateFilterUI() {
    const btnDate = document.querySelector('[data-i18n="filter.date"]')?.parentElement;
    if (btnDate) {
        const spanVal = btnDate.querySelector('.text-slate-900') || btnDate.lastElementChild;
        if (spanVal) {
            let label = 'Todos';
            if (currentFilters.date === 'today') {
                label = getTranslatedText('filter.today', 'hoy');
            } else if (currentFilters.date === 'month') {
                label = getTranslatedText('payments.payments_month', 'Este Mes');
            } else {
                label = getTranslatedText('filter.all_f', 'Todos');
            }
            spanVal.textContent = label;
        }
    }

    const btnStatus = document.querySelector('[data-i18n="filter.status"]')?.parentElement;
    if (btnStatus) {
        const spanVal = btnStatus.querySelector('.text-slate-900') || btnStatus.lastElementChild;
        if (spanVal) {
            let label = 'Todos';
            if (currentFilters.status === 'aprobado') {
                label = getTranslatedText('status.approved', 'Aprobado');
            } else if (currentFilters.status === 'pendiente') {
                label = getTranslatedText('status.pending', 'Pendiente');
            } else if (currentFilters.status === 'fallido') {
                label = getTranslatedText('status.rejected', 'Fallido');
            } else {
                label = getTranslatedText('filter.all_f', 'Todos');
            }
            spanVal.textContent = label;
        }
    }

    const btnMethod = document.querySelector('[data-i18n="filter.methods"]')?.parentElement;
    if (btnMethod) {
        const spanVal = btnMethod.querySelector('.text-slate-900') || btnMethod.lastElementChild;
        if (spanVal) {
            let label = 'Todos';
            if (currentFilters.method === 'tarjeta') {
                label = 'Tarjeta';
            } else if (currentFilters.method === 'excepcion') {
                label = 'Excepciones';
            } else if (currentFilters.method === 'app') {
                label = 'App';
            } else {
                label = getTranslatedText('filter.all_m', 'Todos');
            }
            spanVal.textContent = label;
        }
    }
}

function applyFilters() {
    const q = (document.getElementById('search-transactions')?.value || '').trim().toLowerCase();
    const cleanQuery = q.replace(/[-\s]/g, '');

    filteredPayments = allPayments.filter(p => {
        // Search filter
        if (q) {
            const cleanPlaca = (p.vehiculo_placa || p.placa || '').replace(/[-\s]/g, '').toLowerCase();
            const matchesSearch = (
                cleanPlaca.includes(cleanQuery) ||
                (p.usuario_nombre || '').toLowerCase().includes(q) ||
                (p.metodo || '').toLowerCase().includes(q) ||
                (p.estado_pago || '').toLowerCase().includes(q)
            );
            if (!matchesSearch) return false;
        }

        // Date filter
        if (currentFilters.date === 'today') {
            const hoy = new Date().toDateString();
            if (new Date(p.fecha).toDateString() !== hoy) return false;
        } else if (currentFilters.date === 'month') {
            const mes = new Date().getMonth();
            const anio = new Date().getFullYear();
            const pDate = new Date(p.fecha);
            if (pDate.getMonth() !== mes || pDate.getFullYear() !== anio) return false;
        }

        // Status filter
        if (currentFilters.status !== 'all') {
            const statusVal = (p.estado_pago || p.estado || '').toLowerCase();
            const normalizedStatus = statusVal === 'pagado' ? 'aprobado' : statusVal;
            if (normalizedStatus !== currentFilters.status) return false;
        }

        // Method filter
        if (currentFilters.method !== 'all') {
            if ((p.metodo_pago || p.metodo || '').toLowerCase() !== currentFilters.method) return false;
        }

        return true;
    });

    currentPage = 1;
    renderPage();
}

function setupFilters() {
    // Date filter button
    const btnDate = document.querySelector('[data-i18n="filter.date"]')?.parentElement;
    if (btnDate) {
        btnDate.addEventListener('click', () => {
            const states = ['all', 'today', 'month'];
            const idx = states.indexOf(currentFilters.date);
            currentFilters.date = states[(idx + 1) % states.length];
            updateFilterUI();
            applyFilters();
        });
    }

    // Status filter button
    const btnStatus = document.querySelector('[data-i18n="filter.status"]')?.parentElement;
    if (btnStatus) {
        btnStatus.addEventListener('click', () => {
            const states = ['all', 'aprobado', 'pendiente', 'fallido'];
            const idx = states.indexOf(currentFilters.status);
            currentFilters.status = states[(idx + 1) % states.length];
            updateFilterUI();
            applyFilters();
        });
    }

    // Method filter button
    const btnMethod = document.querySelector('[data-i18n="filter.methods"]')?.parentElement;
    if (btnMethod) {
        btnMethod.addEventListener('click', () => {
            const states = ['all', 'tarjeta', 'app', 'excepcion'];
            const idx = states.indexOf(currentFilters.method);
            currentFilters.method = states[(idx + 1) % states.length];
            updateFilterUI();
            applyFilters();
        });
    }

    // Clear filters button
    const btnClear = document.querySelector('[data-i18n="button.clear_filters"]');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            currentFilters = { date: 'all', status: 'all', method: 'all' };
            const searchInput = document.getElementById('search-transactions');
            if (searchInput) searchInput.value = '';
            updateFilterUI();
            applyFilters();
        });
    }
}

// ─── Cargar pagos ─────────────────────────────────────────────────
async function loadPayments() {
    try {
        const data = await window.apiFetch('/pagos/');
        allPayments = Array.isArray(data) ? data : [];
        
        // Ordenar por fecha descendente (más recientes primero)
        allPayments.sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha) : 0;
            const dateB = b.fecha ? new Date(b.fecha) : 0;
            return dateB - dateA;
        });

        // Aplicar filtros iniciales
        applyFilters();

        // Métricas
        const hoy = new Date().toDateString();
        const recaudadoHoy = allPayments
            .filter(p => new Date(p.fecha).toDateString() === hoy && ['aprobado','pagado'].includes((p.estado_pago||'').toLowerCase()))
            .reduce((s, p) => s + parseFloat(p.monto || 0), 0);

        const mes = new Date().getMonth();
        const anio = new Date().getFullYear();
        const pagosDelMes = allPayments
            .filter(p => {
                const pDate = new Date(p.fecha);
                return pDate.getMonth() === mes && pDate.getFullYear() === anio;
            }).length;

        const elRecaudado = document.getElementById('stat-recaudado');
        if (elRecaudado) elRecaudado.innerHTML = `${Number(recaudadoHoy).toLocaleString('es-CO')} <span class="text-lg font-bold uppercase">cop</span>`;

        const elMes = document.getElementById('stat-pagos-mes');
        if (elMes) elMes.textContent = pagosDelMes;

        const elFacturas = document.getElementById('stat-facturas');
        if (elFacturas) elFacturas.textContent = allPayments.filter(p => ['aprobado','pagado'].includes((p.estado_pago||'').toLowerCase())).length;

        const transaccionesHoy = allPayments.filter(p => new Date(p.fecha).toDateString() === hoy).length;
        const trend = document.getElementById('stat-recaudado-trend');
        if (trend) {
            trend.textContent = `${transaccionesHoy} transacciones hoy`;
            if (transaccionesHoy === 0) {
                trend.className = 'text-slate-400 text-xs font-bold';
            } else {
                trend.className = 'text-green-500 text-xs font-bold';
            }
        }
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
            
            const modal = document.getElementById('payment-detail-modal');
            const content = document.getElementById('payment-detail-modal-content');
            if (!modal) return;

            document.getElementById('detail-modal-id').value = `#PX-${String(pago.id).padStart(4,'0')}`;
            document.getElementById('detail-modal-placa').value = pago.vehiculo_placa || pago.placa || '—';
            document.getElementById('detail-modal-metodo').value = formatMetodo(pago.metodo_pago || pago.metodo);
            document.getElementById('detail-modal-usuario').value = pago.usuario_nombre || pago.usuario || '—';
            document.getElementById('detail-modal-fecha').value = pago.fecha ? new Date(pago.fecha).toLocaleString('es-CO') : '—';
            document.getElementById('detail-modal-monto').value = formatCOP(pago.monto || 0);
            
            const estadoContainer = document.getElementById('detail-modal-estado-container');
            if (estadoContainer) {
                estadoContainer.innerHTML = estadoBadge(pago.estado_pago || pago.estado);
            }

            modal.classList.remove('hidden');
            void modal.offsetWidth; // Reflow
            modal.classList.remove('opacity-0');
            if (content) content.classList.remove('scale-95');
        });
    });

    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pago = allPayments.find(p => String(p.id) === String(btn.dataset.id));
            if (pago?.factura_url) {
                try {
                    const token = localStorage.getItem('auth_token');
                    const headers = {};
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    const response = await fetch(pago.factura_url, { headers });
                    if (!response.ok) {
                        throw new Error('Error al descargar la factura');
                    }
                    const html = await response.text();
                    
                    // Descargar automáticamente el archivo HTML de la factura sin abrir ventanas ni diálogos de impresión
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `factura_PX-${String(pago.id).padStart(4,'0')}.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error('Error cargando factura:', err);
                    alert('Error al descargar la factura. Por favor, intente de nuevo.');
                }
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
        applyFilters();
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

// ─── Modal Detalle ────────────────────────────────────────────────
function setupDetailModal() {
    const modal = document.getElementById('payment-detail-modal');
    const content = document.getElementById('payment-detail-modal-content');
    const btnClose = document.getElementById('btn-detail-close');

    const closeModal = () => {
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('opacity-0');
            if (content) content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    };

    if (btnClose) {
        btnClose.addEventListener('click', closeModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupFilters();
    setupPagination();
    setupLogout();
    setupDetailModal();
    loadPayments();
    // Auto-refresh cada 60 s
    setInterval(loadPayments, 60000);
});
