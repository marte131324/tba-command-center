/**
 * TBA Tech - Aplicación del Técnico en Campo v2.1
 * =================================================
 * Queries simplificadas para funcionar SIN índices compuestos.
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

    // Rangos
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

    // Timer
    function stopTimer() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    }

    // =========================================
    // AUTH
    // =========================================
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

        await loadPools();

        loader.style.display = 'none';
        app.style.display = 'block';
        lucide.createIcons();
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });

    // =========================================
    // CARGAR ALBERCAS (queries simples)
    // =========================================
    async function loadPools() {
        const route = userData.route || '';
        const snapshot = await db.collection('pools').where('route', '==', route).get();
        poolsData = [];
        snapshot.forEach(doc => {
            poolsData.push({ id: doc.id, ...doc.data() });
        });

        // Reportes de hoy (query simple: solo por dateId, filtrar techId client-side)
        const todayId = TBA.todayId();
        const reportsSnap = await db.collection('reports')
            .where('dateId', '==', todayId)
            .get();

        const reportedPoolIds = new Set();
        reportsSnap.forEach(doc => {
            const data = doc.data();
            if (data.techId === currentUser.uid) {
                reportedPoolIds.add(data.poolId);
            }
        });

        // Check-ins activos (query simple: solo por dateId, filtrar client-side)
        const checkinsSnap = await db.collection('checkins')
            .where('dateId', '==', todayId)
            .get();

        const activeCheckins = {};
        checkinsSnap.forEach(doc => {
            const data = doc.data();
            if (data.techId === currentUser.uid && (data.checkoutTime === null || data.checkoutTime === undefined)) {
                activeCheckins[data.poolId] = { id: doc.id, ...data };
            }
        });

        renderPools(poolsData, reportedPoolIds, activeCheckins);
    }

    // =========================================
    // RENDER TARJETAS
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
                    <div class="route-card-top">
                        <div class="route-card-info">
                            <h4>${pool.name}</h4>
                            <p>${pool.filterType || 'Filtro no especificado'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' Lts' : ''}</p>
                        </div>
                        <span class="route-status done"><i data-lucide="check-circle-2"></i> Completado</span>
                    </div>
                `;
            } else if (hasActiveCheckin) {
                const checkinTimeStr = hasActiveCheckin.checkinTime ? TBA.formatTime(hasActiveCheckin.checkinTime) : 'Ahora';
                const checkinMs = hasActiveCheckin.checkinTime ? hasActiveCheckin.checkinTime.toDate().getTime() : Date.now();
                card.className = 'route-card in-progress';
                card.innerHTML = `
                    <div class="route-card-top">
                        <div class="route-card-info">
                            <h4>${pool.name}</h4>
                            <p>${pool.filterType || 'Filtro no especificado'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' Lts' : ''}</p>
                        </div>
                        <span class="route-status in-progress-tag"><i data-lucide="loader"></i> En Servicio</span>
                    </div>
                    <div class="checkin-info">
                        <span>🕐 Check-in: ${checkinTimeStr}</span>
                    </div>
                    <button class="btn-report" data-pool-id="${pool.id}" data-pool-name="${pool.name}" data-pool-filter="${pool.filterType || ''}" data-pool-vol="${pool.volume || ''}" data-checkin-id="${hasActiveCheckin.id}" data-checkin-time="${checkinMs}">
                        <i data-lucide="clipboard-check"></i> Registrar Reporte y Check-out
                    </button>
                `;
            } else {
                card.className = 'route-card pending';
                card.innerHTML = `
                    <div class="route-card-top">
                        <div class="route-card-info">
                            <h4>${pool.name}</h4>
                            <p>${pool.filterType || 'Filtro no especificado'} · ${pool.volume ? Number(pool.volume).toLocaleString() + ' Lts' : ''}</p>
                        </div>
                        <span class="route-status todo"><i data-lucide="circle-dot"></i> Pendiente</span>
                    </div>
                    <button class="btn-checkin" data-pool-id="${pool.id}" data-pool-name="${pool.name}">
                        <i data-lucide="map-pin"></i> Check-in · Llegué al destino
                    </button>
                `;
            }

            routeList.appendChild(card);
        });

        progressText.textContent = `${completedCount} / ${pools.length}`;
        progressFill.style.width = `${pools.length > 0 ? (completedCount / pools.length) * 100 : 0}%`;

        // Events
        document.querySelectorAll('.btn-checkin').forEach(btn => {
            btn.addEventListener('click', () => handleCheckin(btn.dataset.poolId, btn.dataset.poolName));
        });
        document.querySelectorAll('.btn-report').forEach(btn => {
            btn.addEventListener('click', () => openReportModal(btn.dataset));
        });

        lucide.createIcons();
    }

    // =========================================
    // CHECK-IN
    // =========================================
    async function handleCheckin(poolId, poolName) {
        try {
            await db.collection('checkins').add({
                poolId: poolId,
                poolName: poolName,
                techId: currentUser.uid,
                techName: userData.name,
                techRoute: userData.route,
                dateId: TBA.todayId(),
                checkinTime: firebase.firestore.FieldValue.serverTimestamp(),
                checkoutTime: null,
                durationMinutes: null
            });

            TBA.showToast(`📍 Check-in registrado en ${poolName}`);
            await loadPools();
        } catch(err) {
            console.error('Error en check-in:', err);
            TBA.showToast('Error al registrar check-in');
        }
    }

    // =========================================
    // MODAL REPORTE
    // =========================================
    function openReportModal(data) {
        reportPoolId.value = data.poolId;
        reportCheckinId.value = data.checkinId || '';
        document.getElementById('modal-pool-name').textContent = data.poolName;
        document.getElementById('modal-pool-detail').textContent = `${data.poolFilter} · ${data.poolVol ? Number(data.poolVol).toLocaleString() + ' Lts' : ''}`;

        reportForm.reset();
        inpPh.value = 7.4; valPh.textContent = '7.4';
        inpCl.value = 1.5; valCl.textContent = '1.5';
        inpQty.value = 0;
        alertDetail.style.display = 'none';
        btnSendWA.style.display = 'none';

        // Timer desde check-in
        if(data.checkinTime) {
            checkinTime = new Date(parseInt(data.checkinTime));
        } else {
            checkinTime = new Date();
        }
        timerDisplay.style.display = 'flex';
        timerInterval = setInterval(() => {
            const diff = Math.floor((new Date() - checkinTime) / 1000);
            const mins = String(Math.floor(diff / 60)).padStart(2,'0');
            const secs = String(diff % 60).padStart(2,'0');
            timerValue.textContent = `${mins}:${secs}`;
        }, 1000);

        reportModal.classList.add('show');
        lucide.createIcons();
    }

    btnCloseReport.addEventListener('click', (e) => {
        e.preventDefault();
        stopTimer();
        reportModal.classList.remove('show');
    });

    // =========================================
    // ENVIAR REPORTE + CHECK-OUT
    // =========================================
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const poolId = reportPoolId.value;
        const checkinId = reportCheckinId.value;
        const poolInfo = poolsData.find(p => p.id === poolId);
        const ph = parseFloat(inpPh.value).toFixed(1);
        const cl = parseFloat(inpCl.value).toFixed(1);
        const insumo = inpInsumo.value;
        const qty = parseFloat(inpQty.value) || 0;
        const qtyUnit = inpQtyUnit.value;
        const hasAlert = inpAlert.checked;
        const alertType = hasAlert ? inpAlertType.value : null;
        const notes = inpNotes.value || 'Servicio rutinario.';
        const now = new Date();

        const durationMs = checkinTime ? (now - checkinTime) : 0;
        const durationMinutes = Math.round(durationMs / 60000);

        const reportData = {
            poolId: poolId,
            poolName: poolInfo ? poolInfo.name : 'Desconocida',
            poolFilter: poolInfo ? poolInfo.filterType : '',
            techId: currentUser.uid,
            techName: userData.name,
            techRoute: userData.route,
            dateId: TBA.todayId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            checkinTime: checkinTime ? firebase.firestore.Timestamp.fromDate(checkinTime) : null,
            checkoutTime: firebase.firestore.FieldValue.serverTimestamp(),
            durationMinutes: durationMinutes,
            ph: parseFloat(ph),
            cl: parseFloat(cl),
            insumo: insumo,
            insumoQty: qty,
            insumoUnit: qtyUnit,
            hasAlert: hasAlert,
            alertType: alertType,
            notes: notes,
            status: hasAlert ? 'alert' : (ph >= 6.8 && ph <= 7.6 && cl >= 1.0 && cl <= 3.0 ? 'optimal' : 'warning')
        };

        try {
            await db.collection('reports').add(reportData);

            if(checkinId) {
                await db.collection('checkins').doc(checkinId).update({
                    checkoutTime: firebase.firestore.FieldValue.serverTimestamp(),
                    durationMinutes: durationMinutes
                });
            }

            await db.collection('pools').doc(poolId).update({
                lastService: firebase.firestore.FieldValue.serverTimestamp(),
                lastPh: parseFloat(ph),
                lastCl: parseFloat(cl),
                lastTech: userData.name
            });

            lastReportData = { ...reportData, poolName: poolInfo.name, time: now, durationMinutes };

            stopTimer();
            TBA.showToast(`✅ Reporte guardado · Servicio: ${durationMinutes} min`);

            btnSendWA.style.display = 'flex';
            await loadPools();

        } catch (err) {
            console.error('Error al guardar reporte:', err);
            TBA.showToast('Error al guardar. Se sincronizará al recuperar señal.');
        }
    });

    // =========================================
    // WHATSAPP
    // =========================================
    btnSendWA.addEventListener('click', () => {
        if (!lastReportData) return;
        const r = lastReportData;
        const timeStr = r.time.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
        const checkinStr = checkinTime ? checkinTime.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}) : timeStr;

        let statusEmoji = '✅';
        if(r.hasAlert) statusEmoji = '🚨';
        else if(r.status === 'warning') statusEmoji = '⚠️';

        const msg = `*🛠️ [TBA Reporte Técnico]*

${statusEmoji} *Estatus:* ${r.hasAlert ? 'ALERTA - ' + r.alertType : (r.status === 'optimal' ? 'Óptimo' : 'Atención en niveles')}

🏊 *Alberca:* ${r.poolName}
👨‍🔧 *Técnico:* ${r.techName}

⏱️ *Tiempos:*
• Check-in: ${checkinStr}
• Check-out: ${timeStr}
• Duración: ${r.durationMinutes} min

*📊 Parámetros:*
• pH: ${r.ph}
• Cloro: ${r.cl} ppm
• Insumo: ${r.insumo} (${r.insumoQty} ${r.insumoUnit})

📝 *Notas:* ${r.notes}

📸 *(Adjuntar foto de evidencia abajo)*`;

        const url = `https://wa.me/${TBA.WA_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        reportModal.classList.remove('show');
    });
});
