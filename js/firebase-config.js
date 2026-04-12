/**
 * TBA COMMAND CENTER - Firebase Configuration
 * ============================================
 * INSTRUCCIONES:
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un nuevo proyecto llamado "tba-command-center"
 * 3. En "Autenticación" > "Sign-in method", activa "Correo electrónico/Contraseña"
 * 4. En "Firestore Database", crea una base de datos en modo de prueba
 * 5. Copia tu configuración de Firebase aquí abajo (reemplaza los valores)
 */

const firebaseConfig = {
    apiKey: "AIzaSyDN7nZdTqbO9kVHNGT2qRzyvqRztDDgzGI",
    authDomain: "tba-command-center-80d07.firebaseapp.com",
    projectId: "tba-command-center-80d07",
    storageBucket: "tba-command-center-80d07.firebasestorage.app",
    messagingSenderId: "628429285079",
    appId: "1:628429285079:web:3163f8f290a912fcb4f292"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar servicios globales
const auth = firebase.auth();
const db = firebase.firestore();

// Habilitar persistencia offline (El técnico sin señal puede seguir usando la app)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistencia deshabilitada: múltiples pestañas abiertas.');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistencia no soportada en este navegador.');
    }
});

// Utilidades compartidas
const TBA = {
    // Rol del usuario (admin o tech)
    getUserRole: async (uid) => {
        const doc = await db.collection('users').doc(uid).get();
        return doc.exists ? doc.data().role : null;
    },

    // Mostrar toast
    showToast: (msg, duration = 3000) => {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        if (toast && toastMsg) {
            toastMsg.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), duration);
        }
    },

    // Formatear fecha
    formatDate: () => {
        const d = new Date();
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
    },

    // Formatear hora
    formatTime: (date) => {
        if (!date) return '--';
        const d = date instanceof Date ? date : date.toDate();
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    },

    // ID del día actual para queries
    todayId: () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // Número de WA del supervisor (CONFIGURAR)
    WA_NUMBER: "522282393575",
};
