(() => {
    const $ = id => document.getElementById(id);

    function escText(value = '') {
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    function escAttr(value = '') {
        return escText(value).replace(/"/g, '&quot;');
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

    function formatRelativeAge(dateValue) {
        const parsed = new Date(dateValue).getTime();
        if (!parsed) return 'Recently posted';
        const days = Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
        if (days === 0) return 'Posted today';
        if (days === 1) return 'Posted yesterday';
        return `Posted ${days} days ago`;
    }

    function formatSalaryLabel(job) {
        if (job.hideSalary) return '';
        const fmt = v => {
            const raw = String(v || '').trim();
            if (!raw) return '';
            const n = Number(raw.replace(/[\s,]/g, ''));
            return n ? `R${new Intl.NumberFormat('en-ZA', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}` : raw;
        };
        const from = fmt(job.salaryFrom || job.salary_from);
        const to = fmt(job.salaryTo || job.salary_to);
        const note = String(job.salaryNote || job.salary_note || '').trim();
        const period = String(job.salaryPeriod || job.salary_period || 'Per Month').replace(/^Per\s+/i, 'per ');
        let salary = '';
        if (from && to) salary = `${from} – ${to} ${period}`;
        else if (from) salary = `${from} ${period}`;
        else if (to) salary = `${to} ${period}`;
        return [salary, note].filter(Boolean).join(', ');
    }

    function resolveLogoUrl(url) {
        const path = String(url || '').trim();
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        const root = window.location.pathname.replace(/[^/]*$/, '');
        return `${window.location.origin}${root}${path.replace(/^\//, '')}`;
    }

    function hasCompanyLogo(job) {
        return Boolean(resolveLogoUrl(job.companyLogoUrl || job.company_logo_url || ''));
    }

    function renderJobRow(job) {
        const company = job.company || 'Company';
        const logo = resolveLogoUrl(job.companyLogoUrl || job.company_logo_url || '');
        const accent = /^#[0-9A-Fa-f]{3,6}$/.test(String(job.color || '').trim()) ? job.color : '#6366F1';
        const salary = formatSalaryLabel(job);

        const meta = [
            job.location ? `<span>${escText(job.location)}</span>` : '',
            job.type ? `<span>${escText(job.type)}</span>` : '',
            `<span>${escText(formatRelativeAge(job.postedAt || job.created_at))}</span>`,
        ].filter(Boolean).join('');

        const url = jobPageUrl(job);

        return `
            <a class="home-job-row" href="${escAttr(url)}" style="--job-accent:${escAttr(accent)}">
                <div class="home-job-logo"><img src="${escAttr(logo)}" alt="" loading="lazy" decoding="async"></div>
                <div class="home-job-body">
                    <h3>${escText(job.title || 'Untitled role')}</h3>
                    <p class="home-job-company">${escText(company)}</p>
                    ${salary ? `<p class="home-job-salary"><i class="fa-solid fa-wallet" aria-hidden="true"></i>${escText(salary)}</p>` : ''}
                    <div class="home-job-meta">${meta}</div>
                </div>
                <span class="home-job-cta">View role</span>
            </a>
        `;
    }

    async function loadFeaturedJobs() {
        const list = $('homeFeaturedJobs');
        const lead = $('homeJobsLead');
        if (!list) return;

        list.innerHTML = '<div class="home-jobs-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading live roles…</div>';

        try {
            if (typeof JobsStore !== 'undefined') {
                await JobsStore.fetchJobs();
            } else {
                const res = await fetch('api/jobs/index.php', { credentials: 'include' });
                const data = await res.json();
                if (!data.success || !Array.isArray(data.jobs)) throw new Error('No jobs');
            }

            const jobs = typeof JobsBrowser !== 'undefined'
                ? JobsBrowser.sortJobs(JobsStore.getActiveJobs(), 'newest')
                : (JobsStore?.getActiveJobs?.() || []).slice();

            const withLogo = jobs.filter(hasCompanyLogo);
            const featured = withLogo.slice(0, 4);

            if (lead) {
                lead.textContent = featured.length
                    ? `${jobs.length.toLocaleString()} open roles — live picks with company branding below.`
                    : withLogo.length
                        ? 'Check back soon for new roles.'
                        : `${jobs.length.toLocaleString()} open roles — upload a company logo to appear here.`;
            }

            if (!featured.length) {
                list.innerHTML = withLogo.length
                    ? '<div class="home-jobs-empty">No featured roles right now. <a href="jobs.html">Browse the job board</a>.</div>'
                    : `<div class="home-jobs-empty">${jobs.length ? 'Featured roles need a company logo. <a href="jobs.html">Browse all ' + jobs.length.toLocaleString() + ' roles</a>.' : 'No live roles right now. <a href="jobs.html">Browse the job board</a>.'}</div>`;
                return;
            }

            list.innerHTML = featured.map(job => renderJobRow(job)).join('');
        } catch (error) {
            console.warn('Featured jobs failed:', error);
            if (lead) lead.textContent = 'Browse jobs across SA cities.';
            list.innerHTML = '<div class="home-jobs-empty">Could not load jobs right now. <a href="jobs.html">Open the job board</a>.</div>';
        }
    }

    document.addEventListener('DOMContentLoaded', loadFeaturedJobs);
})();
