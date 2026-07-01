// operador.js - Lógica del Dashboard del Operador
// Conectado al backend Django REST API

let espaciosGlobal = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Autenticación
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'operador-login.html';
        return;
    }

    // 2. Cargar nombre del usuario en el topbar
    let usuario = null;
    try {
        usuario = JSON.parse(localStorage.getItem('operator_data'));
    } catch (e) { }

    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay && usuario) {
        usernameDisplay.textContent = usuario.nombre || usuario.full_name || 'Operador';
        // Actualizar inicial del avatar
        const avatar = document.querySelector('.avatar');
        if (avatar && usuario.nombre) {
            avatar.textContent = usuario.nombre.charAt(0).toUpperCase();
        }
    }

    // 3. Cargar todos los datos del tablero en paralelo
    await Promise.all([
        loadSensores(),
        loadCamaras(),
        loadBarreras(),
        loadNotificaciones(),
        loadHistorialEventos(),
        loadEspacios(),
        loadTiposVehiculo()
    ]);

    // 4. Configurar eventos de modales y formularios
    setupModals();
    setupForms();

    // 5. Auto-refresco cada 30 segundos
    setInterval(async () => {
        await Promise.all([
            loadSensores(),
            loadCamaras(),
            loadBarreras(),
            loadNotificaciones(),
            loadHistorialEventos()
        ]);
    }, 30000);
});


// ─── CARGA DE TARJETAS DE MONITOREO ──────────────────────────────

async function loadSensores() {
    try {
        const sensores = await apiFetch('/sensores/');
        const total = sensores.length;
        const activos = sensores.filter(s => s.estado_sensor === true).length;
        const porcentaje = total > 0 ? Math.round((activos / total) * 100) : 0;

        const el = document.getElementById('stat-sensores');
        if (el) {
            el.innerHTML = `${porcentaje}% <span class="badge badge-active">Activo</span>`;
        }
    } catch (error) {
        const el = document.getElementById('stat-sensores');
        if (el) el.innerHTML = `-- <span class="badge badge-complete">Sin datos</span>`;
    }
}

