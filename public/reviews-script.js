import { getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    await window.MovieMarvelEnvReady;

    const API_KEY  = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;
    const IMG_BASE = 'https://image.tmdb.org/t/p';

    const reviewsList  = document.getElementById('reviewsList');
    const emptyState   = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const emptyTitle   = document.getElementById('emptyTitle');
    const emptyDesc    = document.getElementById('emptyDesc');

    if (!API_KEY) { console.error('TMDB API Key missing. Add tmdbApiKey to Firestore config/public.'); return; }

    let app, db, auth;
    try {
        app  = getApp();
        db   = getFirestore(app);
        auth = getAuth(app);
    } catch (e) { return; }

    // State
    let currentSort = 'newest';
    let currentUser = null;
    let currentQuery = '';
    // holds all loaded reviews so search/sort can re-filter without a new Firestore fetch
    let allReviews = [];
    // Cache: movieId → { title, poster_path, release_date }
    const movieCache = {};

    // ── Search input ───────────────────────────────────────────────────
    const searchInput = document.getElementById('movieSearchInput');
    const searchClear = document.getElementById('searchClear');
    const searchCount = document.getElementById('searchCount');

    searchInput.addEventListener('input', () => {
        currentQuery = searchInput.value.trim().toLowerCase();
        searchClear.classList.toggle('visible', currentQuery.length > 0);
        // Re-apply sort+filter without a new Firestore fetch
        if (allReviews.length > 0) applySortAndRender(allReviews);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        currentQuery = '';
        searchClear.classList.remove('visible');
        if (allReviews.length > 0) applySortAndRender(allReviews);
        searchInput.focus();
    });

    // ── Auth listener ──────────────────────────────────────────────────
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        await loadReviews();
    });

    // ── Pill toggle listeners ──────────────────────────────────────────
    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (e.target.classList.contains('active')) return;
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSort = e.target.getAttribute('data-sort');
            // Sort + filter in-memory if already loaded, else fetch
            if (allReviews.length > 0) {
                applySortAndRender(allReviews);
            } else {
                await loadReviews();
            }
        });
    });

    // ── Main load function ───────────────────────────────────────────────────
    async function loadReviews() {
        if (!db) return;

        // Reset UI
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        reviewsList.classList.add('hidden');
        reviewsList.innerHTML = '';

        try {
            if (!currentUser) {
                showEmpty('Sign in to see your reviews', 'Your reviews are tied to your account session.');
                return;
            }

            // Query Firestore for this user's reviews
            const q = query(
                collection(db, "reviews"),
                where("userId", "==", currentUser.uid)
            );
            const snap = await getDocs(q);

            let reviews = [];
            snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));

            if (reviews.length === 0) {
                showEmpty("No reviews yet", "You haven't written any reviews. Browse a movie and share your thoughts!");
                return;
            }

            // Fetch TMDB metadata for any uncached movies
            const uniqueMovieIds = [...new Set(reviews.map(r => r.movieId))];
            await Promise.all(uniqueMovieIds.map(async mid => {
                if (movieCache[mid]) return;
                try {
                    const res = await fetch(`${BASE_URL}/movie/${mid}?api_key=${API_KEY}&language=en-US`);
                    if (!res.ok) return;
                    const data = await res.json();
                    movieCache[mid] = {
                        id: data.id,
                        title: data.title,
                        poster_path: data.poster_path,
                        release_date: data.release_date
                    };
                } catch {}
            }));

            // Attach movie metadata into review objects
            allReviews = reviews.map(r => ({
                ...r,
                movie: movieCache[r.movieId] || null
            }));

            // Apply sort + search filter
            applySortAndRender(allReviews);

        } catch (err) {
            console.error('Error loading reviews:', err);
            showEmpty('Failed to load', 'An error occurred fetching your reviews.');
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    // ── Sort & filter & render ──────────────────────────────────────────
    function applySortAndRender(reviews) {
        let filtered = [...reviews];

        // Apply search filter first
        if (currentQuery) {
            filtered = filtered.filter(r =>
                (r.movie?.title ?? '').toLowerCase().includes(currentQuery)
            );
        }

        // Apply sort
        if (currentSort === 'newest') {
            filtered.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        } else if (currentSort === 'oldest') {
            filtered.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
        } else if (currentSort === 'title_asc') {
            filtered.sort((a, b) => (a.movie?.title ?? '').localeCompare(b.movie?.title ?? ''));
        } else if (currentSort === 'title_desc') {
            filtered.sort((a, b) => (b.movie?.title ?? '').localeCompare(a.movie?.title ?? ''));
        }

        // Update search result count
        if (currentQuery) {
            searchCount.classList.remove('hidden');
            searchCount.innerHTML = `Found <span>${filtered.length}</span> review${filtered.length !== 1 ? 's' : ''} matching "<span>${escapeHtml(currentQuery)}</span>"`;
        } else {
            searchCount.classList.add('hidden');
        }

        renderReviews(filtered);
    }

    // ── Render cards ─────────────────────────────────────────────────────────
    function renderReviews(reviews) {
        reviewsList.innerHTML = '';

        reviews.forEach((review, i) => {
            const movie = review.movie;
            const movieTitle = movie?.title ?? 'Unknown Movie';
            const poster = movie?.poster_path
                ? `${IMG_BASE}/w185${movie.poster_path}`
                : null;
            const year = movie?.release_date
                ? new Date(movie.release_date).getFullYear()
                : '';

            const dateStr = review.createdAt
                ? review.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : '';

            const card = document.createElement('div');
            card.className = 'review-card';
            card.style.animationDelay = `${i * 0.05}s`;
            card.innerHTML = `
                ${poster
                    ? `<img class="review-poster" src="${poster}" alt="${escapeHtml(movieTitle)} poster" loading="lazy">`
                    : `<div class="review-poster" style="display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--bg-card-dark);">🎬</div>`
                }
                <div class="review-body">
                    <div class="review-card-header">
                        <h3 class="review-movie-title">${escapeHtml(movieTitle)}${year ? ` <span style="font-size:0.8rem;color:var(--text-light-gray);font-family:'Roboto',sans-serif;font-weight:400;">(${year})</span>` : ''}</h3>
                        <div class="review-meta">
                            <span class="review-username-badge">${escapeHtml(review.username || 'You')}</span>
                            <span class="review-date">${dateStr}</span>
                        </div>
                    </div>
                    <p class="review-text">${escapeHtml(review.reviewText).replace(/\n/g, '<br>')}</p>
                </div>
            `;

            // Navigate to movie on click
            if (movie?.id) {
                card.addEventListener('click', () => {
                    window.location.href = `movie.html?id=${movie.id}`;
                });
            }

            reviewsList.appendChild(card);
        });

        reviewsList.classList.remove('hidden');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function showEmpty(title, desc) {
        loadingState.classList.add('hidden');
        emptyTitle.textContent = title;
        emptyDesc.textContent = desc;
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
