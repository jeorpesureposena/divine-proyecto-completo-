// admin-user-management.js
// Conecta la tabla de Gestión de Usuarios con el backend Django
// Endpoint: GET/POST/PUT/DELETE /api/usuarios/
// Acciones extra: POST /api/usuarios/<id>/activar/ y /desactivar/

const PAGE_SIZE = 10;
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;

// ─── Íconos SVG reutilizables ─────────────────────────────────────
const SVG_BLOCK = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>`;

const SVG_DELETE = `<svg class="h-5 w-5" fill="currentColor" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path clip-rule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        fill-rule="evenodd"></path>
</svg>`;

const SVG_EDIT = `<svg class="h-5 w-5" fill="currentColor" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
</svg>`;

// ─── Construir una fila de tabla ──────────────────────────────────
function buildRow(user) {
    const estadoBadge = user.estado
        ? `<span class="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-green-400 text-white">Activo</span>`
        : `<span class="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-red-400 text-white">Inactivo</span>`;

    const toggleTitle = user.estado ? 'Desactivar' : 'Activar';
    const toggleAction = user.estado ? 'desactivar' : 'activar';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 transition-colors';
    tr.dataset.userId = user.id;
    tr.innerHTML = `
        <td class="px-6 py-6 text-sm text-gray-500">#PX-${String(user.id).padStart(4, '0')}</td>
        <td class="px-6 py-6 text-sm font-medium text-gray-900">${user.nombre || '—'}</td>
        <td class="px-6 py-6 text-sm text-gray-500">${user.correo || '—'}</td>
        <td class="px-6 py-6 text-sm text-gray-500 capitalize">${user.rol || '—'}</td>
        <td class="px-6 py-6 text-sm text-gray-500">${user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleDateString() : '—'}</td>
        <td class="px-6 py-6">${estadoBadge}</td>
        <td class="px-6 py-6">
            <div class="flex items-center gap-3">
                <button class="btn-toggle text-gray-300 hover:text-gray-500" title="${toggleTitle}" data-id="${user.id}" data-action="${toggleAction}">
                    ${SVG_BLOCK}
                </button>
                <button class="btn-delete text-red-500 hover:text-red-700" title="Eliminar" data-id="${user.id}">
                    ${SVG_DELETE}
                </button>
                <button class="btn-edit text-divine-blue hover:text-blue-900" title="Editar" data-id="${user.id}">
                    ${SVG_EDIT}
                </button>
            </div>
        </td>`;
    return tr;
}

// ─── Renderizar página ────────────────────────────────────────────
function renderPage() {
    const tbody = document.getElementById('users-tbody');
    const tableInfo = document.getElementById('table-info');
    if (!tbody) return;

    tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageUsers = filteredUsers.slice(start, start + PAGE_SIZE);

    if (pageUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-gray-500 font-semibold" data-i18n="table.no_users">No hay usuarios para mostrar.</td></tr>`;
    } else {
        pageUsers.forEach(u => tbody.appendChild(buildRow(u)));
        attachRowHandlers();
    }

    if (tableInfo) {
        tableInfo.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filteredUsers.length)} de ${filteredUsers.length} usuarios`;
    }

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = start + PAGE_SIZE >= filteredUsers.length;
    
    if (window.i18n) window.i18n.applyLanguage();
}

// ─── Cargar usuarios desde el backend ────────────────────────────
async function loadUsers() {
    try {
        const data = await window.apiFetch('/usuarios/');
        allUsers = Array.isArray(data) ? data : [];
        filteredUsers = [...allUsers];

        // Actualizar métricas
        const activos = allUsers.filter(u => u.estado).length;
        const el = document.getElementById('stat-usuarios-activos');
        if (el) el.textContent = activos;
        const trend = document.getElementById('stat-usuarios-trend');
        if (trend) trend.innerHTML = `<span data-i18n="users.total_registered_prefix"></span>${allUsers.length} <span data-i18n="users.total_registered_suffix">registrados en total</span>`;

        // Sesiones activas (from stats endpoint if available)
        try {
            const stats = await window.apiFetch('/estadisticas/tablero/');
            const sesEl = document.getElementById('stat-sesiones-activas');
            if (sesEl) sesEl.textContent = stats.plazas_ocupadas ?? '--';
        } catch (_) {}

        renderPage();
    } catch (err) {
        console.error('Error al cargar usuarios:', err);
        const tbody = document.getElementById('users-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-red-400">Error al cargar datos. Verifica tu sesión.</td></tr>`;
    }
}

// ─── Manejadores de botones por fila ─────────────────────────────
function attachRowHandlers() {
    // Editar
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const user = allUsers.find(u => String(u.id) === String(id));
            if (!user) return;
            openEditModal(user);
        });
    });

    // Activar / Desactivar
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const action = btn.dataset.action; // 'activar' o 'desactivar'
            try {
                await window.apiFetch(`/usuarios/${id}/${action}/`, { method: 'POST' });
                await loadUsers();
            } catch (err) {
                console.error('Error al cambiar estado:', err);
                alert('No se pudo cambiar el estado del usuario.');
            }
        });
    });

    // Eliminar
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar este usuario permanentemente?')) return;
            const id = btn.dataset.id;
            try {
                const token = localStorage.getItem('auth_token');
                const resp = await fetch(`http://127.0.0.1:8000/api/usuarios/${id}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.ok) {
                    await loadUsers();
                } else {
                    alert('No se pudo eliminar el usuario.');
                }
            } catch (err) {
                console.error('Error al eliminar:', err);
            }
        });
    });
}

// ─── Modal: abrir / cerrar / guardar ──────────────────────────
function openEditModal(user) {
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-nombre').value = user.nombre || '';
    document.getElementById('edit-correo').value = user.correo || '';
    document.getElementById('edit-rol').value = user.rol || 'operador';
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function setupEditModal() {
    document.getElementById('modal-cancel')?.addEventListener('click', closeEditModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closeEditModal);

    document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const payload = {
            nombre: document.getElementById('edit-nombre').value.trim(),
            correo: document.getElementById('edit-correo').value.trim(),
            rol:    document.getElementById('edit-rol').value,
        };
        try {
            const token = localStorage.getItem('auth_token');
            const resp = await fetch(`http://127.0.0.1:8000/api/usuarios/${id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                closeEditModal();
                await loadUsers();
            } else {
                const err = await resp.json();
                alert('Error: ' + (err.detail || JSON.stringify(err)));
            }
        } catch (err) {
            console.error('Error al editar usuario:', err);
            alert('No se pudo guardar los cambios.');
        }
    });
}

// ─── Búsqueda en tiempo real ──────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        filteredUsers = allUsers.filter(u =>
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.correo || '').toLowerCase().includes(q) ||
            String(u.id).includes(q)
        );
        currentPage = 1;
        renderPage();
    });
}

// ─── Paginación ───────────────────────────────────────────────────
function setupPagination() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
    if (btnNext) btnNext.addEventListener('click', () => { currentPage++; renderPage(); });
}

// ─── Logout ───────────────────────────────────────────────────────
function setupLogout() {
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.trim() === 'Cerrar Sesión') {
            btn.addEventListener('click', () => window.apiService.logout());
        }
    });
}

// ─── Inicialización ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupPagination();
    setupLogout();
    setupEditModal();
    loadUsers();
    // Auto-refresh cada 30 s
    setInterval(loadUsers, 30000);
});
