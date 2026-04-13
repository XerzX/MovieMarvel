import { getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp, doc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// auth.js is loaded first and initializes the Firebase app
let app, db, auth;
try {
    app = getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    initFeatures();
} catch (error) {
    console.error("Firebase init failed:", error);
}

function initFeatures() {
    const params = new URLSearchParams(window.location.search);
    const movieId = params.get('id');
    if (!movieId) return;

    // -- Recommend Toggle --
    const toggleRecommendBtn = document.getElementById('toggleRecommendBtn');
    const recommendFormContainer = document.getElementById('recommendFormContainer');
    if (toggleRecommendBtn && recommendFormContainer) {
        toggleRecommendBtn.addEventListener('click', () => {
            // Recommendations require a registered account
            if (document.body.classList.contains('auth-mode-anonymous') || (auth.currentUser && auth.currentUser.isAnonymous) || !auth.currentUser) {
                const loginPanel = document.getElementById('loginForm');
                const backdrop = document.getElementById('panelBackdrop');
                if (loginPanel && backdrop) {
                    loginPanel.classList.remove('hidden');
                    backdrop.classList.add('visible');
                    document.body.classList.add('panel-open');
                } else {
                    alert('Please sign in or create an account to recommend a movie!');
                }
                return;
            }

            recommendFormContainer.classList.toggle('hidden');
            toggleRecommendBtn.textContent = recommendFormContainer.classList.contains('hidden') 
                ? 'Recommend Movie ✦' : 'Close Recommendation ✕';
        });
    }

    // -- Review Toggle --
    const toggleReviewBtn = document.getElementById('toggleReviewBtn');
    const reviewFormContainer = document.getElementById('reviewFormContainer');
    if (toggleReviewBtn && reviewFormContainer) {
        toggleReviewBtn.addEventListener('click', () => {
            reviewFormContainer.classList.toggle('hidden');
            toggleReviewBtn.textContent = reviewFormContainer.classList.contains('hidden') 
                ? 'Write a Review ✎' : 'Cancel Review ✕';
        });
    }

    // -- Watchlist Toggle --
    const toggleWatchlistBtn = document.getElementById('toggleWatchlistBtn');
    if (toggleWatchlistBtn) {
        toggleWatchlistBtn.addEventListener('click', async () => {
            if (!auth.currentUser || auth.currentUser.isAnonymous) {
                alert('Please sign in to add this movie to your watchlist!');
                return;
            }

            toggleWatchlistBtn.disabled = true;
            const originalText = toggleWatchlistBtn.textContent;
            toggleWatchlistBtn.textContent = 'Adding...';

            try {
                const q = query(
                    collection(db, "watchlists"),
                    where("userId", "==", auth.currentUser.uid),
                    where("movieId", "==", movieId)
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    toggleWatchlistBtn.textContent = 'Already in Watchlist ✔';
                    return;
                }

                await addDoc(collection(db, "watchlists"), {
                    userId: auth.currentUser.uid,
                    movieId: movieId,
                    addedAt: serverTimestamp()
                });

                toggleWatchlistBtn.textContent = 'Added to Watchlist ✔';
                toggleWatchlistBtn.style.color = "var(--success)";
                toggleWatchlistBtn.style.borderColor = "var(--success)";
            } catch (error) {
                console.error("Error adding to watchlist:", error);
                toggleWatchlistBtn.textContent = 'Error adding. Try again.';
                setTimeout(() => {
                    toggleWatchlistBtn.disabled = false;
                    toggleWatchlistBtn.textContent = originalText;
                }, 3000);
            }
        });
    }

    fetchAndRenderReviews(movieId);
    fetchAndRenderRatings(movieId);

    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitReview(movieId);
        });
    }

    const recommendForm = document.getElementById('recommendForm');
    if (recommendForm) {
        recommendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitRecommendation(movieId);
        });
    }

    setupShareLinks();
}

