/**
 * Joblynk – Shared UI Components
 * Renders sidebar, mobile topbar, bottom tab-bar, and breadcrumb.
 *
 * Usage:
 *   <div id="app-sidebar" data-role="admin" data-active="users"></div>
 *   <div id="app-topbar" data-label="Admin"></div>
 *   <nav id="app-breadcrumb" data-crumbs='[{"label":"Admin","href":"admin-overview.html"},{"label":"Users"}]'></nav>
 */

(function () {
    'use strict';

    // ── Navigation definitions ──
    const NAV = {
        admin: {
            badge: { text: 'ADMIN', class: 'admin-badge-logo' },
            sidebarClass: 'admin-sidebar',
            topbarLabel: 'Admin',
            items: [
                { id: 'navOverview',     key: 'overview',     icon: 'fa-solid fa-gauge-high',       label: 'Overview',      href: 'admin-overview.html' },
                { id: 'navUsers',        key: 'users',        icon: 'fa-solid fa-users',            label: 'Users',         href: 'admin-users.html' },
                { id: 'navRecruiters',   key: 'recruiters',   icon: 'fa-solid fa-building',         label: 'Recruiters',    href: 'admin-recruiters.html' },
                { id: 'navJobs',         key: 'jobs',         icon: 'fa-solid fa-briefcase',         label: 'Job Listings',  href: 'admin-jobs.html' },
                { id: 'navApplications', key: 'applications', icon: 'fa-solid fa-file-signature',   label: 'Applications',  href: 'admin-applications.html' },
                { id: 'navDocuments',    key: 'documents',    icon: 'fa-solid fa-folder-open',      label: 'Documents',     href: 'admin-documents.html' },
                { id: 'navReports',      key: 'reports',      icon: 'fa-solid fa-chart-line',       label: 'Reports',       href: 'admin-reports.html' },
                { id: 'navSettings',     key: 'settings',     icon: 'fa-solid fa-gear',             label: 'Settings',      href: 'admin-settings.html' },
            ],
            // Bottom tab bar: first 4 items + "More" drawer
            tabBarItems: [
                { key: 'overview',     icon: 'fa-solid fa-gauge-high',     label: 'Home',     href: 'admin-overview.html' },
                { key: 'users',        icon: 'fa-solid fa-users',          label: 'Users',    href: 'admin-users.html' },
                { key: 'jobs',         icon: 'fa-solid fa-briefcase',       label: 'Jobs',     href: 'admin-jobs.html' },
                { key: 'reports',      icon: 'fa-solid fa-chart-line',     label: 'Reports',  href: 'admin-reports.html' },
            ],
            moreItems: [
                { key: 'recruiters',   icon: 'fa-solid fa-building',       label: 'Recruiters',   href: 'admin-recruiters.html' },
                { key: 'applications', icon: 'fa-solid fa-file-signature', label: 'Applications', href: 'admin-applications.html' },
                { key: 'documents',    icon: 'fa-solid fa-folder-open',    label: 'Documents',    href: 'admin-documents.html' },
                { key: 'settings',     icon: 'fa-solid fa-gear',           label: 'Settings',     href: 'admin-settings.html' },
            ],
            userIcon: { icon: 'fa-solid fa-shield-halved', bg: 'rgba(220,38,38,0.2)', color: '#FCA5A5' },
            bottomLinks: [],
            ctaButton: null,
        },
        recruiter: {
            badge: { text: 'RECRUITER', class: 'recruiter-badge-logo' },
            sidebarClass: '',
            topbarLabel: 'Recruiter',
            items: [
                { id: 'navDashboard',  key: 'overview',    icon: 'fa-solid fa-chart-pie',    label: 'Overview',    href: 'recruiter-overview.html' },
                { id: 'navMyJobs',     key: 'my-jobs',     icon: 'fa-solid fa-briefcase',    label: 'My Jobs',     href: 'recruiter-my-jobs.html' },
                { id: 'navCandidates', key: 'candidates',  icon: 'fa-solid fa-users',        label: 'Candidates',  href: 'recruiter-candidates.html' },
                { id: 'navMessages',   key: 'messages',    icon: 'fa-regular fa-envelope',   label: 'Messages',    href: 'recruiter-messages.html' },
                { id: 'navPricing',    key: 'pricing',     icon: 'fa-solid fa-tag',          label: 'Pricing',     href: 'recruiter-pricing.html' },
            ],
            tabBarItems: [
                { key: 'overview',   icon: 'fa-solid fa-chart-pie',  label: 'Home',       href: 'recruiter-overview.html' },
                { key: 'my-jobs',    icon: 'fa-solid fa-briefcase',  label: 'My Jobs',    href: 'recruiter-my-jobs.html' },
                { key: 'candidates', icon: 'fa-solid fa-users',      label: 'Candidates', href: 'recruiter-candidates.html' },
                { key: 'messages',   icon: 'fa-regular fa-envelope', label: 'Messages',   href: 'recruiter-messages.html' },
            ],
            moreItems: [
                { key: 'pricing', icon: 'fa-solid fa-tag', label: 'Pricing', href: 'recruiter-pricing.html' },
            ],
            userIcon: { icon: 'fa-solid fa-building', bg: 'rgba(126,34,206,0.2)', color: '#c084fc' },
            bottomLinks: [
                { icon: 'fa-solid fa-shield-halved',            label: 'Super Admin',           href: 'admin-overview.html' },
                { icon: 'fa-solid fa-arrow-right-from-bracket', label: 'Switch to Job Seeker',  href: 'dashboard.html' },
            ],
            ctaButton: { icon: 'fa-solid fa-plus', label: 'Post a Job', href: 'recruiter-post-job.html', id: 'btnPostJobSidebar' },
        },
    };

    // ── Helpers ──
    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function detectActiveKey(items) {
        const path = window.location.pathname.split('/').pop().toLowerCase();
        for (const item of items) {
            if (item.href.toLowerCase() === path) return item.key;
        }
        return items[0]?.key || '';
    }

    // ── Render Sidebar ──
    function renderSidebar() {
        const el = document.getElementById('app-sidebar');
        if (!el) return;

        const role = el.dataset.role;
        const cfg = NAV[role];
        if (!cfg) return;

        const activeKey = el.dataset.active || detectActiveKey(cfg.items);

        const navItems = cfg.items.map(item =>
            `<a href="${esc(item.href)}" class="nav-item${item.key === activeKey ? ' active' : ''}" id="${item.id}"><i class="${item.icon}"></i> <span>${esc(item.label)}</span></a>`
        ).join('\n            ');

        const bottomLinks = cfg.bottomLinks.map(link =>
            `<a href="${esc(link.href)}" class="nav-item"><i class="${link.icon}"></i> <span>${esc(link.label)}</span></a>`
        ).join('\n            ');

        const ctaHtml = cfg.ctaButton
            ? `<a href="${esc(cfg.ctaButton.href)}" class="sidebar-new-btn" id="${cfg.ctaButton.id}"><i class="${cfg.ctaButton.icon}"></i> ${esc(cfg.ctaButton.label)}</a>`
            : '';

        const html = `
    <aside class="sidebar ${cfg.sidebarClass}" id="sidebar">
        <div class="sidebar-top">
            <div class="sidebar-logo">
                <span class="logo-text">Joblynk</span>
                <span class="${cfg.badge.class}">${esc(cfg.badge.text)}</span>
            </div>
            ${ctaHtml}
        </div>
        <nav class="sidebar-nav">
            ${navItems}
        </nav>
        <div class="sidebar-bottom">
            <div class="sidebar-user">
                <div class="user-avatar" style="background:${cfg.userIcon.bg};color:${cfg.userIcon.color}"><i class="${cfg.userIcon.icon}"></i></div>
                <div class="user-info">
                    <span class="user-name" data-user-name>Loading...</span>
                    <span class="user-email" data-user-email>loading...</span>
                </div>
            </div>
            ${bottomLinks}
        </div>
    </aside>`;

        el.outerHTML = html;
    }

    // ── Render Mobile Topbar ──
    function renderTopbar() {
        const el = document.getElementById('app-topbar');
        if (!el) return;

        const label = el.dataset.label || 'Dashboard';
        const role = el.dataset.role || (document.getElementById('sidebar')?.classList.contains('admin-sidebar') ? 'admin' : '');

        el.outerHTML = `
    <button class="mobile-hamburger" id="btnHamburger"><i class="fa-solid fa-bars"></i></button>
    <div class="mobile-topbar" id="mobileTopbar">
        <div class="topbar-brand">
            <span class="topbar-logo">Joblynk</span>
            <span class="topbar-badge">${esc(label)}</span>
        </div>
        <button class="topbar-hamburger" id="btnHamburgerTop"><i class="fa-solid fa-bars"></i></button>
    </div>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>`;
    }

    // ── Render Bottom Tab Bar (mobile-native navigation) ──
    function renderBottomTabBar() {
        const sidebarEl = document.getElementById('sidebar');
        if (!sidebarEl) return;

        const role = sidebarEl.classList.contains('admin-sidebar') ? 'admin' : 'recruiter';
        const cfg = NAV[role];
        if (!cfg || !cfg.tabBarItems) return;

        const activeKey = detectActiveKey(cfg.items);
        // Check if active page is one of the "more" items
        const isMoreActive = cfg.moreItems && cfg.moreItems.some(m => m.key === activeKey);

        const tabs = cfg.tabBarItems.map(tab => {
            const isActive = tab.key === activeKey;
            return `<a href="${esc(tab.href)}" class="btab-item${isActive ? ' btab-active' : ''}">
                <i class="${tab.icon}"></i>
                <span>${esc(tab.label)}</span>
            </a>`;
        }).join('');

        const moreItems = (cfg.moreItems || []).map(item => {
            const isActive = item.key === activeKey;
            return `<a href="${esc(item.href)}" class="btab-more-item${isActive ? ' btab-more-active' : ''}">
                <i class="${item.icon}"></i>
                <span>${esc(item.label)}</span>
            </a>`;
        }).join('');

        const bar = document.createElement('div');
        bar.innerHTML = `
    <nav class="btab-bar" id="bottomTabBar">
        ${tabs}
        <button class="btab-item btab-more-btn${isMoreActive ? ' btab-active' : ''}" id="btabMoreBtn" type="button">
            <i class="fa-solid fa-ellipsis"></i>
            <span>More</span>
        </button>
    </nav>
    <div class="btab-more-sheet" id="btabMoreSheet">
        <div class="btab-more-header">
            <span>More</span>
            <button class="btab-more-close" id="btabMoreClose" type="button"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="btab-more-grid">${moreItems}</div>
    </div>
    <div class="btab-more-overlay" id="btabMoreOverlay"></div>`;

        document.body.appendChild(bar);

        // Wire up More sheet
        const moreBtn = document.getElementById('btabMoreBtn');
        const moreSheet = document.getElementById('btabMoreSheet');
        const moreOverlay = document.getElementById('btabMoreOverlay');
        const moreClose = document.getElementById('btabMoreClose');

        function openMore() {
            moreSheet.classList.add('btab-sheet-open');
            moreOverlay.classList.add('btab-overlay-active');
        }
        function closeMore() {
            moreSheet.classList.remove('btab-sheet-open');
            moreOverlay.classList.remove('btab-overlay-active');
        }

        if (moreBtn) moreBtn.addEventListener('click', openMore);
        if (moreClose) moreClose.addEventListener('click', closeMore);
        if (moreOverlay) moreOverlay.addEventListener('click', closeMore);
    }

    // ── Render Breadcrumb ──
    function renderBreadcrumb() {
        const el = document.getElementById('app-breadcrumb');
        if (!el) return;

        let crumbs;
        try { crumbs = JSON.parse(el.dataset.crumbs); } catch { return; }
        if (!Array.isArray(crumbs) || crumbs.length === 0) return;

        const parts = crumbs.map((c, i) => {
            if (i === crumbs.length - 1) {
                return `<span class="breadcrumb-current">${esc(c.label)}</span>`;
            }
            return `<a href="${esc(c.href)}" class="breadcrumb-link">${esc(c.label)}</a><span class="breadcrumb-sep">/</span>`;
        }).join('\n        ');

        el.classList.add('breadcrumb');
        el.setAttribute('aria-label', 'Breadcrumb');
        el.innerHTML = parts;
    }

    // ── Initialize on DOM ready ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        renderSidebar();
        renderTopbar();
        renderBreadcrumb();
        renderBottomTabBar();

        // Wire up mobile sidebar toggle
        const btnH = document.getElementById('btnHamburger');
        const btnHT = document.getElementById('btnHamburgerTop');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        function toggle() {
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        }
        function close() {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }

        if (btnH)   btnH.addEventListener('click', toggle);
        if (btnHT)  btnHT.addEventListener('click', toggle);
        if (overlay) overlay.addEventListener('click', close);

        // Expose close for other scripts
        window.closeMobileSidebar = close;
        window.toggleMobileSidebar = toggle;
    }
})();
