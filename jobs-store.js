/**
 * JobLynk Jobs Store
 * API-backed utility for job postings and applications.
 * Falls back to localStorage when the API is unavailable.
 * Used by both recruiter-dashboard.js and dashboard.js
 */

const JobsStore = (() => {
    const JOBS_KEY = 'JobLynk_jobs';
    const APPS_KEY = 'JobLynk_applications';
    const API_JOBS = 'api/jobs/index.php';
    const API_APPS = 'api/applications/index.php';

    // ── Cache ──
    let _jobsCache = null;
    let _appsCache = null;

    // ── Helper for fetch ──
    async function apiFetch(url, opts = {}) {
        opts.credentials = 'include';
        if (opts.body && typeof opts.body === 'object') {
            opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
            opts.body = JSON.stringify(opts.body);
        }
        const res = await fetch(url, opts);
        return res.json();
    }

    // ── JOBS ──

    async function fetchJobs() {
        try {
            const result = await apiFetch(API_JOBS);
            if (result.success && result.jobs) {
                _jobsCache = result.jobs.map(normalizeJob);
                // Sync to localStorage as backup
                localStorage.setItem(JOBS_KEY, JSON.stringify(_jobsCache));
                return _jobsCache;
            }
        } catch (e) { console.warn('Jobs API failed:', e); }
        // Fallback
        return getJobsLocal();
    }

    function normalizeJob(j) {
        return {
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location || '',
            type: j.type || 'Full-time',
            description: j.description || '',
            requirements: j.requirements || '',
            skills: j.skills || '',
            salaryFrom: j.salary_from || j.salaryFrom || '',
            salaryTo: j.salary_to || j.salaryTo || '',
            salaryPeriod: j.salary_period || j.salaryPeriod || 'Per Month',
            benefits: j.benefits || [],
            closingDate: j.closing_date || j.closingDate || '',
            customFields: j.custom_fields || j.customFields || [],
            status: j.status || 'active',
            postedAt: j.created_at || j.postedAt || new Date().toISOString(),
            applicants: j.applicant_count || j.applicants || 0,
            color: j.color || '#3B4BA6',
        };
    }

    function getJobsLocal() {
        try {
            return JSON.parse(localStorage.getItem(JOBS_KEY)) || [];
        } catch { return []; }
    }

    // Sync version for backwards compat (returns cached or localStorage)
    function getJobs() {
        if (_jobsCache) return _jobsCache;
        return getJobsLocal();
    }

    function getActiveJobs() {
        return getJobs().filter(j => j.status === 'active');
    }

    function getJobById(id) {
        return getJobs().find(j => String(j.id) === String(id)) || null;
    }

    async function addJob(jobData) {
        // Try API
        try {
            const result = await apiFetch(API_JOBS, { method: 'POST', body: jobData });
            if (result.success) {
                await fetchJobs(); // Refresh cache
                return { id: result.id, ...jobData };
            }
            // Propagate credit errors
            if (result.no_credits) {
                return { no_credits: true };
            }
        } catch (e) { console.warn('API addJob failed:', e); }

        // Fallback
        const jobs = getJobsLocal();
        const colors = ['#DC2626', '#2563EB', '#059669', '#7C3AED', '#D97706', '#EC4899'];
        const job = {
            id: 'job_' + Date.now(),
            ...jobData,
            status: 'active',
            postedAt: new Date().toISOString(),
            applicants: 0,
            color: colors[jobs.length % colors.length]
        };
        jobs.push(job);
        localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
        _jobsCache = jobs;
        return job;
    }

    async function updateJob(id, updates) {
        try {
            const result = await apiFetch(API_JOBS, { method: 'POST', body: { id, ...updates } });
            if (result.success) {
                await fetchJobs();
                return;
            }
        } catch (e) { console.warn('API updateJob failed:', e); }

        const jobs = getJobsLocal();
        const idx = jobs.findIndex(j => String(j.id) === String(id));
        if (idx >= 0) {
            jobs[idx] = { ...jobs[idx], ...updates };
            localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
            _jobsCache = jobs;
        }
    }

    // ── APPLICATIONS ──

    async function fetchApplications() {
        try {
            const result = await apiFetch(API_APPS);
            if (result.success && result.applications) {
                _appsCache = result.applications.map(normalizeApp);
                localStorage.setItem(APPS_KEY, JSON.stringify(_appsCache));
                return _appsCache;
            }
        } catch (e) { console.warn('Applications API failed:', e); }
        return getAppsLocal();
    }

    function normalizeApp(a) {
        return {
            id: a.id,
            jobId: a.job_id || a.jobId,
            cvId: a.cv_id || a.cvId || null,
            clId: a.cl_id || a.clId || null,
            applicantName: a.applicant_name || a.applicantName || '',
            status: a.status || 'submitted',
            submittedAt: a.created_at || a.submittedAt || new Date().toISOString(),
            // Enriched data from API joins
            jobTitle: a.job_title || '',
            jobCompany: a.job_company || '',
            jobColor: a.job_color || '#3B4BA6',
            jobLocation: a.job_location || '',
            jobType: a.job_type || '',
        };
    }

    function getAppsLocal() {
        try {
            return JSON.parse(localStorage.getItem(APPS_KEY)) || [];
        } catch { return []; }
    }

    function getApplications() {
        if (_appsCache) return _appsCache;
        return getAppsLocal();
    }

    async function submitApplication(jobId, applicationData) {
        // Try API
        try {
            const payload = {
                job_id: jobId,
                cv_id: applicationData.cvId || null,
                cl_id: applicationData.clId || null,
                note: applicationData.note || '',
                form_responses: applicationData.formResponses || null,
            };
            const result = await apiFetch(API_APPS, { method: 'POST', body: payload });
            if (result.success) {
                await fetchApplications();
                await fetchJobs(); // Refresh applicant counts
                return { id: result.id, jobId, ...applicationData };
            }
        } catch (e) { console.warn('API submitApplication failed:', e); }

        // Fallback
        const apps = getAppsLocal();
        const app = {
            id: 'app_' + Date.now(),
            jobId,
            ...applicationData,
            status: 'submitted',
            submittedAt: new Date().toISOString()
        };
        apps.push(app);
        localStorage.setItem(APPS_KEY, JSON.stringify(apps));
        _appsCache = apps;

        // Increment local job applicant count
        const jobs = getJobsLocal();
        const job = jobs.find(j => String(j.id) === String(jobId));
        if (job) {
            job.applicants = (job.applicants || 0) + 1;
            localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
            _jobsCache = jobs;
        }

        return app;
    }

    function hasApplied(jobId) {
        return getApplications().some(a => String(a.jobId) === String(jobId));
    }

    // ── Init: fetch from API on load ──
    async function init() {
        await Promise.all([fetchJobs(), fetchApplications()]);
    }

    return {
        init, fetchJobs, fetchApplications,
        getJobs, getActiveJobs, getJobById, addJob, updateJob,
        getApplications, submitApplication, hasApplied
    };
})();
