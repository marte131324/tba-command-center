/**
 * TBA - Auth Controller
 * Maneja el login y redirige al usuario según su rol (admin → admin.html, tech → tech.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-msg');
    const btnLogin = document.getElementById('btn-login');
    const btnLoader = document.getElementById('btn-loader');

    // Si el usuario ya está autenticado, redirigir
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const role = await TBA.getUserRole(user.uid);
            if (role === 'admin') {
                window.location.href = 'admin.html';
            } else if (role === 'tech') {
                window.location.href = 'tech.html';
            } else {
                // Auto-Rescate en Snapshot: si el documento se borró pero había sesión pegada
                console.warn('Reconstruyendo documento en onAuthStateChanged');
                await db.collection('users').doc(user.uid).set({
                    name: 'Admin Rescate',
                    email: user.email,
                    role: 'admin',
                    route: 'Global',
                    createdAt: new Date()
                });
                window.location.href = 'admin.html';
            }
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        // UI Loading
        btnLogin.classList.add('loading');
        errorMsg.textContent = '';
        
        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            const role = await TBA.getUserRole(cred.user.uid);
            
            if (role === 'admin') {
                window.location.href = 'admin.html';
            } else if (role === 'tech') {
                window.location.href = 'tech.html';
            } else {
                // Auto-Rescate: Si el usuario existe en Auth pero el documento de la base de datos se borró
                console.warn('Usuario sin documento en Firestore. Reconstruyendo perfil admin de emergencia...');
                await db.collection('users').doc(cred.user.uid).set({
                    name: email.split('@')[0],
                    email: email,
                    role: 'admin',
                    route: 'Global',
                    createdAt: new Date()
                });
                window.location.href = 'admin.html';
            }
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                // Auto-Rescate Profundo: El usuario tal vez fue borrado tambien del Firebase Auth.
                // Intentamos crearlo usando las credenciales que acaba de ingresar.
                try {
                    const newCred = await auth.createUserWithEmailAndPassword(email, password);
                    await db.collection('users').doc(newCred.user.uid).set({
                        name: email.split('@')[0],
                        email: email,
                        role: 'admin',
                        route: 'Global',
                        createdAt: new Date()
                    });
                    window.location.href = 'admin.html';
                    return;
                } catch (createErr) {
                    if (createErr.code === 'auth/email-already-in-use') {
                        // Si el correo ya está en uso, significa que sí existe en la base, y de verdad está metiendo mal su contraseña.
                        btnLogin.classList.remove('loading');
                        errorMsg.textContent = 'Contraseña incorrecta (Tu cuenta existe, la contraseña es la mala).';
                    } else {
                        btnLogin.classList.remove('loading');
                        errorMsg.textContent = 'Error crítico: ' + createErr.message;
                    }
                }
            } else if (err.code === 'auth/invalid-email') {
                btnLogin.classList.remove('loading');
                errorMsg.textContent = 'Formato de correo no válido.';
            } else {
                btnLogin.classList.remove('loading');
                errorMsg.textContent = 'Error al iniciar sesión: ' + err.message;
            }
        }
    });
});
