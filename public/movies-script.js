document.addEventListener('DOMContentLoaded', async () => {
    await window.MovieMarvelEnvReady;

    const movieGrid = document.getElementById('movieGrid');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const currentPageBtn = document.getElementById('currentPageBtn');

    let currentPage = 1;
    let totalPages = 1;

    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    if (!API_KEY || API_KEY === "") {
        console.error("TMDB API Key is missing. Add tmdbApiKey to Firestore config/public.");
        if (movieGrid) {
            movieGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: rgba(217, 4, 41, 0.1); border-radius: 12px; border: 1px solid var(--error);">
                    <h3 style="color: var(--error);">Configuration Missing</h3>
                    <p>Add your TMDB API key to the <code>config/public</code> document in Firestore (field <code>tmdbApiKey</code>).</p>
                </div>`;
        }
        return;
    }

    async function fetchPopularMovies(page) {
        try {
            movieGrid.style.opacity = '0.5';

            const url = `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // TMDB caps queryable results at 500 pages
            totalPages = Math.min(data.total_pages, 500);
            renderMovies(data.results);
            updatePaginationUI();

        } catch (error) {
            console.error("Failed to fetch movies:", error);
            movieGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--error);">
                    <p>Failed to load movies. Check your API key and network connection.</p>
                </div>
            `;
        } finally {
            movieGrid.style.opacity = '1';
        }
    }

    function renderMovies(movies) {
        movieGrid.innerHTML = '';

        movies.forEach(movie => {
            const imageUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image';

            const card = document.createElement('div');
            card.className = 'movie-card';
            card.title = movie.title;

            card.innerHTML = `
                <img class="movie-poster" src="${imageUrl}" alt="${movie.title} Poster" loading="lazy">
                <div class="movie-info">
                    <p class="movie-title">${movie.title}</p>
                </div>
            `;

            // Save scroll and page position so the back button can restore state
            card.addEventListener('click', () => {
                sessionStorage.setItem('mm_index_page', currentPage);
                sessionStorage.setItem('mm_index_scroll', window.scrollY);
                window.location.href = `movie.html?id=${movie.id}`;
            });

            movieGrid.appendChild(card);
        });
    }

    function updatePaginationUI() {
        currentPageBtn.textContent = currentPage;

        if (currentPage > 1) {
            prevPageBtn.textContent = currentPage - 1;
            prevPageBtn.classList.remove('hidden-page');
            prevPageBtn.disabled = false;
        } else {
            prevPageBtn.classList.add('hidden-page');
            prevPageBtn.disabled = true;
        }

        if (currentPage < totalPages) {
            nextPageBtn.textContent = currentPage + 1;
            nextPageBtn.classList.remove('hidden-page');
            nextPageBtn.disabled = false;
        } else {
            nextPageBtn.classList.add('hidden-page');
            nextPageBtn.disabled = true;
        }
    }

    // easeInOutQuad for smooth acceleration and deceleration
    function smoothScrollToTop(duration = 600) {
        const startPosition = window.pageYOffset;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startPosition - (startPosition * ease));

            if (timeElapsed < duration) requestAnimationFrame(animation);
        }

        requestAnimationFrame(animation);
    }

    // -- Pagination --
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchPopularMovies(currentPage).then(() => { smoothScrollToTop(800); });
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchPopularMovies(currentPage).then(() => { smoothScrollToTop(800); });
        }
    });

    // -- State Restoration --
    // Restores the page and scroll position when the user navigates back from a movie detail page
    const savedPage = sessionStorage.getItem('mm_index_page');
    const savedScroll = sessionStorage.getItem('mm_index_scroll');

    if (savedPage) {
        currentPage = parseInt(savedPage, 10) || 1;
        sessionStorage.removeItem('mm_index_page');
        sessionStorage.removeItem('mm_index_scroll');
    }

    fetchPopularMovies(currentPage).then(() => {
        if (savedScroll) {
            window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
        }

        // Exposed so the nav logo can reset to page 1 from anywhere on this page
        window.resetGallery = () => {
            sessionStorage.removeItem('mm_index_page');
            sessionStorage.removeItem('mm_index_scroll');
            currentPage = 1;
            fetchPopularMovies(1).then(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        };
    });
});
