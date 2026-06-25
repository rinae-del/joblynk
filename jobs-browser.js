/**
 * JobLynk Jobs Browser — shared filtering, grouping, relevance & pagination.
 */
const JobsBrowser = (() => {
    const PAGE_SIZE = 24;

    const SA_REGIONS = {
        johannesburg: ['johannesburg', 'sandton', 'rosebank', 'midrand', 'randburg', 'gauteng', 'fourways', 'soweto'],
        'cape town': ['cape town', 'stellenbosch', 'paarl', 'bellville', 'western cape', 'somerset west'],
        durban: ['durban', 'umhlanga', 'pinetown', 'kwazulu-natal', 'kwa zulu natal', 'kzn'],
        pretoria: ['pretoria', 'centurion', 'menlyn', 'hatfield', 'tyger valley'],
        remote: ['remote', 'work from home', 'wfh', 'hybrid remote', 'anywhere'],
    };

    const CATEGORIES = [
        { id: '', label: 'All roles', icon: 'fa-grid-2', keywords: [] },
        { id: 'tech', label: 'IT & Tech', icon: 'fa-laptop-code', keywords: ['developer', 'software', 'engineer', 'data', 'analyst', 'devops', 'it ', 'tech', 'programmer', 'cloud', 'cyber', 'support'] },
        { id: 'finance', label: 'Finance', icon: 'fa-chart-line', keywords: ['accountant', 'finance', 'bookkeeper', 'audit', 'payroll', 'tax'] },
        { id: 'sales', label: 'Sales', icon: 'fa-handshake', keywords: ['sales', 'business development', 'account executive', 'retail'] },
        { id: 'admin', label: 'Admin', icon: 'fa-clipboard', keywords: ['admin', 'office', 'receptionist', 'secretary', 'personal assistant', 'pa '] },
        { id: 'health', label: 'Healthcare', icon: 'fa-heart-pulse', keywords: ['nurse', 'health', 'medical', 'clinical', 'caregiver', 'pharmacy'] },
        { id: 'logistics', label: 'Logistics', icon: 'fa-truck', keywords: ['driver', 'warehouse', 'logistics', 'courier', 'supply chain'] },
    ];

    function debounce(fn, wait = 280) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    function normalizeText(value = '') {
        return String(value || '').trim().toLowerCase();
    }

    function jobSearchText(job) {
        return [
            job.title, job.company, job.location, job.type, job.description,
            job.requirements, job.skills, job.jobReference,
        ].map(normalizeText).join(' ');
    }

    function matchesLocation(jobLocation, filter) {
        const loc = normalizeText(jobLocation);
        if (!filter) return true;

        const key = normalizeText(filter);
        if (loc.includes(key)) return true;

        const aliases = SA_REGIONS[key] || [];
        return aliases.some(alias => loc.includes(alias));
    }

    function matchesCategory(job, categoryId) {
        if (!categoryId) return true;
        const cat = CATEGORIES.find(item => item.id === categoryId);
        if (!cat || !cat.keywords.length) return true;
        const haystack = jobSearchText(job);
        return cat.keywords.some(kw => haystack.includes(kw));
    }

    function matchesKeyword(job, keyword) {
        const query = normalizeText(keyword);
        if (!query) return true;

        const tokens = query.split(/\s+/).filter(Boolean);
        const haystack = jobSearchText(job);
        return tokens.every(token => haystack.includes(token));
    }

    function getSalaryNumber(job) {
        const raw = String(job.salaryTo || job.salaryFrom || job.salary_to || job.salary_from || '').replace(/[^\d.]/g, '');
        return Number(raw) || 0;
    }

    function getPostedTime(job) {
        return new Date(job.postedAt || job.created_at || 0).getTime() || 0;
    }

    function isRemote(job) {
        return matchesLocation(job.location, 'remote');
    }

    function isNative(job) {
        return (job.source || 'native') === 'native';
    }

    function isFresh(job, days = 7) {
        const posted = getPostedTime(job);
        if (!posted) return false;
        return (Date.now() - posted) <= days * 86400000;
    }

    function filterJobs(jobs, filters = {}) {
        return jobs.filter(job => {
            if (job.status === 'closed') return false;
            return matchesKeyword(job, filters.keyword)
                && matchesLocation(job.location, filters.location)
                && matchesCategory(job, filters.category)
                && (!filters.type || normalizeText(job.type) === normalizeText(filters.type))
                && (!filters.source || (job.source || 'native') === filters.source);
        });
    }

    function scoreRelevance(job, profile = null) {
        let score = 0;
        const haystack = jobSearchText(job);
        const loc = normalizeText(job.location);

        if (isNative(job)) score += 12;
        if (isFresh(job, 3)) score += 10;
        else if (isFresh(job, 7)) score += 5;

        if (!profile) return score;

        const userLoc = normalizeText(profile.location);
        if (userLoc && (loc.includes(userLoc) || matchesLocation(job.location, userLoc))) {
            score += 25;
        }

        const jobTitle = normalizeText(profile.job_title || profile.jobTitle);
        if (jobTitle) {
            const titleTokens = jobTitle.split(/\s+/).filter(t => t.length > 2);
            titleTokens.forEach(token => {
                if (haystack.includes(token)) score += 8;
            });
        }

        const skills = Array.isArray(profile.skills) ? profile.skills : [];
        skills.forEach(skill => {
            const s = normalizeText(skill);
            if (s.length > 2 && haystack.includes(s)) score += 6;
        });

        if (isRemote(job) && userLoc.includes('remote')) score += 8;

        return score;
    }

    function sortJobs(jobs, sortBy = 'newest', profile = null) {
        const list = [...jobs];

        if (sortBy === 'recommended' && profile) {
            return list.sort((a, b) => scoreRelevance(b, profile) - scoreRelevance(a, profile) || getPostedTime(b) - getPostedTime(a));
        }

        if (sortBy === 'salary') {
            return list.sort((a, b) => getSalaryNumber(b) - getSalaryNumber(a));
        }

        if (sortBy === 'closing') {
            return list.sort((a, b) => {
                const left = new Date(a.closingDate || a.closing_date || 0).getTime() || Number.MAX_SAFE_INTEGER;
                const right = new Date(b.closingDate || b.closing_date || 0).getTime() || Number.MAX_SAFE_INTEGER;
                return left - right;
            });
        }

        return list.sort((a, b) => getPostedTime(b) - getPostedTime(a));
    }

    function uniqueById(jobs) {
        const seen = new Set();
        return jobs.filter(job => {
            const id = String(job.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    /**
     * Build curated sections + main browse list (deduped).
     */
    function buildJobSections(jobs, profile = null, options = {}) {
        const maxFeatured = options.maxFeatured || 4;
        const maxFresh = options.maxFresh || 8;
        const maxRecommended = options.maxRecommended || 6;
        const sorted = sortJobs(jobs, profile ? 'recommended' : 'newest', profile);
        const used = new Set();
        const sections = [];

        const take = (list, limit, id) => {
            const picked = [];
            for (const job of list) {
                if (picked.length >= limit) break;
                const key = String(job.id);
                if (used.has(key)) continue;
                used.add(key);
                picked.push(job);
            }
            if (picked.length) {
                sections.push({ id, title: id, jobs: picked });
            }
            return picked;
        };

        if (profile) {
            const recommended = [...sorted].sort((a, b) => scoreRelevance(b, profile) - scoreRelevance(a, profile));
            take(recommended.filter(j => scoreRelevance(j, profile) >= 10), maxRecommended, 'recommended');
        }

        take(sorted.filter(isNative), maxFeatured, 'featured');

        take(sorted.filter(j => isFresh(j, 7)), maxFresh, 'fresh');

        if (!profile) {
            take(sorted.filter(isRemote), 6, 'remote');
        }

        const browse = sorted.filter(job => !used.has(String(job.id)));

        return { sections, browse: uniqueById(browse), allSorted: sorted };
    }

    function getTopLocations(jobs, limit = 14) {
        const counts = new Map();

        Object.keys(SA_REGIONS).forEach(region => counts.set(region, 0));

        jobs.forEach(job => {
            const loc = normalizeText(job.location);
            if (!loc) return;
            Object.entries(SA_REGIONS).forEach(([region, aliases]) => {
                if (loc.includes(region) || aliases.some(a => loc.includes(a))) {
                    counts.set(region, (counts.get(region) || 0) + 1);
                }
            });
        });

        return [...counts.entries()]
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([region, count]) => ({ region, count, label: region.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
    }

    function paginate(jobs, page = 1, pageSize = PAGE_SIZE) {
        const total = jobs.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * pageSize;
        return {
            items: jobs.slice(start, start + pageSize),
            page: safePage,
            totalPages,
            total,
            hasMore: safePage < totalPages,
        };
    }

    function getUniqueTypes(jobs) {
        return [...new Set(jobs.map(j => j.type).filter(Boolean))].sort();
    }

    const SECTION_LABELS = {
        recommended: 'Recommended for you',
        featured: 'Featured on JobLynk',
        fresh: 'New this week',
        remote: 'Remote & flexible',
    };

    return {
        PAGE_SIZE,
        SA_REGIONS,
        CATEGORIES,
        SECTION_LABELS,
        debounce,
        filterJobs,
        sortJobs,
        scoreRelevance,
        buildJobSections,
        getTopLocations,
        getUniqueTypes,
        paginate,
        matchesLocation,
        isNative,
        isFresh,
        isRemote,
    };
})();
