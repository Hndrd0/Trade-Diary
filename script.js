document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Clerk SDK Init & Authentication Flow
    const clerkPublishableKey = "pk_test_ZHJpdmVuLWJhc3MtOC5jbGVyay5hY2NvdW50cy5kZXYk";

    window.addEventListener('load', async () => {
        if (!window.Clerk) {
            console.error("Clerk SDK failed to load.");
            return;
        }

        try {
            await window.Clerk.load();
            
            const authContainer = document.getElementById('clerk-auth-container');
            const authContainerMobile = document.getElementById('clerk-auth-container-mobile');
            const heroCtaClerk = document.getElementById('hero-cta-clerk');

            if (window.Clerk.user) {
                // User is authenticated
                const dashboardButtonHtml = `<a href="app.html" class="btn-nav-login" style="background: var(--primary); border: none; font-weight: 600;">Go to Dashboard</a>`;
                const dashboardButtonMobileHtml = `<a href="app.html" class="mobile-login" style="display: block; text-align: center; background: var(--primary); border-radius: 8px; font-weight: 600; padding: 0.75rem;">Go to Dashboard</a>`;
                const heroCtaHtml = `
                    <a href="app.html" class="btn-primary">
                        <i data-lucide="layout-dashboard"></i>
                        Go to Dashboard
                    </a>`;

                if (authContainer) authContainer.innerHTML = dashboardButtonHtml;
                if (authContainerMobile) authContainerMobile.innerHTML = dashboardButtonMobileHtml;
                if (heroCtaClerk) {
                    heroCtaClerk.innerHTML = heroCtaHtml;
                    lucide.createIcons();
                }
            } else {
                // User is not authenticated
                const signInBtnId = 'clerk-signin-btn';
                const signInBtnMobileId = 'clerk-signin-btn-mobile';
                const heroGetStartedId = 'clerk-get-started';

                if (authContainer) {
                    authContainer.innerHTML = `<button id="${signInBtnId}" class="btn-nav-login" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer;">Sign In</button>`;
                    document.getElementById(signInBtnId).addEventListener('click', () => {
                        window.Clerk.openSignIn({
                            afterSignInUrl: window.location.origin + '/app.html',
                            afterSignUpUrl: window.location.origin + '/app.html'
                        });
                    });
                }

                if (authContainerMobile) {
                    authContainerMobile.innerHTML = `<button id="${signInBtnMobileId}" class="mobile-login" style="width: 100%; text-align: center; border: 1px solid var(--border-color); background: transparent; cursor: pointer; padding: 0.75rem; border-radius: 8px;">Sign In</button>`;
                    document.getElementById(signInBtnMobileId).addEventListener('click', () => {
                        window.Clerk.openSignIn({
                            afterSignInUrl: window.location.origin + '/app.html',
                            afterSignUpUrl: window.location.origin + '/app.html'
                        });
                    });
                }

                if (heroCtaClerk) {
                    heroCtaClerk.innerHTML = `
                        <button id="${heroGetStartedId}" class="btn-primary" style="cursor: pointer; border: none; font-family: inherit;">
                            <i data-lucide="zap"></i>
                            Get Started
                        </button>`;
                    lucide.createIcons();
                    document.getElementById(heroGetStartedId).addEventListener('click', () => {
                        window.Clerk.openSignUp({
                            afterSignInUrl: window.location.origin + '/app.html',
                            afterSignUpUrl: window.location.origin + '/app.html'
                        });
                    });
                }
            }
        } catch (err) {
            console.error("Clerk error during load/init:", err);
        }
    });

    // Mobile Menu Toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-q');
        
        questionBtn.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });

    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            // Close mobile menu if open
            if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
            }

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });
});
