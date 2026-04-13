document.addEventListener('DOMContentLoaded', () => {
    // -- Sidebar --
    const sideMenu = document.getElementById('sideMenu');
    const menuToggle = document.getElementById('menuToggle');
    const siteHeader = document.getElementById('siteHeader');
    const mainContent = document.getElementById('mainContent');

    // Backdrop created in JS to avoid extra markup in every HTML file
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 999;
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        transition: opacity 0.3s ease;
        opacity: 0;
    `;
    document.body.appendChild(backdrop);

    function openSidebar() {
        sideMenu.classList.add('open');
        menuToggle.setAttribute('aria-expanded', 'true');
        backdrop.style.display = 'block';
        requestAnimationFrame(() => { backdrop.style.opacity = '1'; });
    }

    function closeSidebar() {
        sideMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        backdrop.style.opacity = '0';
        setTimeout(() => { backdrop.style.display = 'none'; }, 300);
    }

    function toggleSidebar() {
        sideMenu.classList.contains('open') ? closeSidebar() : openSidebar();
    }

    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sideMenu.classList.contains('open')) closeSidebar();
    });

    // -- Navigation & Panel Elements --
    const signupBtn = document.getElementById('signupBtn');
    const logoBtn = document.getElementById('logoBtn');

    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const paymentPage = document.getElementById('paymentPage');
    const premiumPage = document.getElementById('premiumPage');

    const learnMoreLink = document.getElementById('learnMore');
    const submitSignupBtn = document.getElementById('submitSignup');
    const subscribeCheckbox = document.getElementById('subscribe');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const submitLoginBtn = document.getElementById('submitLogin');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const switchToSignupBtn = document.getElementById('switchToSignupBtn');

    // -- Panel Backdrop & Scroll Lock --
    const panelBackdrop = document.getElementById('panelBackdrop');

    function showPanelBackdrop() {
        document.body.classList.add('panel-open');
        panelBackdrop.classList.add('visible');
    }

    function hidePanelBackdrop() {
        panelBackdrop.classList.remove('visible');
        document.body.classList.remove('panel-open');
    }

    function hideAllPanels() {
        if (signupForm) signupForm.classList.add('hidden');
        if (loginForm) loginForm.classList.add('hidden');
        if (paymentPage) paymentPage.classList.add('hidden');
        if (premiumPage) premiumPage.classList.add('hidden');
        hidePanelBackdrop();
    }

    function showPanel(panel) {
        hideAllPanels();
        panel.classList.remove('hidden');
        showPanelBackdrop();
    }

    if (panelBackdrop) {
        panelBackdrop.addEventListener('click', () => {
            hideAllPanels();
            resetForm();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const anyOpen = [signupForm, loginForm, paymentPage, premiumPage]
                .some(p => p && !p.classList.contains('hidden'));
            if (anyOpen) { hideAllPanels(); resetForm(); }
        }
    });

    // -- Panel Triggers --
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            showPanel(signupForm);
            setTimeout(() => emailInput.focus(), 100);
        });
    }

    if (switchToSignupBtn) {
        switchToSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPanel(signupForm);
            setTimeout(() => emailInput.focus(), 100);
        });
    }

    document.querySelectorAll('.auth-actions .btn-login').forEach(btn => {
        btn.addEventListener('click', () => {
            closeSidebar();
            showPanel(loginForm);
            setTimeout(() => loginEmailInput.focus(), 150);
        });
    });

    document.querySelectorAll('.auth-actions .btn-signup').forEach(btn => {
        btn.addEventListener('click', () => {
            closeSidebar();
            showPanel(signupForm);
            setTimeout(() => emailInput.focus(), 150);
        });
    });

    if (learnMoreLink) {
        learnMoreLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPanel(premiumPage);
        });
    }

    // -- Sign Up Form Submission --
    if (submitSignupBtn) {
        submitSignupBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!emailInput.value.trim() || !passwordInput.value.trim()) {
                alert('Please enter both your email and password to continue.');
                return;
            }

            const originalBtnText = submitSignupBtn.textContent;
            submitSignupBtn.textContent = 'Registering...';
            submitSignupBtn.disabled = true;

            const res = await window.MovieMarvelAuth.registerUser(emailInput.value.trim(), passwordInput.value.trim());

            submitSignupBtn.textContent = originalBtnText;
            submitSignupBtn.disabled = false;

            if (!res.success) {
                alert(res.message);
                return;
            }

            // If the user subscribed, show the payment panel next
            if (subscribeCheckbox && subscribeCheckbox.checked) {
                showPanel(paymentPage);
            } else {
                hideAllPanels();
                resetForm();
            }
        });
    }

    // -- Login Form Submission --
    if (submitLoginBtn) {
        submitLoginBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!loginEmailInput.value.trim() || !loginPasswordInput.value.trim()) {
                alert('Please enter both your email and password.');
                return;
            }

            const originalBtnText = submitLoginBtn.textContent;
            submitLoginBtn.textContent = 'Logging in...';
            submitLoginBtn.disabled = true;

            const res = await window.MovieMarvelAuth.loginUser(loginEmailInput.value.trim(), loginPasswordInput.value.trim());

            submitLoginBtn.textContent = originalBtnText;
            submitLoginBtn.disabled = false;

            if (!res.success) {
                alert(res.message);
                return;
            }

            hideAllPanels();
            resetForm();
        });
    }

    // -- Payment Buttons (demo flow) --
    const paymentButtons = document.querySelectorAll('.payment-btn');
    paymentButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Subscription payment successful! Welcome to MovieMarvel Premium.');
            hideAllPanels();
            resetForm();
        });
    });

    // -- Close / Cancel Buttons --
    const cancelBtns = document.querySelectorAll('.cancel-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.closest('#premiumPage')) {
                // Return to signup instead of fully closing
                showPanel(signupForm);
            } else {
                hideAllPanels();
                resetForm();
            }
        });
    });

    // -- Logo Click --
    if (logoBtn) {
        logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllPanels();
            resetForm();
            if (typeof window.resetGallery === 'function') window.resetGallery();
        });
    }

    // -- Logout --
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (window.MovieMarvelAuth && window.MovieMarvelAuth.logoutUser) {
                const res = await window.MovieMarvelAuth.logoutUser();
                if (res.success) {
                    if (sideMenu && sideMenu.classList.contains('open')) closeSidebar();
                } else {
                    alert("Failed to logout: " + res.message);
                }
            }
        });
    });

    function resetForm() {
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (loginEmailInput) loginEmailInput.value = '';
        if (loginPasswordInput) loginPasswordInput.value = '';
        if (subscribeCheckbox) subscribeCheckbox.checked = false;
    }
});
