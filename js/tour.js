document.addEventListener('DOMContentLoaded', () => {
    // Inicializar driver.js si está dispoinble
    if (!window.driver) return;
    const driver = window.driver.js.driver;

    // ----------------------------------------------------------------
    // TOUR 1: TBA Operativo (El Paquete Estándar - Cómo Funciona Hoy)
    // ----------------------------------------------------------------
    const driverOperativo = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: 'Siguiente ▶',
        prevBtnText: '◀ Atrás',
        doneBtnText: 'Terminar Tour',
        steps: [
            { 
                popover: { 
                    title: 'TBA Operativo (Paquete Estándar)', 
                    description: 'Te doy la bienvenida al recorrido por tu nueva plataforma base. Aquí revisaremos las funcionalidades clave con las que tu equipo operará el día a día sin cuotas mensuales.',
                    side: "over", align: 'center',
                    popoverClass: 'driver-theme-blue'
                } 
            },
            { 
                element: '.stats-row', 
                popover: { 
                    title: 'Dashboard de Indicadores', 
                    description: 'KPIs en tiempo real. Visualiza al instante cuántas de tus 300 albercas han sido atendidas hoy, tus técnicos activos y si han reportado alertas de equipo.',
                    side: "bottom", align: 'start',
                    popoverClass: 'driver-theme-blue'
                } 
            },
            { 
                element: '#active-checkins-body', 
                popover: { 
                    title: 'App del Técnico: Check-in y Reporte', 
                    description: 'Desde su celular, el técnico abre la ruta. Registra el Check-in (para el cronómetro en sitio) y levanta su reporte rápido: pH, Cloro e insumos aplicados. Todo llega directo a esta tabla.',
                    side: "top", align: 'start',
                    popoverClass: 'driver-theme-blue'
                } 
            },
            { 
                element: '#pool-filters', 
                popover: { 
                    title: 'Búsqueda y Gestión Inteligente', 
                    description: 'Administra tu catálogo operativo. Filtra tus albercas y técnicos por volumen o por ruta. La plataforma funciona offline y sincroiza la base de datos automáticamente.',
                    side: "bottom", align: 'start',
                    popoverClass: 'driver-theme-blue'
                } 
            },
            { 
                element: '#btn-export-csv', 
                popover: { 
                    title: 'Exportación Pura (Excel)', 
                    description: 'Contabilidad fácil. Con un botón, exporta la matriz de información de todos los reportes operativos hacia tu Google Sheets o Excel.',
                    side: "bottom", align: 'center',
                    popoverClass: 'driver-theme-blue'
                } 
            },
            { 
                element: '#btn-wa-summary', 
                popover: { 
                    title: 'Corte Diario a WhatsApp', 
                    description: 'El cierre final del servidor: envía de manera automática y perfectamente formateada todo el desglose de consumibles y reportes directo al WhatsApp del administrador principal.',
                    side: "bottom", align: 'end',
                    popoverClass: 'driver-theme-blue'
                } 
            }
        ]
    });

    // ----------------------------------------------------------------
    // TOUR 2: TBA Avanzado (El Paquete Premium - El Escalamiento)
    // ----------------------------------------------------------------
    const driverAvanzado = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: 'Ver Siguiente ▶',
        prevBtnText: '◀ Atrás',
        doneBtnText: 'Cerrar Tour Avanzado 🚀',
        steps: [
            { 
                popover: { 
                    title: 'TBA Avanzado (Paquete Premium)', 
                    description: 'Este es el siguiente nivel logístico. El Paquete Avanzado toma tu operación y le suma Inteligencia Artificial, telemetría y portales interactivos para cerrar fugas y aumentar tu rentabilidad.',
                    side: "over", align: 'center',
                    popoverClass: 'driver-theme-orange'
                }
            },
            { 
                element: '#active-checkins-body', 
                popover: { 
                    title: '🛰️ Verificación Vehicular GPS', 
                    description: 'Control remoto total. Integración de geolocalización viva: cruzaremos la ubicación exacta del celular de tu técnico contra la coordenada guardada de la alberca con una tolerancia de 200m.',
                    side: "top", align: 'start',
                    popoverClass: 'driver-theme-orange'
                } 
            },
            { 
                element: '.stats-row', 
                popover: { 
                    title: '📈 Analítica y Rankings', 
                    description: 'Este tablero implementará gráficas visuales pro. Evaluaremos el rendimiento mensual de tus empleados en rankings, y el score de salud del agua (tendencias de pH).',
                    side: "bottom", align: 'start',
                    popoverClass: 'driver-theme-orange'
                } 
            },
            { 
                popover: { 
                    title: '🧪 Inventario de Insumos & Costos', 
                    description: 'El módulo maestro financiero: La computadora auditará lo que compras por volumen versus las pastillas y mililitros exactos que cada operario inyectó en los equipos MAXFIL.',
                    side: "over", align: 'center',
                    popoverClass: 'driver-theme-orange'
                } 
            },
            { 
                element: '#btn-seed-data', 
                popover: { 
                    title: '🚨 Centro de Alertas Dedicado', 
                    description: 'Módulo independiente para incidencias graves, fotografías pre-servicio obligatorias y un inbox administrativo para procesar garantías de filtros.',
                    side: "bottom", align: 'end',
                    popoverClass: 'driver-theme-orange'
                } 
            },
            { 
                popover: { 
                    title: '🏠 Portal del Cliente Residencial', 
                    description: 'Traspasa el valor al cliente final: Incorporaremos la conexión con la VCard de la empresa para que el usuario residencial digite su ID y visualice la ficha clínica de su propia alberca limpia.',
                    side: "over", align: 'center',
                    popoverClass: 'driver-theme-orange'
                } 
            }
        ]
    });

    setTimeout(() => {
        const btnTour1 = document.getElementById('btn-tour-1');
        const btnTour2 = document.getElementById('btn-tour-2');

        if(btnTour1) btnTour1.addEventListener('click', () => driverOperativo.drive());
        if(btnTour2) btnTour2.addEventListener('click', () => driverAvanzado.drive());
    }, 1000);
});
