import { getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    const movieGallery = document.getElementById('movieGallery');
    const emptyState   = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    if (!API_KEY) {
        console.error('TMDB API Key is missing. Please update public/config.js');
        return;
    }

    let app, db, auth;
    try {
        app  = getApp();
        db   = getFirestore(app);
        auth = getAuth(app);
    } catch (error) {
        console.error("Firebase init failed:", error);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous && user.email) {
            await loadRecommendations(user);
        } else {
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `
                    <div class="empty-icon">🔒</div>
                    <h3>Login Required</h3>
                    <p>Please log in to see your personalized recommendations.</p>
                `;
                emptyState.classList.remove('hidden');
            }
        }
    });

    async function loadRecommendations(user) {
        if (!db) return;

        try {
            if (loadingState) loadingState.style.display = 'block';
            if (emptyState) emptyState.classList.add('hidden');
            if (movieGallery) movieGallery.classList.add('hidden');

            const rawUsername = user.email.split('@')[0];
            const derivedUsername = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);

            // Check by both exact email and derived username to cover how senders may have entered the recipient
            const queryEmail    = query(collection(db, "recommendations"), where("recipient", "==", user.email));
            const queryUsername = query(collection(db, "recommendations"), where("recipient", "==", derivedUsername));

            const [snapEmail, snapUsername] = await Promise.all([
                getDocs(queryEmail),
                getDocs(queryUsername)
            ]);

            const recMap = new Map();

            snapEmail.forEach(doc => {
                const data = doc.data();
                if (data.movieId && !recMap.has(data.movieId)) recMap.set(data.movieId, data);
            });

            snapUsername.forEach(doc => {
                const data = doc.data();
                if (data.movieId && !recMap.has(data.movieId)) recMap.set(data.movieId, data);
            });

            if (recMap.size === 0) {
                if (loadingState) loadingState.style.display = 'none';
                emptyState.classList.remove('hidden');
                movieGallery.innerHTML = '';
                return;
            }

            // Fetch TMDB metadata and pair it with the recommendation record
            const moviePromises = Array.from(recMap.entries()).map(async ([id, recData]) => {
                try {
                    const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`);
                    if (!response.ok) return null;
                    const movie = await response.json();
                    return { movie, rec: recData };
                } catch (e) {
                    return null;
                }
            });

            const results = await Promise.all(moviePromises);
            const valid = results.filter(r => r !== null);

            renderMovies(valid);

        } catch (error) {
            console.error("Error loading recommendations:", error);
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `<h3 style="color:var(--error);">Failed to load</h3>`;
                emptyState.classList.remove('hidden');
            }
        } finally {
            if (loadingState) loadingState.style.display = 'none';
        }
    }

    function renderMovies(items) {
        movieGallery.innerHTML = '';
        movieGallery.classList.remove('hidden');

        items.forEach(({ movie, rec }) => {
            const imageUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image';

            const year = movie.release_date
                ? new Date(movie.release_date).getFullYear()
                : '';

            // Show the sender's email prefix as their display name (e.g. "john" from "john@gmail.com")
            const senderRaw  = rec.sender && rec.sender !== 'User' ? rec.sender.split('@')[0] : null;
            const senderName = senderRaw
                ? senderRaw.charAt(0).toUpperCase() + senderRaw.slice(1)
                : 'A MovieMarvel user';

            const messageHtml = rec.message
                ? `<p class="rec-message">"${escapeHtml(rec.message)}"</p>`
                : '';

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.title = movie.title;
            card.innerHTML = `
                <img class="movie-poster" src="${imageUrl}" alt="${escapeHtml(movie.title)} Poster" loading="lazy">
                <div class="movie-info">
                    <p class="movie-title">${escapeHtml(movie.title)}</p>
                    ${year ? `<p style="font-size:0.8rem; color: var(--text-light-gray); margin:0 0 0.4rem;">${year}</p>` : ''}
                    ${messageHtml}
                    <p class="rec-sender">Recommended by <strong>${escapeHtml(senderName)}</strong></p>
                </div>
            `;

            card.addEventListener('click', () => {
                window.location.href = `movie.html?id=${movie.id}`;
            });

            movieGallery.appendChild(card);
        });
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
