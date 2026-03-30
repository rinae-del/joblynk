/**
 * Joblynk Auth Guard
 * Include this script on protected pages (dashboard, profile, etc.)
 * It checks the session and redirects to sign-in if not logged in.
 * 
 * Usage:
 *   <script src="auth-guard.js"></script>                         — any logged-in user
 *   <script src="auth-guard.js" data-role="recruiter"></script>   — recruiter only
 *   <script src="auth-guard.js" data-role="admin"></script>       — admin only
 */
(async function authGuard() {
    try {
        const res = await fetch('api/auth/session.php', {
            credentials: 'include'
        });
        const data = await res.json();

        if (!data.loggedIn) {
            window.location.replace('sign-in.html');
            return;
        }

        // Check role restriction if specified
        const script = document.currentScript || document.querySelector('script[src*="auth-guard"]');
        const requiredRole = script?.getAttribute('data-role');
        
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
            return; // Stop execution
        }

        // Store user data for page scripts to use
        window.__joblynkUser = data.user;

        // Impersonation Banner
        if (data.user.is_impersonating) {
            const banner = document.createElement('div');
            banner.style.cssText = 'background: #FEF2F2; color: #DC2626; padding: 10px; text-align: center; font-weight: 600; font-size: 0.9rem; position: sticky; top: 0; z-index: 9999; border-bottom: 1px solid #FCA5A5; display: flex; justify-content: center; gap: 15px; align-items: center;';
            banner.innerHTML = `
                <span><i class="fa-solid fa-user-secret"></i> You are impersonating <strong>${data.user.name}</strong> (${data.user.email}).</span>
                <button onclick="window.location.href='api/admin/impersonate.php?revert=1'" style="background: #DC2626; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 0.8rem;">Return to Admin</button>
            `;
            document.body.prepend(banner);
        }

        // Populate user name in any element with data-user-name attribute
        document.querySelectorAll('[data-user-name]').forEach(el => {
            el.textContent = data.user.name;
            // Also set value for option/input elements
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
        // If the API call fails, redirect to sign-in as a safety measure
        window.location.replace('sign-in.html');
    }
})();
