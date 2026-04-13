document.addEventListener('DOMContentLoaded', async () => {
    await window.MovieMarvelEnvReady;

    // -- Config --
    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    // -- DOM References --
    const searchInput    = document.getElementById('browseSearchInput');
    const searchBtn      = document.getElementById('browseSearchBtn');
    const resultsSection = document.getElementById('browseResultsSection');
    const resultsGrid    = document.getElementById('browseResultsGrid');
    const queryLabel     = document.getElementById('browseQueryLabel');
    const clearBtn       = document.getElementById('clearBrowseBtn');
    const emptyState     = document.getElementById('browseEmptyState');
    const prevBtn        = document.getElementById('browsePrevBtn');
    const nextBtn        = document.getElementById('browseNextBtn');
    const currentPageBtn = document.getElementById('browseCurrentPageBtn');

    // -- State --
    let currentQuery  = '';
    let currentPage   = 1;
    let totalPages    = 1;
    let debounceTimer = null;

    if (!API_KEY || API_KEY === '') {
        console.error('TMDB API Key is missing. Add tmdbApiKey to Firestore config/public.');
        if (resultsGrid) {
            showResults('Configuration issue');
            resultsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;
                            background: rgba(217, 4, 41, 0.1); border-radius: 12px;
                            border: 1px solid var(--error);">
                    <h3 style="color: var(--error);">Configuration Missing</h3>
                    <p>Add your TMDB API key to the <code>config/public</code> document in Firestore (field <code>tmdbApiKey</code>).</p>
                </div>`;
        }
        return;
    }

    // -- Search --
    async function searchMovies(query, page = 1) {
        if (!query.trim()) {
            resetToIdle();
            return;
        }

        currentQuery = query.trim();
        currentPage  = page;

        showResults(currentQuery);
        resultsGrid.innerHTML = `
            <div class="no-results">
                <p>Searching for <em>${escapeHtml(currentQuery)}</em>…</p>
            </div>`;

        try {
            const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US` +
                        `&query=${encodeURIComponent(currentQuery)}&page=${page}&include_adult=false`;
            const response = await fetch(url);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            // TMDB caps queryable results at 500 pages
            totalPages = Math.min(data.total_pages, 500);

            if (!data.results || data.results.length === 0) {
                resultsGrid.innerHTML = `
                    <div class="no-results">
                        <h3>No results found</h3>
                        <p>We couldn't find any movies matching "<em>${escapeHtml(currentQuery)}</em>".
                        Try a different search term.</p>
                    </div>`;
                hidePagination();
                return;
            }

            renderMovies(data.results);
            updatePagination();

        } catch (err) {
            console.error('Search failed:', err);
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <h3>Search failed</h3>
                    <p>Something went wrong. Please check your connection and try again.</p>
                </div>`;
            hidePagination();
        }
    }

    // -- Render --
    function renderMovies(movies) {
        resultsGrid.innerHTML = '';

        movies.forEach(movie => {
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
                <div class="movie-info">
                    <p class="movie-title">${movie.title}</p>
                    ${year ? `<p style="font-size:0.8rem; color: var(--text-light-gray); margin:0;">${year}</p>` : ''}
                </div>
            `;

            // Save search state so the back button can restore it
            card.addEventListener('click', () => {
                sessionStorage.setItem('mm_browse_query',  currentQuery);
                sessionStorage.setItem('mm_browse_page',   currentPage);
                sessionStorage.setItem('mm_browse_scroll', window.scrollY);
                window.location.href = `movie.html?id=${movie.id}`;
            });

            resultsGrid.appendChild(card);
        });
    }

    // -- Pagination --
    function updatePagination() {
        currentPageBtn.textContent = currentPage;

        if (currentPage > 1) {
            prevBtn.textContent = currentPage - 1;
            prevBtn.classList.remove('hidden-page');
            prevBtn.disabled = false;
        } else {
            prevBtn.classList.add('hidden-page');
            prevBtn.disabled = true;
        }

        if (currentPage < totalPages) {
            nextBtn.textContent = currentPage + 1;
            nextBtn.classList.remove('hidden-page');
            nextBtn.disabled = false;
        } else {
            nextBtn.classList.add('hidden-page');
            nextBtn.disabled = true;
        }
    }

    function hidePagination() {
        prevBtn.classList.add('hidden-page');
        nextBtn.classList.add('hidden-page');
    }

    // easeInOutQuad for smooth acceleration and deceleration
    function smoothScrollToTop(duration = 600) {
        const startPos = window.pageYOffset;
        let startTime = null;

        function step(now) {
            if (!startTime) startTime = now;
            const elapsed  = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            window.scrollTo(0, startPos - startPos * ease);
            if (elapsed < duration) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            searchMovies(currentQuery, currentPage - 1).then(() => smoothScrollToTop());
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            searchMovies(currentQuery, currentPage + 1).then(() => smoothScrollToTop());
        }
    });

    // -- UI State Helpers --
    function showResults(query) {
        queryLabel.textContent = `"${query}"`;
        emptyState.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }

    function resetToIdle() {
        searchInput.value = '';
        currentQuery = '';
        currentPage  = 1;
        totalPages   = 1;
        resultsGrid.innerHTML = '';
        resultsSection.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }

    // -- Event Listeners --
    searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (q) searchMovies(q);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(debounceTimer);
            const q = searchInput.value.trim();
            if (q) searchMovies(q);
        }
    });

    // Debounced live search while typing
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = searchInput.value.trim();

        if (!q) {
            resetToIdle();
            return;
        }

        debounceTimer = setTimeout(() => searchMovies(q), 450);
    });

    clearBtn.addEventListener('click', resetToIdle);

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    searchInput.focus();

    // -- State Restoration --
    // Restores the query, page, and scroll position when returning from a movie detail page
    const savedQuery  = sessionStorage.getItem('mm_browse_query');
    const savedPage   = sessionStorage.getItem('mm_browse_page');
    const savedScroll = sessionStorage.getItem('mm_browse_scroll');

    if (savedQuery) {
        sessionStorage.removeItem('mm_browse_query');
        sessionStorage.removeItem('mm_browse_page');
        sessionStorage.removeItem('mm_browse_scroll');

        searchInput.value = savedQuery;
        searchMovies(savedQuery, parseInt(savedPage, 10) || 1).then(() => {
            if (savedScroll) {
                window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
            }
        });
    }
});
