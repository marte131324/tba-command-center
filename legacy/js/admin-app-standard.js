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
    // Stores globales para filtrado
    let allPools = [];
    let allTechs = [];
    let allReports = [];

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

        loader.style.display = 'none';
        app.style.display = 'flex';
        lucide.createIcons();
    });

    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });

    // =========================================
    // NAVEGACIÓN
    // =========================================
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    const sections = document.querySelectorAll('.content-section');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`section-${item.dataset.section}`).classList.add('active');
            document.getElementById('page-title').textContent = item.textContent.trim();
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
                tbody.innerHTML = '<tr class="empty-row"><td colspan="9" class="text-center text-muted">Esperando reportes...</td></tr>';
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
                    const st = r.hasAlert ? `🚨 ${r.alertType}` : (r.status === 'optimal' ? '✅ Óptimo' : '⚠️ Atención');
                    const ci = r.checkinTime ? TBA.formatTime(r.checkinTime) : '--';
                    const co = r.checkoutTime ? TBA.formatTime(r.checkoutTime) : '--';
                    const dur = r.durationMinutes ? `${r.durationMinutes} min` : '--';
                    const ins = r.insumo && r.insumo !== 'Ninguno' ? `${r.insumo} (${r.insumoQty||0} ${r.insumoUnit||''})` : 'Ninguno';
                    const tr = document.createElement('tr');
                    tr.className = 'fade-in-row';
                    tr.innerHTML = `
                        <td><span class="pool-name">${r.poolName}</span><span class="pool-sub">${r.poolFilter||''}</span></td>
                        <td>${r.techName}</td><td>${ci}</td><td>${co}</td>
                        <td><strong>${dur}</strong></td>
                        <td><span class="tag-${sc}">${r.ph}</span></td>
                        <td><span class="tag-${sc}">${r.cl}</span></td>
                        <td>${ins}</td>
                        <td><span class="status-tag ${sc}">${st}</span></td>`;
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('s-completed').textContent = completedCount;
            document.getElementById('s-alerts').textContent = alertCount;
        }, err => console.error('Reports error:', err));

        // Check-ins activos
        db.collection('checkins').where('dateId', '==', todayId).onSnapshot(snap => {
            const tbody = document.getElementById('active-checkins-body');
            tbody.innerHTML = '';
            const active = [];
            snap.forEach(doc => { const d = doc.data(); if(!d.checkoutTime) active.push(d); });
            if(!active.length) {
                tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center text-muted">Ningún técnico en campo.</td></tr>';
                return;
            }
            active.forEach(c => {
                const at = c.checkinTime ? TBA.formatTime(c.checkinTime) : 'Ahora';
                let tos = '--';
                if(c.checkinTime) { const d = Math.floor((Date.now()-c.checkinTime.toDate().getTime())/60000); tos = `${d} min`; }
                const tr = document.createElement('tr');
                tr.className = 'fade-in-row';
                tr.innerHTML = `<td><strong>${c.techName}</strong></td><td>${c.poolName}</td><td>${at}</td><td><span class="status-tag in-progress-tag">${tos}</span></td>`;
                tbody.appendChild(tr);
            });
        }, err => console.error('Checkins error:', err));

        // Contadores
        db.collection('pools').onSnapshot(s => {
            document.getElementById('s-pools').textContent = s.size;
            document.getElementById('s-total').textContent = `/ ${s.size}`;
        });
        db.collection('users').where('role','==','tech').onSnapshot(s => {
            document.getElementById('s-techs').textContent = s.size;
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

            // Actualizar dropdowns de filtros
            const routeSelect = document.getElementById('filter-pool-route');
            const saved = routeSelect.value;
            routeSelect.innerHTML = '<option value="">Todas las Rutas</option>';
            [...routes].sort().forEach(r => routeSelect.innerHTML += `<option value="${r}">${r}</option>`);
            routeSelect.value = saved;

            const filterSelect = document.getElementById('filter-pool-filter-type');
            const saved2 = filterSelect.value;
            filterSelect.innerHTML = '<option value="">Todos los Filtros</option>';
            [...filters].sort().forEach(f => filterSelect.innerHTML += `<option value="${f}">${f}</option>`);
            filterSelect.value = saved2;

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
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="pool-name">${p.name}</span></td>
                <td>${p.route}</td><td>${p.filterType}</td>
                <td>${p.volume ? Number(p.volume).toLocaleString()+' Lts' : 'N/A'}</td>
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
                if(t.role !== 'tech' && t.role !== 'admin') return;
                allTechs.push(t);
                if(t.route) routes.add(t.route);
            });

            const routeSelect = document.getElementById('filter-tech-route');
            const saved = routeSelect.value;
            routeSelect.innerHTML = '<option value="">Todas las Rutas</option>';
            [...routes].sort().forEach(r => routeSelect.innerHTML += `<option value="${r}">${r}</option>`);
            routeSelect.value = saved;

            applyTechFilters();
        });
    }

    function applyTechFilters() {
        const search = document.getElementById('filter-tech-search').value.toLowerCase().trim();
        const route = document.getElementById('filter-tech-route').value;
        const role = document.getElementById('filter-tech-role').value;

        let filtered = allTechs.filter(t => {
            if(search && !t.name.toLowerCase().includes(search)) return false;
            if(route && t.route !== route) return false;
            if(role && t.role !== role) return false;
            return true;
        });

        const results = document.getElementById('tech-filter-results');
        const hasFilters = search || route || role;
        results.textContent = hasFilters ? `Mostrando ${filtered.length} de ${allTechs.length} técnicos` : '';

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
            const rb = t.role==='admin' ? '<span class="role-badge admin">Admin</span>' : '<span class="role-badge tech">Técnico</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.name}</strong></td><td>${t.email||'--'}</td>
                <td>${t.route||'Sin ruta'}</td><td>${rb}</td>
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
                    document.getElementById('tech-route').value = t.route||'';
                    document.getElementById('tech-role').value = t.role||'tech';
                    document.getElementById('pass-group').style.display = 'none';
                    document.getElementById('modal-tech-title').textContent = 'Editar Técnico';
                    document.getElementById('btn-tech-submit').textContent = 'Actualizar Técnico';
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
        document.getElementById('modal-pool-title').textContent = 'Agregar Alberca';
        document.getElementById('btn-pool-submit').textContent = 'Guardar Alberca';
        document.getElementById('modal-add-pool').classList.add('show');
    });
    document.getElementById('btn-add-tech').addEventListener('click', () => {
        document.getElementById('edit-tech-uid').value = '';
        document.getElementById('form-add-tech').reset();
        document.getElementById('tech-email').disabled = false;
        document.getElementById('pass-group').style.display = 'block';
        document.getElementById('modal-tech-title').textContent = 'Registrar Técnico';
        document.getElementById('btn-tech-submit').textContent = 'Registrar Técnico';
        document.getElementById('modal-add-tech').classList.add('show');
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.remove('show'));
    });

    // Guardar Alberca
    document.getElementById('form-add-pool').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-pool-id').value;
        const data = {
            name: document.getElementById('pool-name').value,
            route: document.getElementById('pool-route').value,
            filterType: document.getElementById('pool-filter').value,
            volume: parseInt(document.getElementById('pool-volume').value)||0,
        };
        if(editId) { await db.collection('pools').doc(editId).update(data); TBA.showToast('Alberca actualizada'); }
        else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('pools').add(data); TBA.showToast('Alberca registrada'); }
        document.getElementById('modal-add-pool').classList.remove('show');
        e.target.reset();
    });

    // Guardar Técnico
    document.getElementById('form-add-tech').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editUid = document.getElementById('edit-tech-uid').value;
        if(editUid) {
            await db.collection('users').doc(editUid).update({
                name: document.getElementById('tech-name').value,
                route: document.getElementById('tech-route').value,
                role: document.getElementById('tech-role').value,
            });
            TBA.showToast('Técnico actualizado');
            document.getElementById('modal-add-tech').classList.remove('show');
            e.target.reset();
        } else {
            const name = document.getElementById('tech-name').value;
            const email = document.getElementById('tech-email').value;
            const pass = document.getElementById('tech-pass').value;
            const route = document.getElementById('tech-route').value;
            const role = document.getElementById('tech-role').value;
            if(!pass || pass.length < 6) { TBA.showToast('Min. 6 caracteres'); return; }
            try {
                const cred = await auth.createUserWithEmailAndPassword(email, pass);
                await db.collection('users').doc(cred.user.uid).set({
                    name, email, route, role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                TBA.showToast(`${name} registrado`);
                document.getElementById('modal-add-tech').classList.remove('show');
                e.target.reset();
                alert(`"${name}" creado. Firebase cambiará sesión. Serás redirigido al login.`);
                await auth.signOut();
            } catch(err) {
                if(err.code === 'auth/email-already-in-use') TBA.showToast('Email ya registrado.');
                else TBA.showToast('Error: '+err.message);
            }
        }
    });

    // =========================================
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
        const rows = allTechs.map(t => [t.name, t.email||'', t.route||'', t.role]);
        downloadCSV(`TBA_Tecnicos_${TBA.todayId()}.csv`, headers, rows);
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

        const msg = `*📊 [TBA Reporte Diario]*
📅 ${TBA.formatDate()}

*Resumen Operativo:*
✅ Servicios completados: ${completed} / ${total}
⏳ Pendientes: ${remaining}
${alerts ? `🚨 Alertas: ${alerts}` : '✅ Sin alertas'}
⏱️ Duración promedio: ${avgDuration} min

*📍 Por Ruta:*${routeBreakdown || '\n  Sin datos'}

*🧪 Insumos Consumidos:*${insumoBreakdown || '\n  Sin registro'}

_Generado desde TBA Command Center_`;

        const url = `https://wa.me/${TBA.WA_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });

    // =========================================
    // DATOS DEMO
    // =========================================
    document.getElementById('btn-seed-data').addEventListener('click', async () => {
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
});
