document.addEventListener('DOMContentLoaded', () => {
    const movieGrid = document.getElementById('movieGrid');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const currentPageBtn = document.getElementById('currentPageBtn');

    let currentPage = 1;
    let totalPages = 1; // Will be updated by API response

    // Pull configurations securely from our window.ENV namespace constructed in config.js
    const API_KEY = window.ENV && window.ENV.TMDB_API_KEY;
    const BASE_URL = window.ENV && window.ENV.TMDB_BASE_URL;

    // Check if configuration exists
    if (!API_KEY || API_KEY === "") {
        console.error("TMDB API Key is missing or invalid. Please update public/config.js");
        if (movieGrid) {
            movieGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: rgba(217, 4, 41, 0.1); border-radius: 12px; border: 1px solid var(--error);">
                    <h3 style="color: var(--error);">Configuration Missing</h3>
                    <p>Please enter your TMDB API Key in <code>public/config.js</code> to view movies.</p>
                </div>`;
        }
        return; // Halt execution
    }

    /**
     * Fetch popular movies from TMDB API
     * @param {number} page
     */
    async function fetchPopularMovies(page) {
        try {
            // Optional visual feedback while loading
            movieGrid.style.opacity = '0.5';

            const url = `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            totalPages = Math.min(data.total_pages, 500); // TMDB caps pagination at 500 pages usually
            renderMovies(data.results);
            updatePaginationUI();
            

            
        } catch (error) {
            console.error("Failed to fetch movies:", error);
            movieGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--error);">
                    <p>Failed to load movies. Ensure your API key is active and you have network connectivity.</p>
                </div>
            `;
        } finally {
            movieGrid.style.opacity = '1';
        }
    }

    /**
     * Parse the movie array and construct the HTML cards
     * @param {Array} movies
     */
    function renderMovies(movies) {
        movieGrid.innerHTML = ''; // Clear existing movies

        movies.forEach(movie => {
            // Ensure we have a valid image path, or provide a placeholder
            const imageUrl = movie.poster_path 
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image';

            const card = document.createElement('div');
            card.className = 'movie-card';
            
            // Setting a title attribute for native tooltips if title gets truncated
            card.title = movie.title;
            
            card.innerHTML = `
                <img class="movie-poster" src="${imageUrl}" alt="${movie.title} Poster" loading="lazy">
                <div class="movie-info">
                    <p class="movie-title">${movie.title}</p>
                </div>
            `;

            // Optional: Handle mock clicking on a movie
            card.addEventListener('click', () => {
                console.log(`Clicked on: ${movie.title} (ID: ${movie.id})`);
            });

            movieGrid.appendChild(card);
        });
    }

    /**
     * Updates the pagination button states and page number indicator
     */
    function updatePaginationUI() {
        // Current Page
        currentPageBtn.textContent = currentPage;
        
        // Previous Page Check
        if (currentPage > 1) {
            prevPageBtn.textContent = currentPage - 1;
            prevPageBtn.classList.remove('hidden-page');
            prevPageBtn.disabled = false;
        } else {
            prevPageBtn.classList.add('hidden-page');
            prevPageBtn.disabled = true;
        }
        
        // Next Page Check
        if (currentPage < totalPages) {
            nextPageBtn.textContent = currentPage + 1;
            nextPageBtn.classList.remove('hidden-page');
            nextPageBtn.disabled = false;
        } else {
            nextPageBtn.classList.add('hidden-page');
            nextPageBtn.disabled = true;
        }
    }

    /**
     * Custom smooth scroll function for controlled duration
     */
    function smoothScrollToTop(duration = 600) {
        const startPosition = window.pageYOffset;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function: easeInOutQuad for smooth acceleration and deceleration
            const ease = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startPosition - (startPosition * ease));

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }

        requestAnimationFrame(animation);
    }

    // Event Listeners for Pagination
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchPopularMovies(currentPage).then(() => {
                smoothScrollToTop(800); // 800ms duration for a comfortable cinematic glide
            });
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchPopularMovies(currentPage).then(() => {
                smoothScrollToTop(800);
            });
        }
    });

    // Initialize the gallery on load
    fetchPopularMovies(currentPage);
});
