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
        if (from && to) return `${from} – ${to}`;
        if (from) return `From ${from}`;
        if (to) return `Up to ${to}`;
        return '';
    }

    function renderJobRow(job) {
        const company = job.company || 'Company';
        const initial = company.trim().charAt(0).toUpperCase() || 'J';
        const logo = job.companyLogoUrl || job.company_logo_url || '';
        const accent = /^#[0-9A-Fa-f]{3,6}$/.test(String(job.color || '').trim()) ? job.color : '#6366F1';
        const salary = formatSalaryLabel(job);
        const logoHtml = logo
            ? `<img src="${escAttr(logo)}" alt="" loading="lazy" decoding="async">`
            : escText(initial);

        const meta = [
            job.location ? `<span>${escText(job.location)}</span>` : '',
            job.type ? `<span>${escText(job.type)}</span>` : '',
            salary ? `<span class="is-salary">${escText(salary)}</span>` : '',
            `<span>${escText(formatRelativeAge(job.postedAt || job.created_at))}</span>`,
        ].filter(Boolean).join('');

        const url = jobPageUrl(job);

        return `
            <a class="home-job-row" href="${escAttr(url)}" style="--job-accent:${escAttr(accent)}">
                <div class="home-job-logo">${logoHtml}</div>
                <div class="home-job-body">
                    <h3>${escText(job.title || 'Untitled role')}</h3>
                    <p class="home-job-company">${escText(company)}</p>
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

            const featured = jobs.slice(0, 4);

            if (lead) {
                lead.textContent = featured.length
                    ? `A hand-picked sample of ${jobs.length.toLocaleString()} open roles — view the full board for every listing.`
                    : 'New roles are added regularly. Check back soon or browse the full board.';
            }

            if (!featured.length) {
                list.innerHTML = '<div class="home-jobs-empty">No live roles right now. <a href="jobs.html">Browse the job board</a>.</div>';
                return;
            }

            list.innerHTML = featured.map(job => renderJobRow(job)).join('');
        } catch (error) {
            console.warn('Featured jobs failed:', error);
            if (lead) lead.textContent = 'Browse vacancies across Johannesburg, Cape Town, Durban and nationwide.';
            list.innerHTML = '<div class="home-jobs-empty">Could not load jobs right now. <a href="jobs.html">Open the job board</a>.</div>';
        }
    }

    document.addEventListener('DOMContentLoaded', loadFeaturedJobs);
})();
