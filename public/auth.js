import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    linkWithCredential,
    EmailAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB3ZI9Oe0CHcmA7H_UWEPBnTx65MB1x778",
    authDomain: "moviemarvel-4fecc.firebaseapp.com",
    projectId: "moviemarvel-4fecc",
    storageBucket: "moviemarvel-4fecc.firebasestorage.app",
    messagingSenderId: "1022315192924",
    appId: "1:1022315192924:web:6d980e371fa6f69cae3c99"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// -- Auth State Listener --
// Runs on every auth change. Anonymous sign-in is used as the default guest session.
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.isAnonymous) {
            console.log("Logged in anonymously:", user.uid);
            document.body.classList.remove('auth-mode-authenticated');
            document.body.classList.add('auth-mode-anonymous');
        } else {
            console.log("Logged in as:", user.email);
            // Derive display name from email prefix (e.g. "john" from "john@gmail.com")
            const rawUsername = user.email ? user.email.split('@')[0] : 'user';
            const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);

            document.body.classList.remove('auth-mode-anonymous');
            document.body.classList.add('auth-mode-authenticated');

            const greetingEls = document.querySelectorAll('.nav-user-greeting');
            greetingEls.forEach(el => el.textContent = `Welcome, ${username}`);
        }
    } else {
        // No active session — sign in anonymously so all pages work without login
        console.log("No user session. Signing in anonymously...");
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous auth failed:", error.code, error.message);
        });
    }
});

// -- Public Auth API --
// Exposed on window so signup-script.js can call auth actions without importing Firebase directly.
window.MovieMarvelAuth = {

    registerUser: async (email, password) => {
        try {
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                // Link the anonymous session to real credentials so prior activity is preserved
                const credential = EmailAuthProvider.credential(email, password);
                await linkWithCredential(auth.currentUser, credential);
                return { success: true };
            } else {
                throw new Error("Must be in an anonymous session to register.");
            }
        } catch (error) {
            console.error("Registration error:", error);
            let message = "Registration failed.";
            if (error.code === 'auth/email-already-in-use') message = "This email is already in use.";
            if (error.code === 'auth/weak-password') message = "Password should be at least 6 characters.";
            return { success: false, message };
        }
    },

    loginUser: async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            console.error("Login error:", error);
            let message = "Login failed.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Invalid email or password.";
            }
            return { success: false, message };
        }
    },

    logoutUser: async () => {
        try {
            await signOut(auth);
            // Note: onAuthStateChanged will immediately create a new anonymous session after sign-out
            return { success: true };
        } catch (error) {
            console.error("Logout error:", error);
            return { success: false, message: error.message };
        }
    }

};
