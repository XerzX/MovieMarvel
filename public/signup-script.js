document.addEventListener('DOMContentLoaded', () => {
    // ── Sidebar ────────────────────────────────────────────────────────────
    const sideMenu    = document.getElementById('sideMenu');
    const menuToggle  = document.getElementById('menuToggle');
    const siteHeader  = document.getElementById('siteHeader');
    const mainContent = document.getElementById('mainContent');

    // Backdrop overlay (created dynamically so it doesn't clutter the HTML)
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

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sideMenu.classList.contains('open')) closeSidebar();
    });

    // ── Top-level Navigation elements ──────────────────────────────────────
    const signupBtn = document.getElementById('signupBtn');
    const logoBtn   = document.getElementById('logoBtn');

    // Hidden Panel elements
    const signupForm = document.getElementById('signupForm');
    const paymentPage = document.getElementById('paymentPage');
    const premiumPage = document.getElementById('premiumPage');

    // Interactive Form elements
    const learnMoreLink = document.getElementById('learnMore');
    const submitSignupBtn = document.getElementById('submitSignup');
    const subscribeCheckbox = document.getElementById('subscribe');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // ── Panel backdrop & scroll-lock ────────────────────────────────────────
    const panelBackdrop = document.getElementById('panelBackdrop');

    function showPanelBackdrop() {
        document.body.classList.add('panel-open');
        panelBackdrop.classList.add('visible');
    }

    function hidePanelBackdrop() {
        panelBackdrop.classList.remove('visible');
        document.body.classList.remove('panel-open');
    }

    // Utility: hide all panels and dismiss backdrop
    function hideAllPanels() {
        signupForm.classList.add('hidden');
        paymentPage.classList.add('hidden');
        premiumPage.classList.add('hidden');
        hidePanelBackdrop();
    }

    // Utility: show a specific panel
    function showPanel(panel) {
        hideAllPanels();
        panel.classList.remove('hidden');
        showPanelBackdrop();
    }

    // Clicking the backdrop closes all panels
    if (panelBackdrop) {
        panelBackdrop.addEventListener('click', () => {
            hideAllPanels();
            resetForm();
        });
    }

    // Escape key closes panels
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const anyOpen = [signupForm, paymentPage, premiumPage]
                .some(p => !p.classList.contains('hidden'));
            if (anyOpen) { hideAllPanels(); resetForm(); }
        }
    });

    // 1. Header "Sign Up" button opens the Sign Up form
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            showPanel(signupForm);
            setTimeout(() => emailInput.focus(), 100);
        });
    }

    // 2. "Learn More" link opens the Premium info block
    if (learnMoreLink) {
        learnMoreLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPanel(premiumPage);
        });
    }

    // 3. "Sign Up Now" form submission logic
    if (submitSignupBtn) {
        submitSignupBtn.addEventListener('click', (e) => {
            // Prevent the default browser form submission (which reloads the page)
            e.preventDefault();

            // Very basic empty-state validation to mimic HTML required attributes
            if (!emailInput.value.trim() || !passwordInput.value.trim()) {
                alert('Please enter both your email and password to continue.');
                return;
            }

            // Route based on whether they checked the premium subscription box
            if (subscribeCheckbox && subscribeCheckbox.checked) {
                showPanel(paymentPage);
            } else {
                alert('Account created successfully! Welcome to MovieMarvel.');
                hideAllPanels();
                resetForm();
            }
        });
    }

    // 4. Dummy Payment button handling to demonstrate the flow completion
    const paymentButtons = document.querySelectorAll('.payment-btn');
    paymentButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Subscription payment successful! Welcome to MovieMarvel Premium.');

            // Go back to absolute default state
            hideAllPanels();
            resetForm();
        });
    });

    // 5. Cancel buttons to close panels and return to unobstructed landing
    const cancelBtns = document.querySelectorAll('.cancel-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.closest('#premiumPage')) {
                // If closing premium page, go back to signup form
                showPanel(signupForm);
            } else {
                hideAllPanels();
                resetForm();
            }
        });
    });

    // 6. Logo click to go back to landing page natively without reload
    if (logoBtn) {
        logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllPanels();
            resetForm();
        });
    }

    // Helper function to reset form state after a completed action
    function resetForm() {
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (subscribeCheckbox) subscribeCheckbox.checked = false;
    }
});
