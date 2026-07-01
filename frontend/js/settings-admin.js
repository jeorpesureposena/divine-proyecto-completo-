// settings-admin.js
// Conecta el Panel de Configuración con el backend Django
// Endpoints utilizados:
//   GET  /api/tarifas/           → Cargar tarifa activa
//   POST /api/tarifas/           → Crear nueva tarifa
//   PATCH /api/tarifas/<id>/     → Actualizar tarifa existente
//   GET  /api/espacios/?zona=X   → Estado de espacios por zona

// ─── Tarifas ──────────────────────────────────────────────────────

let tarifaActivaId = null;

async function loadTarifa() {
    try {
        const tarifas = await window.apiFetch('/tarifas/');
        // Buscar la primera tarifa activa
        const activa = Array.isArray(tarifas)
            ? tarifas.find(t => t.activa) || tarifas[0]
            : null;

        if (!activa) {
            const updated = document.getElementById('tarifa-updated');
            if (updated) {
                updated.textContent = 'No hay tarifas configuradas';
            }
            return;
        }

        tarifaActivaId = activa.id;

        // Rellenar campos
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? '';
        };

        setVal('tarifa-minuto', activa.valor_fraccion ?? '');
        setVal('tarifa-hora',   activa.valor_hora   ?? '');

        // Mostrar rango de vigencia de la tarifa
        const updated = document.getElementById('tarifa-updated');
        if (updated && activa.vigencia_inicio && activa.vigencia_fin) {
            const inicio = new Date(activa.vigencia_inicio);
            const fin = new Date(activa.vigencia_fin);
            updated.textContent = `Vigencia: ${inicio.toLocaleString()} - ${fin.toLocaleString()}`;
        } else if (updated) {
            updated.textContent = 'Tarifa cargada desde el sistema';
        }

    } catch (err) {
        console.error('Error cargando tarifas:', err);
        const updated = document.getElementById('tarifa-updated');
        if (updated) {
            updated.textContent = 'Error al cargar la tarifa';
        }
    }
}

async function saveTarifa(e) {
    e.preventDefault();

    const now = new Date();
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const payload = {
        valor_fraccion: parseFloat(document.getElementById('tarifa-minuto').value) || 0,
        valor_hora:     parseFloat(document.getElementById('tarifa-hora').value)   || 0,
        vigencia_inicio: now.toISOString(),
        vigencia_fin:    nextYear.toISOString(),
        activa: true,
    };

    try {
        const token = localStorage.getItem('auth_token');
        let resp;

        if (tarifaActivaId) {
            // Actualizar tarifa existente
            resp = await fetch(`http://127.0.0.1:8000/api/tarifas/${tarifaActivaId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            // Crear nueva tarifa
            resp = await fetch(`http://127.0.0.1:8000/api/tarifas/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (resp.ok) {
            alert('✅ Tarifas guardadas correctamente.');
            await loadTarifa();
        } else {
            const err = await resp.json();
            alert('Error: ' + JSON.stringify(err));
        }
    } catch (err) {
        console.error('Error guardando tarifas:', err);
        alert('No se pudo guardar. Revisa la consola.');
    }
}

// ─── Zonas ────────────────────────────────────────────────────────
// El backend no tiene un endpoint de "activar/desactivar zona" directo,
// así que leemos el porcentaje de ocupación de cada zona y mostramos
// si está activa (tiene espacios). El toggle actúa visualmente.

async function loadZonas() {
    try {
        const espacios = await window.apiFetch('/espacios/');
        if (!Array.isArray(espacios)) return;

        ['A', 'B', 'C', 'D'].forEach(zona => {
            const espaciosZona = espacios.filter(e => e.zona === zona);
            const tieneEspacios = espaciosZona.length > 0;
            const toggle = document.getElementById(`zona-${zona}-toggle`);
            if (toggle) {
                setZonaActiva(toggle, tieneEspacios);
            }
        });
    } catch (err) {
        console.error('Error cargando zonas:', err);
    }
}

function setZonaActiva(el, activa) {
    const track = el.querySelector('.zona-track');
    const knob  = el.querySelector('.zona-knob');
    el.dataset.activa = activa ? '1' : '0';

    if (activa) {
        track.classList.remove('bg-slate-200');
        track.classList.add('bg-divine-blue');
        knob.classList.remove('left-1');
        knob.classList.add('left-8', 'bg-white');
    } else {
        track.classList.add('bg-slate-200');
        track.classList.remove('bg-divine-blue');
        knob.classList.add('left-1');
        knob.classList.remove('left-8', 'bg-divine-blue');
    }
}

// Toggle visual (el backend no tiene endpoint de zonas, solo es UI)
function toggleZona(el) {
    const activa = el.dataset.activa !== '1';
    setZonaActiva(el, activa);
}
window.toggleZona = toggleZona;

// ─── Logout ───────────────────────────────────────────────────────
function setupLogout() {
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.trim().toLowerCase().includes('cerrar sesión')) {
            btn.addEventListener('click', () => window.apiService.logout());
        }
    });
}

// ─── Inicialización ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadTarifa();
    loadZonas();
    setupLogout();

    const form = document.getElementById('tarifa-form');
    if (form) form.addEventListener('submit', saveTarifa);
});
