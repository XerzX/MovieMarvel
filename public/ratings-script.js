import { getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    const movieGallery = document.getElementById('movieGallery');
    const emptyState   = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const viewHeader   = document.getElementById('viewHeader');
    const viewDesc     = document.getElementById('viewDesc');
    const emptyTitle   = document.getElementById('emptyTitle');
    const emptyDesc    = document.getElementById('emptyDesc');
    const searchInput  = document.getElementById('movieSearchInput');
    const searchClear  = document.getElementById('searchClear');
    const searchCount  = document.getElementById('searchCount');

    if (!API_KEY) { console.error('TMDB API Key missing.'); return; }

    let app, db, auth;
    try {
        app  = getApp();
        db   = getFirestore(app);
        auth = getAuth(app);
    } catch (e) { return; }

    let currentView  = 'personal_newest';
    let currentUser  = null;
    let currentQuery = '';
    // Cache of fully enriched movie items for the current view – avoids re-fetching on search
    let loadedMovies = [];

    // ── Search listeners ─────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        currentQuery = searchInput.value.trim().toLowerCase();
        searchClear.classList.toggle('visible', currentQuery.length > 0);
        if (loadedMovies.length > 0) applyFilterAndRender(loadedMovies);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        currentQuery = '';
        searchClear.classList.remove('visible');
        searchCount.classList.add('hidden');
        if (loadedMovies.length > 0) applyFilterAndRender(loadedMovies);
        searchInput.focus();
    });

    // ── Auth ──────────────────────────────────────────────────────────────────
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        const authWarning = document.getElementById('authWarning');
        if (user && user.isAnonymous && authWarning) {
            authWarning.classList.remove('hidden');
        } else if (authWarning) {
            authWarning.classList.add('hidden');
        }

        await loadView();
    });

    // ── Pill toggle listeners ─────────────────────────────────────────────────
    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (e.target.classList.contains('active')) return;
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.getAttribute('data-view');
            // Clear search when switching views so stale filter doesn't confuse
            searchInput.value = '';
            currentQuery = '';
            searchClear.classList.remove('visible');
            searchCount.classList.add('hidden');
            await loadView();
        });
    });

    // ── Main load (hits Firestore + TMDB, stores results in loadedMovies) ─────
    async function loadView() {
        if (!db) return;

        loadingState.style.display = 'block';
        emptyState.classList.add('hidden');
        movieGallery.classList.add('hidden');
        movieGallery.innerHTML = '';
        loadedMovies = [];

        try {
            let processedRatings = [];

            if (currentView.startsWith('personal')) {
                viewHeader.innerHTML = `Your <span>Ratings</span>`;
                viewDesc.textContent = "Movies you have personally rated.";

                if (!currentUser) {
                    showEmpty("Login Required", "You must load the page with an active session to see personal ratings.");
                    return;
                }

                const q = query(collection(db, "user_movie_ratings"), where("userId", "==", currentUser.uid));
                const snap = await getDocs(q);

                snap.forEach(d => {
                    const data = d.data();
                    processedRatings.push({
                        movieId:   data.movieId,
                        rating:    data.rating,
                        timestamp: data.timestamp ? data.timestamp.toMillis() : 0,
                        type:      'personal'
                    });
                });

                if (currentView === 'personal_newest') {
                    processedRatings.sort((a, b) => b.timestamp - a.timestamp);
                } else {
                    processedRatings.sort((a, b) => b.rating - a.rating);
                }

            } else {
                viewHeader.innerHTML = `Community <span>Ratings</span>`;
                viewDesc.textContent = "See what the MovieMarvel community thinks.";

                const q = query(collection(db, "user_movie_ratings"));
                const snap = await getDocs(q);

                const movieAgg = {};
                snap.forEach(d => {
                    const data = d.data();
                    if (!movieAgg[data.movieId]) movieAgg[data.movieId] = { total: 0, count: 0 };
                    movieAgg[data.movieId].total += data.rating;
                    movieAgg[data.movieId].count++;
                });

                for (const [mId, agg] of Object.entries(movieAgg)) {
                    if (agg.count > 0) {
                        processedRatings.push({ movieId: mId, rating: agg.total / agg.count, count: agg.count, type: 'community' });
                    }
                }

                if (currentView === 'community_highest') {
                    processedRatings.sort((a, b) => b.rating - a.rating);
                } else {
                    processedRatings.sort((a, b) => a.rating - b.rating);
                }

                processedRatings = processedRatings.slice(0, 30);
            }

            if (processedRatings.length === 0) {
                const isPersonal = currentView.startsWith('personal');
                showEmpty(
                    isPersonal ? "No ratings found" : "No community ratings",
                    isPersonal ? "Explore and rate movies to build your collection." : "Be the first to rate a movie!"
                );
                return;
            }

            // Fetch TMDB metadata
            const moviePromises = processedRatings.map(async item => {
                try {
                    const res = await fetch(`${BASE_URL}/movie/${item.movieId}?api_key=${API_KEY}&language=en-US`);
                    if (!res.ok) return null;
                    const json = await res.json();
                    return { movieParams: json, ratingInfo: item };
                } catch { return null; }
            });

            const movies = await Promise.all(moviePromises);
            loadedMovies = movies.filter(m => m !== null);

            if (loadedMovies.length === 0) {
                showEmpty("Failed to load details", "Could not fetch movie data from TMDB.");
                return;
            }

            applyFilterAndRender(loadedMovies);

        } catch (error) {
            console.error("Error loading view:", error);
            showEmpty("Failed to load", "An error occurred fetching the ratings.");
        } finally {
            loadingState.style.display = 'none';
        }
    }

    // ── Filter by search query then render ────────────────────────────────────
    function applyFilterAndRender(movies) {
        let filtered = movies;

        if (currentQuery) {
            filtered = movies.filter(m =>
                m.movieParams.title.toLowerCase().includes(currentQuery)
            );
            searchCount.classList.remove('hidden');
            searchCount.innerHTML = `Found <span>${filtered.length}</span> result${filtered.length !== 1 ? 's' : ''} matching "<span>${escapeHtml(currentQuery)}</span>"`;
        } else {
            searchCount.classList.add('hidden');
        }

        if (filtered.length === 0) {
            movieGallery.classList.add('hidden');
            showEmpty(`No results for "${currentQuery}"`, "Try a different search term.");
            return;
        }

        emptyState.classList.add('hidden');
        renderMovies(filtered);
    }

    // ── Render grid ───────────────────────────────────────────────────────────
    function renderMovies(movieDataList) {
        movieGallery.innerHTML = '';
        movieGallery.classList.remove('hidden');

        movieDataList.forEach(item => {
            const movie = item.movieParams;
            const rInfo = item.ratingInfo;

            const imageUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image';

            const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';

            const badgeHtml = rInfo.type === 'personal'
                ? `<div class="rating-badge personal" title="Your personal rating">${rInfo.rating}</div>`
                : `<div class="rating-badge community" title="Community average based on ${rInfo.count} ratings">${rInfo.rating.toFixed(1)}</div>`;

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.title = movie.title;
            card.innerHTML = `
                ${badgeHtml}
                <img class="movie-poster" src="${imageUrl}" alt="${escapeHtml(movie.title)} Poster" loading="lazy">
                <div class="movie-info">
                    <p class="movie-title">${escapeHtml(movie.title)}</p>
                    ${year ? `<p style="font-size:0.8rem; color: var(--text-light-gray); margin:0;">${year}</p>` : ''}
                </div>
            `;

            card.addEventListener('click', () => {
                window.location.href = `movie.html?id=${movie.id}`;
            });

            movieGallery.appendChild(card);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function showEmpty(title, desc) {
        loadingState.style.display = 'none';
        emptyTitle.textContent = title;
        emptyDesc.textContent  = desc;
        emptyState.classList.remove('hidden');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
