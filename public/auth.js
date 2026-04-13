import { app } from "./firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    linkWithCredential,
    EmailAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const auth = getAuth(app);

let envResolve;
window.MovieMarvelEnvReady = new Promise((resolve) => {
    envResolve = resolve;
});

let envBootstrapDone = false;

function finishEnvBootstrap() {
    if (!envBootstrapDone) {
        envBootstrapDone = true;
        envResolve(window.ENV || {});
    }
}

async function loadPublicEnvFromFirestore() {
    if (window.ENV && window.ENV.TMDB_API_KEY) {
        return window.ENV;
    }
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "config", "public"));
    if (snap.exists()) {
        const d = snap.data();
        window.ENV = {
            TMDB_API_KEY: d.tmdbApiKey ?? "",
            TMDB_BASE_URL: d.tmdbBaseUrl ?? "https://api.themoviedb.org/3",
            OMDB_API_KEY: d.omdbApiKey ?? "",
            OMDB_BASE_URL: d.omdbBaseUrl ?? "https://www.omdbapi.com"
        };
    } else {
        console.error(
            "MovieMarvel: Firestore document config/public is missing. Create it in the Firebase console (see project docs)."
        );
        window.ENV = {};
    }
    return window.ENV;
}

setTimeout(() => {
    if (!envBootstrapDone) {
        console.error("MovieMarvel: Timed out waiting for auth/Firestore API config.");
        window.ENV = window.ENV || {};
        finishEnvBootstrap();
    }
}, 20000);

// -- Auth State Listener --
// Runs on every auth change. Anonymous sign-in is used as the default guest session.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            await loadPublicEnvFromFirestore();
        } catch (err) {
            console.error("MovieMarvel: Failed to load API keys from Firestore:", err);
            window.ENV = window.ENV || {};
        }
        finishEnvBootstrap();

        if (user.isAnonymous) {
            console.log("Logged in anonymously:", user.uid);
            document.body.classList.remove("auth-mode-authenticated");
            document.body.classList.add("auth-mode-anonymous");
        } else {
            console.log("Logged in as:", user.email);
            const rawUsername = user.email ? user.email.split("@")[0] : "user";
            const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);

            document.body.classList.remove("auth-mode-anonymous");
            document.body.classList.add("auth-mode-authenticated");

            const greetingEls = document.querySelectorAll(".nav-user-greeting");
            greetingEls.forEach((el) => (el.textContent = `Welcome, ${username}`));
        }
    } else {
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
                const credential = EmailAuthProvider.credential(email, password);
                await linkWithCredential(auth.currentUser, credential);
                return { success: true };
            } else {
                throw new Error("Must be in an anonymous session to register.");
            }
        } catch (error) {
            console.error("Registration error:", error);
            let message = "Registration failed.";
            if (error.code === "auth/email-already-in-use") message = "This email is already in use.";
            if (error.code === "auth/weak-password") message = "Password should be at least 6 characters.";
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
            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/user-not-found" ||
                error.code === "auth/wrong-password"
            ) {
                message = "Invalid email or password.";
            }
            return { success: false, message };
        }
    },

    logoutUser: async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            console.error("Logout error:", error);
            return { success: false, message: error.message };
        }
    }
};

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.warn("Service worker registration failed:", err);
        });
    });
}
