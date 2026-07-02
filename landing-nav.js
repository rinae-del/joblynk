/**
 * JobLynk — shared public landing navigation
 * Single source of truth for nav links, mobile menu, and active states.
 */
(() => {
    const NAV_ITEMS = [
        { id: 'home', label: 'Home', href: 'home.html' },
        { id: 'jobs', label: 'Jobs', href: 'jobs.html' },
        { id: 'cv', label: 'CV Builder', href: 'home.html#cv-start' },
        { id: 'recruiters', label: 'Recruiters', href: 'recruiter-pricing.html' },
        { id: 'faq', label: 'FAQ', href: 'home.html#faq' },
    ];

    const DEFAULT_ACTIONS = [
        { id: 'signin', label: 'Sign in', href: 'sign-in.html', className: 'btn-landing btn-landing-outline' },
        { id: 'signup', label: 'Sign up', href: 'sign-up.html', className: 'btn-landing btn-landing-outline' },
        { id: 'getstarted', label: 'Get started free', href: 'sign-up.html', className: 'btn-landing btn-landing-primary' },
    ];

    function getBasePrefix() {
        const meta = document.querySelector('meta[name="joblynk-base"]');
        if (meta?.content) {
            const base = meta.content.trim();
            return base.endsWith('/') ? base : `${base}/`;
        }
        if (/^\/job\//.test(window.location.pathname)) return '../';
        return '';
    }

    function href(path) {
        const prefix = getBasePrefix();
        if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
        return `${prefix}${path}`;
    }

    function detectActiveId() {
        const override = document.body?.dataset?.navActive || document.getElementById('landingNavMount')?.dataset?.navActive;
        if (override) return override;

        const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (page === 'home.html') return 'home';
        if (page === 'jobs.html') return 'jobs';
        if (page === 'recruiter-pricing.html') return 'recruiters';
        if (page === 'job.php' || /^\/job\//.test(window.location.pathname)) return 'jobs';
        return '';
    }

    function getDashboardHref(role) {
        if (role === 'recruiter') return href('recruiter-overview.html');
        if (role === 'admin') return href('admin-overview.html');
        return href('dashboard.html');
    }

    function getActions() {
        if (document.body?.dataset?.loggedIn === '1') {
            const role = document.body.dataset.userRole || '';
            return [{
                id: 'account',
                label: 'My account',
                href: getDashboardHref(role),
                className: 'btn-landing btn-landing-primary',
            }];
        }
        return DEFAULT_ACTIONS.map(action => ({
            ...action,
            href: href(action.href),
        }));
    }

    function escAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderNav(activeId) {
        const actions = getActions();
        const navExtraClass = document.body?.classList.contains('pricing-page') ? ' pricing-nav' : '';

        const linksHtml = NAV_ITEMS.map(item => {
            const isActive = activeId === item.id;
            return `<a href="${escAttr(href(item.href))}" class="landing-nav-link${isActive ? ' is-active' : ''}"${isActive ? ' aria-current="page"' : ''}>${escAttr(item.label)}</a>`;
        }).join('');

        const actionsHtml = actions.map(action =>
            `<a href="${escAttr(action.href)}" class="${escAttr(action.className)}" data-nav-action="${escAttr(action.id)}">${escAttr(action.label)}</a>`
        ).join('');

        const mobileLinksHtml = NAV_ITEMS.map(item => {
            const isActive = activeId === item.id;
            return `<a href="${escAttr(href(item.href))}" class="mobile-nav-link${isActive ? ' is-active' : ''}">${escAttr(item.label)}</a>`;
        }).join('');

        const mobileActionsHtml = actions.map(action =>
            `<a href="${escAttr(action.href)}" class="mobile-nav-action">${escAttr(action.label)}</a>`
        ).join('');

        return `
            <nav class="landing-nav${navExtraClass}" id="landingNav">
                <a href="${escAttr(href('home.html'))}" class="landing-nav-logo" aria-label="JobLynk home">
                    <img src="${escAttr(href('images/logo.png'))}" alt="" class="landing-logo-img" width="96" height="28">
                    <span class="landing-logo-text">JobLynk</span>
                </a>
                <div class="landing-nav-links" role="navigation" aria-label="Main">
                    ${linksHtml}
                </div>
                <div class="landing-nav-actions">
                    ${actionsHtml}
                </div>
                <button class="landing-nav-hamburger" id="navHamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavMenu">
                    <i class="fa-solid fa-bars" aria-hidden="true"></i>
                </button>
            </nav>
            <div class="mobile-nav-menu" id="mobileNavMenu" aria-label="Mobile navigation">
                ${mobileLinksHtml}
                <div class="mobile-nav-divider" role="presentation"></div>
                ${mobileActionsHtml}
            </div>
        `;
    }

    function syncNavHeight() {
        const nav = document.getElementById('landingNav') || document.querySelector('.landing-nav');
        if (!nav) return;
        const height = `${nav.offsetHeight}px`;
        document.documentElement.style.setProperty('--landing-nav-h', height);
        document.documentElement.style.setProperty('--jb-nav-h', height);
    }

    function closeMobileMenu() {
        const menu = document.getElementById('mobileNavMenu');
        const hamburger = document.getElementById('navHamburger');
        if (!menu || !hamburger) return;
        menu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        const icon = hamburger.querySelector('i');
        if (icon) {
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-xmark');
        }
    }

    function bindNav() {
        const hamburger = document.getElementById('navHamburger');
        const menu = document.getElementById('mobileNavMenu');
        if (hamburger && menu) {
            hamburger.addEventListener('click', () => {
                const isOpen = menu.classList.toggle('open');
                hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
                const icon = hamburger.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars', !isOpen);
                    icon.classList.toggle('fa-xmark', isOpen);
                }
            });

            menu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', closeMobileMenu);
            });
        }

        syncNavHeight();
        window.addEventListener('resize', syncNavHeight, { passive: true });
    }

    function mountNav() {
        const mount = document.getElementById('landingNavMount');
        const activeId = detectActiveId();

        if (mount) {
            mount.innerHTML = renderNav(activeId);
            bindNav();
            return;
        }

        // Fallback: patch active state on existing markup
        NAV_ITEMS.forEach(item => {
            document.querySelectorAll(`.landing-nav-link[href*="${item.href}"]`).forEach(link => {
                link.classList.toggle('is-active', activeId === item.id);
            });
        });
        bindNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountNav);
    } else {
        mountNav();
    }

    window.JobLynkNav = { syncNavHeight, closeMobileMenu, remount: mountNav, NAV_ITEMS };
})();
