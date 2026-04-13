document.addEventListener('DOMContentLoaded', async () => {
    await window.MovieMarvelEnvReady;

    // -- Config --
    const TMDB_KEY  = window.ENV && window.ENV.TMDB_API_KEY;
    const TMDB_BASE = window.ENV && window.ENV.TMDB_BASE_URL;
    const OMDB_KEY  = window.ENV && window.ENV.OMDB_API_KEY;
    const OMDB_BASE = window.ENV && window.ENV.OMDB_BASE_URL;
    const IMG_BASE  = 'https://image.tmdb.org/t/p';

    // -- DOM References --
    const loadingState    = document.getElementById('loadingState');
    const errorState      = document.getElementById('errorState');
    const movieDetail     = document.getElementById('movieDetail');
    const heroBackdrop    = document.getElementById('heroBackdrop');
    const detailPoster    = document.getElementById('detailPoster');
    const detailTitle     = document.getElementById('detailTitle');
    const detailTagline   = document.getElementById('detailTagline');
    const detailMeta      = document.getElementById('detailMeta');
    const detailGenres    = document.getElementById('detailGenres');
    const scoresRow       = document.getElementById('scoresRow');
    const detailOverview  = document.getElementById('detailOverview');
    const detailInfoGrid  = document.getElementById('detailInfoGrid');
    const collectionSection = document.getElementById('collectionSection');
    const collectionBanner  = document.getElementById('collectionBanner');
    const castSection     = document.getElementById('castSection');
    const castGrid        = document.getElementById('castGrid');

    // -- Helpers --
    function show(el)  { el.classList.remove('hidden'); }
    function hide(el)  { el.classList.add('hidden'); }

    function showError() {
        hide(loadingState);
        show(errorState);
    }

    function formatMoney(n) {
        if (!n || n === 0) return 'N/A';
        return '$' + n.toLocaleString('en-US');
    }

    function formatRuntime(mins) {
        if (!mins) return 'N/A';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;');
    }

    // -- Read movie ID from URL --
    const params  = new URLSearchParams(window.location.search);
    const movieId = params.get('id');

    if (!movieId || !TMDB_KEY) {
        showError();
        return;
    }

    // -- Fetch TMDB detail + credits in parallel --
    let tmdb, credits;
    try {
        const [detailRes, creditsRes] = await Promise.all([
            fetch(`${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_KEY}&language=en-US`),
            fetch(`${TMDB_BASE}/movie/${movieId}/credits?api_key=${TMDB_KEY}&language=en-US`)
        ]);

        if (!detailRes.ok) throw new Error('TMDB detail error');

        tmdb    = await detailRes.json();
        credits = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };
    } catch (err) {
        console.error('TMDB fetch failed:', err);
        showError();
        return;
    }

    // -- Fetch OMDB data using IMDB ID from TMDB --
    let omdb = null;
    if (tmdb.imdb_id) {
        try {
            const omdbRes = await fetch(
                `${OMDB_BASE}/?i=${tmdb.imdb_id}&apikey=${OMDB_KEY}`
            );
            if (omdbRes.ok) {
                const omdbData = await omdbRes.json();
                if (omdbData.Response === 'True') omdb = omdbData;
            }
        } catch (err) {
            console.warn('OMDB fetch failed (non-fatal):', err);
        }
    }

    // ── Update page title ─────────────────────────────────────────────────────
    document.title = `${tmdb.title} — MovieMarvel`;

    // -- Hero Backdrop --
    if (tmdb.backdrop_path) {
        heroBackdrop.style.backgroundImage =
            `url('${IMG_BASE}/w1280${tmdb.backdrop_path}')`;
    } else if (tmdb.poster_path) {
        heroBackdrop.style.backgroundImage =
            `url('${IMG_BASE}/w780${tmdb.poster_path}')`;
    }

    // -- Poster --
    if (tmdb.poster_path) {
        detailPoster.src = `${IMG_BASE}/w500${tmdb.poster_path}`;
        detailPoster.alt = `${tmdb.title} poster`;
    } else {
        detailPoster.src = 'https://via.placeholder.com/500x750?text=No+Image';
    }

    // -- Title & Tagline --
    detailTitle.textContent = tmdb.title || 'Unknown Title';
    if (tmdb.tagline) {
        detailTagline.textContent = `"${tmdb.tagline}"`;
    } else {
        hide(detailTagline);
    }

    // -- Meta Chips --
    const year = tmdb.release_date ? new Date(tmdb.release_date).getFullYear() : null;
    const chips = [];
    if (year)          chips.push(`<span class="meta-chip year">${year}</span>`);
    if (tmdb.runtime)  chips.push(`<span class="meta-chip runtime">⏱ ${formatRuntime(tmdb.runtime)}</span>`);
    if (tmdb.status)   chips.push(`<span class="meta-chip">${tmdb.status}</span>`);
    if (tmdb.original_language) {
        chips.push(`<span class="meta-chip">${tmdb.original_language.toUpperCase()}</span>`);
    }
    detailMeta.innerHTML = chips.join('');

    // -- Genre Tags --
    if (tmdb.genres && tmdb.genres.length) {
        detailGenres.innerHTML = tmdb.genres
            .map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`)
            .join('');
    }

    // -- Ratings Scores --
    const scores = [];

    // TMDB score
    if (tmdb.vote_average) {
        scores.push({
            cls:    'tmdb',
            source: 'TMDB',
            value:  tmdb.vote_average.toFixed(1),
            label:  `${tmdb.vote_count?.toLocaleString() || '?'} votes`
        });
    }

    // IMDb and other OMDB-sourced scores
    if (omdb) {
        if (omdb.imdbRating && omdb.imdbRating !== 'N/A') {
            scores.push({
                cls:    'imdb',
                source: 'IMDb',
                value:  omdb.imdbRating,
                label:  omdb.imdbVotes !== 'N/A' ? `${omdb.imdbVotes} votes` : ''
            });
        }

        (omdb.Ratings || []).forEach(r => {
            if (r.Source === 'Rotten Tomatoes') {
                scores.push({ cls: 'rt', source: 'Rotten Tomatoes', value: r.Value, label: '' });
            }
            if (r.Source === 'Metacritic') {
                scores.push({ cls: 'mc', source: 'Metacritic', value: r.Value, label: '' });
            }
        });
    }

    if (scores.length) {
        scoresRow.innerHTML = scores.map(s => `
            <div class="score-card ${s.cls}">
                <span class="score-source">${escapeHtml(s.source)}</span>
                <span class="score-value">${escapeHtml(s.value)}</span>
                ${s.label ? `<span class="score-label">${escapeHtml(s.label)}</span>` : ''}
            </div>
        `).join('');
    } else {
        hide(scoresRow);
    }

    // -- Overview --
    if (tmdb.overview) {
        detailOverview.textContent = tmdb.overview;
    } else {
        hide(document.getElementById('overviewSection'));
    }

    // -- Info Grid --
    const director  = credits.crew?.find(c => c.job === 'Director');
    const writers   = credits.crew?.filter(c => c.department === 'Writing').slice(0, 3);
    const producers = credits.crew?.filter(c => c.job === 'Producer').slice(0, 2);

    const infoItems = [
        { label: 'Director',        value: director ? director.name : null },
        { label: 'Writer(s)',        value: writers?.length  ? writers.map(w => w.name).join(', ')   : null },
        { label: 'Producer(s)',      value: producers?.length? producers.map(p => p.name).join(', '): null },
        { label: 'Release Date',     value: tmdb.release_date ? new Date(tmdb.release_date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : null },
        { label: 'Runtime',          value: tmdb.runtime ? formatRuntime(tmdb.runtime) : null },
        { label: 'Original Language',value: tmdb.original_language ? tmdb.original_language.toUpperCase() : null },
        { label: 'Budget',           value: tmdb.budget  ? formatMoney(tmdb.budget)  : null },
        { label: 'Box Office',       value: tmdb.revenue ? formatMoney(tmdb.revenue) : (omdb?.BoxOffice && omdb.BoxOffice !== 'N/A' ? omdb.BoxOffice : null) },
        { label: 'Country',          value: omdb?.Country && omdb.Country !== 'N/A' ? omdb.Country : (tmdb.production_countries?.[0]?.name ?? null) },
        { label: 'Rated',            value: omdb?.Rated && omdb.Rated !== 'N/A' ? omdb.Rated : null },
        { label: 'Awards',           value: omdb?.Awards && omdb.Awards !== 'N/A' ? omdb.Awards : null },
    ].filter(i => i.value);

    if (infoItems.length) {
        detailInfoGrid.innerHTML = infoItems.map(i => `
            <div class="info-item">
                <div class="info-label">${escapeHtml(i.label)}</div>
                <div class="info-value">${escapeHtml(i.value)}</div>
            </div>
        `).join('');
    }

    // -- Collection / Series Banner --
    if (tmdb.belongs_to_collection) {
        const col = tmdb.belongs_to_collection;
        const colPoster = col.poster_path
            ? `<img src="${IMG_BASE}/w92${col.poster_path}" alt="${escapeHtml(col.name)} poster"
                 style="width:60px;border-radius:8px;flex-shrink:0;">`
            : `<div class="collection-icon">🎬</div>`;

        collectionBanner.innerHTML = `
            ${colPoster}
            <div class="collection-text">
                <h3>${escapeHtml(col.name)}</h3>
                <p>${escapeHtml(tmdb.title)} is part of this collection.</p>
            </div>
        `;
        show(collectionSection);
    }

    // -- Cast Grid --
    const topCast = credits.cast?.slice(0, 12) ?? [];
    if (topCast.length) {
        castGrid.innerHTML = topCast.map(actor => {
            const photo = actor.profile_path
                ? `<img class="cast-photo" src="${IMG_BASE}/w185${actor.profile_path}" alt="${escapeHtml(actor.name)}" loading="lazy">`
                : `<div class="cast-photo" style="display:flex;align-items:center;justify-content:center;background:var(--bg-card-dark);font-size:2.5rem;">👤</div>`;
            return `
                <div class="cast-card">
                    ${photo}
                    <div class="cast-info">
                        <div class="cast-name" title="${escapeHtml(actor.name)}">${escapeHtml(actor.name)}</div>
                        <div class="cast-character" title="${escapeHtml(actor.character || '')}">${escapeHtml(actor.character || '—')}</div>
                    </div>
                </div>
            `;
        }).join('');
        show(castSection);
    }

    // -- Reveal Page --
    hide(loadingState);
    show(movieDetail);

    document.getElementById('backBtn').addEventListener('click', () => history.back());
});
