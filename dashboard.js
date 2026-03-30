/* ======================================
   JOBLYNK DASHBOARD – Script
   ====================================== */
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);

    // ============================
    // SIDEBAR MOBILE TOGGLE
    // ============================
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    const hamburger = $('btnHamburger');
    const hamburgerTop = $('btnHamburgerTop');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    hamburger?.addEventListener('click', toggleSidebar);
    hamburgerTop?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // ============================
    // SAVED CVs & COVER LETTERS
    // ============================
    const cvCardGrid = $('cvCardGrid');
    const clCardGrid = $('clCardGrid');

    function getSavedData(key) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    function getTimeAgo(dateStr) {
        const now = new Date();
        const past = new Date(dateStr);
        const diffMs = now - past;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} min ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
        return past.toLocaleDateString();
    }

    // Normalized doc object from API or localStorage
    function normalizeDoc(raw, source) {
        if (source === 'api') {
            return {
                id: raw.id,
                name: raw.name || 'Untitled',
                lastEdited: raw.updated_at || raw.created_at,
                accentColor: raw.accent_color || '#3B4BA6',
                type: raw.doc_type,
            };
        }
        return {
            id: raw.id,
            name: raw.name || 'Untitled',
            lastEdited: raw.lastEdited || new Date().toISOString(),
            accentColor: raw.accentColor || '#3B4BA6',
            type: raw.type,
        };
    }

    async function renderCards() {
        cvCardGrid.querySelectorAll('.doc-card-existing').forEach(c => c.remove());
        clCardGrid.querySelectorAll('.doc-card-existing').forEach(c => c.remove());

        let cvs = [];
        let cls = [];

        // Try API first
        try {
            const res = await fetch('api/documents/index.php', { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.documents) {
                result.documents.forEach(d => {
                    const nd = normalizeDoc(d, 'api');
                    if (nd.type === 'cv') cvs.push(nd);
                    else if (nd.type === 'cl') cls.push(nd);
                });
            }
        } catch (e) {
            console.warn('API failed, using localStorage:', e);
            getSavedData('joblynk_cvs').forEach(d => cvs.push(normalizeDoc(d, 'local')));
            getSavedData('joblynk_cls').forEach(d => cls.push(normalizeDoc(d, 'local')));
        }

        // CVs
        if (cvs.length === 0) {
            cvCardGrid.appendChild(createDocCard({
                id: 'sample', name: 'Untitled CV',
                lastEdited: new Date().toISOString(),
                accentColor: '#3B4BA6', type: 'cv'
            }));
        } else {
            cvs.forEach(cv => cvCardGrid.appendChild(createDocCard(cv)));
        }

        // Cover Letters
        if (cls.length === 0) {
            clCardGrid.appendChild(createDocCard({
                id: 'sample', name: 'Untitled Cover Letter',
                lastEdited: new Date().toISOString(),
                accentColor: '#0F766E', type: 'cl'
            }));
        } else {
            cls.forEach(cl => clCardGrid.appendChild(createDocCard(cl)));
        }

        updateStats(cvs.length || 1, cls.length || 1);
    }

    function updateStats(cvCount, clCount) {
        const statCvs = $('statCvs');
        const statCls = $('statCls');
        if (statCvs) statCvs.textContent = cvCount;
        if (statCls) statCls.textContent = clCount;
    }

    function createDocCard(doc) {
        const card = document.createElement('a');
        const urlBase = doc.type === 'cv' ? 'cv-builder.html' : 'cover-letter.html';
        card.href = `${urlBase}${doc.id !== 'sample' ? '?id=' + doc.id : ''}`;
        card.className = 'doc-card doc-card-existing';

        const accent = doc.accentColor || (doc.type === 'cv' ? '#3B4BA6' : '#0F766E');
        const docLabel = doc.type === 'cv' ? 'Curriculum Vitae' : 'Cover Letter';
        
        const miniBodyHtml = doc.type === 'cv' ? `
            <div class="cv-mini-line w60"></div>
            <div class="cv-mini-line w80"></div>
            <div class="cv-mini-line w40"></div>
            <div class="cv-mini-line w100"></div>
            <div class="cv-mini-line w60"></div>
        ` : `
            <div class="cv-mini-line w30"></div>
            <div class="cv-mini-line w100" style="margin-top:4px"></div>
            <div class="cv-mini-line w100"></div>
            <div class="cv-mini-line w90"></div>
            <div class="cv-mini-line w90"></div>
            <div class="cv-mini-line w60"></div>
        `;

        card.innerHTML = `
            <div class="doc-card-thumb">
                <div class="cv-mini">
                    <div class="cv-mini-header" style="background:${accent}">
                        <span class="cv-mini-header-label">${docLabel}</span>
                    </div>
                    <div class="cv-mini-body">
                        ${miniBodyHtml}
                    </div>
                    <div class="cv-mini-wave" style="background:${accent}"></div>
                </div>
                <button class="doc-card-actions" onclick="event.preventDefault(); event.stopPropagation(); toggleCardMenu(this);">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div class="card-action-menu">
                    <button onclick="event.preventDefault(); editDoc('${doc.id}', '${doc.type}')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="event.preventDefault(); duplicateDoc('${doc.id}', '${doc.type}')"><i class="fa-regular fa-copy"></i> Duplicate</button>
                    <button onclick="event.preventDefault(); renameDoc('${doc.id}', '${doc.type}')"><i class="fa-solid fa-i-cursor"></i> Rename</button>
                    <button class="danger" onclick="event.preventDefault(); deleteDoc('${doc.id}', '${doc.type}')"><i class="fa-regular fa-trash-can"></i> Delete</button>
                </div>
            </div>
            <div class="doc-card-footer">
                <div class="doc-card-name">${doc.name || 'Untitled ' + (doc.type==='cv'?'CV':'Cover Letter')}</div>
                <div class="doc-card-date">Edited ${getTimeAgo(doc.lastEdited)}</div>
            </div>
        `;

        return card;
    }

    // Card action menu toggle
    window.toggleCardMenu = function (btn) {
        const menu = btn.nextElementSibling;
        document.querySelectorAll('.card-action-menu.open').forEach(m => {
            if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
    };

    window.editDoc = function (id, type) {
        const urlBase = type === 'cv' ? 'cv-builder.html' : 'cover-letter.html';
        window.location.href = `${urlBase}?id=${id}`;
    };

    window.duplicateDoc = async function (id, type) {
        // Try API duplicate
        try {
            const res = await fetch('api/documents/index.php?id=' + encodeURIComponent(id), { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.document) {
                const doc = result.document;
                const payload = {
                    doc_type: doc.doc_type,
                    name: (doc.name || 'Untitled') + ' (Copy)',
                    accent_color: doc.accent_color,
                    data: typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data,
                };
                await fetch('api/documents/index.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
                renderCards();
                return;
            }
        } catch (e) { console.warn('API duplicate failed:', e); }

        // Fallback
        const key = type === 'cv' ? 'joblynk_cvs' : 'joblynk_cls';
        const docs = getSavedData(key);
        const original = docs.find(c => String(c.id) === String(id));
        if (!original) return;
        const copy = { ...original, id: Date.now().toString(), name: (original.name || 'Untitled') + ' (Copy)', lastEdited: new Date().toISOString() };
        docs.push(copy);
        localStorage.setItem(key, JSON.stringify(docs));
        renderCards();
    };

    window.renameDoc = async function (id, type) {
        const newName = prompt('Enter new name:');
        if (newName === null || newName.trim() === '') return;

        // Try API rename
        try {
            const res = await fetch('api/documents/index.php?id=' + encodeURIComponent(id), { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.document) {
                const doc = result.document;
                await fetch('api/documents/index.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id: doc.id, doc_type: doc.doc_type, name: newName.trim(), accent_color: doc.accent_color, data: typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data }),
                });
                renderCards();
                return;
            }
        } catch (e) { console.warn('API rename failed:', e); }

        // Fallback
        const key = type === 'cv' ? 'joblynk_cvs' : 'joblynk_cls';
        const docs = getSavedData(key);
        const doc = docs.find(c => String(c.id) === String(id));
        if (!doc) return;
        doc.name = newName.trim();
        localStorage.setItem(key, JSON.stringify(docs));
        renderCards();
    };

    window.deleteDoc = async function (id, type) {
        if (!confirm('Are you sure you want to delete this document?')) return;

        // Try API delete
        try {
            const res = await fetch('api/documents/index.php?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include' });
            const result = await res.json();
            if (result.success) {
                renderCards();
                return;
            }
        } catch (e) { console.warn('API delete failed:', e); }

        // Fallback
        const key = type === 'cv' ? 'joblynk_cvs' : 'joblynk_cls';
        let docs = getSavedData(key);
        docs = docs.filter(c => String(c.id) !== String(id));
        localStorage.setItem(key, JSON.stringify(docs));
        renderCards();
    };

    // Close action menus on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.card-action-menu.open').forEach(m => m.classList.remove('open'));
    });

    // ============================
    // SMOOTH SCROLL NAV
    // ============================
    document.querySelectorAll('.nav-item[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
    });

    // ============================
    // DYNAMIC JOBS (from jobs-store.js API)
    // ============================
    let currentApplyJobId = null;

    async function renderJobs() {
        const jobList = $('jobList');
        if (!jobList || typeof JobsStore === 'undefined') return;

        // Fetch from API
        await JobsStore.fetchJobs();
        const jobs = JobsStore.getActiveJobs();
        jobList.innerHTML = '';

        if (jobs.length === 0) {
            jobList.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fa-solid fa-briefcase" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>No jobs available yet</div>';
            return;
        }

        const statJobs = $('statJobs');
        if (statJobs) statJobs.textContent = jobs.length;

        jobs.forEach(job => {
            const letter = job.company ? job.company[0].toUpperCase() : 'J';
            const color = job.color || '#3B4BA6';
            const lighterColor = color + '88';
            const applied = JobsStore.hasApplied(job.id);
            const daysSince = Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86400000);
            let badge = '';
            if (applied) {
                badge = '<span class="job-badge" style="background:#ECFDF5; color:#059669;">Applied ✓</span>';
            } else if (daysSince <= 3) {
                badge = '<span class="job-badge new">New</span>';
            } else if (job.applicants >= 40) {
                badge = '<span class="job-badge hot">Hot</span>';
            }

            const item = document.createElement('div');
            item.className = 'job-item';
            item.innerHTML = `
                <div class="job-avatar" style="background:linear-gradient(135deg,${color},${lighterColor})">${letter}</div>
                <div class="job-info">
                    <div class="job-title">${job.title}</div>
                    <div class="job-meta">
                        <span class="job-meta-pill"><i class="fa-solid fa-building"></i> ${job.company}</span>
                        ${job.location ? `<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>` : ''}
                        ${job.type ? `<span class="job-meta-pill"><i class="fa-solid fa-clock"></i> ${job.type}</span>` : ''}
                    </div>
                    ${applied
                        ? '<span class="job-applied-label"><i class="fa-solid fa-circle-check"></i> Application Submitted</span>'
                        : `<button onclick="openAppModal('${job.id}')" class="job-apply-btn"><i class="fa-solid fa-paper-plane"></i> Apply Now</button>`
                    }
                </div>
                ${badge}
            `;
            jobList.appendChild(item);
        });
    }

    // Application Modal
    window.openAppModal = async function(jobId) {
        currentApplyJobId = jobId;
        const job = JobsStore.getJobById(jobId);
        if (!job) return;

        $('appModalTitle').textContent = job.title;
        $('appModalCompany').textContent = job.company + ' • ' + (job.location || '') + ' • ' + (job.type || '');

        // Populate CV dropdown from API
        const cvSelect = $('appCvSelect');
        cvSelect.innerHTML = '<option value="">-- Select a saved CV --</option>';

        const clSelect = $('appClSelect');
        clSelect.innerHTML = '<option value="">-- None --</option>';

        try {
            const res = await fetch('api/documents/index.php', { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.documents) {
                result.documents.forEach(doc => {
                    const opt = `<option value="${doc.id}">${doc.name || 'Untitled'}</option>`;
                    if (doc.doc_type === 'cv') cvSelect.innerHTML += opt;
                    else if (doc.doc_type === 'cl') clSelect.innerHTML += opt;
                });
            }
        } catch (e) {
            // Fallback to localStorage
            console.warn('Docs API failed:', e);
            getSavedData('joblynk_cvs').forEach(cv => {
                cvSelect.innerHTML += `<option value="${cv.id}">${cv.name || 'Untitled CV'}</option>`;
            });
            getSavedData('joblynk_cls').forEach(cl => {
                clSelect.innerHTML += `<option value="${cl.id}">${cl.name || 'Untitled Cover Letter'}</option>`;
            });
        }

        const modalOverlay = $('appModalOverlay');
        modalOverlay.style.display = 'flex';
    };

    window.closeAppModal = function() {
        $('appModalOverlay').style.display = 'none';
        currentApplyJobId = null;
    };

    window.submitJobApplication = async function() {
        if (!currentApplyJobId) return;

        const cvId = $('appCvSelect').value;
        if (!cvId) {
            alert('Please select a CV to attach.');
            return;
        }

        const clId = $('appClSelect').value;
        const btn = $('btnSubmitApp');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        btn.disabled = true;

        try {
            await JobsStore.submitApplication(currentApplyJobId, {
                cvId: cvId || null,
                clId: clId || null,
                applicantName: document.querySelector('[data-user-name]')?.textContent || 'Guest User'
            });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Submitted!';
            btn.style.background = '#059669';

            setTimeout(() => {
                closeAppModal();
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
                btn.style.background = '#3B4BA6';
                btn.disabled = false;
                renderJobs();
                renderApplications();
            }, 1200);
        } catch (e) {
            console.error('Submit failed:', e);
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
            btn.disabled = false;
            alert('Failed to submit application. Please try again.');
        }
    };

    // ============================
    // RENDER APPLICATIONS
    // ============================
    async function renderApplications() {
        if (typeof JobsStore === 'undefined') return;
        const appList = $('appList');
        if (!appList) return;

        await JobsStore.fetchApplications();
        const apps = JobsStore.getApplications();
        const statApps = $('statApps');
        if (statApps) statApps.textContent = apps.length;

        if (apps.length === 0) return;

        appList.innerHTML = '';
        apps.slice(0, 5).forEach(app => {
            // Use enriched API data if available, otherwise lookup locally
            const jobTitle = app.jobTitle || (JobsStore.getJobById(app.jobId)?.title) || 'Unknown Job';
            const jobCompany = app.jobCompany || (JobsStore.getJobById(app.jobId)?.company) || '';
            const color = app.jobColor || (JobsStore.getJobById(app.jobId)?.color) || '#3B4BA6';
            const letter = jobCompany ? jobCompany[0].toUpperCase() : 'J';

            const statusMap = {
                submitted: { bg: '#ECFDF5', color: '#059669', text: 'Submitted' },
                reviewed: { bg: '#EFF6FF', color: '#2563EB', text: 'Reviewed' },
                shortlisted: { bg: '#FDF4FF', color: '#A855F7', text: 'Shortlisted' },
                rejected: { bg: '#FEF2F2', color: '#DC2626', text: 'Rejected' },
            };
            const st = statusMap[app.status] || statusMap.submitted;

            const item = document.createElement('div');
            item.className = 'job-item';
            item.innerHTML = `
                <div class="job-avatar" style="background:linear-gradient(135deg,${color},${color}88); width:38px; height:38px; font-size:0.82rem;">${letter}</div>
                <div class="job-info">
                    <div class="job-title">${jobTitle}</div>
                    <div class="job-meta">
                        <span class="job-meta-pill"><i class="fa-solid fa-building"></i> ${jobCompany}</span>
                        <span class="job-meta-pill"><i class="fa-regular fa-clock"></i> ${getTimeAgo(app.submittedAt)}</span>
                    </div>
                </div>
                <span class="job-badge" style="background:${st.bg}; color:${st.color}; position:static;">${st.text}</span>
            `;
            appList.appendChild(item);
        });
    }

    // Initial render (async)
    (async () => {
        await renderCards();
        await renderJobs();
        await renderApplications();
    })();

});
