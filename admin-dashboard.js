/* ======================================
   ADMIN DASHBOARD – INTERACTIVITY
   ====================================== */

const adminState = {
    users: [],
    jobs: [],
    applications: [],
    documents: [],
};

// ── HTML Escape helper (prevent XSS) ──
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── View Navigation (redirects to separate pages) ──
function switchView(viewName) {
    const pageMap = {
        'overview': 'admin-overview.html',
        'users': 'admin-users.html',
        'recruiters': 'admin-recruiters.html',
        'jobs': 'admin-jobs.html',
        'applications': 'admin-applications.html',
        'documents': 'admin-documents.html',
        'reports': 'admin-reports.html',
        'settings': 'admin-settings.html'
    };
    window.location.href = pageMap[viewName] || 'admin-overview.html';
}

// ── Mobile Sidebar ──
const btnHamburger = document.getElementById('btnHamburger');
const btnHamburgerTop = document.getElementById('btnHamburgerTop');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleMobileSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
}

if (btnHamburger) btnHamburger.addEventListener('click', toggleMobileSidebar);
if (btnHamburgerTop) btnHamburgerTop.addEventListener('click', toggleMobileSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// ── Animated Counters ──
function animateCounters() {
    const counters = document.querySelectorAll('[data-target]');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const isCurrency = counter.classList.contains('kpi-currency');
        const duration = 1600;
        const startTime = performance.now();

        function easeOut(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOut(progress);
            const current = Math.floor(easedProgress * target);

            if (isCurrency) {
                counter.textContent = 'R' + current.toLocaleString();
            } else {
                counter.textContent = current.toLocaleString();
            }

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    });
}

// ── Table Search & Filter ──
function filterTable(searchInputId, tableBodyId) {
    const searchValue = document.getElementById(searchInputId).value.toLowerCase();
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matchesSearch = text.includes(searchValue);
        row.style.display = matchesSearch ? '' : 'none';
    });
}

// ── Settings Toggle Feedback ──
document.querySelectorAll('.toggle-switch input').forEach(toggle => {
    toggle.addEventListener('change', function () {
        const settingName = this.closest('.setting-row').querySelector('.setting-name').textContent;
        const status = this.checked ? 'enabled' : 'disabled';

        // Create toast notification
        showToast(`${settingName} ${status}`);
    });
});

// ── Toast Notification ──
function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(message)}`;
    document.body.appendChild(toast);

    // Add animation keyframes dynamically
    if (!document.getElementById('toastStyles')) {
        const style = document.createElement('style');
        style.id = 'toastStyles';
        style.textContent = `
            @keyframes toastOut {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(20px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ── Simulated Live Activity — REMOVED ──
// Replaced with real DB-backed activity from api/admin/stats.php

function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minute' + (mins !== 1 ? 's' : '') + ' ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs !== 1 ? 's' : '') + ' ago';
    var days = Math.floor(hrs / 24);
    return days + ' day' + (days !== 1 ? 's' : '') + ' ago';
}

function renderActivityFeed(activities) {
    var feed = document.getElementById('activityFeed');
    if (!feed) return;
    if (!activities || activities.length === 0) {
        feed.innerHTML = '<div class="activity-item"><div class="activity-body"><p style="color:var(--text-muted);">No recent activity</p></div></div>';
        return;
    }
    feed.innerHTML = activities.map(function(a) {
        return '<div class="activity-item">' +
            '<div class="activity-dot" style="background:' + escapeHtml(a.color || '#3B82F6') + '"></div>' +
            '<div class="activity-body">' +
            '<p>' + a.text + '</p>' +
            '<span class="activity-time">' + timeAgo(a.time) + '</span>' +
            '</div></div>';
    }).join('');
}