async function loadCamaras() {
    try {
        const camaras = await apiFetch('/camaras/');
        const activas = camaras.filter(c => c.activa === true).length;

        const el = document.getElementById('stat-camaras');
        if (el) {
            el.textContent = `${activas} activa${activas !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        const el = document.getElementById('stat-camaras');
        if (el) el.textContent = '-- activas';
    }
}

async function loadBarreras() {
    try {
        const barreras = await apiFetch('/barreras/');
        // Buscar barrera de entrada y salida por ubicación
        const barrераEntrada = barreras.find(b =>
            b.ubicacion && b.ubicacion.toLowerCase().includes('entrada')
        );
        const barreraSalida = barreras.find(b =>
            b.ubicacion && b.ubicacion.toLowerCase().includes('salida')
        );

        const elEntrada = document.getElementById('barrera-entrada');
        const elSalida = document.getElementById('barrera-salida');

        if (elEntrada) {
            const estadoEntrada = barrераEntrada ? barrераEntrada.estado : null;
            const activa = estadoEntrada === 'abierta' || estadoEntrada === 'cerrada';
            elEntrada.innerHTML = `Entrada: <span class="badge ${activa ? 'badge-active' : 'badge-complete'}">${activa ? 'Activo' : 'Inactivo'}</span>`;
        }
        if (elSalida) {
            const estadoSalida = barreraSalida ? barreraSalida.estado : null;
            const activa = estadoSalida === 'abierta' || estadoSalida === 'cerrada';
            elSalida.innerHTML = `Salida: <span class="badge ${activa ? 'badge-active' : 'badge-complete'}">${activa ? 'Activo' : 'Inactivo'}</span>`;
        }
    } catch (error) {
        // Si no hay barreras registradas, mostrar estado por defecto
        const elEntrada = document.getElementById('barrera-entrada');
        const elSalida = document.getElementById('barrera-salida');
        if (elEntrada) elEntrada.innerHTML = `Entrada: <span class="badge badge-active">Activo</span>`;
        if (elSalida) elSalida.innerHTML = `Salida: <span class="badge badge-active">Activo</span>`;
    }
}


// ─── NOTIFICACIONES DE ALERTAS ────────────────────────────────────

async function loadNotificaciones() {
    try {
        const notificaciones = await apiFetch('/notificaciones/');
        const container = document.getElementById('alertas-container');
        if (!container) return;

        if (notificaciones.length === 0) {
            container.innerHTML = `<div class="alert-item info">No hay notificaciones recientes.</div>`;
            return;
        }

        // Mostrar las últimas 3 notificaciones
        const ultimas = notificaciones.slice(0, 3);
        container.innerHTML = ultimas.map(n => {
            const esAlerta = n.tipo === 'alerta';
            const clase = esAlerta ? 'danger' : 'info';
            const fechaFormateada = new Date(n.fecha).toLocaleString('es-CO', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            return `
                <div class="alert-item ${clase}">
                    ${n.mensaje}
                    <span style="float:right; font-size:0.75rem; color:#999;">${fechaFormateada}</span>
                </div>`;
        }).join('');

    } catch (error) {
        const container = document.getElementById('alertas-container');
        if (container) {
            container.innerHTML = `<div class="alert-item info">No se pudieron cargar las notificaciones.</div>`;
        }
    }
}


// ─── HISTORIAL DE EVENTOS ─────────────────────────────────────────

function extractArrayFromApiResponse(resp) {
    if (Array.isArray(resp)) return resp;
    if (!resp || typeof resp !== 'object') return [];

    const keysToCheck = ['results', 'data', 'eventos', 'events', 'items', 'results'];
    for (const key of keysToCheck) {
        if (Array.isArray(resp[key])) return resp[key];
    }

    for (const value of Object.values(resp)) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') {
            const nested = extractArrayFromApiResponse(value);
            if (Array.isArray(nested) && nested.length > 0) return nested;
        }
    }

    return [];
}

async function loadHistorialEventos() {
    try {
        const eventosResp = await apiFetch('/eventos/');
        const eventos = extractArrayFromApiResponse(eventosResp);
        const tbody = document.getElementById('historial-tbody');
        if (!tbody) return;

        if (!eventos || eventos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Sin registros aún.</td></tr>`;
            return;
        }

        // Mostrar los últimos 10 eventos ordenados por fecha
        const ultimos = eventos.slice(0, 10);
        tbody.innerHTML = ultimos.map(evento => {
            const fecha = new Date(evento.fecha_hora);
            const fechaFormateada = fecha.toLocaleString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const esEntrada = (evento.tipo_evento || '').toString().toLowerCase() === 'entrada';
            const badgeClass = esEntrada ? 'badge-process' : 'badge-complete';
            const badgeText = esEntrada ? 'En Proceso' : 'Completado';
            const tipoText = esEntrada ? 'Entrada' : 'Salida';

            let espacioInfo = '--';
            if (evento.espacio_zona && evento.espacio_numero !== null && evento.espacio_numero !== undefined) {
                espacioInfo = `${evento.espacio_zona}-${String(evento.espacio_numero).padStart(2, '0')}`;
            } else if (evento.ubicacion) {
                espacioInfo = evento.ubicacion;
            }

            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td style="font-weight: 600;">${evento.placa_detectada || '--'}</td>
                    <td>${espacioInfo}</td>
                    <td>${tipoText}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                </tr>`;
        }).join('');

    } catch (error) {
        const tbody = document.getElementById('historial-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#e53e3e; padding:20px;">Error al cargar el historial.</td></tr>`;
        }
    }
}


// ─── ESPACIOS LIBRES (para modal de entrada) ──────────────────────

async function loadEspacios() {
    try {
        espaciosGlobal = await apiFetch('/espacios/');
        const selectEntrada = document.getElementById('espacio-entrada');
        if (selectEntrada) {
            const libres = espaciosGlobal.filter(e => e.estado === 'libre');
            if (libres.length === 0) {
                selectEntrada.innerHTML = '<option value="">No hay espacios libres</option>';
            } else {
                selectEntrada.innerHTML = '<option value="">Seleccione un espacio libre...</option>';
                libres.forEach(espacio => {
                    const opt = document.createElement('option');
                    opt.value = espacio.id;
                    opt.textContent = `Espacio #${espacio.numero} (${espacio.tipo})`;
                    selectEntrada.appendChild(opt);
                });
            }
        }
    } catch (error) {
        console.error('Error cargando espacios:', error);
    }
}

async function loadTiposVehiculo() {
    try {
        const tipos = await apiFetch('/vehiculos/tipos/');
        const selectTipos = document.getElementById('tipo-entrada');
        if (selectTipos) {
            selectTipos.innerHTML = '';
            if (tipos.length === 0) {
                selectTipos.innerHTML = '<option value="">No hay tipos disponibles</option>';
                return;
            }
            tipos.forEach(tipo => {
                const opt = document.createElement('option');
                opt.value = tipo.id;
                opt.textContent = tipo.nombre;
                selectTipos.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error cargando tipos de vehículo:', error);
    }
}

// ─── MODALES ──────────────────────────────────────────────────────

function setupModals() {
    // Los botones del sidebar ahora son links <a href> que navegan a las páginas dedicadas.
    // Solo se configuran los cierres de los modales de Entrada/Salida (aún accesibles si se usan directamente).

    // Cerrar modales con botón X
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Cerrar modales clickeando el fondo
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}


// ─── FORMULARIOS ──────────────────────────────────────────────────

function setupForms() {

    // FORMULARIO ENTRADA MANUAL
    const formEntrada = document.getElementById('form-entrada');
    if (formEntrada) {
        const btnRegistrar = formEntrada.querySelector('button[type="submit"]');
        btnRegistrar.disabled = true; // Bloqueado por defecto

        const btnBuscar = document.getElementById('btn-buscar-entrada');
        if (btnBuscar) {
            btnBuscar.addEventListener('click', async () => {
                const placa = document.getElementById('placa-entrada').value.toUpperCase().trim();
                if (!placa) {
                    showToast('Por favor ingresa una placa', 'error');
                    return;
                }

                btnBuscar.innerHTML = '<i class="bx bx-loader bx-spin"></i>';
                btnBuscar.disabled = true;

                try {
                    const data = await apiFetch('/sesiones/validar-entrada/', {
                        method: 'POST',
                        body: JSON.stringify({ placa })
                    });

                    if (data.valido) {
                        const infoDiv = document.getElementById('vehiculo-info-entrada');
                        infoDiv.style.display = 'block';
                        infoDiv.innerHTML = `
                            <strong>Vehículo:</strong> ${data.vehiculo.marca} ${data.vehiculo.modelo} (${data.vehiculo.color})<br>
                            <strong>Reserva:</strong> #${data.reserva_id} | <strong>Espacio:</strong> ${data.espacio.zona}-${String(data.espacio.numero).padStart(2, '0')}
                        `;

                        document.getElementById('tipo-entrada').value = data.vehiculo.tipo;
                        const selectEspacio = document.getElementById('espacio-entrada');
                        selectEspacio.value = data.espacio.id;
                        
                        if (!selectEspacio.value) {
                            const opt = document.createElement('option');
                            opt.value = data.espacio.id;
                            opt.textContent = `${data.espacio.zona}-${String(data.espacio.numero).padStart(2, '0')} (Reservado)`;
                            selectEspacio.appendChild(opt);
                            selectEspacio.value = data.espacio.id;
                        }

                        document.getElementById('tipo-entrada').style.pointerEvents = 'none';
                        document.getElementById('espacio-entrada').style.pointerEvents = 'none';

                        btnRegistrar.disabled = false;
                        showToast('Vehículo verificado', 'success');
                    }
                } catch (error) {
                    document.getElementById('vehiculo-info-entrada').style.display = 'none';
                    btnRegistrar.disabled = true;
                    showToast(error.message || 'No se encontró reserva para esta placa', 'error');
                } finally {
                    btnBuscar.innerHTML = '<i class="bx bx-search"></i> Buscar';
                    btnBuscar.disabled = false;
                }
            });
        }

        formEntrada.addEventListener('submit', async (e) => {
            e.preventDefault();
            btnRegistrar.disabled = true;
            btnRegistrar.textContent = 'Registrando...';

            const payload = {
                placa: document.getElementById('placa-entrada').value.toUpperCase().trim(),
                tipo: document.getElementById('tipo-entrada').value,
                espacio_id: document.getElementById('espacio-entrada').value
            };

            if (!payload.espacio_id) {
                showToast('Seleccione un espacio disponible', 'error');
                btn.disabled = false;
                btn.textContent = 'Confirmar Entrada';
                return;
            }

            try {
                await apiFetch('/sesiones/entrada-manual/', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                showToast(`Entrada de ${payload.placa} registrada exitosamente`, 'success');
                document.getElementById('modal-entrada').classList.remove('active');
                formEntrada.reset();

                // Recargar datos afectados
                await Promise.all([loadEspacios(), loadHistorialEventos()]);

            } catch (error) {
                showToast(error.message || 'Error al registrar entrada', 'error');
            } finally {
                btnRegistrar.disabled = false;
                btnRegistrar.textContent = 'Confirmar Entrada';
            }
        });
    }

    // FORMULARIO SALIDA MANUAL
    const formSalida = document.getElementById('form-salida');
    if (formSalida) {
        formSalida.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formSalida.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Buscando...';

            const placa = document.getElementById('placa-salida').value.toUpperCase().trim();

            try {
                // 1. Buscar sesión activa por placa ignorando guiones y espacios
                btn.textContent = 'Procesando...';
                const sesiones = await apiFetch('/sesiones/');
                const placaLimpia = placa.replace(/[-\s]/g, '');
                
                const sesionActiva = sesiones.find(s => {
                    const dbPlaca = (s.vehiculo_placa || '').toUpperCase().replace(/[-\s]/g, '');
                    return dbPlaca === placaLimpia && s.estado_sesion === 'abierta';
                });

                if (!sesionActiva) {
                    throw new Error(`No se encontró una sesión abierta para la placa ${placa}`);
                }

                // 2. Registrar salida manual
                const resultado = await apiFetch(`/sesiones/${sesionActiva.id}/salida-manual/`, {
                    method: 'POST'
                });

                const monto = new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0
                }).format(resultado.pago.monto);

                showToast(`Salida registrada. Total a cobrar: ${monto}`, 'success');

                // Mostrar resumen de cobro
                const duracion = resultado.sesion.duracion_min;
                const horas = Math.floor(duracion / 60);
                const minutos = duracion % 60;
                const duracionTexto = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;

                mostrarResumenCobro(placa, duracionTexto, monto);

                document.getElementById('modal-salida').classList.remove('active');
                formSalida.reset();

                // Recargar datos afectados
                await Promise.all([loadEspacios(), loadHistorialEventos()]);

            } catch (error) {
                showToast(error.message || 'Error al registrar salida', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Calcular y Registrar Salida';
            }
        });
    }
}


// ─── MODAL RESUMEN DE COBRO ───────────────────────────────────────

function mostrarResumenCobro(placa, duracion, monto) {
    // Crear modal dinámico de resumen
    const modalExistente = document.getElementById('modal-resumen');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-resumen';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <div style="font-size: 3rem; color: #2e7d32; margin-bottom: 16px;">
                <i class='bx bx-check-circle'></i>
            </div>
            <h2 style="margin-bottom: 8px;">Salida Registrada</h2>
            <p style="color: #64748b; margin-bottom: 24px;">Resumen del cobro</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color:#64748b;">Placa:</span>
                    <strong>${placa}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color:#64748b;">Duración:</span>
                    <strong>${duracion}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px;">
                    <span style="color:#64748b; font-weight:600;">Total a Cobrar:</span>
                    <strong style="color: #2e7d32; font-size: 1.2rem;">${monto}</strong>
                </div>
            </div>
            <button class="btn btn-primary" style="width:100%;" onclick="document.getElementById('modal-resumen').remove()">
                Aceptar
            </button>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}


// ─── LOGOUT ───────────────────────────────────────────────────────

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('operator_data');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
    window.location.href = 'operador-login.html';
}
window.logout = logout;


// ════════════════════════════════════════════════════════════════
// MODAL: HISTORIAL DE ENTRADAS Y SALIDAS (PAGINADO + FILTROS)
// ════════════════════════════════════════════════════════════════

const HistorialModal = {
    todos: [],          // todos los eventos del backend
    filtrados: [],      // eventos después de aplicar filtros
    paginaActual: 1,
    porPagina: 8,

    async abrir() {
        document.getElementById('modal-historial').classList.add('active');
        this.todos = [];
        this.paginaActual = 1;
        const tbody = document.getElementById('hist-modal-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">Cargando...</td></tr>`;
        }

        try {
            const eventosResp = await apiFetch('/eventos/');
            this.todos = extractArrayFromApiResponse(eventosResp);
            this.filtrados = [...this.todos];

            const selZona = document.getElementById('hist-filtro-zona');
            if (selZona) {
                const zonasRaw = this.todos.map(ev =>
                    ev.espacio_zona || ev.ubicacion || ev.zona || (ev.espacio && ev.espacio.zona) || ''
                ).filter(Boolean);
                const zonas = Array.from(new Set(zonasRaw.map(z => z.toString().trim())))
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b));
                selZona.innerHTML = '<option value="">Todas las Zonas</option>' + zonas.map(z => `<option value="${z}">${z}</option>`).join('');
            }

            this.render();
        } catch (e) {
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#e53e3e;">Error al cargar el historial.</td></tr>`;
            }
        }
    },

    aplicarFiltros() {
        const fecha = document.getElementById('hist-filtro-fecha').value;
        const desde = document.getElementById('hist-filtro-desde').value;
        const hasta = document.getElementById('hist-filtro-hasta').value;
        const tipo = (document.getElementById('hist-filtro-tipo').value || '').toLowerCase();
        const zonaFiltro = (document.getElementById('hist-filtro-zona') ? document.getElementById('hist-filtro-zona').value : '').toString().trim();

        this.filtrados = this.todos.filter(ev => {
            const dt = new Date(ev.fecha_hora);
            if (isNaN(dt.getTime())) return false;

            if (fecha) {
                const start = new Date(`${fecha}T00:00:00`);
                const end = new Date(`${fecha}T23:59:59.999`);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
                if (dt < start || dt > end) return false;
            }

            if (desde) {
                const hhmm = dt.toTimeString().slice(0, 5);
                if (hhmm < desde) return false;
            }
            if (hasta) {
                const hhmm = dt.toTimeString().slice(0, 5);
                if (hhmm > hasta) return false;
            }
            if (tipo && (ev.tipo_evento || '').toString().toLowerCase() !== tipo) return false;

            if (zonaFiltro) {
                const evZona = (ev.espacio_zona || ev.ubicacion || ev.zona || (ev.espacio && ev.espacio.zona) || '').toString().trim();
                if (!evZona || evZona !== zonaFiltro) return false;
            }
            return true;
        });

        this.paginaActual = 1;
        this.render();
    },

    limpiarFiltros() {
        document.getElementById('hist-filtro-fecha').value = '';
        document.getElementById('hist-filtro-desde').value = '';
        document.getElementById('hist-filtro-hasta').value = '';
        document.getElementById('hist-filtro-tipo').value = '';
        document.getElementById('hist-filtro-zona').value = '';

        this.filtrados = [...this.todos];
        this.paginaActual = 1;
        this.render();
    },

    render() {
        const totalPaginas = Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
        this.paginaActual = Math.min(this.paginaActual, totalPaginas);
        const inicio = (this.paginaActual - 1) * this.porPagina;
        const pagina = this.filtrados.slice(inicio, inicio + this.porPagina);

        const tbody = document.getElementById('hist-modal-tbody');
        if (tbody) {
            if (pagina.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">Sin resultados para los filtros aplicados.</td></tr>`;
            } else {
                tbody.innerHTML = pagina.map(ev => {
                    const dt = new Date(ev.fecha_hora);
                    const fecha = dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                    const hora = dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                    const esEntrada = (ev.tipo_evento || '').toString().toLowerCase() === 'entrada';
                    const badge = esEntrada
                        ? `<span class="badge badge-process">En Proceso</span>`
                        : `<span class="badge badge-complete">Completado</span>`;

                    let espacioInfo = '--';
                    if (ev.espacio_zona && ev.espacio_numero !== null && ev.espacio_numero !== undefined) {
                        espacioInfo = `${ev.espacio_zona}-${String(ev.espacio_numero).padStart(2, '0')}`;
                    } else if (ev.ubicacion) {
                        espacioInfo = ev.ubicacion;
                    }

                    return `
                        <tr>
                            <td>${fecha} / ${hora}</td>
                            <td style="font-weight:600;">#${ev.placa_detectada || '--'}</td>
                            <td>${espacioInfo}</td>
                            <td>${esEntrada ? 'Entrada' : 'Salida'}</td>
                            <td>${badge}</td>
                        </tr>`;
                }).join('');
            }
        }

        const prevBtn = document.getElementById('hist-prev');
        const nextBtn = document.getElementById('hist-next');
        if (prevBtn) {
            prevBtn.disabled = this.paginaActual <= 1;
            prevBtn.classList.toggle('nav-btn-active', this.paginaActual > 1);
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginaActual >= totalPaginas;
            nextBtn.classList.toggle('nav-btn-active', this.paginaActual < totalPaginas);
        }

        const info = document.getElementById('hist-info-pagina');
        if (info) {
            info.textContent = `Página ${this.paginaActual} de ${totalPaginas}  (${this.filtrados.length} registros)`;
        }
    },

    paginaAnterior() {
        if (this.paginaActual > 1) { this.paginaActual--; this.render(); }
    },
    paginaSiguiente() {
        const total = Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
        if (this.paginaActual < total) { this.paginaActual++; this.render(); }
    }
};


