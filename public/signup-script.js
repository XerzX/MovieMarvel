document.addEventListener('DOMContentLoaded', () => {
    // Top-level Navigation elements
    const signupBtn = document.getElementById('signupBtn');
    const logoBtn = document.getElementById('logoBtn');

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

    // Utility function to hide all dynamic panels
    function hideAllPanels() {
        signupForm.classList.add('hidden');
        paymentPage.classList.add('hidden');
        premiumPage.classList.add('hidden');
    }

    // 1. Header "Sign Up" button opens the Sign Up form
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            // Un-hide the signup form
            hideAllPanels();
            signupForm.classList.remove('hidden');

            // Optionally, focus the email input immediately when opening the form
            setTimeout(() => emailInput.focus(), 100);
        });
    }

    // 2. "Learn More" link opens the Premium info block
    if (learnMoreLink) {
        learnMoreLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllPanels();
            premiumPage.classList.remove('hidden');
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
                // Navigate to payment page
                hideAllPanels();
                paymentPage.classList.remove('hidden');
            } else {
                // Standard un-subscribed sign up flow
                alert('Account created successfully! Welcome to MovieMarvel.');

                // Hide panels and reset form
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
                hideAllPanels();
                signupForm.classList.remove('hidden');
            } else {
                // Otherwise close completely
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