function renderReports(reports) {
    if (!reports) return;
    var u = reports.users || {};
    var j = reports.jobs || {};
    var ap = reports.applications || {};

    setTextById('reportTotalUsers', (u.total || 0).toLocaleString());
    setTextById('reportTotalJobs', (j.total || 0).toLocaleString());
    setTextById('reportTotalApps', (ap.total || 0).toLocaleString());

    setBarAndPct('barVerified', 'pctVerified', u.verifiedPct || 0);
    setBarAndPct('barUnverified', 'pctUnverified', u.unverifiedPct || 0);

    setBarAndPct('barJobsActive', 'pctJobsActive', j.activePct || 0);
    setBarAndPct('barJobsClosed', 'pctJobsClosed', j.closedPct || 0);
    setBarAndPct('barJobsDraft', 'pctJobsDraft', j.draftPct || 0);

    setBarAndPct('barAppsReviewed', 'pctAppsReviewed', ap.reviewedPct || 0);
    setBarAndPct('barAppsPending', 'pctAppsPending', ap.pendingPct || 0);
    setBarAndPct('barAppsRejected', 'pctAppsRejected', ap.rejectedPct || 0);

    renderAuditLog(reports);
}

function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setBarAndPct(barId, pctId, value) {
    var bar = document.getElementById(barId);
    var pct = document.getElementById(pctId);
    if (bar) bar.style.width = value + '%';
    if (pct) pct.textContent = value + '%';
}

function renderAuditLog(reports) {
    var tbody = document.getElementById('auditLogBody');
    if (!tbody) return;

    var rows = [];
    var u = reports.users || {};
    var j = reports.jobs || {};
    var ap = reports.applications || {};

    rows.push({ ts: new Date().toISOString(), action: 'Users', cls: 'create', by: 'Platform', detail: u.total + ' total — ' + u.seekers + ' seekers, ' + u.recruiters + ' recruiters, ' + u.admins + ' admins' });
    rows.push({ ts: new Date().toISOString(), action: 'Jobs', cls: 'update', by: 'Platform', detail: j.total + ' total — ' + j.active + ' active, ' + j.closed + ' closed, ' + j.draft + ' draft' });
    rows.push({ ts: new Date().toISOString(), action: 'Applications', cls: 'verify', by: 'Platform', detail: ap.total + ' total — ' + ap.reviewed + ' reviewed, ' + ap.pending + ' pending, ' + ap.rejected + ' rejected' });

    tbody.innerHTML = rows.map(function(r) {
        return '<tr><td style="white-space:nowrap;">' + formatDate(r.ts) + '</td>' +
            '<td data-label="Action"><span class="audit-action ' + r.cls + '">' + escapeHtml(r.action) + '</span></td>' +
            '<td data-label="By">' + escapeHtml(r.by) + '</td>' +
            '<td data-label="Detail">' + escapeHtml(r.detail) + '</td></tr>';
    }).join('');
}

// ── Fetch Admin Stats from API ──
async function fetchAdminStats() {
    try {
        var res = await fetch('api/admin/stats.php', { credentials: 'include' });
        var data = await res.json();
        if (!data.success) return;

        // KPI 30-day metrics
        setStatTarget('kpiNewUsers', data.kpi30d.newUsers || 0);
        setStatTarget('kpiNewRecruiters', data.kpi30d.newRecruiters || 0);
        setStatTarget('kpiNewApps', data.kpi30d.newApps || 0);
        setStatTarget('kpiRevenue', data.kpi30d.revenue || 0);

        // Activity feed
        renderActivityFeed(data.activity);

        // Reports
        renderReports(data.reports);

        animateCounters();
    } catch (e) {
        console.error('Failed to fetch admin stats:', e);
    }
}

// Add a live activity every 12 seconds
// (removed: was generating fake data — stats now come from the API)

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
    animateCounters();
    fetchAndRenderUsers();
    renderAdminJobs();
    renderAdminApplications();
    renderAdminDocuments();
    updateOverviewStats();
    fetchAdminStats();
    loadPricingSettings();
    loadAllSettings();
});

// ── Pricing Settings (API-backed) ──
const PRICING_KEY = 'joblynk_pricing';

window.savePricingSettings = async function() {
    const pricing = {
        intro: parseInt(document.getElementById('priceIntro')?.value) || 750,
        job1: parseInt(document.getElementById('price1Job')?.value) || 1300,
        job2: parseInt(document.getElementById('price2Job')?.value) || 2200,
        job3: parseInt(document.getElementById('price3Job')?.value) || 2950,
        job4: parseInt(document.getElementById('price4Job')?.value) || 3500,
        job5: parseInt(document.getElementById('price5Job')?.value) || 3900,
        introActive: document.getElementById('toggleIntroOffer')?.checked ?? true,
        introExpiry: document.getElementById('introExpiry')?.value || '2026-05-31',
        updatedAt: new Date().toISOString()
    };

    try {
        const res = await fetch('api/admin/settings.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pricing: pricing })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Pricing settings saved');
        } else {
            throw new Error(data.message || 'Save failed');
        }
    } catch (e) {
        console.error('Failed to save pricing:', e);
        showToast('Failed to save pricing settings');
    }
};

