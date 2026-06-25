(() => {
    const $ = id => document.getElementById(id);
    const FEATURED_LIMIT = 4;

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
        const combined = [salary, note].filter(Boolean).join(' · ');
        if (combined) return combined;
        if (job.hideSalary || job.hide_salary) return '';
        return '';
    }

    function jobHasSalary(job) {
        return Boolean(formatSalaryLabel(job));
    }

    function pickFeaturedJobs(jobs) {
        return [...jobs]
            .sort((a, b) => Number(jobHasSalary(b)) - Number(jobHasSalary(a)))
            .slice(0, FEATURED_LIMIT);
    }

    function renderJobRow(job) {
        const company = job.company || 'Company';
        const salary = formatSalaryLabel(job);

        const meta = [
            salary ? `<span class="is-salary">${escText(salary)}</span>` : '',
            job.location ? `<span>${escText(job.location)}</span>` : '',
            job.type ? `<span>${escText(job.type)}</span>` : '',
            `<span>${escText(formatRelativeAge(job.postedAt || job.created_at))}</span>`,
        ].filter(Boolean).join('');

        const url = jobPageUrl(job);

        return `
            <a class="home-job-row" href="${escAttr(url)}">
                <div class="home-job-body">
                    <h3>${escText(job.title || 'Untitled role')}</h3>
                    <p class="home-job-company">${escText(company)}</p>
                    <div class="home-job-meta">${meta}</div>
                </div>
                <span class="home-job-cta">View role</span>
            </a>
        `;
    }

    function updateHeroStats(jobCount) {
        const heroCount = $('homeHeroJobCount');
        if (heroCount) {
            heroCount.textContent = jobCount > 0 ? jobCount.toLocaleString() : '—';
        }
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
                const res = await fetch('api/jobs/index.php', { credentials: 'include', cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data.success || !Array.isArray(data.jobs)) throw new Error('No jobs');
            }

            const jobs = typeof JobsBrowser !== 'undefined'
                ? JobsBrowser.sortJobs(JobsStore.getActiveJobs(), 'newest')
                : (JobsStore?.getActiveJobs?.() || []).slice();

            const featured = pickFeaturedJobs(jobs);

            updateHeroStats(jobs.length);

            if (lead) {
                lead.textContent = featured.length
                    ? `${jobs.length.toLocaleString()} open roles — ${featured.length} live picks below.`
                    : 'Check back soon for new roles.';
            }

            if (!featured.length) {
                list.innerHTML = '<div class="home-jobs-empty">No live roles right now. <a href="jobs.html">Browse the job board</a>.</div>';
                return;
            }

            list.innerHTML = featured.map(job => renderJobRow(job)).join('');
        } catch (error) {
            console.warn('Featured jobs failed:', error);
            if (lead) lead.textContent = 'Browse jobs across SA cities.';
            list.innerHTML = '<div class="home-jobs-empty">Could not load jobs right now. <a href="jobs.html">Open the job board</a>.</div>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadFeaturedJobs();
        initHomeNavScroll();
    });

    function initHomeNavScroll() {
        const SCROLL_THRESHOLD = 12;

        function syncNavScrollState() {
            document.body.classList.toggle('is-nav-scrolled', window.scrollY > SCROLL_THRESHOLD);
        }

        syncNavScrollState();
        window.addEventListener('scroll', syncNavScrollState, { passive: true });
    }
})();
