import { getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    const movieGallery = document.getElementById('movieGallery');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    if (!API_KEY) {
        console.error('TMDB API Key is missing. Please update public/config.js');
        return;
    }

    let app, db, auth;
    try {
        app = getApp();
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (error) {
        console.error("Failed to initialize Firebase features:", error);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous && user.email) {
            await loadWatchlist(user);
        } else {
            // Not authorized, show empty state or redirect
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `
                    <div class="empty-icon">🔒</div>
                    <h3>Login Required</h3>
                    <p>Please log in to see your personalized watchlist.</p>
                `;
                emptyState.classList.remove('hidden');
            }
        }
    });

    async function loadWatchlist(user) {
        if (!db) return;
        
        try {
            if (loadingState) loadingState.style.display = 'block';
            if (emptyState) emptyState.classList.add('hidden'); // hide until we decide what to show
            if (movieGallery) movieGallery.classList.add('hidden');
            
            const q = query(collection(db, "watchlists"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);

            const watchlistMap = new Map();
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.movieId && !watchlistMap.has(data.movieId)) {
                    // Storing the document ID alongside data to allow deletion
                    watchlistMap.set(data.movieId, { ...data, docId: doc.id });
                }
            });

            if (watchlistMap.size === 0) {
                if (loadingState) loadingState.style.display = 'none';
                
                emptyState.innerHTML = `
                    <div class="empty-icon">🍿</div>
                    <h3>Your watchlist is empty</h3>
                    <p>Browse movies and add them to your watchlist to see them here.</p>
                    <button onclick="location.href='browse.html'" style="margin-top: 1rem;">Browse Movies</button>
                `;
                emptyState.classList.remove('hidden');
                
                movieGallery.innerHTML = '';
                return;
            }

            const movieIds = Array.from(watchlistMap.keys());
            
            const moviePromises = movieIds.map(async id => {
                try {
                    const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`);
                    if (!response.ok) return null;
                    const json = await response.json();
                    return { movieParams: json, docId: watchlistMap.get(id).docId };
                } catch(e) {
                    return null;
                }
            });

            const movies = await Promise.all(moviePromises);
            const validMovies = movies.filter(m => m !== null);

            renderMovies(validMovies);

        } catch (error) {
            console.error("Error loading watchlist", error);
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.innerHTML = `<h3 style="color:var(--error);">Failed to load</h3>`;
                emptyState.classList.remove('hidden');
            }
        } finally {
            if (loadingState) loadingState.style.display = 'none';
        }
    }

    function renderMovies(movieDataList) {
        movieGallery.innerHTML = '';
        movieGallery.classList.remove('hidden');
        
        // Dynamically update the generic block to act as an "Add More" call to action
        if (emptyState) {
            emptyState.innerHTML = `
                <div class="empty-icon" style="font-size: 2.5rem; margin-top: 1rem;">🎥</div>
                <h3 style="font-size: 1.2rem;">Looking for more?</h3>
                <p style="font-size: 0.9rem;">Explore our vast catalog to discover your next favorite movie and add more to your watchlist.</p>
                <button onclick="location.href='browse.html'" style="margin-top: 0.5rem; padding: 0.5rem 1.2rem; font-size: 0.9rem;">Discover More</button>
            `;
            emptyState.classList.remove('hidden');
        }

        movieDataList.forEach(item => {
            const movie = item.movieParams;
            const docId = item.docId;

            const imageUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image';

            const year = movie.release_date
                ? new Date(movie.release_date).getFullYear()
                : '';

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.title = movie.title;
            card.innerHTML = `
                <img class="movie-poster" src="${imageUrl}" alt="${movie.title} Poster" loading="lazy">
                <button class="remove-btn" title="Remove from Watchlist" data-docid="${docId}">✕</button>
                <div class="movie-info">
                    <p class="movie-title">${movie.title}</p>
                    ${year ? `<p style="font-size:0.8rem; color: var(--text-light-gray); margin:0;">${year}</p>` : ''}
                </div>
            `;

            // Setup Navigation
            card.addEventListener('click', (e) => {
                if(e.target.classList.contains('remove-btn')) return;
                window.location.href = `movie.html?id=${movie.id}`;
            });

            // Setup Removal
            const removeBtn = card.querySelector('.remove-btn');
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // prevent card click
                const targetDocId = e.target.getAttribute('data-docid');
                if(!targetDocId) return;

                const confirmed = confirm("Remove this movie from your watchlist?");
                if(!confirmed) return;

                try {
                    await deleteDoc(doc(db, "watchlists", targetDocId));
                    card.remove(); // remove visually immediately
                    if (movieGallery.children.length === 0) {
                        movieGallery.classList.add('hidden');
                        
                        emptyState.innerHTML = `
                            <div class="empty-icon">🍿</div>
                            <h3>Your watchlist is empty</h3>
                            <p>Browse movies and add them to your watchlist to see them here.</p>
                            <button onclick="location.href='browse.html'" style="margin-top: 1rem;">Browse Movies</button>
                        `;
                        emptyState.classList.remove('hidden');
                    }
                } catch(error) {
                    console.error("Error removing from watchlist", error);
                    alert("Could not remove movie. Please try again later.");
                }
            });

            movieGallery.appendChild(card);
        });
    }
});