async function loadPricingSettings() {
    try {
        const res = await fetch('api/admin/settings.php?key=pricing', { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.value) return;
        const p = data.value;
        if (p.intro) document.getElementById('priceIntro').value = p.intro;
        if (p.job1) document.getElementById('price1Job').value = p.job1;
        if (p.job2) document.getElementById('price2Job').value = p.job2;
        if (p.job3) document.getElementById('price3Job').value = p.job3;
        if (p.job4) document.getElementById('price4Job').value = p.job4;
        if (p.job5) document.getElementById('price5Job').value = p.job5;
        if (p.introExpiry) document.getElementById('introExpiry').value = p.introExpiry;
        if (p.introActive !== undefined) document.getElementById('toggleIntroOffer').checked = p.introActive;
    } catch (e) { console.error('Error loading pricing:', e); }
}

// ── Platform Settings (API-backed) ──
const SETTING_TOGGLES = [
    'toggleMaintenance', 'toggleRegistration', 'toggleRecruiterSignup',
    'toggleEmailAlerts', 'toggleNewUser', 'toggleWeekly',
    'toggleAutoFlag', 'toggleJobApproval', 'toggleProfanity'
];

window.saveAllSettings = async function() {
    var toggles = {};
    SETTING_TOGGLES.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) toggles[id] = el.checked;
    });

    try {
        var res = await fetch('api/admin/settings.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform_toggles: toggles })
        });
        var data = await res.json();
        if (data.success) {
            showToast('Platform settings saved');
        } else {
            throw new Error(data.message || 'Save failed');
        }
    } catch (e) {
        console.error('Failed to save settings:', e);
        showToast('Failed to save settings');
    }
};

window.resetSettingsDefaults = function() {
    var defaults = {
        toggleMaintenance: false, toggleRegistration: true, toggleRecruiterSignup: true,
        toggleEmailAlerts: true, toggleNewUser: true, toggleWeekly: false,
        toggleAutoFlag: true, toggleJobApproval: false, toggleProfanity: true
    };
    Object.keys(defaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.checked = defaults[id];
    });
    showToast('Settings reset to defaults (not yet saved)');
};

async function loadAllSettings() {
    try {
        var res = await fetch('api/admin/settings.php?key=platform_toggles', { credentials: 'include' });
        var data = await res.json();
        if (!data.success || !data.value) return;
        var toggles = data.value;
        Object.keys(toggles).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.checked = toggles[id];
        });
    } catch (e) { console.error('Error loading settings:', e); }

    // Load DeepSeek key status
    try {
        var res2 = await fetch('api/admin/settings.php?key=deepseek_api_key', { credentials: 'include' });
        var data2 = await res2.json();
        var statusEl = document.getElementById('deepseekKeyStatus');
        var input = document.getElementById('deepseekApiKey');
        if (data2.success && data2.value) {
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#059669;"></i> API key is configured';
            if (input) input.placeholder = '••••••••••••••••  (key is set — enter new value to replace)';
        } else {
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#F59E0B;"></i> No API key configured — AI cover letter generation will be unavailable';
        }
    } catch (e) { /* ignore */ }
}

window.saveDeepSeekKey = async function() {
    var input = document.getElementById('deepseekApiKey');
    var key = (input ? input.value.trim() : '');
    if (!key) {
        showToast('Please enter an API key');
        return;
    }
    try {
        var res = await fetch('api/admin/settings.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deepseek_api_key: key })
        });
        var data = await res.json();
        if (data.success) {
            showToast('DeepSeek API key saved');
            input.value = '';
            var statusEl = document.getElementById('deepseekKeyStatus');
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#059669;"></i> API key is configured';
            input.placeholder = '••••••••••••••••  (key is set — enter new value to replace)';
        } else {
            throw new Error(data.message || 'Save failed');
        }
    } catch (e) {
        console.error('Failed to save API key:', e);
        showToast('Failed to save API key');
    }
};

