import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC-K9IG5LuHK9oQGyi1jlpiYby989Zywio",
    authDomain: "greenjournal.firebaseapp.com",
    projectId: "greenjournal",
    storageBucket: "greenjournal.firebasestorage.app",
    messagingSenderId: "256519277997",
    appId: "1:256519277997:web:e9b4a2336b0fcf18b92524"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Handle auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in.
        // Redirect to dashboard/home if we are on the login page
        if (window.location.pathname.includes('Login.html')) {
            window.location.href = "index.html";
        }
    } else {
        // User is signed out.
        // If we want to strictly keep user on login page we could redirect from index.html,
        // but the prompt constraints are mostly for the login page behavior.
    }
});

window.signup = async function(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Signup error:", error);
        throw error;
    }
};

window.login = async function(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
};

window.logout = async function() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        throw error;
    }
};

window.googleLogin = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Google Login error:", error);
        if (typeof createToast === 'function') {
            createToast('error', 'Google Login Failed', error.message);
        } else {
            // Attempt to find or create an error element if createToast is not available
            const errorElement = document.getElementById('loginEmailError') || document.getElementById('error');
            if (errorElement) {
                errorElement.innerText = error.message;
                errorElement.style.display = 'block';
            }
        }
        throw error;
    }
};