// ════════════════════════════════════════════════════════════════
// MODAL: NOTIFICACIONES DE ALERTAS (PAGINADO)
// ════════════════════════════════════════════════════════════════

const NotificacionesModal = {
    todas: [],
    paginaActual: 1,
    porPagina: 9,

    async abrir() {
        document.getElementById('modal-notificaciones').classList.add('active');
        this.todas = [];
        this.paginaActual = 1;
        document.getElementById('noti-list').innerHTML =
            `<div class="alert-item info">Cargando notificaciones...</div>`;
        try {
            this.todas = await apiFetch('/notificaciones/');
            this.render();
        } catch (e) {
            document.getElementById('noti-list').innerHTML =
                `<div class="alert-item danger">Error al cargar las notificaciones.</div>`;
        }
    },

    render() {
        const totalPaginas = Math.ceil(this.todas.length / this.porPagina) || 1;
        const inicio = (this.paginaActual - 1) * this.porPagina;
        const pagina = this.todas.slice(inicio, inicio + this.porPagina);

        const container = document.getElementById('noti-list');
        if (pagina.length === 0) {
            container.innerHTML = `<div class="alert-item info">No hay notificaciones.</div>`;
        } else {
            container.innerHTML = pagina.map(n => {
                const esAlerta = n.tipo === 'alerta';
                const clase = esAlerta ? 'danger' : 'info';
                const fecha = new Date(n.fecha).toLocaleString('es-CO', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                return `
                    <div class="alert-item ${clase}" style="position:relative;">
                        ${n.mensaje}
                        <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:0.72rem;color:#aaa;">${fecha}</span>
                    </div>`;
            }).join('');
        }

        // Botones de paginación
        const prevBtn = document.getElementById('noti-prev');
        const nextBtn = document.getElementById('noti-next');
        prevBtn.disabled = this.paginaActual <= 1;
        nextBtn.disabled = this.paginaActual >= totalPaginas;
        prevBtn.classList.toggle('nav-btn-active', this.paginaActual > 1);
        nextBtn.classList.toggle('nav-btn-active', this.paginaActual < totalPaginas);

        document.getElementById('noti-info-pagina').textContent =
            `Página ${this.paginaActual} de ${totalPaginas}  (${this.todas.length} notificaciones)`;
    },

    paginaAnterior() {
        if (this.paginaActual > 1) { this.paginaActual--; this.render(); }
    },
    paginaSiguiente() {
        const total = Math.ceil(this.todas.length / this.porPagina);
        if (this.paginaActual < total) { this.paginaActual++; this.render(); }
    }
};


// ─── REGISTRAR EVENTOS DE LOS MODALES GRANDES ─────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Abrir modales desde los links del dashboard
    document.getElementById('btn-ver-historial').addEventListener('click', e => {
        e.preventDefault();
        HistorialModal.abrir();
    });

    document.getElementById('btn-ver-notificaciones').addEventListener('click', e => {
        e.preventDefault();
        NotificacionesModal.abrir();
    });

    // Paginación historial
    document.getElementById('hist-prev').addEventListener('click', () => HistorialModal.paginaAnterior());
    document.getElementById('hist-next').addEventListener('click', () => HistorialModal.paginaSiguiente());

    // Filtros historial
    document.getElementById('hist-btn-filtrar').addEventListener('click', () => HistorialModal.aplicarFiltros());
    document.getElementById('hist-btn-limpiar').addEventListener('click', () => HistorialModal.limpiarFiltros());

    // Paginación notificaciones
    document.getElementById('noti-prev').addEventListener('click', () => NotificacionesModal.paginaAnterior());
    document.getElementById('noti-next').addEventListener('click', () => NotificacionesModal.paginaSiguiente());

    // Cerrar con X (modales grandes heredan .close-modal)
    document.querySelectorAll('#modal-historial .close-modal, #modal-notificaciones .close-modal').forEach(btn => {
        btn.addEventListener('click', e => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Cerrar clickando el fondo oscuro
    document.querySelectorAll('#modal-historial, #modal-notificaciones').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
});