// ── Fetch Real Users from API ──
async function fetchAndRenderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const info = document.getElementById('usersTableInfo');
    if (!tbody) return;

    try {
        const res = await fetch('api/admin/users.php', { credentials: 'include' });
        const data = await res.json();

        if (!data.success || !data.users) {
            adminState.users = [];
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Failed to load users</td></tr>';
            if (info) info.textContent = 'Error loading users';
            updateOverviewStats();
            return;
        }

        const users = data.users;
        adminState.users = users;
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No registered users yet</td></tr>';
            if (info) info.textContent = 'Showing 0 users';
            return;
        }

        const avatarColors = [
            { bg: '#DBEAFE', fg: '#2563EB' },
            { bg: '#FFF1F2', fg: '#E11D48' },
            { bg: '#F0FDF4', fg: '#16A34A' },
            { bg: '#FEF3C7', fg: '#D97706' },
            { bg: '#EDE9FE', fg: '#7C3AED' },
            { bg: '#FCE7F3', fg: '#DB2777' },
            { bg: '#ECFDF5', fg: '#059669' },
            { bg: '#FEF9C3', fg: '#CA8A04' },
        ];

        users.forEach((user, idx) => {
            const initials = ((user.first_name || '')[0] || '') + ((user.last_name || '')[0] || '');
            const fullName = escapeHtml(`${user.first_name} ${user.last_name}`);
            const safeEmail = escapeHtml(user.email);
            const color = avatarColors[idx % avatarColors.length];

            const roleMap = {
                'job_seeker': { label: 'Job Seeker', cls: 'seeker' },
                'recruiter': { label: 'Recruiter', cls: 'premium' },
                'admin': { label: 'Admin', cls: 'premium' }
            };
            const role = roleMap[user.role] || { label: escapeHtml(user.role), cls: 'seeker' };

            const verified = parseInt(user.email_verified);
            const statusDot = verified ? 'active' : 'suspended';
            const statusText = verified ? 'Verified' : 'Unverified';

            const isSelfOrAdmin = user.role === 'admin';
            const userId = parseInt(user.id);
            const impersonateBtn = isSelfOrAdmin 
                ? `<button class="tbl-btn" title="Cannot Impersonate Admin" disabled style="opacity:0.5; cursor:not-allowed;"><i class="fa-solid fa-user-secret"></i></button>`
                : `<button class="tbl-btn" title="Impersonate User" onclick="window.location.href='api/admin/impersonate.php?user_id=${userId}'" style="color:#7C3AED"><i class="fa-solid fa-user-secret"></i></button>`;

            const tr = document.createElement('tr');
            tr.className = 'card-row card-row-users';
            tr.innerHTML = `
                <td data-label="User">
                    <div class="table-user">
                        <div class="table-avatar" style="background:${color.bg}; color:${color.fg};">${escapeHtml(initials).toUpperCase()}</div>
                        <div class="entity-block">
                            <span class="entity-title">${fullName}</span>
                            <span class="entity-sub">Platform account</span>
                        </div>
                    </div>
                </td>
                <td data-label="Email">
                    <div class="table-value">
                        <span>${safeEmail}</span>
                        <span class="table-note">${verified ? 'Email confirmed' : 'Verification pending'}</span>
                    </div>
                </td>
                <td data-label="Role"><span class="role-tag ${role.cls}">${role.label}</span></td>
                <td data-label="Status"><span class="status-dot ${statusDot}"></span> ${statusText}</td>
                <td data-label="Joined">
                    <div class="table-value">
                        <span>${formatDate(user.created_at)}</span>
                        <span class="table-note">Member since sign up</span>
                    </div>
                </td>
                <td class="actions-cell" data-label="Actions">
                    ${impersonateBtn}
                    <button class="tbl-btn" title="View" onclick="adminViewUser(${userId})"><i class="fa-solid fa-eye"></i></button>
                    ${isSelfOrAdmin ? '' : `<button class="tbl-btn warn" title="${verified ? 'Suspend' : 'Verify'}" onclick="adminToggleUser(${userId}, ${verified ? 0 : 1})"><i class="fa-solid fa-${verified ? 'ban' : 'check'}"></i></button>`}
                    ${isSelfOrAdmin ? '' : `<button class="tbl-btn danger" title="Delete" onclick="adminDeleteUser(${userId})"><i class="fa-solid fa-trash"></i></button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (info) info.textContent = `Showing ${users.length} registered user${users.length !== 1 ? 's' : ''}`;
        updateOverviewStats();

    } catch (err) {
        adminState.users = [];
        console.error('Error fetching users:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#DC2626;"><i class="fa-solid fa-triangle-exclamation"></i> Could not connect to API. Make sure the PHP server is running.</td></tr>';
        if (info) info.textContent = 'API unavailable';
        updateOverviewStats();
    }
}

// ── Update Overview Stats from API state ──
function updateOverviewStats() {
    setStatTarget('statTotalUsers', adminState.users.length);
    setStatTarget('statTotalJobs', adminState.jobs.filter(job => job.status === 'active').length);
    setStatTarget('statTotalApps', adminState.applications.length);
    setStatTarget('statTotalDocs', adminState.documents.length);

    animateCounters();
}

function setStatTarget(id, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-target', value);
}

function getStoredData(key) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// ── Render Admin Jobs Table ──
function renderAdminJobs() {
    const tbody = document.getElementById('jobsTableBody');
    const info = document.getElementById('jobsTableInfo');
    if (!tbody) return;

    fetch('api/admin/jobs.php', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.success || !Array.isArray(data.jobs)) {
                throw new Error('Failed to load jobs');
            }

            adminState.jobs = data.jobs;
            tbody.innerHTML = '';

            if (data.jobs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No job listings yet</td></tr>';
                if (info) info.textContent = 'Showing 0 jobs';
                updateOverviewStats();
                return;
            }

            data.jobs.forEach(job => {
                const statusClass = job.status === 'active' ? 'active' : 'closed';
                const recruiterName = escapeHtml(`${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unknown recruiter');
                const jobId = parseInt(job.id);
                const applicantCount = parseInt(job.applicant_count, 10) || 0;
                const tr = document.createElement('tr');
                tr.className = 'card-row card-row-jobs';
                tr.innerHTML = `
                    <td data-label="Job">
                        <div class="entity-block">
                            <span class="entity-title">${escapeHtml(job.title)}</span>
                            <div class="entity-meta">
                                <span class="meta-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(job.location || 'Remote')}</span>
                                <span class="meta-chip"><i class="fa-regular fa-clock"></i> ${escapeHtml(job.type || 'Full-time')}</span>
                            </div>
                        </div>
                    </td>
                    <td data-label="Company">
                        <div class="table-value">
                            <span>${escapeHtml(job.company || '—')}</span>
                            <span class="table-note">${recruiterName}</span>
                        </div>
                    </td>
                    <td data-label="Applicants">
                        <div class="table-value">
                            <span class="table-metric">${applicantCount}</span>
                            <span class="table-note">candidate${applicantCount === 1 ? '' : 's'}</span>
                        </div>
                    </td>
                    <td data-label="Status"><span class="job-status ${statusClass}">${job.status === 'active' ? 'Active' : 'Closed'}</span></td>
                    <td data-label="Posted">
                        <div class="table-value">
                            <span>${formatDate(job.created_at)}</span>
                            <span class="table-note">Recruiter listing</span>
                        </div>
                    </td>
                    <td class="actions-cell" data-label="Actions">
                        <button class="tbl-btn" title="View" onclick="adminViewJob(${jobId})"><i class="fa-solid fa-eye"></i></button>
                        <button class="tbl-btn danger" title="Remove" onclick="adminDeleteJob(${jobId})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (info) info.textContent = `Showing ${data.jobs.length} job${data.jobs.length !== 1 ? 's' : ''}`;
            updateOverviewStats();
        })
        .catch(err => {
            adminState.jobs = [];
            console.error('Error fetching jobs:', err);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#DC2626;">Failed to load jobs</td></tr>';
            if (info) info.textContent = 'API unavailable';
            updateOverviewStats();
        });
}

window.adminViewJob = function(jobId) {
    const job = adminState.jobs.find(j => parseInt(j.id) === jobId);
    if (!job) return;
    const recruiterName = `${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unknown';
    const details = [
        `Title: ${job.title}`,
        `Company: ${job.company || '—'}`,
        `Location: ${job.location || 'Remote'}`,
        `Type: ${job.type || 'Full-time'}`,
        `Status: ${job.status}`,
        `Applicants: ${job.applicant_count || 0}`,
        `Recruiter: ${recruiterName}`,
        `Email: ${job.email || '—'}`,
        `Posted: ${formatDate(job.created_at)}`,
    ];
    alert(details.join('\n'));
};

window.adminDeleteJob = async function(jobId) {
    if (!confirm('Are you sure you want to remove this job listing?')) return;
    try {
        const res = await fetch(`api/admin/jobs.php?id=${encodeURIComponent(jobId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.message || 'Delete failed');
        }

        renderAdminJobs();
        renderAdminApplications();
        showToast('Job listing removed');
    } catch (err) {
        console.error('Error deleting job:', err);
        showToast('Failed to remove job listing');
    }
};

// ── Render Admin Applications Table ──
function renderAdminApplications() {
    const tbody = document.getElementById('appsTableBody');
    const info = document.getElementById('appsTableInfo');
    if (!tbody) return;

    fetch('api/admin/applications.php', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.success || !Array.isArray(data.applications)) {
                throw new Error('Failed to load applications');
            }

            adminState.applications = data.applications;
            tbody.innerHTML = '';

            if (data.applications.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No applications submitted yet</td></tr>';
                if (info) info.textContent = 'Showing 0 applications';
                updateOverviewStats();
                return;
            }

            data.applications.forEach(app => {
                const applicantName = escapeHtml(`${app.first_name || ''} ${app.last_name || ''}`.trim() || app.applicant_name || 'Unknown');
                const statusValue = String(app.status || 'submitted').toLowerCase();
                const statusClass = {
                    submitted: 'is-submitted',
                    reviewed: 'is-reviewed',
                    shortlisted: 'is-shortlisted',
                    rejected: 'is-rejected'
                }[statusValue] || 'is-submitted';
                const statusLabel = statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
                const tr = document.createElement('tr');
                tr.className = 'card-row card-row-apps';
                tr.innerHTML = `
                    <td data-label="Applicant">
                        <div class="table-user">
                            <div class="table-avatar" style="background:#DBEAFE; color:#2563EB;">${(applicantName[0] || 'U').toUpperCase()}</div>
                            <div class="entity-block">
                                <span class="entity-title">${applicantName}</span>
                                <small class="table-sub">${escapeHtml(app.email || '—')}</small>
                            </div>
                        </div>
                    </td>
                    <td data-label="Job">
                        <div class="table-value">
                            <span class="entity-title">${escapeHtml(app.job_title || 'Unknown Job')}</span>
                            <span class="table-note">Applied role</span>
                        </div>
                    </td>
                    <td data-label="Company">
                        <div class="table-value">
                            <span>${escapeHtml(app.job_company || '—')}</span>
                            <span class="table-note">Hiring company</span>
                        </div>
                    </td>
                    <td data-label="CV">${app.cv_name ? '<span class="document-chip success"><i class="fa-solid fa-file-lines"></i> ' + escapeHtml(app.cv_name) + '</span>' : '<span class="document-chip muted">No CV</span>'}</td>
                    <td data-label="Cover Letter">${app.cl_name ? '<span class="document-chip accent"><i class="fa-solid fa-envelope-open-text"></i> ' + escapeHtml(app.cl_name) + '</span>' : '<span class="document-chip muted">No cover letter</span>'}</td>
                    <td data-label="Status"><span class="verification-badge app-status-badge ${statusClass}"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(statusLabel)}</span></td>
                    <td data-label="Date">
                        <div class="table-value">
                            <span>${formatDate(app.created_at)}</span>
                            <span class="table-note">Submission date</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (info) info.textContent = `Showing ${data.applications.length} application${data.applications.length !== 1 ? 's' : ''}`;
            updateOverviewStats();
        })
        .catch(err => {
            adminState.applications = [];
            console.error('Error fetching applications:', err);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#DC2626;">Failed to load applications</td></tr>';
            if (info) info.textContent = 'API unavailable';
            updateOverviewStats();
        });
}

// ── Render Admin Documents Table ──
function renderAdminDocuments() {
    const cvsBody = document.getElementById('cvsTableBody');
    const clsBody = document.getElementById('clsTableBody');
    const info = document.getElementById('docsTableInfo');

    fetch('api/admin/documents.php', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.success || !Array.isArray(data.documents)) {
                throw new Error('Failed to load documents');
            }

            adminState.documents = data.documents;
            const cvs = data.documents.filter(doc => doc.doc_type === 'cv');
            const cls = data.documents.filter(doc => doc.doc_type === 'cl');

            if (cvsBody) {
                cvsBody.innerHTML = '';
                if (cvs.length === 0) {
                    cvsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No CVs created yet</td></tr>';
                } else {
                    cvs.forEach(cv => {
                        const accent = escapeHtml(cv.accent_color || '#3B4BA6');
                        const ownerName = escapeHtml(`${cv.first_name || ''} ${cv.last_name || ''}`.trim() || 'Unknown');
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-weight:600;">${escapeHtml(cv.name || 'Untitled CV')}</td>
                            <td data-label="Owner">${ownerName}</td>
                            <td data-label="Updated">${formatDate(cv.updated_at || cv.created_at)}</td>
                            <td data-label="Color"><span style="display:inline-block; width:20px; height:20px; border-radius:50%; background:${accent}; vertical-align:middle;"></span> <code style="font-size:0.8rem;">${accent}</code></td>
                        `;
                        cvsBody.appendChild(tr);
                    });
                }
            }

            if (clsBody) {
                clsBody.innerHTML = '';
                if (cls.length === 0) {
                    clsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No cover letters created yet</td></tr>';
                } else {
                    cls.forEach(cl => {
                        const accent = escapeHtml(cl.accent_color || '#0F766E');
                        const ownerName = escapeHtml(`${cl.first_name || ''} ${cl.last_name || ''}`.trim() || 'Unknown');
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="font-weight:600;">${escapeHtml(cl.name || 'Untitled Cover Letter')}</td>
                            <td data-label="Owner">${ownerName}</td>
                            <td data-label="Updated">${formatDate(cl.updated_at || cl.created_at)}</td>
                            <td data-label="Color"><span style="display:inline-block; width:20px; height:20px; border-radius:50%; background:${accent}; vertical-align:middle;"></span> <code style="font-size:0.8rem;">${accent}</code></td>
                        `;
                        clsBody.appendChild(tr);
                    });
                }
            }

            const total = data.documents.length;
            if (info) info.textContent = `Showing ${total} document${total !== 1 ? 's' : ''} (${cvs.length} CV${cvs.length !== 1 ? 's' : ''}, ${cls.length} cover letter${cls.length !== 1 ? 's' : ''})`;
            updateOverviewStats();
        })
        .catch(err => {
            adminState.documents = [];
            console.error('Error fetching documents:', err);
            if (cvsBody) cvsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#DC2626;">Failed to load documents</td></tr>';
            if (clsBody) clsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#DC2626;">Failed to load documents</td></tr>';
            if (info) info.textContent = 'API unavailable';
            updateOverviewStats();
        });
}

// ── Admin User Management ──
window.adminViewUser = function(userId) {
    const user = adminState.users.find(u => parseInt(u.id) === userId);
    if (!user) return;
    const details = [
        `Name: ${user.first_name} ${user.last_name}`,
        `Email: ${user.email}`,
        `Role: ${user.role}`,
        `Verified: ${parseInt(user.email_verified) ? 'Yes' : 'No'}`,
        `Company: ${user.company_name || '—'}`,
        `Joined: ${formatDate(user.created_at)}`,
    ];
    alert(details.join('\n'));
};

window.adminToggleUser = async function(userId, newVerified) {
    const label = newVerified ? 'verify' : 'suspend';
    if (!confirm(`Are you sure you want to ${label} this user?`)) return;
    try {
        const res = await fetch('api/admin/users.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, email_verified: newVerified })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Update failed');
        fetchAndRenderUsers();
        showToast(`User ${newVerified ? 'verified' : 'suspended'}`);
    } catch (err) {
        console.error('Error updating user:', err);
        showToast('Failed to update user');
    }
};

window.adminDeleteUser = async function(userId) {
    if (!confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return;
    try {
        const res = await fetch(`api/admin/users.php?id=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Delete failed');
        fetchAndRenderUsers();
        renderAdminJobs();
        renderAdminApplications();
        renderAdminDocuments();
        showToast('User deleted');
    } catch (err) {
        console.error('Error deleting user:', err);
        showToast('Failed to delete user');
    }
};
