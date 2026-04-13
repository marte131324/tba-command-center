/**
 * TBA Tech - Aplicación del Técnico en Campo v2.2
 * =================================================
 * Sincronización en tiempo real para colaboración por ruta.
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const loader = document.getElementById('full-loader');
    const app = document.getElementById('tech-app');
    const routeList = document.getElementById('route-list');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    const reportModal = document.getElementById('report-modal');
    const btnCloseReport = document.getElementById('btn-close-report');
    const reportForm = document.getElementById('report-form');
    const btnSendWA = document.getElementById('btn-send-wa');
    const timerDisplay = document.getElementById('checkin-timer-display');
    const timerValue = document.getElementById('timer-value');

    const inpPh = document.getElementById('inp-ph');
    const valPh = document.getElementById('val-ph');
    const inpCl = document.getElementById('inp-cl');
    const valCl = document.getElementById('val-cl');
    const inpInsumo = document.getElementById('inp-insumo');
    const inpQty = document.getElementById('inp-qty');
    const inpQtyUnit = document.getElementById('inp-qty-unit');
    const inpAlert = document.getElementById('inp-alert');
    const alertDetail = document.getElementById('alert-detail');
    const inpAlertType = document.getElementById('inp-alert-type');
    const inpNotes = document.getElementById('inp-notes');
    const reportPoolId = document.getElementById('report-pool-id');
    const reportCheckinId = document.getElementById('report-checkin-id');

    let currentUser = null;
    let userData = null;
    let poolsData = [];
    let lastReportData = null;
    let timerInterval = null;
    let checkinTime = null;
    let historyChartInstance = null;
    let selectedPhotoFile = null;

    // Rango visual del pH y Cloro
    inpPh.addEventListener('input', (e) => { 
        valPh.textContent = parseFloat(e.target.value).toFixed(1);
        updateRangeColor(e.target, 6.8, 7.6);
    });
    inpCl.addEventListener('input', (e) => { 
        valCl.textContent = parseFloat(e.target.value).toFixed(1);
        updateRangeColor(e.target, 1.0, 3.0);
    });

    function updateRangeColor(input, idealMin, idealMax) {
        const val = parseFloat(input.value);
        const display = input.nextElementSibling;
        if(val >= idealMin && val <= idealMax) {
            display.style.color = '#10b981';
            display.style.borderColor = 'rgba(16,185,129,0.3)';
        } else {
            display.style.color = '#f59e0b';
            display.style.borderColor = 'rgba(245,158,11,0.3)';
        }
    }

    inpAlert.addEventListener('change', (e) => {
        alertDetail.style.display = e.target.checked ? 'block' : 'none';
    });

    function stopTimer() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    }

    // AUTH & INITIALIZATION
    auth.onAuthStateChanged(async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        currentUser = user;

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'tech') {
            window.location.href = 'index.html'; return;
        }
        userData = userDoc.data();

        document.getElementById('tech-greeting').textContent = `Hola, ${userData.name.split(' ')[0]}`;
        document.getElementById('tech-date').textContent = TBA.formatDate() + ' • ' + (userData.route || 'Sin ruta');
        document.getElementById('tech-avatar').textContent = userData.name.charAt(0).toUpperCase();

        // Iniciar Sincronización en Tiempo Real
        setupRealtimeSync();
        listenToTasks();

        // Retraso cinemático de 5 segundos para el Splash de Co-Branding
        setTimeout(() => {
            if(loader) {
                loader.style.transition = 'opacity 0.8s ease';
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    app.style.display = 'block';
                    lucide.createIcons();
                }, 800);
            } else {
                app.style.display = 'block';
                lucide.createIcons();
            }
        }, 5000);
    });

    // =========================================
    // SINCRONIZACIÓN EN TIEMPO REAL (COLABORACIÓN)
    // =========================================
    let currentReports = new Set();
    let currentCheckins = {};
    let currentPools = [];

    function setupRealtimeSync() {
        const route = userData.route || '';
        const todayId = TBA.todayId();

        // 1. Reportes: Marcar como terminado si alguien del equipo(ruta) lo hizo hoy
        db.collection('reports').where('dateId', '==', todayId).where('techRoute', '==', route)
            .onSnapshot(snap => {
                currentReports = new Set();
                snap.forEach(doc => currentReports.add(doc.data().poolId));
                renderPools(currentPools, currentReports, currentCheckins);
                if(typeof updateDownloadButton === 'function') updateDownloadButton();
            });

        // 2. Checkins: Ver mis propios checkins activos
        db.collection('checkins').where('dateId', '==', todayId)
            .onSnapshot(snap => {
                currentCheckins = {};
                snap.forEach(doc => {
                    const data = doc.data();
                    if (data.techId === currentUser.uid && !data.checkoutTime) {
                        currentCheckins[data.poolId] = { id: doc.id, ...data };
                    }
                });
                renderPools(currentPools, currentReports, currentCheckins);
            });

        // 3. Albercas: Listado oficial de la ruta (Filtrado por Día)
        db.collection('pools').where('route', '==', route)
            .onSnapshot(snap => {
                currentPools = [];
                const currentDay = new Date().getDay(); // 1=Lunes, 6=Sabado
                
                snap.forEach(doc => {
                    const pData = doc.data();
                    // Si tiene configuración de días de semana en `visitDays`
                    if (pData.visitDays && pData.visitDays.length > 0) {
                        if (pData.visitDays.includes(currentDay)) {
                            currentPools.push({ id: doc.id, ...pData });
                        }
                    } else {
                        // Retrocompatibilidad: si no tiene filtro, le sale siempre
                        currentPools.push({ id: doc.id, ...pData });
                    }
                });
                poolsData = currentPools; // Sincronizar referencia global
                renderPools(currentPools, currentReports, currentCheckins);
            });
    }

    // =========================================
    // RENDERIZADO DE INTERFAZ
    // =========================================
    function renderPools(pools, reportedIds, activeCheckins) {
        routeList.innerHTML = '';
        if (pools.length === 0) {
            routeList.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><p>No tienes albercas asignadas a tu ruta.</p></div>';
            lucide.createIcons();
            return;
        }

        let completedCount = 0;
        pools.forEach(pool => {
            const isCompleted = reportedIds.has(pool.id);
            const hasActiveCheckin = activeCheckins[pool.id];
            if (isCompleted) completedCount++;

            const card = document.createElement('div');
            if (isCompleted) {
                card.className = 'route-card completed';
                card.innerHTML = `
                    <div class="route-card-top"><div class="route-card-info"><h4>${pool.name}</h4><p>${pool.filterType || 'Filtro...'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' L' : ''}</p></div><span class="route-status done"><i data-lucide="check-circle-2"></i> Hecho</span></div>
                    <button class="btn-outline btn-history" data-pool-id="${pool.id}" data-pool-name="${pool.name}" style="width:100%; margin-top:10px;"><i data-lucide="bar-chart-3"></i> Ver Historial</button>`;
            } else if (hasActiveCheckin) {
                const checkinTimeStr = hasActiveCheckin.checkinTime ? TBA.formatTime(hasActiveCheckin.checkinTime) : 'Ahora';
                const checkinMs = hasActiveCheckin.checkinTime ? hasActiveCheckin.checkinTime.toDate().getTime() : Date.now();
                card.className = 'route-card in-progress';
                card.innerHTML = `
                    <div class="route-card-top"><div class="route-card-info"><h4>${pool.name}</h4><p>${pool.filterType || 'Filtro...'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' L' : ''}</p></div><span class="route-status in-progress-tag"><i data-lucide="loader"></i> En Servicio</span></div>
                    <div class="checkin-info"><span>🕐 Check-in: ${checkinTimeStr}</span></div>
                    <button class="btn-primary-full btn-report" data-pool-id="${pool.id}" data-pool-name="${pool.name}" data-pool-filter="${pool.filterType || ''}" data-pool-vol="${pool.volume || ''}" data-checkin-id="${hasActiveCheckin.id}" data-checkin-time="${checkinMs}" style="margin-bottom:8px;"><i data-lucide="clipboard-check"></i> Terminar Servicio</button>
                    <button class="btn-outline btn-history" data-pool-id="${pool.id}" data-pool-name="${pool.name}" style="width:100%;"><i data-lucide="bar-chart-3"></i> Ver Historial</button>`;
            } else {
                card.className = 'route-card pending';
                card.innerHTML = `
                    <div class="route-card-top"><div class="route-card-info"><h4>${pool.name}</h4><p>${pool.filterType || 'Filtro...'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' L' : ''}</p></div><span class="route-status todo"><i data-lucide="circle-dot"></i> Pendiente</span></div>
                    <button class="btn-primary-full btn-checkin" data-pool-id="${pool.id}" data-pool-name="${pool.name}" data-lat="${pool.lat || ''}" data-lng="${pool.lng || ''}" style="margin-bottom:8px;"><i data-lucide="map-pin"></i> Iniciar Check-in GPS</button>
                    <button class="btn-outline btn-history" data-pool-id="${pool.id}" data-pool-name="${pool.name}" style="width:100%;"><i data-lucide="bar-chart-3"></i> Ver Historial</button>`;
            }
            routeList.appendChild(card);
        });

        progressText.textContent = `${completedCount} / ${pools.length}`;
        progressFill.style.width = `${pools.length > 0 ? (completedCount / pools.length) * 100 : 0}%`;

        document.querySelectorAll('.btn-checkin').forEach(btn => btn.addEventListener('click', () => handleCheckin(btn.dataset.poolId, btn.dataset.poolName, btn.dataset.lat, btn.dataset.lng)));
        document.querySelectorAll('.btn-report').forEach(btn => btn.addEventListener('click', () => openReportModal(btn.dataset)));
        document.querySelectorAll('.btn-history').forEach(btn => btn.addEventListener('click', () => openHistory(btn.dataset.poolId, btn.dataset.poolName)));
        lucide.createIcons();
    }

    // =========================================
    // LÓGICA DE NEGOCIO (GPS, REPORTE, TAREAS)
    // =========================================
    async function handleCheckin(poolId, poolName, poolLat, poolLng) {
        let techLat = null, techLng = null, distanceMeters = null, isFraudulent = false;
        TBA.showToast("Buscando señal GPS...");
        if (navigator.geolocation) {
            try {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true }));
                techLat = pos.coords.latitude; techLng = pos.coords.longitude;
                if (poolLat && poolLng) {
                    distanceMeters = getDistance(techLat, techLng, parseFloat(poolLat), parseFloat(poolLng));
                    if (distanceMeters > 200) isFraudulent = true;
                }
            } catch (err) {
                TBA.showToast("⚠️ GPS débil, registrando con posición aproximada.");
            }
        }
        try {
            await db.collection('checkins').add({
                poolId, poolName, techId: currentUser.uid, techName: userData.name, techRoute: userData.route,
                dateId: TBA.todayId(), checkinTime: firebase.firestore.FieldValue.serverTimestamp(),
                checkoutTime: null, durationMinutes: null, gpsLat: techLat, gpsLng: techLng, distanceToPool: distanceMeters, isFraudulent
            });
            TBA.showToast(isFraudulent ? `🚨 ALERTA: Estás a ${Math.round(distanceMeters)}m.` : `📍 Check-in exitoso en ${poolName}`);
        } catch(err) { TBA.showToast('Error de conexión.'); }
    }

    function openReportModal(data) {
        reportPoolId.value = data.poolId;
        reportCheckinId.value = data.checkinId || '';
        document.getElementById('modal-pool-name').textContent = data.poolName;
        document.getElementById('modal-pool-detail').textContent = `${data.poolFilter} · ${data.poolVol ? Number(data.poolVol).toLocaleString() + ' L' : ''}`;
        reportForm.reset();
        inpPh.value = 7.4; valPh.textContent = '7.4';
        inpCl.value = 1.5; valCl.textContent = '1.5';
        inpQty.value = 0; alertDetail.style.display = 'none'; btnSendWA.style.display = 'none';
        document.querySelectorAll('.chk-pre').forEach(c => c.checked = false);
        document.getElementById('checklist-warning').style.display = 'none';
        checkinTime = data.checkinTime ? new Date(parseInt(data.checkinTime)) : new Date();
        timerDisplay.style.display = 'flex';
        timerInterval = setInterval(() => {
            const diff = Math.floor((new Date() - checkinTime) / 1000);
            timerValue.textContent = `${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`;
        }, 1000);
        reportModal.classList.add('show');
        lucide.createIcons();
    }

    btnCloseReport.addEventListener('click', () => { stopTimer(); reportModal.classList.remove('show'); });

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const checkedItems = document.querySelectorAll('.chk-pre:checked');
        if(checkedItems.length < 5) { // Suponiendo 5 items
            document.getElementById('checklist-warning').style.display = 'block';
            return;
        }

        const poolId = reportPoolId.value, checkinId = reportCheckinId.value;
        const poolInfo = poolsData.find(p => p.id === poolId);
        const durationMinutes = Math.round((new Date() - checkinTime) / 60000);
        const shortId = 'TBA-' + Date.now().toString(36).toUpperCase().slice(-6);

        const reportData = {
            poolId, poolName: poolInfo?.name || '?', poolFilter: poolInfo?.filterType || '',
            techId: currentUser.uid, techName: userData.name, techRoute: userData.route,
            dateId: TBA.todayId(), timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            checkinTime: firebase.firestore.Timestamp.fromDate(checkinTime),
            checkoutTime: firebase.firestore.FieldValue.serverTimestamp(),
            durationMinutes, ph: parseFloat(inpPh.value), cl: parseFloat(inpCl.value),
            insumo: inpInsumo.value, insumoQty: parseFloat(inpQty.value), insumoUnit: inpQtyUnit.value,
            hasAlert: inpAlert.checked, alertType: inpAlert.checked ? inpAlertType.value : null,
            notes: inpNotes.value || 'Servicio rutinario.', status: inpAlert.checked ? 'alert' : 'optimal',
            reportShortId: shortId
        };

        try {
            await db.collection('reports').add(reportData);
            if(checkinId) await db.collection('checkins').doc(checkinId).update({ checkoutTime: firebase.firestore.FieldValue.serverTimestamp(), durationMinutes });
            await db.collection('pools').doc(poolId).update({ lastService: firebase.firestore.FieldValue.serverTimestamp(), lastTech: userData.name });
            
            lastReportData = { ...reportData, time: new Date() };
            stopTimer();
            TBA.showToast(`✅ Reporte ${shortId} enviado.`);
            btnSendWA.style.display = 'flex';
        } catch(err) { TBA.showToast('Error al guardar.'); }
    });

    // =========================================
    // TAREAS (DESPACHO CENTRAL)
    // =========================================
    let activeTaskData = null;
    function listenToTasks() {
        const banner = document.getElementById('tech-task-banner'), textEl = document.getElementById('tech-task-text');
        db.collection('tasks').where('techId', '==', currentUser.uid).where('status', '==', 'pending')
            .onSnapshot(snap => {
                if(snap.empty) { banner.style.display = 'none'; activeTaskData = null; return; }
                snap.forEach(doc => { activeTaskData = { id: doc.id, ...doc.data() }; });
                textEl.textContent = activeTaskData.text; banner.style.display = 'block';
                if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
            });

        document.getElementById('btn-open-task-modal').addEventListener('click', () => {
            if(!activeTaskData) return;
            document.getElementById('task-modal-text').textContent = activeTaskData.text;
            document.getElementById('task-detail-modal').classList.add('show');
            lucide.createIcons();
        });
        document.getElementById('btn-close-task-modal').addEventListener('click', () => document.getElementById('task-detail-modal').classList.remove('show'));
        document.getElementById('btn-resolve-task').addEventListener('click', () => submitTaskResolution('resolved'));
        document.getElementById('btn-reject-task').addEventListener('click', () => submitTaskResolution('unresolved'));
    }

    async function submitTaskResolution(res) {
        if(!activeTaskData) return;
        const note = document.getElementById('task-modal-note').value;
        await db.collection('tasks').doc(activeTaskData.id).update({ status: 'completed', resolution: res, resolutionNote: note, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('task-detail-modal').classList.remove('show');
        TBA.showToast('Tarea resuelta.');
    }

    // =========================================
    // UTILIDADES (GPS, DOWNLOAD, LOGOUT, WHATSAPP)
    // =========================================
    function getDistance(la1, lo1, la2, lo2) {
        const R = 6371e3;
        const dLat = (la2-la1)*Math.PI/180, dLon = (lo2-lo1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function updateDownloadButton() {
        const btn = document.getElementById('btn-download-daily');
        db.collection('reports').where('techId', '==', currentUser.uid).where('dateId', '==', TBA.todayId()).limit(1).get()
            .then(s => { btn.style.display = s.empty ? 'none' : 'block'; });
    }

    // Descargar Reporte del Día como CSV
    document.getElementById('btn-download-daily').addEventListener('click', async () => {
        try {
            const snap = await db.collection('reports').where('techId', '==', currentUser.uid).where('dateId', '==', TBA.todayId()).get();
            if(snap.empty) { TBA.showToast('No hay reportes hoy'); return; }
            const BOM = '\uFEFF';
            const headers = ['ID','Alberca','pH','Cloro','Insumo','Cantidad','Unidad','Duración(min)','Estatus','Notas'];
            const rows = [];
            snap.forEach(doc => {
                const r = doc.data();
                rows.push([
                    r.reportShortId || '', r.poolName || '', r.ph, r.cl,
                    r.insumo || 'Ninguno', r.insumoQty || 0, r.insumoUnit || '',
                    r.durationMinutes || '', r.status || '', (r.notes || '').replace(/"/g,'""')
                ]);
            });
            const csv = BOM + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `MiReporte_${TBA.todayId()}.csv`;
            a.click(); URL.revokeObjectURL(url);
            TBA.showToast('📁 Reporte descargado');
        } catch(err) { TBA.showToast('Error al descargar: ' + err.message); }
    });

    document.getElementById('btn-logout').addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));

    btnSendWA.addEventListener('click', () => {
        if (!lastReportData) return;
        const r = lastReportData;
        const msg = `*REPORTE TBA*\nID: ${r.reportShortId}\nAlberca: ${r.poolName}\nEstado: ${r.status.toUpperCase()}\npH: ${r.ph} | Cl: ${r.cl}\nInsumo: ${r.insumo} (${r.insumoQty})\nNotas: ${r.notes}\n\n*Adjunta la foto de evidencia visual debajo de este mensaje*`;
        window.open(`https://wa.me/${TBA.WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        reportModal.classList.remove('show');
    });

    async function openHistory(poolId, poolName) {
        document.getElementById('history-pool-name').textContent = poolName;
        document.getElementById('history-list').innerHTML = 'Cargando...';
        document.getElementById('history-modal').classList.add('show');
        const snap = await db.collection('reports').where('poolId', '==', poolId).orderBy('timestamp', 'desc').limit(5).get();
        let h = '';
        snap.forEach(d => {
            const r = d.data();
            h += `<div class="history-item"><p><strong>${r.dateId}</strong> · ${r.techName}</p><small>pH: ${r.ph} | Cl: ${r.cl} | ${r.insumo || '-'}</small></div>`;
        });
        document.getElementById('history-list').innerHTML = h || 'Sin historial.';
    }

    document.getElementById('btn-close-history').addEventListener('click', () => document.getElementById('history-modal').classList.remove('show'));
});