async function fetchAndRenderReviews(movieId) {
    if (!db) return;
    const reviewsList = document.getElementById('reviewsList');

    try {
        // Avoid a compound Firestore index requirement by querying without orderBy and sorting client-side
        const querySnapshot = await getDocs(query(collection(db, "reviews"), where("movieId", "==", movieId)));

        const results = [];
        querySnapshot.forEach(doc => results.push(doc.data()));

        if (results.length === 0) {
            reviewsList.innerHTML = '<p style="color: var(--text-light-gray); font-style: italic;">No reviews yet. Be the first to review!</p>';
            return;
        }

        // Sort newest first
        results.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        let html = '';
        results.forEach((data) => {
            const d = data.createdAt ? data.createdAt.toDate().toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            }) : 'Just now';
            html += `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-author">${escapeHtml(data.username)}</span>
                        <span class="review-date">${d}</span>
                    </div>
                    <p class="review-body">${escapeHtml(data.reviewText).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        });
        reviewsList.innerHTML = html;
    } catch (error) {
        console.error("Error fetching reviews:", error);
        reviewsList.innerHTML = '<p style="color: var(--error);">Failed to load reviews.</p>';
    }
}

async function fetchAndRenderRatings(movieId) {
    if (!db) return;
    const communityScoresRow = document.getElementById('communityScoresRow');
    if (!communityScoresRow) return;

    try {
        const q = query(collection(db, "user_movie_ratings"), where("movieId", "==", movieId));
        const snap = await getDocs(q);

        let totalScore = 0;
        let count = 0;
        let currentUserRating = 0;

        // Wait for auth to resolve before checking if this user has an existing rating
        const currentUser = await new Promise(resolve => {
            const unsub = onAuthStateChanged(auth, user => {
                unsub();
                resolve(user);
            });
            setTimeout(() => { unsub(); resolve(auth.currentUser); }, 1500);
        });

        snap.forEach(d => {
            const data = d.data();
            totalScore += data.rating;
            count++;
            if (currentUser && data.userId === currentUser.uid) {
                currentUserRating = data.rating;
            }
        });

        const avg = count > 0 ? (totalScore / count) : 0;

        let html = '';
        if (count > 0) {
            html += `
                <div class="score-card moviemarvel">
                    <span class="score-source">MovieMarvel Users</span>
                    <span class="score-value">${avg.toFixed(1)} / 5</span>
                    <span class="score-label">${count} rating${count !== 1 ? 's' : ''}</span>
                </div>
            `;
        }

        html += `
            <div class="score-card user-rating">
                <span class="score-source">Your Rating</span>
                <div class="star-rating" id="userStarRating">
                    <span class="star ${currentUserRating >= 1 ? 'active' : ''}" data-value="1">★</span>
                    <span class="star ${currentUserRating >= 2 ? 'active' : ''}" data-value="2">★</span>
                    <span class="star ${currentUserRating >= 3 ? 'active' : ''}" data-value="3">★</span>
                    <span class="star ${currentUserRating >= 4 ? 'active' : ''}" data-value="4">★</span>
                    <span class="star ${currentUserRating >= 5 ? 'active' : ''}" data-value="5">★</span>
                </div>
                <span class="score-label" id="userRatingMsg">${currentUserRating > 0 ? 'Thanks for rating!' : 'Click to rate'}</span>
            </div>
        `;

        communityScoresRow.innerHTML = html;

        const stars = communityScoresRow.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('mouseover', function() {
                const val = parseInt(this.getAttribute('data-value'));
                stars.forEach(s => {
                    s.classList.toggle('hover', parseInt(s.getAttribute('data-value')) <= val);
                });
            });

            star.addEventListener('mouseout', function() {
                stars.forEach(s => s.classList.remove('hover'));
            });

            star.addEventListener('click', async function() {
                const val = parseInt(this.getAttribute('data-value'));
                const msgEl = document.getElementById('userRatingMsg');
                msgEl.textContent = 'Saving...';

                try {
                    const user = await getOrSignInUser();
                    if (!user) throw new Error("Could not authenticate");

                    // Use a composite doc ID so each user can only have one rating per movie
                    const ratingRef = doc(db, "user_movie_ratings", `${movieId}_${user.uid}`);
                    await setDoc(ratingRef, {
                        movieId: movieId,
                        userId: user.uid,
                        rating: val,
                        timestamp: serverTimestamp()
                    });

                    await fetchAndRenderRatings(movieId);
                } catch (err) {
                    console.error("Error saving rating:", err);
                    msgEl.textContent = 'Error saving';
                    msgEl.style.color = 'var(--error)';
                }
            });
        });

    } catch (err) {
        console.error("Error fetching ratings:", err);
    }
}

// Returns the current user, waiting for auth state if needed.
// Falls back to anonymous sign-in if there is no session at all.
function getOrSignInUser() {
    return new Promise((resolve) => {
        if (auth.currentUser !== null) {
            resolve(auth.currentUser);
            return;
        }
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            if (user) {
                resolve(user);
            } else {
                signInAnonymously(auth)
                    .then((cred) => resolve(cred.user))
                    .catch(() => resolve(null));
            }
        });
    });
}

async function submitReview(movieId) {
    const text = document.getElementById('reviewText').value.trim();
    const submitBtn = document.getElementById('submitReview');
    const msg = document.getElementById('reviewSuccessMsg');

    if (!text) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    const currentUser = await getOrSignInUser();

    // Registered users get their email prefix as the display name; guests get a random handle
    let username;
    if (currentUser && !currentUser.isAnonymous) {
        const rawUsername = currentUser.email ? currentUser.email.split('@')[0] : 'user';
        username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
    } else {
        username = `guest_user_${Math.floor(Math.random() * 90000) + 10000}`;
    }

    try {
        await addDoc(collection(db, "reviews"), {
            movieId: movieId,
            userId: currentUser ? currentUser.uid : null,
            username: username,
            reviewText: text,
            createdAt: serverTimestamp()
        });

        document.getElementById('reviewText').value = '';
        msg.textContent = "Review posted successfully!";
        msg.style.color = "var(--success)";
        msg.classList.remove('hidden');

        fetchAndRenderReviews(movieId);

        setTimeout(() => {
            msg.classList.add('hidden');
            document.getElementById('reviewFormContainer').classList.add('hidden');
            document.getElementById('toggleReviewBtn').textContent = 'Write a Review ✎';
        }, 3000);

    } catch (error) {
        console.error("Error adding review:", error);
        msg.textContent = "Error posting review. Try again.";
        msg.style.color = "var(--error)";
        msg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Review';
    }
}

async function submitRecommendation(movieId) {
    const recipient = document.getElementById('recRecipient').value.trim();
    const text = document.getElementById('recMessage').value.trim();
    const submitBtn = document.getElementById('submitRecommend');
    const msg = document.getElementById('recSuccessMsg');

    if (!recipient) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const currentUser = auth.currentUser;
    let sender = "User";
    if (currentUser && !currentUser.isAnonymous && currentUser.email) {
        sender = currentUser.email;
    }

    try {
        await addDoc(collection(db, "recommendations"), {
            movieId: movieId,
            sender: sender,
            recipient: recipient,
            message: text,
            createdAt: serverTimestamp()
        });

        document.getElementById('recRecipient').value = '';
        document.getElementById('recMessage').value = '';

        msg.textContent = "Recommendation sent!";
        msg.style.color = "var(--success)";
        msg.classList.remove('hidden');

        setTimeout(() => {
            msg.classList.add('hidden');
            document.getElementById('recommendFormContainer').classList.add('hidden');
            document.getElementById('toggleRecommendBtn').textContent = 'Recommend Movie ✦';
        }, 3000);

    } catch (error) {
        console.error("Error adding recommendation:", error);
        msg.textContent = "Error sending recommendation. Try again.";
        msg.style.color = "var(--error)";
        msg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Recommendation';
    }
}

function setupShareLinks() {
    const whatsapp = document.getElementById('whatsappShare');
    const instagram = document.getElementById('instagramShare');
    if (!whatsapp || !instagram) return;

    const pageUrl = encodeURIComponent(window.location.href);

    // Delay slightly so movie-script.js has time to populate the title from TMDB
    setTimeout(() => {
        const titleEl = document.getElementById('detailTitle');
        const title = typeof titleEl !== 'undefined' && titleEl ? encodeURIComponent(titleEl.textContent) : "this movie";

        whatsapp.href = `https://wa.me/?text=Check out ${title} on MovieMarvel! ${pageUrl}`;
        // Instagram doesn't support a direct share intent via web URL
        instagram.href = `https://www.instagram.com/`;
    }, 1500);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}
