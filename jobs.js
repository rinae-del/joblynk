(() => {
    const state = {
        jobs: [],
        session: { loggedIn: false, user: null },
        selectedJobId: null,
    };

    const $ = id => document.getElementById(id);

    function escText(value = '') {
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    function escAttr(value = '') {
        return escText(value).replace(/"/g, '&quot;');
    }

    function normalizeSearch(value = '') {
        return String(value).trim().toLowerCase();
    }

    function compactMoney(value) {
        return new Intl.NumberFormat('en-ZA', {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);
    }

    function formatSalaryValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const plainNumeric = /^\d[\d\s,.]*$/.test(raw);
        if (!plainNumeric) return raw;
        const numeric = Number(raw.replace(/[\s,]/g, ''));
        return numeric ? `R${compactMoney(numeric)}` : raw;
    }

    function formatSalaryLabel(job) {
        if (job.hideSalary) return '';
        const salaryFrom = formatSalaryValue(job.salaryFrom || job.salary_from);
        const salaryTo = formatSalaryValue(job.salaryTo || job.salary_to);
        const salaryNote = String(job.salaryNote || job.salary_note || '').trim();
        const period = String(job.salaryPeriod || job.salary_period || 'Per Month').replace(/^Per\s+/i, 'per ');
        let salary = '';

        if (salaryFrom && salaryTo) salary = `${salaryFrom} to ${salaryTo} ${period}`;
        else if (salaryFrom) salary = `${salaryFrom} ${period}`;
        else if (salaryTo) salary = `${salaryTo} ${period}`;

        return [salary, salaryNote].filter(Boolean).join(', ');
    }

    function getDaysSince(dateValue) {
        const parsed = new Date(dateValue).getTime();
        if (!parsed) return 0;
        return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
    }

    function formatRelativeAge(dateValue) {
        const days = getDaysSince(dateValue);
        if (days === 0) return 'Posted today';
        if (days === 1) return 'Posted yesterday';
        return `Posted ${days} days ago`;
    }

    function buildJobMeta(job) {
        return [
            job.location || 'Remote friendly',
            job.type || 'Role type not specified',
            formatSalaryLabel(job),
        ].filter(Boolean);
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
        const raw = String(value || '').trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
        } catch (error) {}
        return raw.split(',').map(item => item.trim()).filter(Boolean);
    }

    function getClosingDate(job) {
        return job.closingDate || job.closing_date || '';
    }

    function formatClosingLabel(job) {
        const closingDate = getClosingDate(job);
        if (!closingDate) return '';
        const parsed = new Date(closingDate);
        if (Number.isNaN(parsed.getTime())) return '';
        return 'Closes ' + parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function getSalaryNumber(job) {
        const salaryTo = String(job.salaryTo || job.salary_to || '').replace(/[^\d.]/g, '');
        const salaryFrom = String(job.salaryFrom || job.salary_from || '').replace(/[^\d.]/g, '');
        const value = Number(salaryTo || salaryFrom || 0);
        return Number.isFinite(value) ? value : 0;
    }

    function getApplicantCount(job) {
        const count = Number(job.applicants || job.applicant_count || 0);
        return Number.isFinite(count) ? count : 0;
    }

    function getSafeAccent(job) {
        const color = String(job.color || '#6366F1').trim();
        return /^#[0-9A-Fa-f]{6}$/.test(color) || /^#[0-9A-Fa-f]{3}$/.test(color) ? color : '#6366F1';
    }

    function getJobById(jobId) {
        return state.jobs.find(job => String(job.id) === String(jobId)) || null;
    }

    async function loadSession() {
        try {
            const response = await fetch('api/auth/session.php', { credentials: 'include', cache: 'no-store' });
            const result = await response.json();
            state.session = result.loggedIn ? result : { loggedIn: false, user: null };
        } catch (error) {
            state.session = { loggedIn: false, user: null };
        }

        const dashboardUrl = state.session.user?.role === 'recruiter'
            ? 'recruiter-overview.html'
            : state.session.user?.role === 'admin'
                ? 'admin-overview.html'
                : 'dashboard.html';

        if (state.session.loggedIn) {
            [$('jobsSignInLink'), $('jobsMobileSignInLink')].forEach(link => {
                if (!link) return;
                link.href = dashboardUrl;
                link.textContent = 'Dashboard';
            });
            [$('jobsSignupLink'), $('jobsMobileSignupLink')].forEach(link => {
                if (!link) return;
                link.href = dashboardUrl;
                link.textContent = 'My Account';
            });
        }
    }

    async function loadJobs() {
        const summary = $('jobsResultsSummary');
        try {
            if (typeof JobsStore !== 'undefined') {
                await JobsStore.fetchJobs();
                state.jobs = JobsStore.getActiveJobs();
            } else {
                const response = await fetch('api/jobs/index.php', { credentials: 'include' });
                const result = await response.json();
                state.jobs = result.success && Array.isArray(result.jobs) ? result.jobs : [];
            }
        } catch (error) {
            console.warn('Unable to load jobs:', error);
            state.jobs = [];
            if (summary) summary.textContent = 'We could not load jobs right now. Please refresh the page.';
        }
    }

    function populateFilters() {
        const locationSelect = $('publicJobLocation');
        const typeSelect = $('publicJobType');
        const locations = [...new Set(state.jobs.map(job => job.location).filter(Boolean))].sort();
        const types = [...new Set(state.jobs.map(job => job.type).filter(Boolean))].sort();

        if (locationSelect) {
            locationSelect.innerHTML = '<option value="">All locations</option>';
            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                locationSelect.appendChild(option);
            });
        }

        if (typeSelect) {
            typeSelect.innerHTML = '<option value="">All types</option>';
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });
        }

        const heroCount = $('jobsHeroCount');
        const locationCount = $('jobsLocationCount');
        const typeCount = $('jobsTypeCount');
        if (heroCount) heroCount.textContent = String(state.jobs.length);
        if (locationCount) locationCount.textContent = String(locations.length);
        if (typeCount) typeCount.textContent = String(types.length);
    }

    function syncLocationChips() {
        const selectedLocation = $('publicJobLocation')?.value || '';
        document.querySelectorAll('[data-location-filter]').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-location-filter') === selectedLocation);
        });
    }

    function getFilteredJobs() {
        const keyword = normalizeSearch($('publicJobKeyword')?.value || '');
        const location = $('publicJobLocation')?.value || '';
        const type = $('publicJobType')?.value || '';
        const sort = $('publicJobSort')?.value || 'newest';

        const filtered = state.jobs.filter(job => {
            const searchable = [job.title, job.company, job.location, job.description, job.requirements, job.skills, normalizeList(job.benefits).join(' ')]
                .map(normalizeSearch)
                .join(' ');
            const matchesKeyword = !keyword || searchable.includes(keyword);
            const matchesLocation = !location || job.location === location;
            const matchesType = !type || String(job.type || '').toLowerCase() === type.toLowerCase();
            return matchesKeyword && matchesLocation && matchesType;
        });

        return filtered.sort((left, right) => {
            if (sort === 'salary') return getSalaryNumber(right) - getSalaryNumber(left);
            if (sort === 'closing') {
                const leftTime = new Date(getClosingDate(left)).getTime() || Number.MAX_SAFE_INTEGER;
                const rightTime = new Date(getClosingDate(right)).getTime() || Number.MAX_SAFE_INTEGER;
                return leftTime - rightTime;
            }
            return (new Date(right.postedAt || right.created_at).getTime() || 0) - (new Date(left.postedAt || left.created_at).getTime() || 0);
        });
    }

    function renderJobCard(job) {
        const meta = buildJobMeta(job);
        const companyInitial = String(job.company || 'J').trim().charAt(0).toUpperCase() || 'J';
        const companyLogo = job.companyLogoUrl || job.company_logo_url || '';
        const description = String(job.description || job.requirements || 'Open this listing to view more details from the recruiter.').trim();
        const applicantCount = getApplicantCount(job);
        const closingLabel = formatClosingLabel(job);
        const accent = getSafeAccent(job);
        const logoHtml = companyLogo
            ? `<img src="${escAttr(companyLogo)}" alt="" loading="lazy">`
            : escText(companyInitial);

        return `
            <article class="public-job-card" style="--job-accent:${escAttr(accent)}">
                <div class="public-job-card-top">
                    <div class="public-job-logo">${logoHtml}</div>
                    <div>
                        <span class="public-job-company">${escText(job.company || 'Company')}</span>
                        <h3>${escText(job.title || 'Untitled role')}</h3>
                    </div>
                </div>
                <div class="public-job-badges">
                    <span><i class="fa-solid fa-circle-check"></i> Verified recruiter</span>
                    <span>${applicantCount ? escText(applicantCount + ' applicant' + (applicantCount === 1 ? '' : 's')) : 'New listing'}</span>
                </div>
                <div class="public-job-meta">
                    ${meta.map(item => `<span>${escText(item)}</span>`).join('')}
                </div>
                <p>${escText(description).slice(0, 190)}${description.length > 190 ? '...' : ''}</p>
                <div class="public-job-card-footer">
                    <div class="public-job-footnotes">
                        <span>${escText(formatRelativeAge(job.postedAt || job.created_at))}</span>
                        ${closingLabel ? `<span>${escText(closingLabel)}</span>` : ''}
                    </div>
                    <div class="public-job-actions">
                        <button type="button" class="public-job-secondary" data-view-job="${escAttr(job.id)}">View Job</button>
                        <button type="button" class="public-job-primary" data-apply-job="${escAttr(job.id)}">Apply</button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderJobs() {
        const list = $('publicJobsList');
        const summary = $('jobsResultsSummary');
        if (!list) return;

        const jobs = getFilteredJobs();
        syncLocationChips();
        if (summary) {
            summary.textContent = jobs.length === 1
                ? `Showing 1 of ${state.jobs.length} live jobs.`
                : `Showing ${jobs.length} of ${state.jobs.length} live jobs.`;
        }

        if (!jobs.length) {
            const hasLiveJobs = state.jobs.length > 0;
            list.innerHTML = `
                <div class="public-jobs-empty">
                    <i class="fa-solid fa-briefcase"></i>
                    <h3>${hasLiveJobs ? 'No matching jobs found' : 'No live jobs available yet'}</h3>
                    <p>${hasLiveJobs ? 'Try clearing the filters or searching a different keyword.' : 'New roles will appear here as recruiters publish them.'}</p>
                </div>
            `;
            return;
        }

        list.innerHTML = jobs.map(renderJobCard).join('');
    }

    function buildJobDetailsHtml(job) {
        const sections = [];
        if (job.description) sections.push(`<section><h3>Description</h3><p>${escText(job.description)}</p></section>`);
        if (job.requirements) sections.push(`<section><h3>Requirements</h3><p>${escText(job.requirements)}</p></section>`);
        const skills = normalizeList(job.skills);
        if (skills.length) {
            const chips = skills.map(skill => `<span>${escText(skill)}</span>`).join('');
            sections.push(`<section><h3>Skills</h3><div class="public-job-skill-chips">${chips}</div></section>`);
        }
        const benefits = normalizeList(job.benefits);
        if (benefits.length) {
            const chips = benefits.map(benefit => `<span>${escText(benefit)}</span>`).join('');
            sections.push(`<section><h3>Benefits</h3><div class="public-job-skill-chips">${chips}</div></section>`);
        }
        if (getClosingDate(job)) {
            sections.push(`<section><h3>Closing date</h3><p>${new Date(getClosingDate(job)).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</p></section>`);
        }
        return sections.join('') || '<p>The recruiter has not added more details for this listing yet.</p>';
    }

    function openPreview(jobId) {
        const job = getJobById(jobId);
        if (!job) return;
        state.selectedJobId = job.id;
        $('jobPreviewCompany').textContent = job.company || 'Company';
        $('jobPreviewTitle').textContent = job.title || 'Untitled role';
        $('jobPreviewMeta').innerHTML = buildJobMeta(job).map(item => `<span>${escText(item)}</span>`).join('');
        $('jobPreviewBody').innerHTML = buildJobDetailsHtml(job);
        openModal('jobPreviewModal');
    }

    function buildApplyUrl(base, jobId) {
        const params = new URLSearchParams({ return: 'jobs', job: String(jobId || '') });
        return `${base}?${params.toString()}`;
    }

    function applyForJob(jobId) {
        const job = getJobById(jobId);
        if (!job) return;

        if (state.session.loggedIn && state.session.user?.role === 'job_seeker') {
            window.location.href = `job-details.html?id=${encodeURIComponent(job.id)}&apply=1`;
            return;
        }

        state.selectedJobId = job.id;
        const signIn = $('jobLoginSignIn');
        const signup = $('jobLoginSignup');
        const copy = $('jobLoginCopy');
        if (signIn) signIn.href = buildApplyUrl('sign-in.html', job.id);
        if (signup) signup.href = buildApplyUrl('sign-up.html', job.id);
        if (copy) {
            copy.textContent = state.session.loggedIn
                ? 'Please use a job seeker account to apply for this role.'
                : 'You can browse and view jobs as a guest. To apply, sign in or create a free job seeker account.';
        }
        openModal('jobLoginModal');
    }

    function openModal(id) {
        const modal = $(id);
        if (!modal) return;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    function closeModal(id) {
        const modal = $(id);
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }

    function bindEvents() {
        $('navHamburger')?.addEventListener('click', () => {
            $('mobileNavMenu')?.classList.toggle('open');
        });

        [$('publicJobKeyword'), $('publicJobLocation'), $('publicJobType'), $('publicJobSort')].forEach(input => {
            input?.addEventListener('input', renderJobs);
            input?.addEventListener('change', renderJobs);
        });

        document.querySelectorAll('[data-location-filter]').forEach(button => {
            button.addEventListener('click', () => {
                const location = button.getAttribute('data-location-filter') || '';
                if ($('publicJobLocation')) $('publicJobLocation').value = location;
                renderJobs();
            });
        });

        $('clearJobFilters')?.addEventListener('click', () => {
            if ($('publicJobKeyword')) $('publicJobKeyword').value = '';
            if ($('publicJobLocation')) $('publicJobLocation').value = '';
            if ($('publicJobType')) $('publicJobType').value = '';
            if ($('publicJobSort')) $('publicJobSort').value = 'newest';
            renderJobs();
        });

        $('publicJobsList')?.addEventListener('click', event => {
            const viewButton = event.target.closest('[data-view-job]');
            const applyButton = event.target.closest('[data-apply-job]');
            if (viewButton) openPreview(viewButton.getAttribute('data-view-job'));
            if (applyButton) applyForJob(applyButton.getAttribute('data-apply-job'));
        });

        $('jobPreviewApplyBtn')?.addEventListener('click', () => {
            if (!state.selectedJobId) return;
            closeModal('jobPreviewModal');
            applyForJob(state.selectedJobId);
        });

        document.querySelectorAll('[data-close-job-modal]').forEach(button => {
            button.addEventListener('click', () => closeModal('jobPreviewModal'));
        });

        document.querySelectorAll('[data-close-login-modal]').forEach(button => {
            button.addEventListener('click', () => closeModal('jobLoginModal'));
        });

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            closeModal('jobPreviewModal');
            closeModal('jobLoginModal');
        });
    }

    async function init() {
        bindEvents();
        await Promise.all([loadSession(), loadJobs()]);
        populateFilters();
        renderJobs();

        const params = new URLSearchParams(window.location.search);
        const jobId = params.get('job');
        if (jobId && getJobById(jobId)) openPreview(jobId);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
