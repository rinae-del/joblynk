(() => {
    const state = {
        jobs: [],
        session: { loggedIn: false, user: null },
        selectedJobId: null,
        browsePage: 1,
        activeCategory: '',
        loading: true,
    };

    const $ = id => document.getElementById(id);
    const debouncedRender = JobsBrowser.debounce(() => renderJobs(), 280);

    function escText(value = '') {
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    function escAttr(value = '') {
        return escText(value).replace(/"/g, '&quot;');
    }

    function compactMoney(value) {
        return new Intl.NumberFormat('en-ZA', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
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
        return [job.location || 'Remote friendly', job.type || 'Full-time', formatSalaryLabel(job)].filter(Boolean);
    }

    function renderMetaPills(job) {
        const salary = formatSalaryLabel(job);
        const pills = [
            { icon: 'fa-location-dot', text: job.location || 'Remote friendly' },
            { icon: 'fa-briefcase', text: job.type || 'Full-time' },
        ];
        if (salary) pills.push({ icon: 'fa-wallet', text: salary, salary: true });
        return pills
            .map(pill => `<span class="${pill.salary ? 'is-salary' : ''}"><i class="fa-solid ${pill.icon}"></i>${escText(pill.text)}</span>`)
            .join('');
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

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function jobPageUrl(job) {
        const slug = slugify([job.title, job.location].filter(Boolean).join(' ')) || 'job';
        return `job/${encodeURIComponent(job.id)}-${slug}`;
    }

    function getFilters() {
        return {
            keyword: $('publicJobKeyword')?.value || '',
            location: $('publicJobLocation')?.value || '',
            type: $('publicJobType')?.value || '',
            category: state.activeCategory,
        };
    }

    function hasActiveFilters() {
        const f = getFilters();
        return !!(f.keyword.trim() || f.location || f.type || f.category);
    }

    function getSortMode() {
        return $('publicJobSort')?.value || 'newest';
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

    function renderSkeleton() {
        const list = $('publicJobsList');
        if (!list) return;
        list.innerHTML = Array.from({ length: 8 }, () => `
            <article class="job-row job-row--skeleton" aria-hidden="true">
                <div class="skeleton-block skeleton-logo"></div>
                <div class="job-row-body">
                    <div class="skeleton-block skeleton-line skeleton-line--lg"></div>
                    <div class="skeleton-block skeleton-line"></div>
                    <div class="skeleton-block skeleton-line skeleton-line--sm"></div>
                </div>
            </article>
        `).join('');
    }

    async function loadJobs() {
        state.loading = true;
        renderSkeleton();
        const summary = $('jobsResultsSummary');
        if (summary) summary.textContent = 'Loading jobs...';

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
        } finally {
            state.loading = false;
        }
    }

    function renderCategoryChips() {
        const container = $('jobsCategoryChips');
        if (!container) return;

        container.innerHTML = JobsBrowser.CATEGORIES.map(cat => `
            <button type="button" class="jobs-category-chip${state.activeCategory === cat.id ? ' active' : ''}"
                data-category-filter="${escAttr(cat.id)}" aria-pressed="${state.activeCategory === cat.id}">
                <i class="fa-solid ${escAttr(cat.icon)}"></i> ${escText(cat.label)}
            </button>
        `).join('');

        container.querySelectorAll('[data-category-filter]').forEach(button => {
            button.addEventListener('click', () => {
                const next = button.getAttribute('data-category-filter') || '';
                state.activeCategory = state.activeCategory === next ? '' : next;
                state.browsePage = 1;
                renderCategoryChips();
                renderJobs();
            });
        });
    }

    function populateFilters() {
        const locationSelect = $('publicJobLocation');
        const typeSelect = $('publicJobType');
        const topLocations = JobsBrowser.getTopLocations(state.jobs, 20);
        const types = JobsBrowser.getUniqueTypes(state.jobs);

        if (locationSelect) {
            const current = locationSelect.value;
            locationSelect.innerHTML = '<option value="">All locations</option>';
            topLocations.forEach(({ region, count, label }) => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = `${label} (${count})`;
                locationSelect.appendChild(option);
            });
            if (current) locationSelect.value = current;
        }

        if (typeSelect) {
            const current = typeSelect.value;
            typeSelect.innerHTML = '<option value="">All types</option>';
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });
            if (current) typeSelect.value = current;
        }

        const statEl = $('jobsStatTotal');
        if (statEl) {
            const locCount = topLocations.length;
            statEl.innerHTML = `<i class="fa-solid fa-briefcase"></i> ${state.jobs.length.toLocaleString()} live jobs · ${locCount} regions`;
        }
    }

    function syncLocationChips() {
        const selected = normalizeLocationKey($('publicJobLocation')?.value || '');
        document.querySelectorAll('[data-location-filter]').forEach(button => {
            const key = normalizeLocationKey(button.getAttribute('data-location-filter') || '');
            button.classList.toggle('active', key === selected);
        });
    }

    function normalizeLocationKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getSourceBadge(job) {
        const source = job.source || 'native';
        if (source === 'native') return '<span class="job-source-badge is-native">JobLynk</span>';
        if (source === 'adzuna') return '<span class="job-source-badge is-adzuna">Adzuna</span>';
        if (source === 'dpsa') return '<span class="job-source-badge is-dpsa">Gov</span>';
        return `<span class="job-source-badge">${escText(source)}</span>`;
    }

    function renderJobRow(job) {
        const companyInitial = String(job.company || 'J').trim().charAt(0).toUpperCase() || 'J';
        const companyLogo = job.companyLogoUrl || job.company_logo_url || '';
        const salary = formatSalaryLabel(job);
        const applicantCount = getApplicantCount(job);
        const closingLabel = formatClosingLabel(job);
        const accent = getSafeAccent(job);
        const logoHtml = companyLogo
            ? `<img src="${escAttr(companyLogo)}" alt="" loading="lazy" decoding="async">`
            : escText(companyInitial);

        const metaBits = [
            job.location ? `<span>${escText(job.location)}</span>` : '',
            job.type ? `<span>${escText(job.type)}</span>` : '',
            salary ? `<span class="job-row-meta-salary">${escText(salary)}</span>` : '',
        ].filter(Boolean).join('');

        const footBits = [
            `<span>${escText(formatRelativeAge(job.postedAt || job.created_at))}</span>`,
            closingLabel ? `<span>${escText(closingLabel)}</span>` : '',
            applicantCount ? `<span>${escText(applicantCount + ' applied')}</span>` : '',
        ].filter(Boolean).join('');

        const url = jobPageUrl(job);

        return `
            <article class="job-row" style="--job-accent:${escAttr(accent)}">
                <a class="job-row-logo" href="${escAttr(url)}" aria-label="${escAttr(job.title || 'View job')}">${logoHtml}</a>
                <div class="job-row-body">
                    <div class="job-row-title-line">
                        <h3><a href="${escAttr(url)}">${escText(job.title || 'Untitled role')}</a></h3>
                        <div class="job-row-badges">${getSourceBadge(job)}${JobsBrowser.isFresh(job, 3) ? '<span class="job-pill job-pill--new">New</span>' : ''}</div>
                    </div>
                    <p class="job-row-company">${escText(job.company || 'Company')}</p>
                    ${metaBits ? `<div class="job-row-meta">${metaBits}</div>` : ''}
                    <div class="job-row-foot">${footBits}</div>
                </div>
                <div class="job-row-actions">
                    <a class="job-row-btn job-row-btn--ghost" href="${escAttr(url)}">View</a>
                    <a class="job-row-btn job-row-btn--primary" href="${escAttr(url)}#jpApplyForm">Apply</a>
                </div>
            </article>
        `;
    }

    function renderCuratedSections(sections) {
        const root = $('jobsCuratedSections');
        if (!root) return;

        if (!sections.length) {
            root.innerHTML = '';
            return;
        }

        root.innerHTML = sections.map(section => {
            const title = JobsBrowser.SECTION_LABELS[section.id] || section.id;
            const rows = section.jobs.map(job => renderJobRow(job)).join('');
            return `
                <section class="jobs-curated-block" aria-label="${escAttr(title)}">
                    <div class="jobs-curated-block-head">
                        <h2>${escText(title)}</h2>
                        <span>${section.jobs.length} role${section.jobs.length === 1 ? '' : 's'}</span>
                    </div>
                    <div class="jobs-curated-list">${rows}</div>
                </section>
            `;
        }).join('');
    }

    function renderJobs() {
        if (state.loading) return;

        const list = $('publicJobsList');
        const summary = $('jobsResultsSummary');
        const curatedRoot = $('jobsCuratedSections');
        const browseHeader = document.querySelector('.jobs-browse-header');
        const pagination = $('jobsPagination');
        const browseCount = $('jobsBrowseCount');
        if (!list) return;

        populateFilters();
        syncLocationChips();

        const filters = getFilters();
        const sort = getSortMode();
        const filtered = JobsBrowser.filterJobs(state.jobs, filters);
        const sorted = JobsBrowser.sortJobs(filtered, sort);
        const filtering = hasActiveFilters();

        let browseJobs = sorted;
        if (!filtering) {
            const grouped = JobsBrowser.buildJobSections(sorted);
            renderCuratedSections(grouped.sections);
            browseJobs = JobsBrowser.sortJobs(grouped.browse, sort);
            if (curatedRoot) curatedRoot.hidden = false;
            if (browseHeader) browseHeader.hidden = grouped.sections.length === 0;
        } else {
            if (curatedRoot) {
                curatedRoot.innerHTML = '';
                curatedRoot.hidden = true;
            }
            if (browseHeader) browseHeader.hidden = true;
        }

        const pageData = JobsBrowser.paginate(browseJobs, state.browsePage);

        if (summary) {
            summary.textContent = filtering
                ? `${sorted.length.toLocaleString()} match${sorted.length === 1 ? '' : 'es'} of ${state.jobs.length.toLocaleString()} live roles`
                : `${state.jobs.length.toLocaleString()} live roles across South Africa`;
        }

        if (browseCount) {
            browseCount.textContent = `${browseJobs.length.toLocaleString()} listing${browseJobs.length === 1 ? '' : 's'}`;
        }

        if (!sorted.length) {
            list.innerHTML = `
                <div class="public-jobs-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <h3>${state.jobs.length ? 'No matching jobs' : 'No jobs available yet'}</h3>
                    <p>${state.jobs.length ? 'Try a different keyword, location, or category.' : 'Check back soon or ask admin to refresh the job feed.'}</p>
                    ${state.jobs.length ? '<button type="button" class="jobs-clear-btn" id="emptyClearFilters">Clear filters</button>' : ''}
                </div>
            `;
            $('emptyClearFilters')?.addEventListener('click', clearFilters);
            if (pagination) pagination.hidden = true;
            return;
        }

        if (state.browsePage === 1) {
            list.innerHTML = pageData.items.map(job => renderJobRow(job)).join('');
        } else {
            list.insertAdjacentHTML('beforeend', pageData.items.map(job => renderJobRow(job)).join(''));
        }

        if (pagination) {
            pagination.hidden = !pageData.hasMore;
            const btn = $('jobsLoadMore');
            if (btn) {
                btn.textContent = `Load more (${Math.min(pageData.page * JobsBrowser.PAGE_SIZE, pageData.total)} of ${pageData.total})`;
            }
        }
    }

    function clearFilters() {
        if ($('publicJobKeyword')) $('publicJobKeyword').value = '';
        if ($('publicJobLocation')) $('publicJobLocation').value = '';
        if ($('publicJobType')) $('publicJobType').value = '';
        if ($('publicJobSort')) $('publicJobSort').value = 'newest';
        state.activeCategory = '';
        state.browsePage = 1;
        renderCategoryChips();
        renderJobs();
    }

    function buildJobDetailsHtml(job) {
        const sections = [];
        if (job.description) sections.push(`<section><h3>Description</h3><p>${escText(job.description)}</p></section>`);
        if (job.requirements) sections.push(`<section><h3>Requirements</h3><p>${escText(job.requirements)}</p></section>`);
        const skills = normalizeList(job.skills);
        if (skills.length) {
            sections.push(`<section><h3>Skills</h3><div class="public-job-skill-chips">${skills.map(s => `<span>${escText(s)}</span>`).join('')}</div></section>`);
        }
        if (getClosingDate(job)) {
            sections.push(`<section><h3>Closing date</h3><p>${new Date(getClosingDate(job)).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</p></section>`);
        }
        return sections.join('') || '<p>More details available on the full listing.</p>';
    }

    function openPreview(jobId) {
        const job = getJobById(jobId);
        if (!job) return;
        state.selectedJobId = job.id;
        $('jobPreviewCompany').textContent = job.company || 'Company';
        $('jobPreviewTitle').textContent = job.title || 'Untitled role';
        $('jobPreviewMeta').innerHTML = renderMetaPills(job);
        $('jobPreviewBody').innerHTML = buildJobDetailsHtml(job);
        openModal('jobPreviewModal');
    }

    function buildApplyUrl(base, jobId) {
        return `${base}?${new URLSearchParams({ return: 'jobs', job: String(jobId || '') })}`;
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
                : 'Browse as a guest — sign in or create a free account when you are ready to apply.';
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
        $('navHamburger')?.addEventListener('click', () => $('mobileNavMenu')?.classList.toggle('open'));

        $('publicJobKeyword')?.addEventListener('input', () => {
            state.browsePage = 1;
            debouncedRender();
        });

        [$('publicJobLocation'), $('publicJobType'), $('publicJobSort')].forEach(input => {
            input?.addEventListener('change', () => {
                state.browsePage = 1;
                renderJobs();
            });
        });

        document.querySelectorAll('[data-location-filter]').forEach(button => {
            button.addEventListener('click', () => {
                const location = button.getAttribute('data-location-filter') || '';
                if ($('publicJobLocation')) $('publicJobLocation').value = location;
                state.browsePage = 1;
                renderJobs();
            });
        });

        $('clearJobFilters')?.addEventListener('click', clearFilters);

        $('jobsFilterToggle')?.addEventListener('click', () => {
            const panel = $('jobsAdvancedFilters');
            const btn = $('jobsFilterToggle');
            if (!panel || !btn) return;
            const open = panel.classList.toggle('is-open');
            btn.classList.toggle('is-active', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        $('jobsLoadMore')?.addEventListener('click', () => {
            state.browsePage += 1;
            renderJobs();
        });

        $('publicJobsList')?.addEventListener('click', event => {
            const viewButton = event.target.closest('[data-view-job]');
            const applyButton = event.target.closest('[data-apply-job]');
            if (viewButton) openPreview(viewButton.getAttribute('data-view-job'));
            if (applyButton) applyForJob(applyButton.getAttribute('data-apply-job'));
        });

        $('jobsCuratedSections')?.addEventListener('click', event => {
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

        document.querySelectorAll('[data-close-job-modal]').forEach(btn => btn.addEventListener('click', () => closeModal('jobPreviewModal')));
        document.querySelectorAll('[data-close-login-modal]').forEach(btn => btn.addEventListener('click', () => closeModal('jobLoginModal')));

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            closeModal('jobPreviewModal');
            closeModal('jobLoginModal');
        });
    }

    function syncNavOffset() {
        const nav = document.querySelector('.landing-nav');
        if (!nav) return;
        document.documentElement.style.setProperty('--jb-nav-h', `${nav.offsetHeight}px`);
    }

    async function init() {
        bindEvents();
        syncNavOffset();
        window.addEventListener('resize', syncNavOffset, { passive: true });
        renderCategoryChips();
        await Promise.all([loadSession(), loadJobs()]);
        populateFilters();
        renderJobs();

        const jobId = new URLSearchParams(window.location.search).get('job');
        if (jobId && getJobById(jobId)) openPreview(jobId);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
