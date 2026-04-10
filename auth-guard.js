/**
 * JobLynk Auth Guard
 * Include this script on protected pages (dashboard, profile, etc.)
 * It checks the session and redirects to sign-in if not logged in.
 * 
 * Usage:
 *   <script src="auth-guard.js"></script>                         — any logged-in user
 *   <script src="auth-guard.js" data-role="recruiter"></script>   — recruiter only
 *   <script src="auth-guard.js" data-role="admin"></script>       — admin only
 */
// Capture script ref synchronously (before any await nullifies document.currentScript)
const _authScript = document.currentScript || document.querySelector('script[src*="auth-guard"]');

(async function authGuard() {
    try {
        const res = await fetch('api/auth/session.php', {
            credentials: 'include',
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error('[AuthGuard] Session endpoint returned', res.status);
            window.location.replace('sign-in.html');
            return;
        }

        let data;
        try {
            data = await res.json();
        } catch (parseErr) {
            console.error('[AuthGuard] Invalid JSON from session endpoint:', parseErr);
            window.location.replace('sign-in.html');
            return;
        }

        if (!data.loggedIn) {
            window.location.replace('sign-in.html');
            return;
        }

        // Check role restriction if specified
        const requiredRole = _authScript?.getAttribute('data-role');
        
        // Strict mapping of dashboard pages to roles
        const path = window.location.pathname.toLowerCase();
        let correctDashboard = 'dashboard.html';
        if (data.user.role === 'recruiter') correctDashboard = 'recruiter-overview.html';
        if (data.user.role === 'admin') correctDashboard = 'admin-overview.html';

        // Redirect if they are explicitly forbidden (via data-role) OR if they are on the wrong dashboard
        const isWrongDashboard = (path.includes('dashboard') && !path.includes(correctDashboard));
        
        if ((requiredRole && data.user.role !== requiredRole) || isWrongDashboard) {
            // Wrong role — redirect to their correct dashboard
            window.location.replace(correctDashboard);
            return;
        }

        // Store user data for page scripts to use
        window.__JobLynkUser = data.user;

        // Wait for body to be available before DOM operations
        if (!document.body) {
            await new Promise(resolve => {
                if (document.readyState !== 'loading') resolve();
                else document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Impersonation Banner
        if (data.user.is_impersonating) {
            const banner = document.createElement('div');
            banner.style.cssText = 'background: #FEF2F2; color: #DC2626; padding: 10px 16px; text-align: center; font-weight: 600; font-size: 0.9rem; z-index: 9999; border: 1px solid #FCA5A5; border-radius: 8px; display: flex; justify-content: center; gap: 15px; align-items: center; margin-bottom: 16px;';
            banner.innerHTML = `
                <span><i class="fa-solid fa-user-secret"></i> You are impersonating <strong>${data.user.name}</strong> (${data.user.email}).</span>
                <button onclick="window.location.href='api/admin/impersonate.php?revert=1'" style="background: #DC2626; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 0.8rem;">Return to Admin</button>
            `;
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.prepend(banner);
            } else {
                document.body.prepend(banner);
            }
        }

        // Populate user name in any element with data-user-name attribute
        document.querySelectorAll('[data-user-name]').forEach(el => {
            el.textContent = data.user.name;
            if (el.tagName === 'OPTION' || el.tagName === 'INPUT') {
                el.value = data.user.name;
            }
        });

        // Populate user email in any element with data-user-email attribute
        document.querySelectorAll('[data-user-email]').forEach(el => {
            el.textContent = data.user.email;
        });

        // Populate user initials in any element with data-user-initials attribute
        const initials = data.user.name
            ? data.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            : '?';
        document.querySelectorAll('[data-user-initials]').forEach(el => {
            el.textContent = initials;
        });

        // Show the page (in case it was hidden to prevent flash)
        document.body.classList.add('auth-ready');

    } catch (err) {
        console.error('[AuthGuard] Unexpected error:', err);
        window.location.replace('sign-in.html');
    }
})();
