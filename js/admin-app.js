/**
 * TBA Command Center - Admin Application v3.0
 * =============================================
 * NUEVAS FUNCIONALIDADES:
 * 1. Filtros en Albercas (búsqueda, ruta, tipo filtro, volumen)
 * 2. Filtros en Técnicos (búsqueda, ruta, rol)
 * 3. Exportar CSV del reporte del día (compatible Excel/Sheets)
 * 4. Exportar CSV de albercas y técnicos
 * 5. Resumen diario automático a WhatsApp
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const loader = document.getElementById('full-loader');
    const app = document.getElementById('admin-app');

    let currentUser = null;
    let allPools = [];
    let allTechs = [];
    let allReports = [];
    let statusChartInstance = null;

    // DEFINICIÓN DE ELEMENTOS DE NAVEGACIÓN (Corrección)
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    const sections = document.querySelectorAll('.content-section');

    // =========================================
    // AUTH
    // =========================================
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            window.location.href = 'index.html'; return;
        }
        document.getElementById('admin-name').textContent = userDoc.data().name || 'Admin';
        document.getElementById('today-date').textContent = TBA.formatDate();

        initDashboardListeners();
        initPoolsListener();
        initTeamListener();
        initFilterEvents();
        loadWeeklyChart();
        initAlertsAndTasks();
        initKPIListener();
        initGlobalSearch();

        // Retraso cinemático de 5 segundos para el Splash de Co-Branding
        setTimeout(() => {
            if(loader) {
                loader.style.transition = 'opacity 0.8s ease';
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    app.style.display = 'flex';
                    lucide.createIcons();
                }, 800);
            } else {
                app.style.display = 'flex';
                lucide.createIcons();
            }
        }, 5000);
    });

    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });

    // =========================================
    // NAVEGACIÓN
    // =========================================
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openBtn = document.getElementById('btn-open-sidebar');
    const closeBtn = document.getElementById('btn-close-sidebar');

    const toggleSidebar = (show) => {
        sidebar.classList.toggle('open', show);
        overlay.classList.toggle('show', show);
    };

    if(openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
    if(closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if(overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            const sectionId = `section-${item.dataset.section}`;
            const targetSet = document.getElementById(sectionId);
            if(targetSet) targetSet.classList.add('active');
            document.getElementById('page-title').textContent = item.textContent.trim();
            
            // Cerrar movil
            toggleSidebar(false);
            lucide.createIcons();
        });
    });

    // =========================================
    // DASHBOARD LISTENERS
    // =========================================
    function initDashboardListeners() {
        const todayId = TBA.todayId();

        // Reportes
        db.collection('reports').where('dateId', '==', todayId).onSnapshot((snapshot) => {
            const tbody = document.getElementById('live-reports-body');
            tbody.innerHTML = '';
            allReports = [];
            let completedCount = 0, alertCount = 0;

            if (snapshot.empty) {
                tbody.innerHTML = '<tr class="empty-row"><td colspan="11" class="text-center text-muted">Esperando reportes...</td></tr>';
            } else {
                snapshot.forEach(doc => allReports.push({ id: doc.id, ...doc.data() }));
                allReports.sort((a, b) => {
                    const ta = a.timestamp ? a.timestamp.toDate().getTime() : 0;
                    const tb = b.timestamp ? b.timestamp.toDate().getTime() : 0;
                    return tb - ta;
                });
                allReports.forEach(r => {
                    completedCount++;
                    if (r.hasAlert) alertCount++;
                    const sc = r.hasAlert ? 'alert' : (r.status === 'optimal' ? 'optimal' : 'warning');
                    const st = r.hasAlert ? 'ALERTA: ' + r.alertType : (r.status === 'optimal' ? 'Optimo' : 'Atencion');
                    const ci = r.checkinTime ? TBA.formatTime(r.checkinTime) : '--';
                    const co = r.checkoutTime ? TBA.formatTime(r.checkoutTime) : '--';
                    const dur = r.durationMinutes ? r.durationMinutes + ' min' : '--';
                    const ins = r.insumo && r.insumo !== 'Ninguno' ? r.insumo + ' (' + (r.insumoQty||0) + ' ' + (r.insumoUnit||'') + ')' : 'Ninguno';
                    const shortId = r.reportShortId || '--';
                    const chkCount = r.preChecklist ? r.preChecklist.length + '/6' : '--';
                    const tr = document.createElement('tr');
                    tr.className = 'fade-in-row';
                    tr.innerHTML = '<td><code style="color:#ffb86c;font-size:11px;">' + shortId + '</code></td>' +
                        '<td><span class="pool-name">' + r.poolName + '</span><span class="pool-sub">' + (r.poolFilter||'') + '</span></td>' +
                        '<td>' + r.techName + '</td><td>' + ci + '</td><td>' + co + '</td>' +
                        '<td><strong>' + dur + '</strong></td>' +
                        '<td><span class="tag-' + sc + '">' + r.ph + '</span></td>' +
                        '<td><span class="tag-' + sc + '">' + r.cl + '</span></td>' +
                        '<td>' + ins + '</td>' +
                        '<td><span style="color:#10b981;font-size:12px;">' + chkCount + '</span></td>' +
                        '<td><span class="status-tag ' + sc + '">' + st + '</span></td>';
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('s-completed').textContent = completedCount;
            document.getElementById('s-alerts').textContent = alertCount;
            
            // ACTUALIZAR CHART.JS
            updateStatusChart(allReports);
            
        }, err => console.error('Reports error:', err));

        let mapInstance = null;
        let markersGroup = null;

        setTimeout(() => {
            if(!mapInstance && document.getElementById('map')) {
                // Coordenadas Riviera Veracruzana: [19.05, -96.08]
                mapInstance = L.map('map').setView([19.05, -96.08], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(mapInstance);
                markersGroup = L.layerGroup().addTo(mapInstance);
            }
        }, 1000);

        // Check-ins activos — TIEMPO REAL
        let previousActiveCount = 0;
        let activeTimerInterval = null;
        
        db.collection('checkins').where('dateId', '==', todayId).onSnapshot(snap => {
            const tbody = document.getElementById('active-checkins-body');
            tbody.innerHTML = '';
            const active = [];
            
            if(markersGroup) markersGroup.clearLayers();

            snap.forEach(doc => { const d = doc.data(); if(!d.checkoutTime) active.push(d); });
            
            // Actualizar TODOS los contadores en tiempo real
            const liveCount = document.getElementById('live-techs-count');
            if(liveCount) liveCount.textContent = active.length;
            document.getElementById('s-techs').textContent = active.length;
            
            // Alerta sonora cuando un técnico nuevo entra en campo
            if(active.length > previousActiveCount && previousActiveCount > 0) {
                TBA.showToast(`📍 ${active[active.length-1]?.techName || 'Técnico'} inició servicio`);
            }
            previousActiveCount = active.length;
            
            if(!active.length) {
                tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center text-muted">Ningún técnico en campo.</td></tr>';
                if(activeTimerInterval) { clearInterval(activeTimerInterval); activeTimerInterval = null; }
                return;
            }

            const bounds = [];
            active.forEach(c => {
                const at = c.checkinTime ? TBA.formatTime(c.checkinTime) : 'Ahora';
                let tos = '--';
                if(c.checkinTime) { const d = Math.floor((Date.now()-c.checkinTime.toDate().getTime())/60000); tos = `${d} min`; }
                const tr = document.createElement('tr');
                tr.className = 'fade-in-row';
                tr.innerHTML = `<td><strong>${c.techName}</strong></td><td>${c.poolName}</td><td>${at}</td><td><span class="status-tag in-progress-tag">${tos}</span></td>`;
                tbody.appendChild(tr);

                if (c.gpsLat && c.gpsLng && markersGroup) {
                    const lat = parseFloat(c.gpsLat);
                    const lng = parseFloat(c.gpsLng);
                    bounds.push([lat, lng]);
                    
                    const fraudIcon = c.isFraudulent ? '🚨' : '📍';
                    const popupContent = `<b>${fraudIcon} ${c.techName}</b><br>Alberca: ${c.poolName}<br>Check-in: ${at}<br>Tiempo: ${tos}`;
                    
                    const marker = L.circleMarker([lat, lng], {
                        radius: 8,
                        fillColor: c.isFraudulent ? '#ef4444' : '#4facfe',
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(markersGroup);
                    
                    marker.bindPopup(popupContent);
                }
            });

            if (bounds.length > 0 && mapInstance) {
                mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
            }
            
            // Auto-refrescar tiempo transcurrido cada 30 seg — SIN RECARGAR PÁGINA
            if(activeTimerInterval) clearInterval(activeTimerInterval);
            activeTimerInterval = setInterval(() => {
                const rows = tbody.querySelectorAll('tr:not(.empty-row)');
                active.forEach((c, i) => {
                    if(rows[i] && c.checkinTime) {
                        const mins = Math.floor((Date.now() - c.checkinTime.toDate().getTime()) / 60000);
                        const timeCell = rows[i].querySelector('.in-progress-tag');
                        if(timeCell) timeCell.textContent = `${mins} min`;
                    }
                });
            }, 30000);
            
        }, err => console.error('Checkins error:', err));

        // Contadores estáticos
        db.collection('pools').onSnapshot(s => {
            document.getElementById('s-pools').textContent = s.size;
            document.getElementById('s-total').textContent = `/ ${s.size}`;
        });
    }

    // =========================================
    // CHART.JS RENDER INTEGRATION
    // =========================================
    function updateStatusChart(reports) {
        let opt = 0, warn = 0, alert = 0;
        reports.forEach(r => {
            if (r.hasAlert || r.status === 'alert') alert++;
            else if (r.status === 'optimal') opt++;
            else warn++;
        });

        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        if (statusChartInstance) {
            statusChartInstance.data.datasets[0].data = [opt, warn, alert];
            statusChartInstance.update();
        } else {
            Chart.defaults.color = '#888';
            statusChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Optimas', 'Preventivas', 'Alertas'],
                    datasets: [{
                        data: [opt, warn, alert],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#ccc', font: { family: 'Inter' } } }
                    },
                    cutout: '70%'
                }
            });
        }

        // Actualizar graficas de rendimiento por ruta
        updateRouteCharts(reports);
    }

    // =========================================
    // GRAFICAS DE RENDIMIENTO (AVANZADO)
    // =========================================
    let chartServRuta = null;
    let chartPhRuta = null;
    let chartSemanal = null;

    function updateRouteCharts(reports) {
        // Agrupar servicios y pH por ruta
        const routeMap = {};
        reports.forEach(r => {
            const ruta = r.techRoute || 'Sin Ruta';
            if (!routeMap[ruta]) routeMap[ruta] = { count: 0, phSum: 0, phCount: 0 };
            routeMap[ruta].count++;
            if (r.ph) {
                routeMap[ruta].phSum += parseFloat(r.ph);
                routeMap[ruta].phCount++;
            }
        });

        const rutas = Object.keys(routeMap).sort();
        const serviciosPorRuta = rutas.map(r => routeMap[r].count);
        const phPromPorRuta = rutas.map(r => routeMap[r].phCount > 0 ? (routeMap[r].phSum / routeMap[r].phCount).toFixed(2) : 0);

        const chartOpts = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
            }
        };

        // 1. Servicios por Ruta (Bar vertical)
        const ctx1 = document.getElementById('chartServiciosPorRuta');
        if (ctx1) {
            if (chartServRuta) {
                chartServRuta.data.labels = rutas;
                chartServRuta.data.datasets[0].data = serviciosPorRuta;
                chartServRuta.update();
            } else {
                chartServRuta = new Chart(ctx1, {
                    type: 'bar',
                    data: {
                        labels: rutas,
                        datasets: [{
                            label: 'Servicios',
                            data: serviciosPorRuta,
                            backgroundColor: 'rgba(79,172,254,0.6)',
                            borderColor: '#4facfe',
                            borderWidth: 1,
                            borderRadius: 6
                        }]
                    },
                    options: chartOpts
                });
            }
        }

        // 2. pH Promedio por Ruta (Horizontal bar)
        const ctx2 = document.getElementById('chartPhPorRuta');
        if (ctx2) {
            if (chartPhRuta) {
                chartPhRuta.data.labels = rutas;
                chartPhRuta.data.datasets[0].data = phPromPorRuta;
                chartPhRuta.update();
            } else {
                chartPhRuta = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: rutas,
                        datasets: [{
                            label: 'pH Prom.',
                            data: phPromPorRuta,
                            backgroundColor: phPromPorRuta.map(v => {
                                const n = parseFloat(v);
                                return (n >= 6.8 && n <= 7.6) ? 'rgba(16,185,129,0.6)' : 'rgba(245,158,11,0.6)';
                            }),
                            borderWidth: 1,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        ...chartOpts,
                        indexAxis: 'y',
                        scales: {
                            x: {
                                min: 6.0, max: 9.0,
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                ticks: { color: '#94a3b8', font: { size: 11 } }
                            },
                            y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
                        },
                        plugins: {
                            legend: { display: false },
                            annotation: undefined
                        }
                    }
                });
            }
        }
    }

    // 3. Comparativo Semanal - se carga una vez
    async function loadWeeklyChart() {
        const ctx3 = document.getElementById('chartSemanal');
        if (!ctx3) return;

        const labels = [];
        const dataServicios = [];
        const dataAlertas = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dayId = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const dayLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            labels.push(dayLabel);

            try {
                const snap = await db.collection('reports').where('dateId', '==', dayId).get();
                let serv = 0, alerts = 0;
                snap.forEach(doc => {
                    serv++;
                    if (doc.data().hasAlert) alerts++;
                });
                dataServicios.push(serv);
                dataAlertas.push(alerts);
            } catch (e) {
                dataServicios.push(0);
                dataAlertas.push(0);
            }
        }

        chartSemanal = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Servicios',
                        data: dataServicios,
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79,172,254,0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#4facfe'
                    },
                    {
                        label: 'Alertas',
                        data: dataAlertas,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#ef4444'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ccc', font: { family: 'Inter', size: 11 } } }
                },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    }

    // =========================================
    // ALBERCAS LISTENER + FILTROS
    // =========================================
    function initPoolsListener() {
        db.collection('pools').onSnapshot(snap => {
            allPools = [];
            const routes = new Set();
            const filters = new Set();
            snap.forEach(doc => {
                const p = { id: doc.id, ...doc.data() };
                allPools.push(p);
                if(p.route) routes.add(p.route);
                if(p.filterType) filters.add(p.filterType);
            });
            allPools.sort((a,b) => (a.route||'').localeCompare(b.route||''));

            const filterSelect = document.getElementById('filter-pool-filter-type');
            if(filterSelect) {
                const saved2 = filterSelect.value;
                filterSelect.innerHTML = '<option value="">Todos los Filtros</option>';
                [...filters].sort().forEach(f => filterSelect.innerHTML += `<option value="${f}">${f}</option>`);
                filterSelect.value = saved2;
            }

            refreshSharedRoutes();

            const dynamicRouteSelects = ['pool-route', 'tech-route'];

            // Escuchar cambios para "Crear Nueva Ruta"
            dynamicRouteSelects.forEach(id => {
                const el = document.getElementById(id);
                if(el && !el.dataset.hasListener) {
                    el.addEventListener('change', (e) => {
                        if(e.target.value === 'NEW_ROUTE') {
                            const newR = prompt('Nombre de la nueva Ruta (ej: Ruta Sur 2):');
                            if(newR && newR.trim() !== '') {
                                const opt = document.createElement('option');
                                opt.value = newR.trim();
                                opt.textContent = newR.trim();
                                el.prepend(opt);
                                el.value = newR.trim();
                                // Also add to monitor checkboxes
                                if(monitorCheckboxes) {
                                    monitorCheckboxes.innerHTML += `<label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;color:#e2e8f0;transition:all 0.2s;"><input type="checkbox" class="monitor-route-cb" value="${newR.trim()}" style="accent-color:#4facfe;"> ${newR.trim()}</label>`;
                                }
                            } else {
                                el.value = "";
                            }
                        }
                    });
                    el.dataset.hasListener = "true";
                }
            });

            const poolSelect = document.getElementById('task-pool-select');
            if(poolSelect) {
                poolSelect.innerHTML = '<option value="">(Ninguna)</option>';
                [...allPools].sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
                    poolSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.route || ''}</option>`;
                });
            }

            applyPoolFilters();
        });
    }

    function applyPoolFilters() {
        const search = document.getElementById('filter-pool-search').value.toLowerCase().trim();
        const route = document.getElementById('filter-pool-route').value;
        const filterType = document.getElementById('filter-pool-filter-type').value;
        const volume = document.getElementById('filter-pool-volume').value;

        let filtered = allPools.filter(p => {
            if(search && !p.name.toLowerCase().includes(search)) return false;
            if(route && p.route !== route) return false;
            if(filterType && p.filterType !== filterType) return false;
            if(volume === 'small' && (p.volume || 0) > 30000) return false;
            if(volume === 'medium' && ((p.volume || 0) <= 30000 || (p.volume || 0) > 80000)) return false;
            if(volume === 'large' && (p.volume || 0) <= 80000) return false;
            return true;
        });

        const results = document.getElementById('pool-filter-results');
        const hasFilters = search || route || filterType || volume;
        results.textContent = hasFilters ? `Mostrando ${filtered.length} de ${allPools.length} albercas` : '';

        renderPoolsTable(filtered);
    }

    function renderPoolsTable(pools) {
        const tbody = document.getElementById('pools-table-body');
        tbody.innerHTML = '';
        if(!pools.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center text-muted">Sin resultados.</td></tr>';
            return;
        }
        pools.forEach(p => {
            const ls = p.lastService ? TBA.formatTime(p.lastService) : 'Sin servicio';
            
            let freqLabel = 'Eventual';
            if(p.visitFrequency == '1') freqLabel = '1 vez / sem';
            else if(p.visitFrequency == '2') freqLabel = '2 veces / sem';
            else if(p.visitFrequency == '3') freqLabel = '3 veces / sem';
            else if(p.visitFrequency == '7') freqLabel = 'Diaria';
            else if(p.visitFrequency == '15') freqLabel = 'Quincenal';
            else if(p.visitFrequency == '30') freqLabel = 'Mensual';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="pool-name">${p.name}</span></td>
                <td>${p.route}</td><td>${p.filterType}</td>
                <td>${p.volume ? Number(p.volume).toLocaleString()+' Lts' : 'N/A'}</td>
                <td><span class="status-tag" style="background:rgba(255,255,255,0.05);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);">${freqLabel}</span></td>
                <td>${ls}</td>
                <td class="actions-cell">
                    <button class="btn-action edit" data-id="${p.id}" data-type="pool" title="Editar"><i data-lucide="pencil"></i></button>
                    <button class="btn-action delete" data-id="${p.id}" data-type="pool" data-name="${p.name}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
        bindActionButtons();
        lucide.createIcons();
    }

    // =========================================
    // TÉCNICOS LISTENER + FILTROS
    // =========================================
    function initTeamListener() {
        db.collection('users').onSnapshot(snap => {
            allTechs = [];
            const routes = new Set();
            snap.forEach(doc => {
                const t = { id: doc.id, ...doc.data() };
                if(doc.id === currentUser.uid) return;
                if(t.role !== 'tech' && t.role !== 'admin' && t.role !== 'monitor') return;
                allTechs.push(t);
                if(t.route) routes.add(t.route);
                // Monitor multi-routes
                if(t.routes && Array.isArray(t.routes)) {
                    t.routes.forEach(r => routes.add(r));
                }
            });

            refreshSharedRoutes();

            const taskSelect = document.getElementById('task-tech-select');
            if(taskSelect) {
                taskSelect.innerHTML = '<option value="">Seleccione un Técnico...</option>';
                allTechs.filter(t => t.role === 'tech').forEach(t => {
                    taskSelect.innerHTML += `<option value="${t.id}">${t.name} (${t.route || 'Sin ruta'})</option>`;
                });
            }

            applyTechFilters();
        });
    }

    function applyTechFilters() {
        const search = document.getElementById('filter-tech-search').value.toLowerCase().trim();
        const route = document.getElementById('filter-tech-route').value;
        const role = document.getElementById('filter-tech-role').value;

        let filtered = allTechs.filter(t => {
            if(search && !t.name.toLowerCase().includes(search)) return false;
            if(route) {
                // For monitors, check if route is in their routes array
                if(t.role === 'monitor' && t.routes && Array.isArray(t.routes)) {
                    if(!t.routes.includes(route)) return false;
                } else if(t.route !== route) {
                    return false;
                }
            }
            if(role && t.role !== role) return false;
            return true;
        });

        const results = document.getElementById('tech-filter-results');
        const hasFilters = search || route || role;
        results.textContent = hasFilters ? `Mostrando ${filtered.length} de ${allTechs.length} personal` : '';

        renderTechsTable(filtered);
    }

    function renderTechsTable(techs) {
        const tbody = document.getElementById('team-table-body');
        tbody.innerHTML = '';
        if(!techs.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="text-center text-muted">Sin resultados.</td></tr>';
            return;
        }
        techs.forEach(t => {
            let rb, routeDisplay;
            if(t.role === 'admin') {
                rb = '<span class="role-badge admin">Admin</span>';
                routeDisplay = '<span style="color:#64748b;font-style:italic;font-size:12px;">Acceso Total</span>';
            } else if(t.role === 'monitor') {
                rb = '<span class="role-badge monitor" style="background:rgba(168,85,247,0.15);color:#c084fc;border-color:rgba(168,85,247,0.4);">Monitor</span>';
                if(t.routes && t.routes.length > 0) {
                    routeDisplay = t.routes.map(r => `<span style="display:inline-block;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.25);color:#c084fc;padding:2px 8px;border-radius:6px;font-size:10px;margin:1px 2px;">${r}</span>`).join('');
                } else {
                    routeDisplay = '<span style="color:#64748b;">Sin rutas</span>';
                }
            } else {
                rb = '<span class="role-badge tech">Técnico</span>';
                routeDisplay = t.route || '<span style="color:#64748b;">Sin ruta</span>';
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.name}</strong></td><td>${t.email||'--'}</td>
                <td>${routeDisplay}</td><td>${rb}</td>
                <td class="actions-cell">
                    <button class="btn-action edit" data-id="${t.id}" data-type="tech" title="Editar"><i data-lucide="pencil"></i></button>
                    <button class="btn-action delete" data-id="${t.id}" data-type="tech" data-name="${t.name}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
        bindActionButtons();
        lucide.createIcons();
    }

    // =========================================
    // RUTAS COMPARTIDAS (GLOBAL)
    // =========================================
    function refreshSharedRoutes() {
        const routes = new Set();
        allPools.forEach(p => { if(p.route) routes.add(p.route); });
        allTechs.forEach(t => { 
            if(t.route) routes.add(t.route);
            if(t.routes && Array.isArray(t.routes)) {
                t.routes.forEach(r => routes.add(r));
            }
        });
        const routeList = [...routes].sort();

        // 1. Filter Pool Route
        const routeSelectPool = document.getElementById('filter-pool-route');
        if(routeSelectPool) {
            const saved = routeSelectPool.value;
            routeSelectPool.innerHTML = '<option value="">Todas las Rutas</option>';
            routeList.forEach(r => routeSelectPool.innerHTML += `<option value="${r}">${r}</option>`);
            routeSelectPool.value = saved;
        }

        // 2. Filter Tech Route
        const routeSelectTech = document.getElementById('filter-tech-route');
        if(routeSelectTech) {
            const saved = routeSelectTech.value;
            routeSelectTech.innerHTML = '<option value="">Todas las Rutas</option>';
            routeList.forEach(r => routeSelectTech.innerHTML += `<option value="${r}">${r}</option>`);
            routeSelectTech.value = saved;
        }

        // 3. Modals Dropdowns
        const dynamicRouteSelects = ['pool-route', 'tech-route'];
        dynamicRouteSelects.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                const savedVal = el.value;
                let html = '<option value="">(Selecciona una ruta)</option>';
                routeList.forEach(r => {
                    html += `<option value="${r}">${r}</option>`;
                });
                html += '<option value="NEW_ROUTE">+ Crear Nueva Ruta...</option>';
                el.innerHTML = html;
                el.value = savedVal;
            }
        });

        // 4. Monitor routes checkboxes
        const monitorCheckboxes = document.getElementById('monitor-routes-checkboxes');
        if(monitorCheckboxes) {
            const prevChecked = [...monitorCheckboxes.querySelectorAll('input:checked')].map(cb => cb.value);
            monitorCheckboxes.innerHTML = '';
            routeList.forEach(r => {
                const isChecked = prevChecked.includes(r) ? 'checked' : '';
                monitorCheckboxes.innerHTML += `<label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;color:#e2e8f0;transition:all 0.2s;"><input type="checkbox" class="monitor-route-cb" value="${r}" ${isChecked} style="accent-color:#4facfe;"> ${r}</label>`;
            });
        }
    }

    // =========================================
    // FILTROS: EVENT LISTENERS
    // =========================================
    function initFilterEvents() {
        // Pool filters
        ['filter-pool-search','filter-pool-route','filter-pool-filter-type','filter-pool-volume'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', applyPoolFilters);
        });
        document.getElementById('btn-clear-pool-filters').addEventListener('click', () => {
            document.getElementById('filter-pool-search').value = '';
            document.getElementById('filter-pool-route').value = '';
            document.getElementById('filter-pool-filter-type').value = '';
            document.getElementById('filter-pool-volume').value = '';
            applyPoolFilters();
        });

        // Tech filters
        ['filter-tech-search','filter-tech-route','filter-tech-role'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', applyTechFilters);
        });
        document.getElementById('btn-clear-tech-filters').addEventListener('click', () => {
            document.getElementById('filter-tech-search').value = '';
            document.getElementById('filter-tech-route').value = '';
            document.getElementById('filter-tech-role').value = '';
            applyTechFilters();
        });
    }


    // =========================================
    // ACCIONES: EDITAR / ELIMINAR
    // =========================================
    function bindActionButtons() {
        document.querySelectorAll('.btn-action.edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id, type = btn.dataset.type;
                if(type === 'pool') {
                    const doc = await db.collection('pools').doc(id).get();
                    if(!doc.exists) return;
                    const p = doc.data();
                    document.getElementById('edit-pool-id').value = id;
                    document.getElementById('pool-name').value = p.name;
                    document.getElementById('pool-route').value = p.route;
                    document.getElementById('pool-filter').value = p.filterType;
                    document.getElementById('pool-volume').value = p.volume || '';
                    document.getElementById('pool-frequency').value = p.visitFrequency || '1';
                    
                    document.querySelectorAll('.chk-pool-day').forEach(cb => {
                        cb.checked = p.visitDays ? p.visitDays.includes(parseInt(cb.value)) : false;
                    });
                    document.getElementById('pool-lat').value = p.lat || '';
                    document.getElementById('pool-lng').value = p.lng || '';
                    document.getElementById('modal-pool-title').textContent = 'Editar Alberca';
                    document.getElementById('btn-pool-submit').textContent = 'Actualizar Alberca';
                    document.getElementById('modal-add-pool').classList.add('show');
                } else if(type === 'tech') {
                    const doc = await db.collection('users').doc(id).get();
                    if(!doc.exists) return;
                    const t = doc.data();
                    document.getElementById('edit-tech-uid').value = id;
                    document.getElementById('tech-name').value = t.name;
                    document.getElementById('tech-email').value = t.email||'';
                    document.getElementById('tech-email').disabled = true;
                    document.getElementById('tech-role').value = t.role||'tech';
                    
                    // Set route data based on role
                    if(t.role === 'monitor' && t.routes && Array.isArray(t.routes)) {
                        // Pre-check the monitor route checkboxes
                        document.querySelectorAll('.monitor-route-cb').forEach(cb => {
                            cb.checked = t.routes.includes(cb.value);
                        });
                    } else {
                        document.getElementById('tech-route').value = t.route||'';
                    }
                    
                    document.getElementById('pass-group').style.display = 'none';
                    document.getElementById('modal-tech-title').textContent = 'Editar Personal';
                    document.getElementById('btn-tech-submit').textContent = 'Actualizar';
                    toggleTechRoleFields(t.role||'tech');
                    document.getElementById('modal-add-tech').classList.add('show');
                }
                lucide.createIcons();
            });
        });
        document.querySelectorAll('.btn-action.delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id, type = btn.dataset.type, name = btn.dataset.name;
                if(!confirm(`¿Eliminar "${name}"?`)) return;
                try {
                    await db.collection(type==='pool'?'pools':'users').doc(id).delete();
                    TBA.showToast(`"${name}" eliminado`);
                } catch(e) { TBA.showToast('Error al eliminar'); }
            });
        });
    }

    // =========================================
    // MODALES
    // =========================================
    document.getElementById('btn-add-pool').addEventListener('click', () => {
        document.getElementById('edit-pool-id').value = '';
        document.getElementById('form-add-pool').reset();
        document.getElementById('pool-frequency').value = '1';
        document.querySelectorAll('.chk-pool-day').forEach(cb => cb.checked = false);
        document.getElementById('modal-pool-title').textContent = 'Agregar Alberca';
        document.getElementById('btn-pool-submit').textContent = 'Guardar Alberca';
        document.getElementById('modal-add-pool').classList.add('show');
    });
    document.getElementById('btn-add-tech').addEventListener('click', () => {
        document.getElementById('edit-tech-uid').value = '';
        document.getElementById('form-add-tech').reset();
        document.getElementById('tech-email').disabled = false;
        document.getElementById('pass-group').style.display = 'block';
        document.getElementById('modal-tech-title').textContent = 'Registrar Personal';
        document.getElementById('btn-tech-submit').textContent = 'Registrar';
        // Reset monitor checkboxes
        document.querySelectorAll('.monitor-route-cb').forEach(cb => cb.checked = false);
        toggleTechRoleFields('tech');
        document.getElementById('modal-add-tech').classList.add('show');
        lucide.createIcons();
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.remove('show'));
    });

    // =========================================
    // ROLE-BASED FIELD VISIBILITY
    // =========================================
    function toggleTechRoleFields(role) {
        const routeGroup = document.getElementById('tech-route-group');
        const routesGroup = document.getElementById('tech-routes-group');
        const adminInfo = document.getElementById('tech-admin-info');
        
        if(role === 'tech') {
            routeGroup.style.display = 'block';
            routesGroup.style.display = 'none';
            adminInfo.style.display = 'none';
        } else if(role === 'monitor') {
            routeGroup.style.display = 'none';
            routesGroup.style.display = 'block';
            adminInfo.style.display = 'none';
        } else if(role === 'admin') {
            routeGroup.style.display = 'none';
            routesGroup.style.display = 'none';
            adminInfo.style.display = 'block';
        }
        lucide.createIcons();
    }

    document.getElementById('tech-role').addEventListener('change', (e) => {
        toggleTechRoleFields(e.target.value);
    });

    // EXTRAER COORDENADAS MAPS
    document.getElementById('btn-extract-gps').addEventListener('click', () => {
        const urlObj = document.getElementById('pool-maps-url').value;
        if (!urlObj) { TBA.showToast('Pega un enlace primero'); return; }
        
        let match = urlObj.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); 
        if(!match) match = urlObj.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); // Formato App
        
        if (match && match.length >= 3) {
            document.getElementById('pool-lat').value = match[1];
            document.getElementById('pool-lng').value = match[2];
            TBA.showToast('✅ Coordenadas extraídas con éxito');
        } else {
            TBA.showToast('⚠️ No pude extraer las coordenadas automáticamente. Escríbelas manual.');
        }
    });

    // Guardar Alberca
    document.getElementById('form-add-pool').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-pool-id').value;
        const daysChecked = Array.from(document.querySelectorAll('.chk-pool-day:checked')).map(cb => parseInt(cb.value));

        const data = {
            name: document.getElementById('pool-name').value,
            route: document.getElementById('pool-route').value,
            filterType: document.getElementById('pool-filter').value,
            volume: parseInt(document.getElementById('pool-volume').value)||0,
            visitFrequency: document.getElementById('pool-frequency').value,
            visitDays: daysChecked,
            lat: parseFloat(document.getElementById('pool-lat').value)||null,
            lng: parseFloat(document.getElementById('pool-lng').value)||null,
        };
        if(editId) { await db.collection('pools').doc(editId).update(data); TBA.showToast('Alberca actualizada'); }
        else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('pools').add(data); TBA.showToast('Alberca registrada'); }
        document.getElementById('modal-add-pool').classList.remove('show');
        e.target.reset();
    });

    // Guardar Técnico / Monitor / Admin
    document.getElementById('form-add-tech').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-tech-submit');
        const originalText = submitBtn.textContent;
        
        try {
            // Bloquear botón para evitar doble-click
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Procesando...';
            submitBtn.style.opacity = '0.6';
            
            const editUid = document.getElementById('edit-tech-uid').value;
            const role = document.getElementById('tech-role').value;
            const name = document.getElementById('tech-name').value;
            
            // Validar ruta según cargo
            if(role === 'tech') {
                const route = document.getElementById('tech-route').value;
                if(!route) { TBA.showToast('⚠️ Selecciona una ruta para el técnico'); return; }
            } else if(role === 'monitor') {
                const checked = document.querySelectorAll('.monitor-route-cb:checked');
                if(!checked.length) { TBA.showToast('⚠️ Selecciona al menos una ruta para monitorear'); return; }
            }
            
            if(editUid) {
                // === EDITAR USUARIO EXISTENTE ===
                const updateData = { name, role };
                if(role === 'tech') {
                    updateData.route = document.getElementById('tech-route').value;
                } else if(role === 'monitor') {
                    const selectedRoutes = [...document.querySelectorAll('.monitor-route-cb:checked')].map(cb => cb.value);
                    updateData.routes = selectedRoutes;
                    updateData.route = selectedRoutes[0] || '';
                } else {
                    updateData.route = '';
                }
                
                await db.collection('users').doc(editUid).update(updateData);
                const roleName = role === 'admin' ? 'Administrador' : role === 'monitor' ? 'Monitor' : 'Técnico';
                TBA.showToast(`✅ ${roleName} actualizado`);
                document.getElementById('modal-add-tech').classList.remove('show');
                e.target.reset();
            } else {
                // === CREAR NUEVO USUARIO ===
                const email = document.getElementById('tech-email').value;
                const pass = document.getElementById('tech-pass').value;
                if(!pass || pass.length < 6) { TBA.showToast('⚠️ Mínimo 6 caracteres para contraseña'); return; }
                
                const userData = { name, email, role, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                if(role === 'tech') {
                    userData.route = document.getElementById('tech-route').value;
                } else if(role === 'monitor') {
                    const selectedRoutes = [...document.querySelectorAll('.monitor-route-cb:checked')].map(cb => cb.value);
                    userData.routes = selectedRoutes;
                    userData.route = selectedRoutes[0] || '';
                } else {
                    userData.route = '';
                }
                
                // App secundaria para no destruir sesión admin
                const tempApp = firebase.initializeApp(firebaseConfig, 'TempReg-' + Date.now());
                try {
                    const cred = await tempApp.auth().createUserWithEmailAndPassword(email, pass);
                    await db.collection('users').doc(cred.user.uid).set(userData);
                    await tempApp.auth().signOut();
                    
                    const roleName = role === 'admin' ? 'Administrador' : role === 'monitor' ? 'Monitor' : 'Técnico';
                    TBA.showToast(`✅ ${name} registrado como ${roleName}`);
                    document.getElementById('modal-add-tech').classList.remove('show');
                    e.target.reset();
                } catch(authErr) {
                    console.error('Error en registro:', authErr);
                    if(authErr.code === 'auth/email-already-in-use') TBA.showToast('⚠️ Ese email ya está registrado');
                    else if(authErr.code === 'auth/invalid-email') TBA.showToast('⚠️ Email inválido');
                    else if(authErr.code === 'auth/weak-password') TBA.showToast('⚠️ Contraseña muy débil');
                    else TBA.showToast('❌ Error: ' + authErr.message);
                } finally {
                    // Limpiar app temporal SIEMPRE, incluso si hay error
                    try { await tempApp.delete(); } catch(e) { /* ignore */ }
                }
            }
        } catch(globalErr) {
            console.error('Error global en formulario:', globalErr);
            TBA.showToast('❌ Error inesperado: ' + globalErr.message);
        } finally {
            // SIEMPRE restaurar el botón, pase lo que pase
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = '1';
        }
    });

    // EXPORTAR CSV (Excel/Sheets compatible)
    // =========================================
    function downloadCSV(filename, headers, rows) {
        // BOM para que Excel reconozca UTF-8 correctamente (acentos, ñ)
        const BOM = '\uFEFF';
        const csv = BOM + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        TBA.showToast(`📁 ${filename} descargado`);
    }

    // Exportar reporte del día
    document.getElementById('btn-export-csv').addEventListener('click', () => {
        if(!allReports.length) { TBA.showToast('No hay reportes para exportar'); return; }
        const headers = ['Alberca','Técnico','Ruta','Check-in','Check-out','Duración (min)','pH','Cloro','Insumo','Cantidad','Unidad','Estatus','Notas','Alerta'];
        const rows = allReports.map(r => [
            r.poolName, r.techName, r.techRoute||'',
            r.checkinTime ? r.checkinTime.toDate().toLocaleTimeString('es-MX') : '',
            r.checkoutTime ? r.checkoutTime.toDate().toLocaleTimeString('es-MX') : '',
            r.durationMinutes||'', r.ph, r.cl,
            r.insumo, r.insumoQty||0, r.insumoUnit||'',
            r.status, r.notes||'', r.hasAlert ? r.alertType : 'Sin alerta'
        ]);
        downloadCSV(`TBA_Reporte_${TBA.todayId()}.csv`, headers, rows);
    });

    // Exportar albercas
    document.getElementById('btn-export-pools').addEventListener('click', () => {
        if(!allPools.length) { TBA.showToast('No hay albercas'); return; }
        const headers = ['Nombre','Ruta','Tipo Filtro','Volumen (Lts)','Último pH','Último Cloro','Último Técnico'];
        const rows = allPools.map(p => [
            p.name, p.route, p.filterType, p.volume||'',
            p.lastPh||'', p.lastCl||'', p.lastTech||''
        ]);
        downloadCSV(`TBA_Albercas_${TBA.todayId()}.csv`, headers, rows);
    });

    // Exportar técnicos
    document.getElementById('btn-export-techs').addEventListener('click', () => {
        if(!allTechs.length) { TBA.showToast('No hay técnicos'); return; }
        const headers = ['Nombre','Email','Ruta','Rol'];
        const rows = allTechs.map(t => {
            let routeDisplay = t.route || '';
            let roleDisplay = 'Técnico';
            if (t.role === 'admin') {
                routeDisplay = 'Acceso Total';
                roleDisplay = 'Administrador';
            } else if (t.role === 'monitor') {
                routeDisplay = (t.routes && t.routes.length > 0) ? t.routes.join(' | ') : 'Sin rutas';
                roleDisplay = 'Monitor';
            }
            return [t.name, t.email||'', routeDisplay, roleDisplay];
        });
        downloadCSV(`TBA_Personal_${TBA.todayId()}.csv`, headers, rows);
    });

    // =========================================
    // RESUMEN DIARIO A WHATSAPP
    // =========================================
    document.getElementById('btn-wa-summary').addEventListener('click', () => {
        const total = allPools.length;
        const completed = allReports.length;
        const remaining = total - completed;
        const alerts = allReports.filter(r => r.hasAlert).length;
        const avgDuration = allReports.length
            ? Math.round(allReports.reduce((sum,r) => sum + (r.durationMinutes||0), 0) / allReports.length)
            : 0;

        // Desglose por ruta
        const byRoute = {};
        allReports.forEach(r => {
            const route = r.techRoute || 'Sin ruta';
            if(!byRoute[route]) byRoute[route] = { count: 0, alerts: 0 };
            byRoute[route].count++;
            if(r.hasAlert) byRoute[route].alerts++;
        });
        let routeBreakdown = '';
        Object.entries(byRoute).forEach(([route, data]) => {
            routeBreakdown += `\n  • ${route}: ${data.count} servicios${data.alerts ? ` (${data.alerts} alertas)` : ''}`;
        });

        // Insumos consumidos
        const insumos = {};
        allReports.forEach(r => {
            if(r.insumo && r.insumo !== 'Ninguno' && r.insumoQty > 0) {
                const key = `${r.insumo} (${r.insumoUnit})`;
                insumos[key] = (insumos[key]||0) + r.insumoQty;
            }
        });
        let insumoBreakdown = '';
        Object.entries(insumos).forEach(([name, qty]) => {
            insumoBreakdown += `\n  • ${name}: ${qty}`;
        });

        const msg = `*[TBA Reporte Diario]*
${TBA.formatDate()}

*Resumen Operativo:*
- Servicios completados: ${completed} / ${total}
- Pendientes: ${remaining}
${alerts ? `- ALERTAS: ${alerts}` : '- Sin alertas'}
- Duracion promedio: ${avgDuration} min

*Por Ruta:*${routeBreakdown || '\n  Sin datos'}

*Insumos Consumidos:*${insumoBreakdown || '\n  Sin registro'}

_Generado desde TBA Command Center Pro_`;

        const url = `https://wa.me/${TBA.WA_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });

    // =========================================
    // ALERTAS Y TAREAS (CENTRO DEDICADO)
    // =========================================
    function initAlertsAndTasks() {
        const bdg = document.getElementById('alert-badge');
        
        // 1. Snapshot de Alertas Activas (Reportes con hasAlert === true y !isResolved)
        db.collection('reports')
            .where('hasAlert', '==', true)
            .where('isResolved', '==', false)
            .onSnapshot(snap => {
                const tbody = document.getElementById('active-alerts-body');
                tbody.innerHTML = '';
                
                bdg.style.display = snap.empty ? 'none' : 'inline-block';
                bdg.textContent = snap.size;

                if(snap.empty) {
                    tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center text-muted">No hay alertas pendientes.</td></tr>';
                    return;
                }

                snap.forEach(doc => {
                    const r = doc.data();
                    const tr = document.createElement('tr');
                    const ts = r.timestamp ? TBA.formatTime(r.timestamp) : '--';
                    tr.innerHTML = `
                        <td>${ts}</td>
                        <td><strong>${r.poolName}</strong><br><small style="color:#94a3b8;">${r.techName}</small></td>
                        <td><span style="color:#ef4444; font-weight:600;"><i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:-2px;"></i> ${r.alertType}</span></td>
                        <td><small>pH: ${r.ph} | Cl: ${r.cl}</small><br><small style="color:#ffb86c;">${r.notes || 'Sin Notas'}</small></td>
                        <td><span class="status-tag alert">Pendiente</span></td>
                        <td><button class="btn-outline btn-resolve" data-id="${doc.id}" style="border-color:#10b981; color:#10b981; padding:4px 8px;"><i data-lucide="check"></i> Resolver</button></td>
                    `;
                    tbody.appendChild(tr);
                });
                lucide.createIcons();

                document.querySelectorAll('.btn-resolve').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.dataset.id;
                        await db.collection('reports').doc(id).update({ isResolved: true });
                        TBA.showToast('✅ Alerta marcada como resuelta.');
                    });
                });
            });

        // 2. Snapshot de Tareas Enviadas Hoy (Sin orderBy mixto para evitar requerir index compuesto en Firestore)
        db.collection('tasks').where('dateId', '==', TBA.todayId()).onSnapshot(snap => {
            const tbody = document.getElementById('sent-tasks-body');
            tbody.innerHTML = '';
            if(snap.empty) {
                tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center text-muted">No has asignado tareas hoy.</td></tr>';
                return;
            }
            
            // Ordenamiento manual descendente
            const tasks = [];
            snap.forEach(doc => tasks.push(doc.data()));
            tasks.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

            tasks.forEach(t => {
                const ts = t.timestamp ? TBA.formatTime(t.timestamp) : '--';
                
                let stBadge = '<span class="status-tag warning"><i data-lucide="clock" style="width:12px;height:12px;"></i> Pendiente...</span>';
                if(t.status === 'completed') {
                    if(t.resolution === 'resolved') {
                        stBadge = '<span class="status-tag optimal"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Resuelta</span>';
                    } else if (t.resolution === 'unresolved') {
                        stBadge = '<span class="status-tag alert"><i data-lucide="x-circle" style="width:12px;height:12px;"></i> No se logró resolver</span>';
                    } else {
                        stBadge = '<span class="status-tag optimal"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Leída</span>';
                    }
                }
                
                const noteHtml = t.resolutionNote ? `<div style="font-size:12px; color:#94a3b8; margin-top:4px;"><b>Nota:</b> ${t.resolutionNote}</div>` : '';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${ts}</td><td><strong>${t.techName}</strong></td><td>${t.text}${noteHtml}</td><td>${stBadge}</td>`;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        });

        // Evento para Enviar Tarea Manual
        document.getElementById('btn-send-task').addEventListener('click', async () => {
            const techId = document.getElementById('task-tech-select').value;
            const poolSelect = document.getElementById('task-pool-select');
            let text = document.getElementById('task-text').value.trim();
            if(!techId || !text) {
                alert('Selecciona un tecnico y escribe un mensaje.');
                return;
            }
            
            if(poolSelect && poolSelect.value) {
                const poolText = poolSelect.options[poolSelect.selectedIndex].text.split(' - ')[0];
                text = `[📍 ${poolText}]\n${text}`;
            }

            const techOpt = document.getElementById('task-tech-select').options[document.getElementById('task-tech-select').selectedIndex];
            const techName = techOpt.text.split(' (')[0];

            try {
                await db.collection('tasks').add({
                    techId: techId,
                    techName: techName,
                    adminName: currentUser.displayName || 'Admin',
                    text: text,
                    dateId: TBA.todayId(),
                    status: 'pending',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                document.getElementById('task-text').value = '';
                TBA.showToast('¡Notificación Push enviada!');
            } catch(e) {
                console.error(e);
                TBA.showToast('Error al enviar tarea.');
            }
        });
    }

    // =========================================
    // KPIS DE EFICIENCIA
    // =========================================
    function initKPIListener() {
        const kpiSelect = document.getElementById('kpi-month-filter');
        if(!kpiSelect) return;

        kpiSelect.addEventListener('change', calculateKPIs);

        // Listen a reports para recalcular en vivo (aunque no siempre es estrictamente necesario, nos da Live Ranking)
        db.collection('reports').onSnapshot(() => {
            calculateKPIs();
        });

        async function calculateKPIs() {
            const timeFilter = document.getElementById('kpi-month-filter').value;
            const tbody = document.getElementById('kpi-ranking-body');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Calculando ranking...</td></tr>';

            try {
                // Descargamos todo sin filtros para no chocar con las restricciones de Índices de Firebase.
                // Filtraremos en memoria local, que es extremadamente rápido.
                const snap = await db.collection('reports').get();
                
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                
                const techStats = {};
                snap.forEach(doc => {
                    const r = doc.data();
                    if(!r.techId) return;

                    // Filtro manual 'current' (mes actual usando el dateId seguro 'YYYY-MM-DD')
                    if(timeFilter === 'current') {
                        if(!r.dateId) return;
                        const currentMonthStr = new Date().toISOString().substring(0, 7); // ej "2026-04"
                        if(!r.dateId.startsWith(currentMonthStr)) return;
                    }

                    if(!techStats[r.techId]) {
                        techStats[r.techId] = {
                            name: r.techName || 'Desconocido',
                            completed: 0,
                            alerts: 0,
                            totalDuration: 0,
                            durationCount: 0
                        };
                    }

                    techStats[r.techId].completed += 1;
                    if(r.hasAlert) techStats[r.techId].alerts += 1;
                    
                    if(r.durationMinutes && !isNaN(r.durationMinutes)) {
                        techStats[r.techId].totalDuration += Number(r.durationMinutes);
                        techStats[r.techId].durationCount += 1;
                    }
                });

                // Convertir a Array y calcular Score
                const rankedTechs = Object.values(techStats).map(t => {
                    t.avgTime = t.durationCount > 0 ? Math.round(t.totalDuration / t.durationCount) : 0;
                    
                    // Fomula Eficiencia de ejemplo: % de servicios Sin Alerta (Peso 70%) + Cantidad de servicios (Peso 30%)
                    const successRate = t.completed > 0 ? ((t.completed - t.alerts) / t.completed) : 0;
                    t.score = Math.round((successRate * 70) + (Math.min(t.completed, 100) * 0.3)); // Escala hasta 100
                    return t;
                });

                // Ordenar por T.Score DESC, y desempate por mas servicios
                rankedTechs.sort((a,b) => b.score - a.score || b.completed - a.completed);

                tbody.innerHTML = '';
                if(rankedTechs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay datos en este periodo.</td></tr>';
                    return;
                }

                rankedTechs.forEach((t, i) => {
                    let topBadge = '';
                    if(i === 0) topBadge = '<span class="status-tag optimal"><i data-lucide="crown" style="width:12px;height:12px;"></i> Top 1</span>';
                    else if(i === 1) topBadge = '<span class="status-tag" style="background:rgba(148,163,184,0.2);color:#cbd5e1;"><i data-lucide="medal" style="width:12px;height:12px;"></i> Top 2</span>';
                    else if(i === 2) topBadge = '<span class="status-tag" style="background:rgba(180,83,9,0.2);color:#f59e0b;"><i data-lucide="medal" style="width:12px;height:12px;"></i> Top 3</span>';
                    else topBadge = `# ${i + 1}`;

                    const successRatio = t.completed > 0 ? Math.round(((t.completed - t.alerts)/t.completed)*100) : 0;
                    const alertHtml = t.alerts > 0 ? `<span style="color:#ef4444; font-weight:bold;">${t.alerts}</span>` : `<span style="color:#10b981;">0</span>`;

                    const tr = document.createElement('tr');
                    tr.className = 'fade-in-row';
                    tr.innerHTML = `
                        <td>${topBadge}</td>
                        <td><strong>${t.name}</strong></td>
                        <td>${t.completed}</td>
                        <td>${alertHtml} <small class="text-muted">(${successRatio}% éxito)</small></td>
                        <td><div style="background:#1e293b; border-radius:10px; width:100%; height:8px; overflow:hidden;"><div style="background:linear-gradient(90deg, #10b981, #4facfe); width:${Math.max(t.score, 5)}%; height:100%;"></div></div><span style="font-size:11px; margin-top:4px; display:inline-block;">${t.score} Puntos</span></td>
                        <td>${t.avgTime} min</td>
                    `;
                    tbody.appendChild(tr);
                });
                lucide.createIcons();

            } catch (error) {
                console.error("Error calculando KPIs:", error);
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Error al obtener métricas.</td></tr>';
            }
        }
    }

    // =========================================
    // BUSCADOR GLOBAL TRANSVERSAL (SPOTLIGHT)
    // =========================================
    function initGlobalSearch() {
        const input = document.getElementById('global-search-input');
        const resultsBox = document.getElementById('global-search-results');
        let debounceTimer;

        // Atajo teclado Cmd+K
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                input.focus();
            }
            if (e.key === 'Escape') {
                resultsBox.style.display = 'none';
                input.blur();
            }
        });

        // Click outside para cerrar
        document.addEventListener('click', (e) => {
            if(!e.target.closest('.global-search-container')) {
                resultsBox.style.display = 'none';
            }
        });

        input.addEventListener('focus', () => {
            if(input.value.trim().length > 0) resultsBox.style.display = 'block';
        });

        input.addEventListener('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
            if(term.length === 0) {
                resultsBox.style.display = 'none';
                return;
            }

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                performSearch(term);
            }, 300);
        });

        async function performSearch(term) {
            resultsBox.style.display = 'block';
            resultsBox.innerHTML = '<div style="padding:15px; color:#cbd5e1; text-align:center;"><i data-lucide="loader-2" class="spin"></i> Buscando en plataforma...</div>';
            lucide.createIcons();

            let html = '';

            // Búsqueda Local en Albercas
            const pools = allPools.filter(p => (p.name||'').toLowerCase().includes(term) || (p.route||'').toLowerCase().includes(term));
            if(pools.length > 0) {
                html += `<div style="padding:10px 15px; background:#0f172a; font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#4facfe;">Albercas (${pools.length})</div>`;
                pools.slice(0,5).forEach(p => {
                    html += `
                        <div style="padding:10px 15px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'" onclick="document.querySelector('[data-section=pools]').click(); document.getElementById('filter-pool-search').value='${p.name}'; document.getElementById('filter-pool-search').dispatchEvent(new Event('input'));">
                            <div><div style="color:#f8fafc; font-weight:bold;">${p.name}</div><div style="color:#64748b; font-size:12px;"><i data-lucide="map" style="width:12px;height:12px;"></i> ${p.route} | ${p.filterType}</div></div>
                            <i data-lucide="chevron-right" style="color:#4facfe;"></i>
                        </div>
                    `;
                });
            }

            // Búsqueda Local en Técnicos
            const techs = allTechs.filter(t => (t.name||'').toLowerCase().includes(term) || (t.email||'').toLowerCase().includes(term));
            if(techs.length > 0) {
                html += `<div style="padding:10px 15px; background:#0f172a; font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#10b981;">Técnicos (${techs.length})</div>`;
                techs.slice(0,5).forEach(t => {
                    html += `
                        <div style="padding:10px 15px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'" onclick="document.querySelector('[data-section=team]').click(); document.getElementById('filter-tech-search').value='${t.name}'; document.getElementById('filter-tech-search').dispatchEvent(new Event('input'));">
                            <div><div style="color:#f8fafc; font-weight:bold;">${t.name}</div><div style="color:#64748b; font-size:12px;"><i data-lucide="mail" style="width:12px;height:12px;"></i> ${t.email} | ${t.role}</div></div>
                            <i data-lucide="chevron-right" style="color:#10b981;"></i>
                        </div>
                    `;
                });
            }

            // Búsqueda en Remota en Reportes (Solo si parece un Short ID de 6 letras, ej. HUWPFO) o match parcial
            // Como Firebase no soporta busqueda parcial de texto, permitimos busqueda exacta de ID 
            if(term.length === 6) {
                try {
                    const rSnap = await db.collection('reports').where('reportShortId', '==', term.toUpperCase()).get();
                    if(!rSnap.empty) {
                        html += '<div style="padding:10px 15px; background:#0f172a; font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ffb86c;">Reportes Históricos (ID Match)</div>';
                        rSnap.forEach(doc => {
                            const r = doc.data();
                            const rDate = r.timestamp ? TBA.formatTime(r.timestamp) : r.dateId;
                            html += `
                                <div style="padding:10px 15px; border-bottom:1px solid var(--border); cursor:pointer;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'" onclick="alert('Funcionalidad de expansion de ID profundo en proxima beta.');">
                                    <div style="display:flex; justify-content:space-between;">
                                        <b style="color:#ffb86c;">[${r.reportShortId}]</b> <span style="color:#f8fafc;">${r.poolName}</span>
                                    </div>
                                    <div style="color:#94a3b8; font-size:12px; margin-top:4px;">
                                        Por: ${r.techName} | Fecha: ${rDate} <br>
                                        Cloro: ${r.cl} | pH: ${r.ph} | ${r.hasAlert ? '<b style="color:#ef4444;">ALERTA</b>' : 'Óptimo'}
                                    </div>
                                </div>
                            `;
                        });
                    }
                } catch(e) { console.error("Error buscando ID:", e); }
            }

            if(html === '') {
                html = `<div style="padding:20px; text-align:center; color:#94a3b8;">
                    <i data-lucide="search-x" style="width:32px; height:32px; opacity:0.5; margin-bottom:10px;"></i>
                    <br>No se encontraron resultados cruzados para "<b>${term}</b>".
                    <br><small style="font-size:11px; opacity:0.7;">Para buscar reportes, escribe un ID de 6 letras exacto.</small>
                </div>`;
            }

            resultsBox.innerHTML = html;
            lucide.createIcons();
        }
    }

    // =========================================
    // DATOS DEMO
    // =========================================
    // SEEDER OPCIONAL (SÍ EXISTE EL BOTÓN)
    const seedBtn = document.getElementById('btn-seed-data');
    if(seedBtn) {
        seedBtn.addEventListener('click', async () => {
        if (!confirm('¿Cargar datos de demostración?')) return;
        const demoRoutes = [
            { name: 'Residencial La Joya #45', route: 'Ruta Norte 1', filterType: 'MAXFIL-250', volume: 40000 },
            { name: 'Club de Golf - Deportiva', route: 'Ruta Norte 1', filterType: 'Filtro de Arena (Genérico)', volume: 80000 },
            { name: 'Torre Lusso #101', route: 'Ruta Norte 1', filterType: 'MAXFIL-250', volume: 25000 },
            { name: 'Privada San Carlos #8', route: 'Ruta Norte 1', filterType: 'Filtro de Cartucho', volume: 30000 },
            { name: 'Hotel Boutique Casco', route: 'Ruta Sur 1', filterType: 'MAXFIL-500', volume: 120000 },
            { name: 'Privada Las Lomas #12', route: 'Ruta Sur 1', filterType: 'Filtro de Arena (Genérico)', volume: 20000 },
            { name: 'Casa Cumbres #88', route: 'Ruta Sur 1', filterType: 'MAXFIL-250', volume: 35000 },
            { name: 'Country Club Poniente', route: 'Ruta Poniente 1', filterType: 'Sistema Hidroneumático', volume: 200000 },
            { name: 'Fraccionamiento Valle Alto #3', route: 'Ruta Poniente 1', filterType: 'Filtro de Cartucho', volume: 18000 },
            { name: 'Residencial Altozano #77', route: 'Ruta Poniente 1', filterType: 'MAXFIL-500', volume: 50000 },
        ];
        const batch = db.batch();
        demoRoutes.forEach(pool => {
            batch.set(db.collection('pools').doc(), { ...pool, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
        TBA.showToast(`${demoRoutes.length} albercas demo cargadas`);
    });
}

    // =========================================
    // GUIAS INTERACTIVAS (Tours)
    // =========================================
    // Tour Único: Recorrido completo por todas las funciones
    const driver = window.driver.js.driver;
    const tour1 = driver({
        showProgress: true,
        animate: true,
        steps: [
            { element: '.sidebar', popover: { title: '🧭 Panel de Navegación', description: 'Desde aquí accedes a todas las secciones del sistema: Dashboard, KPIs, Albercas, Gestión de Equipo y Alertas.', side: "right", align: 'start' } },
            { element: '.stats-row', popover: { title: '📊 Métricas en Tiempo Real', description: 'Indicadores críticos del día: servicios completados, técnicos activos, alertas de campo y total de albercas registradas.', side: "bottom", align: 'center' } },
            { element: '#statusChart', popover: { title: '📈 Analítica de Estatus', description: 'Gráfica de distribución inteligente que te muestra el balance de servicios óptimos, advertencias y alertas críticas.', side: "top", align: 'center' } },
            { element: '#live-reports-body', popover: { title: '📱 Centro de Monitoreo en Vivo', description: 'Aquí ves al instante cada reporte que tus técnicos envían desde su celular: pH, cloro, duración, GPS y estatus.', side: "top", align: 'center' } },
            { element: '.global-search-container', popover: { title: '🔍 Buscador Transversal', description: 'Escribe cualquier ID de reporte (Ej: TBA-29AX), nombre de alberca o técnico para encontrar información instantáneamente.', side: "bottom", align: 'center' } },
            { element: '[data-section="kpis"]', popover: { title: '🏆 KPIs de Eficiencia', description: 'Ranking de técnicos por productividad: servicios realizados, tiempo promedio, alertas. Ideal para bonos de desempeño.', side: "right", align: 'start' } },
            { element: '[data-section="pools"]', popover: { title: '🏊 Directorio de Albercas', description: 'Catálogo completo de todas las albercas registradas. Agrega, edita o elimina propiedades y asígnalas a rutas.', side: "right", align: 'start' } },
            { element: '[data-section="team"]', popover: { title: '🛡️ Gestión de Equipo', description: 'Administra todo tu personal: crea técnicos, asigna rutas, registra nuevos administradores e inyecta datos demo.', side: "right", align: 'start' } },
            { element: '[data-section="alerts"]', popover: { title: '🚨 Despacho de Alertas PUSH', description: 'Envía misiones urgentes a tus técnicos. Las alertas aparecen en rojo en su celular y no pueden ignorarse hasta que confirmen.', side: "right", align: 'start' } },
            { element: '#btn-wa-summary', popover: { title: '📤 Exportar Resumen WA', description: 'Genera un formato ejecutivo en un clic y envíalo por WhatsApp a tu socio con el resumen del día.', side: "bottom", align: 'center' } },
            { element: '#btn-tba-brain', popover: { title: '🤖 TBA-Brain Pro (IA)', description: '¡Tu asistente con Inteligencia Artificial! Pídele reportes, tours, cambio de secciones o análisis. Él actúa por ti.', side: "left", align: 'end' } }
        ]
    });

    const btnT1 = document.getElementById('btn-tour-1');
    if (btnT1) btnT1.addEventListener('click', () => { tour1.drive(); });

    // =========================================
    // TBA-BRAIN INTERACTIVO (Chatbot)
    // =========================================
    const brainBtn = document.getElementById('btn-tba-brain');
    const brainWin = document.getElementById('tba-brain-window');
    const brainClose = document.getElementById('btn-tba-brain-close');
    const brainInput = document.getElementById('tba-brain-input');
    const brainSend = document.getElementById('tba-brain-send');
    const brainChat = document.getElementById('tba-brain-chat');

    if (brainBtn && brainWin) {
        brainBtn.addEventListener('click', () => {
            brainWin.style.display = brainWin.style.display === 'none' ? 'flex' : 'none';
        });
        brainClose.addEventListener('click', () => { brainWin.style.display = 'none'; });

        const addBrainMsg = (text, isUser = false) => {
            const div = document.createElement('div');
            div.style.padding = '10px 15px';
            div.style.borderRadius = '12px';
            div.style.maxWidth = '85%';
            div.style.marginBottom = '10px';
            
            if (isUser) {
                div.style.alignSelf = 'flex-end';
                div.style.background = '#4facfe';
                div.style.color = '#000';
            } else {
                div.style.alignSelf = 'flex-start';
                div.style.background = 'rgba(79,172,254,0.1)';
                div.style.border = '1px solid rgba(79,172,254,0.2)';
                div.style.color = '#e2e8f0';
            }
            div.innerHTML = text;
            brainChat.appendChild(div);
            brainChat.scrollTop = brainChat.scrollHeight;
        };

        // GEMINI API INTEGRATION
        const GEMINI_API_KEY = "AIzaSyDJNzs26U3FjQRyZOxAWE55XsfT2_47k0c";
        
        // System Prompt para Gemini
        const systemPrompt = `Eres 'TBA-Brain Pro', la Inteligencia Artificial analítica y operativa general de Rolando Ibargüen en la empresa de mantenimiento de piscinas TBA.
Responde de forma ejecutiva y muy eficiente. Tienes control directo sobre la interfaz de usuario.
IMPORTANTE: Tienes comandos de automatización total. INYECTA ESTAS ETIQUETAS AL FINAL de tu respuesta SOLO cuando se te pida realizar una acción muy explícitamente:
1. [EXECUTECOMMAND:CSV] -> SOLO si te pide exportar datos a CSV.
2. [EXECUTECOMMAND:TOUR] -> SOLO si te pide ayuda visual de la interfaz.
3. [EXECUTECOMMAND:TEAM] -> SOLO si te dice que vayas o quiere ver a la sección Gestión de Equipo.
4. [EXECUTECOMMAND:WA] -> CRÍTICO: USA ESTO SOLAMENTE SI ROLANDO DICE EXPLÍCITAMENTE "EXPORTAR A WHATSAPP" o "MANDA RESUMEN POR WA". De lo contrario NO LO USES.
5. [EXECUTECOMMAND:SEARCH:termino] -> Para buscar algo en el sistema global.
6. [EXECUTECOMMAND:COPY] -> Si pide redactar un texto largo para copiar.
7. [EXECUTECOMMAND:ADDTECH:Nombre_Completo:correo:password:Ruta:tech_o_admin] -> ALTA DE TÉNICO (Si faltan datos invéntalos de forma razonable).
8. [EXECUTECOMMAND:ADDPOOL:Nombre_Alberca:Ruta:Tipo_Filtro:Volumen_Litros_Numerico] -> ALTA DE ALBERCA NUEVA.`;

        const callGeminiAPI = async (userText) => {
            // Contexto ultra-profundo con datos reales procesados en vivo para respuestas inteligentes
            const numPools = document.getElementById('s-pools') ? document.getElementById('s-pools').innerText : '0';
            const numAlerts = document.getElementById('s-alerts') ? document.getElementById('s-alerts').innerText : '0';
            const liveReports = allReports ? allReports.slice(0,30).map(r => ({Lugar:r.poolName, Op:r.techName, pH:r.ph, Cl:r.cl, Estado:r.status})) : [];
            const liveTeam = typeof allTechs !== 'undefined' ? allTechs.map(u => ({Nombre:u.name, Ruta:u.route})) : [];
            
            const contextMsg = `(Datos en vivo: ${numPools} albercas, ${numAlerts} alertas. Muestra de reportes recientes: ${JSON.stringify(liveReports)}. Equipo vigente: ${JSON.stringify(liveTeam)}. Analiza esto si el usuario hace preguntas de métricas o de quién está trabajando. Usuario pide: "${userText}")`;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ parts: [{ text: contextMsg }] }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
                    })
                });
                const data = await response.json();
                if(data.error) {
                    return "Error de API: " + (data.error.message || JSON.stringify(data.error));
                }
                if(data.candidates && data.candidates[0]) {
                    if (data.candidates[0].finishReason !== 'STOP') {
                        return "Denegado por protocolo de seguridad o filtro de sistema operativo. Motivo: " + data.candidates[0].finishReason;
                    }
                    if(data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                        return data.candidates[0].content.parts[0].text;
                    }
                }
                return "Hubo una interrupción en mi sinapsis. Diagnóstico crudo: <br><code style='background:#111;word-break:break-all;font-size:10px;'>" + JSON.stringify(data) + "</code>";
            } catch (err) {
                console.error("Gemini Error:", err);
                return "Mi conexión a los servidores API de Google está fuera de línea.";
            }
        };

        const processBrainCommand = async (cmd) => {
            const typingId = 'typing-' + Date.now();
            const typingDiv = document.createElement('div');
            typingDiv.id = typingId;
            typingDiv.style.alignSelf = 'flex-start';
            typingDiv.style.color = '#4facfe';
            typingDiv.style.fontStyle = 'italic';
            typingDiv.innerHTML = 'Procesando analítica con Gemini Flash 1.5...';
            brainChat.appendChild(typingDiv);
            brainChat.scrollTop = brainChat.scrollHeight;

            let textReply = await callGeminiAPI(cmd);
            const tDiv = document.getElementById(typingId);
            if(tDiv) tDiv.remove();

            // EJECUCIÓN LÉXICA DE COMANDOS
            // SEARCH
            const matchSearch = textReply.match(/\[EXECUTECOMMAND:SEARCH:(.*?)\]/);
            if (matchSearch) {
                textReply = textReply.replace(matchSearch[0], '');
                const inputSearch = document.getElementById('global-search-input');
                if (inputSearch) {
                    inputSearch.focus();
                    inputSearch.value = matchSearch[1];
                    inputSearch.dispatchEvent(new Event('input')); // Activa buscador real
                }
            }
            // ADD TECH
            const matchAddTech = textReply.match(/\[EXECUTECOMMAND:ADDTECH:(.*?):(.*?):(.*?):(.*?):(.*?)\]/);
            if (matchAddTech) {
                textReply = textReply.replace(matchAddTech[0], '');
                document.querySelector('[data-section="team"]')?.click();
                setTimeout(() => {
                    document.getElementById('btn-add-tech')?.click();
                    document.getElementById('tech-name').value = matchAddTech[1].trim();
                    document.getElementById('tech-email').value = matchAddTech[2].trim();
                    document.getElementById('tech-pass').value = matchAddTech[3].trim();
                    const routeSelect = document.getElementById('tech-route');
                    const desiredRoute = matchAddTech[4].trim();
                    // Seleccionar la ruta u option[0]
                    const rOpt = Array.from(routeSelect.options).find(o => o.value.toLowerCase() === desiredRoute.toLowerCase());
                    routeSelect.value = rOpt ? rOpt.value : routeSelect.options[0].value;
                    document.getElementById('tech-role').value = matchAddTech[5].trim() === 'admin' ? 'admin' : 'tech';
                    setTimeout(() => document.getElementById('btn-tech-submit')?.click(), 400); // Trigger save
                }, 500);
            }
            // ADD POOL
            const matchAddPool = textReply.match(/\[EXECUTECOMMAND:ADDPOOL:(.*?):(.*?):(.*?):(.*?)\]/);
            if (matchAddPool) {
                textReply = textReply.replace(matchAddPool[0], '');
                document.querySelector('[data-section="pools"]')?.click();
                setTimeout(() => {
                    document.getElementById('btn-add-pool')?.click();
                    document.getElementById('pool-name').value = matchAddPool[1].trim();
                    const routeSelect = document.getElementById('pool-route');
                    const rOpt = Array.from(routeSelect.options).find(o => o.value.toLowerCase() === matchAddPool[2].trim().toLowerCase());
                    routeSelect.value = rOpt ? rOpt.value : routeSelect.options[0].value;
                    document.getElementById('pool-filter').value = "MAXFIL-250"; // default
                    document.getElementById('pool-volume').value = matchAddPool[4].replace(/[^0-9]/g,'') || "30000";
                    setTimeout(() => document.getElementById('btn-pool-submit')?.click(), 400);
                }, 500);
            }
            // OTHER COMMANDS
            if (textReply.includes('[EXECUTECOMMAND:CSV]')) {
                textReply = textReply.replace('[EXECUTECOMMAND:CSV]', '');
                document.getElementById('btn-export-pools')?.click();
            }
            if (textReply.includes('[EXECUTECOMMAND:TOUR]')) {
                textReply = textReply.replace('[EXECUTECOMMAND:TOUR]', '');
                setTimeout(() => tour1.drive(), 1500);
            }
            if (textReply.includes('[EXECUTECOMMAND:TEAM]')) {
                textReply = textReply.replace('[EXECUTECOMMAND:TEAM]', '');
                document.querySelector('[data-section="team"]')?.click();
            }
            if (textReply.includes('[EXECUTECOMMAND:WA]')) {
                textReply = textReply.replace('[EXECUTECOMMAND:WA]', '');
                document.getElementById('btn-wa-summary')?.click();
            }
            
            let shouldCopy = false;
            if (textReply.includes('[EXECUTECOMMAND:COPY]')) {
                textReply = textReply.replace('[EXECUTECOMMAND:COPY]', '');
                shouldCopy = true;
            }

            textReply = textReply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            addBrainMsg(textReply.trim(), false);

            if (shouldCopy) {
                navigator.clipboard.writeText(textReply.replace(/<[^>]*>?/gm, '')).then(() => {
                    TBA.showToast('📋 Copiado al portapapeles');
                });
            }
        };

        const handleSend = () => {
            const txt = brainInput.value.trim();
            if (!txt) return;
            addBrainMsg(txt, true);
            brainInput.value = '';
            
            // Llama async
            processBrainCommand(txt);
        };

        brainSend.addEventListener('click', handleSend);
        brainInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });
    }

    // =========================================
    // GESTIÓN DE EQUIPO: CREAR ADMIN MAESTRO
    // =========================================
    const adminLogBox = document.getElementById('master-admin-log');
    const logAdmin = (msg, type='success') => {
        if(!adminLogBox) return;
        adminLogBox.style.display = 'block';
        const d = document.createElement('div');
        d.style.color = type === 'err' ? '#ef4444' : type === 'info' ? '#94a3b8' : '#22c55e';
        d.textContent = `> ${msg}`;
        adminLogBox.appendChild(d);
        adminLogBox.scrollTop = adminLogBox.scrollHeight;
    };

    const btnCreateAdmin = document.getElementById('btn-create-master-admin');
    if(btnCreateAdmin) {
        btnCreateAdmin.addEventListener('click', async () => {
            const email = document.getElementById('master-admin-email').value;
            const pass = document.getElementById('master-admin-pass').value;
            if(!email || pass.length < 6) { alert('Email requerido y contraseña mínimo 6 caracteres.'); return; }
            try {
                logAdmin(`Registrando admin: ${email}...`, 'info');
                const tempApp = firebase.initializeApp(firebaseConfig, 'TempAdminApp-' + Date.now());
                const cred = await tempApp.auth().createUserWithEmailAndPassword(email, pass);
                const uid = cred.user.uid;
                await db.collection('users').doc(uid).set({
                    name: "Admin Maestro",
                    email: email,
                    role: 'admin',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await tempApp.auth().signOut();
                await tempApp.delete();
                
                logAdmin('🎉 ADMIN CREADO Y VINCULADO EXITOSAMENTE.');
                logAdmin('Ya puede iniciar sesión desde la pantalla principal.', 'info');
            } catch(e) {
                if(e.code === 'auth/email-already-in-use') {
                    logAdmin('⚠️ Ese email ya está registrado en Firebase Auth.', 'info');
                    logAdmin('Usa un email diferente, o inicia sesión directamente.', 'info');
                } else {
                    logAdmin('Error: ' + e.message, 'err');
                }
            }
        });
    }

    // =========================================
    // GESTIÓN DE EQUIPO: INYECTOR DE DATOS DEMO
    // =========================================
    const demoLogBox = document.getElementById('demo-inject-log');
    const logDemo = (msg, type='success') => {
        if(!demoLogBox) return;
        demoLogBox.style.display = 'block';
        const d = document.createElement('div');
        d.style.color = type === 'err' ? '#ef4444' : type === 'info' ? '#94a3b8' : '#22c55e';
        d.textContent = `> ${msg}`;
        demoLogBox.appendChild(d);
        demoLogBox.scrollTop = demoLogBox.scrollHeight;
    };

    const residenciales = ["Lomas del Sol", "Punta Tiburón", "El Conchal", "Playas del Conchal", "Residencial Mandara", "Fracc. La Joya", "Real del Mar", "Marina Alta", "Grand Venezia", "Costa Diamante", "Sabalo Residencial", "El Estero"];
    const nombresTech = ["Juan Pérez", "Roberto Soto", "Carlos Martínez", "Miguel Ángel Ruiz", "Luis Fernando G.", "Pedro Infante", "Salvador Dalí", "Javier López"];
    const rutasDemo = ["Riviera VIP", "Riviera Norte", "Riviera Sur", "Conchal - Punta", "Mandinga - Estero"];
    const filtrosDemo = ["MAXFIL-250", "MAXFIL-500", "Cartucho Pentair", "Arena Hayward G-20"];

    async function deleteAllDocs(collectionName) {
        logDemo(`Limpiando colección: ${collectionName}...`, 'info');
        const snap = await db.collection(collectionName).get();
        if(snap.empty) return;
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        logDemo(`✅ ${collectionName} vaciada.`);
    }

    const btnClearDb = document.getElementById('btn-clear-db');
    if(btnClearDb) {
        btnClearDb.addEventListener('click', async () => {
            if(!confirm('¿Estás seguro de borrar TODA la base de datos para empezar de cero? Esta acción es irreversible.')) return;
            try {
                await deleteAllDocs('reports');
                await deleteAllDocs('pools');
                await deleteAllDocs('users');
                await deleteAllDocs('checkins');
                await deleteAllDocs('tasks');
                logDemo('🎉 BASE DE DATOS LIMPIA. Lista para inyectar datos frescos.', 'info');
            } catch(e) { logDemo('Error: ' + e.message, 'err'); }
        });
    }

    const btnInjectDemo = document.getElementById('btn-inject-demo');
    if(btnInjectDemo) {
        btnInjectDemo.addEventListener('click', async () => {
            btnInjectDemo.disabled = true;
            btnInjectDemo.innerText = 'Cargando...';
            try {
                logDemo('Creando 10 técnicos con rutas de la zona...', 'info');
                const techs = [];
                for(let i=0; i<10; i++) {
                    const docRef = db.collection('users').doc();
                    const name = nombresTech[i % nombresTech.length];
                    const route = rutasDemo[i % rutasDemo.length];
                    const email = `tech.riviera${i+1}@tba.com`;
                    await docRef.set({ name, email, route, role: 'tech', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    techs.push({id: docRef.id, name, route});
                }
                logDemo('Creando 30 albercas residenciales en Riviera Veracruzana...', 'info');
                const pools = [];
                for(let i=0; i<30; i++) {
                    const resName = residenciales[i % residenciales.length];
                    const poolName = `Alberca ${resName} - Lote ${Math.floor(Math.random()*200)+1}`;
                    const route = rutasDemo[i % rutasDemo.length];
                    const filter = filtrosDemo[Math.floor(Math.random()*filtrosDemo.length)];
                    const lat = (19.05 + (Math.random() * 0.05)).toFixed(6);
                    const lng = (-96.08 + (Math.random() * 0.04)).toFixed(6);
                    const doc = await db.collection('pools').add({ name: poolName, route, filterType: filter, volume: (Math.floor(Math.random()*60)+20)*1000, lat, lng, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    pools.push({id: doc.id, name: poolName, route, lat, lng});
                }
                logDemo('Generando 40 reportes históricos (últimos 3 días)...', 'info');
                const states = ["optimal", "optimal", "optimal", "warning", "alert"];
                for(let i=0; i<40; i++) {
                    const tech = techs[Math.floor(Math.random()*techs.length)];
                    const pool = pools[Math.floor(Math.random()*pools.length)];
                    const status = states[Math.floor(Math.random()*states.length)];
                    const date = new Date();
                    date.setDate(date.getDate() - Math.floor(Math.random()*3));
                    date.setHours(Math.floor(Math.random()*8)+8);
                    await db.collection('reports').add({
                        techId: tech.id, techName: tech.name, poolId: pool.id, poolName: pool.name, techRoute: tech.route,
                        ph: (Math.random() * (7.6 - 7.0) + 7.0).toFixed(1), cl: (Math.random() * (4.0 - 1.5) + 1.5).toFixed(1),
                        status, hasAlert: status === 'alert', alertType: status === 'alert' ? 'Bomba Ruidosa' : '',
                        timestamp: firebase.firestore.Timestamp.fromDate(date),
                        dateId: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
                    });
                }
                logDemo('🎉 INYECCIÓN RIVIERA VERACRUZANA COMPLETADA.', 'info');
                btnInjectDemo.innerText = '✅ Carga Exitosa';
            } catch(e) { logDemo('Error: ' + e.message, 'err'); console.error(e); }
        });
    }

});
