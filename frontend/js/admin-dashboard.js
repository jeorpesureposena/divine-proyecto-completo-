class AdminDashboardController {
  constructor() {
    this.init();
  }

  init() {
    this.setupLogout();
    this.loadAdminData();
    this.loadDashboardStats();
    this.loadParkingMap();
    this.loadRecentActivity();
    this.setupHistoryModal();
    this.setupSpotModal();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        this.loadDashboardStats();
        this.loadParkingMap();
        this.loadRecentActivity();
    }, 30000);
  }

  setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.apiService.logout();
      });
    }
  }

  loadAdminData() {
    const adminDataStr = localStorage.getItem('admin_data');
    if (adminDataStr) {
      const adminData = JSON.parse(adminDataStr);
      const nameElements = document.querySelectorAll('.admin-name');
      nameElements.forEach(el => el.textContent = adminData.nombre || 'Administrador');
    }
  }

  async loadDashboardStats() {
    // ── Ingresos y ocupación desde /estadisticas/tablero/ ──────────
    try {
        const stats = await window.apiFetch('/estadisticas/tablero/');

        // Ingresos
        const statIngresos = document.getElementById('stat-ingresos');
        const statIngresosTrend = document.getElementById('stat-ingresos-trend');
        if (statIngresos) {
            const val = stats.ingresos_hoy ?? stats.total_ingresos ?? 0;
            statIngresos.textContent = `${Number(val).toLocaleString('es-CO')} cop`;
        }
        if (statIngresosTrend) statIngresosTrend.textContent = '';

        // Ocupación
        const statOcupacionPercent = document.getElementById('stat-ocupacion-percent');
        const statOcupacionText   = document.getElementById('stat-ocupacion-text');
        const totalEspacios = stats.total_espacios || 0;
        const ocupados      = stats.espacios_ocupados || 0;
        const porcentaje    = totalEspacios > 0 ? Math.round((ocupados / totalEspacios) * 100) : 0;
        if (statOcupacionPercent) statOcupacionPercent.textContent = `${porcentaje}%`;
        if (statOcupacionText)   statOcupacionText.innerHTML = `${ocupados} de ${totalEspacios} <br />espacios ocupados`;

        // Estado del sistema
        const statEstado     = document.getElementById('stat-estado');
        const statEstadoText = document.getElementById('stat-estado-text');
        if (statEstado) {
            if (porcentaje >= 100) {
                statEstado.textContent = 'Bloqueado';
                statEstado.classList.replace('text-gray-900', 'text-red-600');
                if (statEstadoText) statEstadoText.innerHTML = 'Capacidad<br />máxima';
            } else {
                statEstado.textContent = 'Online';
                statEstado.classList.replace('text-red-600', 'text-gray-900');
                if (statEstadoText) statEstadoText.innerHTML = 'Todos los <br />servicios activos';
            }
        }
    } catch (error) {
        console.warn('Estadísticas no disponibles:', error);
        // Mostrar valores 0 en lugar de quedarse en "Cargando..."
        const statIngresos = document.getElementById('stat-ingresos');
        if (statIngresos) statIngresos.textContent = '0 cop';
        const statIngresosTrend = document.getElementById('stat-ingresos-trend');
        if (statIngresosTrend) statIngresosTrend.textContent = 'Sin datos';
        const statOcupacionPercent = document.getElementById('stat-ocupacion-percent');
        if (statOcupacionPercent) statOcupacionPercent.textContent = '0%';
        const statOcupacionText = document.getElementById('stat-ocupacion-text');
        if (statOcupacionText) statOcupacionText.innerHTML = '0 de 0 <br />espacios ocupados';
    }

    // ── Reservas activas ───────────────────────────────────────────
    try {
        const reservas = await window.apiFetch('/reservas/');
        const statReservas = document.getElementById('stat-reservas');
        if (statReservas) {
            statReservas.textContent = Array.isArray(reservas) ? reservas.length : 0;
        }
    } catch (error) {
        // /reservas/ puede no existir aún — poner 0 sin error visible
        const statReservas = document.getElementById('stat-reservas');
        if (statReservas) statReservas.textContent = '0';
    }
  }

  async loadParkingMap() {
    const grid = document.getElementById('parking-grid');
    if (!grid) return;

    try {
        const espacios = await window.apiFetch('/espacios/');

        if (!Array.isArray(espacios) || espacios.length === 0) {
            grid.innerHTML = '<p class="text-gray-400 text-sm col-span-full py-4">No hay espacios registrados.</p>';
            return;
        }

        grid.innerHTML = '';

        // Ordenar por zona y número
        espacios.sort((a, b) => {
            if (a.zona === b.zona) return (a.numero || 0) - (b.numero || 0);
            return String(a.zona).localeCompare(String(b.zona));
        });

        espacios.forEach(espacio => {
            const div = document.createElement('div');
            div.className = 'grid-spot text-[10px] py-2 rounded text-center font-bold';

            const estado = (espacio.estado || '').toLowerCase();
            if (estado === 'ocupado') {
                div.classList.add('bg-red-600', 'text-white');
            } else if (estado === 'libre' || estado === 'disponible') {
                div.classList.add('bg-green-500', 'text-white');
            } else if (estado === 'reservado') {
                div.classList.add('bg-yellow-300', 'text-black');
            } else {
                div.classList.add('bg-gray-200', 'text-black', 'border', 'border-gray-300');
            }

            const numStr = String(espacio.numero || 0).padStart(2, '0');
            div.textContent = `${espacio.zona}-${numStr}`;
            div.title = `Estado: ${espacio.estado}`;
            div.classList.add('cursor-pointer', 'transition-transform', 'hover:scale-105', 'shadow-sm');
            
            // Open modal on click
            div.addEventListener('click', () => {
                const modal = document.getElementById('spot-modal');
                const modalContent = document.getElementById('spot-modal-content');
                const inputName = document.getElementById('spot-modal-name');
                const inputId = document.getElementById('spot-modal-id');
                const isMaintenance = estado === 'mantenimiento';
                
                if (modal && inputName) {
                    inputName.value = `${espacio.zona}-${numStr}`;
                    if (inputId) inputId.value = espacio.id || '';
                    
                    // Adjust UI based on current state
                    const modalTitle = document.getElementById('spot-modal-title');
                    const btnConfirm = document.getElementById('btn-spot-confirm');
                    const reasonInput = document.getElementById('spot-modal-reason');
                    const durationInput = document.getElementById('spot-modal-duration');
                    
                    if (isMaintenance) {
                        if (modalTitle) modalTitle.textContent = 'Habilitar Cupo';
                        if (btnConfirm) {
                            btnConfirm.textContent = 'Habilitar Cupo';
                            btnConfirm.classList.replace('bg-[#001A8E]', 'bg-green-600');
                            btnConfirm.classList.replace('hover:bg-blue-900', 'hover:bg-green-800');
                        }
                        if (reasonInput) {
                            reasonInput.value = espacio.motivo_mantenimiento || 'Mantenimiento en curso';
                            reasonInput.readOnly = true;
                            reasonInput.classList.add('bg-slate-100');
                        }
                        if (durationInput) {
                            durationInput.value = espacio.duracion_mantenimiento || 'Indefinido';
                            durationInput.disabled = true;
                            durationInput.classList.add('bg-slate-100');
                        }
                    } else {
                        if (modalTitle) modalTitle.textContent = 'Desactivar Cupo';
                        if (btnConfirm) {
                            btnConfirm.textContent = 'Guardar';
                            btnConfirm.classList.replace('bg-green-600', 'bg-[#001A8E]');
                            btnConfirm.classList.replace('hover:bg-green-800', 'hover:bg-blue-900');
                        }
                        if (reasonInput) {
                            reasonInput.value = '';
                            reasonInput.readOnly = false;
                            reasonInput.classList.remove('bg-slate-100');
                        }
                        if (durationInput) {
                            durationInput.value = 'Indefinido';
                            durationInput.disabled = false;
                            durationInput.classList.remove('bg-slate-100');
                        }
                    }

                    // Save state to know what to send in PATCH
                    modal.dataset.currentState = estado;

                    modal.classList.remove('hidden');
                    void modal.offsetWidth; // Reflow
                    modal.classList.remove('opacity-0');
                    modalContent.classList.remove('scale-95');
                }
            });

            grid.appendChild(div);
        });

    } catch (error) {
        console.warn('Error al cargar mapa de espacios:', error);
        // Mostrar cuadrícula de demostración en lugar de pantalla vacía
        grid.innerHTML = '';
        const zonas = ['A', 'B', 'C', 'D'];
        const porZona = 12;
        zonas.forEach(zona => {
            for (let i = 1; i <= porZona; i++) {
                const div = document.createElement('div');
                div.className = 'grid-spot text-[10px] py-2 rounded text-center font-bold bg-green-500 text-white cursor-pointer transition-transform hover:scale-105 shadow-sm';
                div.textContent = `${zona}-${String(i).padStart(2, '0')}`;
                div.title = 'Estado desconocido';
                
                div.addEventListener('click', () => {
                    const modal = document.getElementById('spot-modal');
                    const modalContent = document.getElementById('spot-modal-content');
                    const inputName = document.getElementById('spot-modal-name');
                    if (modal && inputName) {
                        inputName.value = div.textContent;
                        modal.classList.remove('hidden');
                        void modal.offsetWidth; // Reflow
                        modal.classList.remove('opacity-0');
                        modalContent.classList.remove('scale-95');
                    }
                });

                grid.appendChild(div);
            }
        });
    }
  }

  async loadRecentActivity() {
    try {
        const tbody = document.getElementById('recent-activity-body');
        if (!tbody) return;

        const eventos = await window.apiFetch('/eventos/');
        if (!Array.isArray(eventos)) return;

        tbody.innerHTML = '';
        
        // Take last 10
        const recent = eventos.slice(0, 10);

        recent.forEach(evento => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';

            const date = new Date(evento.fecha_hora);
            const dateStr = date.toLocaleDateString() + ' / ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            let estadoBadge = '';
            if (evento.tipo_evento === 'entrada') {
                estadoBadge = `<span class="px-3 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase rounded">Entrada</span>`;
            } else {
                estadoBadge = `<span class="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold uppercase rounded">Salida</span>`;
            }

            tr.innerHTML = `
                <td class="px-6 py-4 font-semibold text-gray-700">${dateStr}</td>
                <td class="px-6 py-4 font-bold text-gray-900">${evento.vehiculo_placa || evento.placa_detectada || 'N/A'}</td>
                <td class="px-6 py-4 font-semibold text-gray-700 capitalize">${evento.tipo_evento}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar eventos:', error);
    }
  }

  setupHistoryModal() {
    this.historyEvents = [];
    this.historyPage = 1;
    this.historyPageSize = 8;
    
    const btnOpen = document.getElementById('btn-open-history');
    const btnClose = document.getElementById('btn-close-history');
    const modal = document.getElementById('history-modal');
    const modalContent = document.getElementById('history-modal-content');
    
    if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
            modal.classList.remove('hidden');
            // Trigger reflow
            void modal.offsetWidth;
            modal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
            
            this.loadHistoryModalData();
        });
    }
    
    const closeModal = () => {
        if (!modal.classList.contains('hidden')) {
            modal.classList.add('opacity-0');
            modalContent.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    };

    if (btnClose && modal) {
        btnClose.addEventListener('click', closeModal);
    }
    
    // Cerrar al hacer clic afuera
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // Pagination
    document.getElementById('history-btn-prev')?.addEventListener('click', () => {
        if (this.historyPage > 1) {
            this.historyPage--;
            this.renderHistoryModalPage();
        }
    });
    
    document.getElementById('history-btn-next')?.addEventListener('click', () => {
        const maxPage = Math.ceil(this.historyEvents.length / this.historyPageSize);
        if (this.historyPage < maxPage) {
            this.historyPage++;
            this.renderHistoryModalPage();
        }
    });
  }

  async loadHistoryModalData() {
    try {
        const tbody = document.getElementById('history-modal-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-slate-400">Cargando...</td></tr>`;
        
        const eventos = await window.apiFetch('/eventos/');
        if (Array.isArray(eventos)) {
            this.historyEvents = eventos.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
            this.historyPage = 1;
            this.renderHistoryModalPage();
        }
    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('history-modal-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-red-400">Error al cargar historial</td></tr>`;
    }
  }

  renderHistoryModalPage() {
    const tbody = document.getElementById('history-modal-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const start = (this.historyPage - 1) * this.historyPageSize;
    const pageEvents = this.historyEvents.slice(start, start + this.historyPageSize);
    
    pageEvents.forEach(evento => {
        const tr = document.createElement('tr');
        
        const date = new Date(evento.fecha_hora);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('es', { month: 'short' }).replace('.', '').replace(/^\w/, c => c.toUpperCase());
        const year = date.getFullYear();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
        
        const dateStr = `${day} ${month} ${year}/ ${time}`;
        const placa = evento.vehiculo_placa || evento.placa_detectada || 'N/A';
        const tipo = (evento.tipo_evento || '').toLowerCase();
        
        const tipoLabel = tipo === 'entrada' ? 'Entrada' : 'Salida';
        const isEntrada = tipo === 'entrada';
        
        const estadoClass = isEntrada ? 'text-green-600 font-bold' : 'text-slate-300 font-medium';
        const estadoLabel = isEntrada ? 'En Proceso' : 'Completado';
        
        tr.innerHTML = `
            <td class="pb-4 px-2 text-slate-600 font-medium">${dateStr}</td>
            <td class="pb-4 px-2 text-slate-900 font-medium text-center">#${placa}</td>
            <td class="pb-4 px-2 text-slate-600 font-medium text-center">${tipoLabel}</td>
            <td class="pb-4 px-2 text-center ${estadoClass}">${estadoLabel}</td>
        `;
        tbody.appendChild(tr);
    });
    
    const prev = document.getElementById('history-btn-prev');
    const next = document.getElementById('history-btn-next');
    if (prev) prev.disabled = this.historyPage <= 1;
    if (next) next.disabled = start + this.historyPageSize >= this.historyEvents.length;
  }

  setupSpotModal() {
    const modal = document.getElementById('spot-modal');
    const modalContent = document.getElementById('spot-modal-content');
    const btnCancel = document.getElementById('btn-spot-cancel');
    const btnConfirm = document.getElementById('btn-spot-confirm');

    const closeModal = () => {
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('opacity-0');
            modalContent.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    };

    if (btnCancel) {
        btnCancel.addEventListener('click', closeModal);
    }

    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const inputId = document.getElementById('spot-modal-id');
            const id = inputId ? inputId.value : null;
            const btnOriginalText = btnConfirm.textContent;
            
            if (!id) {
                alert('No se pudo identificar el cupo para actualizar.');
                return;
            }

            try {
                btnConfirm.textContent = 'Guardando...';
                btnConfirm.disabled = true;

                // Determine the new state based on the current state
                const modal = document.getElementById('spot-modal');
                const currentState = modal ? modal.dataset.currentState : '';
                const newState = currentState === 'mantenimiento' ? 'libre' : 'mantenimiento';

                const payload = { estado: newState };
                
                // If we are disabling the spot, we should save the reason and duration
                if (newState === 'mantenimiento') {
                    const reasonInput = document.getElementById('spot-modal-reason');
                    const durationInput = document.getElementById('spot-modal-duration');
                    payload.motivo_mantenimiento = reasonInput ? reasonInput.value : '';
                    payload.duracion_mantenimiento = durationInput ? durationInput.value : '';
                } else {
                    // Clear the fields when enabling
                    payload.motivo_mantenimiento = '';
                    payload.duracion_mantenimiento = '';
                }

                // Send PATCH request to backend to update state
                await window.apiFetch(`/espacios/${id}/`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });

                closeModal();
                // Refresh the map to show the new gray box
                this.loadParkingMap();
                
                // Clear the form
                const reasonInput = document.getElementById('spot-modal-reason');
                if(reasonInput) reasonInput.value = '';

            } catch (error) {
                console.error('Error actualizando cupo:', error);
                alert('Hubo un error al actualizar el estado del cupo. Verifica la consola.');
            } finally {
                btnConfirm.textContent = btnOriginalText;
                btnConfirm.disabled = false;
            }
        });
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
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminDashboardController();
});
