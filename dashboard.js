/* ======================================
   JOBLYNK DASHBOARD – Script
   ====================================== */
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);

    // ============================
    // SMOOTH SCROLL NAV (for hash links in sidebar)
    // ============================
    document.querySelectorAll('.nav-item[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (typeof window.closeMobileSidebar === 'function') window.closeMobileSidebar();
            }
        });
    });

    // Also handle bottom tab bar hash links
    document.addEventListener('click', (e) => {
        const tabLink = e.target.closest('.btab-item[href^="#"]');
        if (tabLink) {
            const target = document.querySelector(tabLink.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

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
    // DYNAMIC JOBS (from jobs-store.js API)
    // ============================
    let currentApplyJobId = null;

    function getDaysSince(dateValue) {
        const parsedDate = new Date(dateValue).getTime();
        if (!parsedDate) return 0;
        return Math.max(0, Math.floor((Date.now() - parsedDate) / 86400000));
    }

    function formatRelativeAge(dateValue) {
        const days = getDaysSince(dateValue);
        if (days === 0) return 'Posted today';
        if (days === 1) return 'Posted yesterday';
        return `Posted ${days} days ago`;
    }

    function formatSalaryLabel(job) {
        const salaryFrom = Number(job.salaryFrom || 0);
        const salaryTo = Number(job.salaryTo || 0);
        if (!salaryFrom && !salaryTo) return '';

        const compactMoney = value => new Intl.NumberFormat('en', {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);

        const period = String(job.salaryPeriod || 'Per Month').replace(/^Per\s+/i, '/');
        if (salaryFrom && salaryTo) {
            return `R${compactMoney(salaryFrom)} - R${compactMoney(salaryTo)} ${period}`;
        }
        if (salaryFrom) {
            return `From R${compactMoney(salaryFrom)} ${period}`;
        }
        return `Up to R${compactMoney(salaryTo)} ${period}`;
    }

    function getJobFootnote(job, daysSince, applicants) {
        if (job.closingDate) {
            const closingDate = new Date(job.closingDate).getTime();
            if (closingDate) {
                const closingDays = Math.ceil((closingDate - Date.now()) / 86400000);
                if (closingDays <= 0) return 'Closing today';
                if (closingDays === 1) return 'Closes tomorrow';
                if (closingDays <= 7) return `Closes in ${closingDays} days`;
            }
        }

        if (daysSince === 0) return 'Freshly published role';
        if (applicants >= 40) return 'High-interest opportunity';
        return 'Quick apply with your saved profile';
    }

    async function renderJobs() {
        const jobList = $('jobList');
        if (!jobList || typeof JobsStore === 'undefined') return;

        // Fetch from API
        await JobsStore.fetchJobs();
        const jobs = JobsStore.getActiveJobs();
        jobList.innerHTML = '';

        if (jobs.length === 0) {
            jobList.innerHTML = '<div class="job-empty-state"><i class="fa-solid fa-briefcase job-empty-icon"></i><p>No jobs available yet</p><span>Fresh matches will appear here as soon as recruiters publish them.</span></div>';
            return;
        }

        const statJobs = $('statJobs');
        if (statJobs) statJobs.textContent = jobs.length;

        jobs.forEach(job => {
            const letter = job.company ? job.company[0].toUpperCase() : 'J';
            const color = job.color || '#4F46E5';
            const lighterColor = color + '88';
            const accentSoft = color + '22';
            const applied = JobsStore.hasApplied(job.id);
            const daysSince = getDaysSince(job.postedAt);
            const applicants = parseInt(job.applicants, 10) || 0;
            const benefitsCount = Array.isArray(job.benefits) ? job.benefits.length : 0;
            const salaryLabel = formatSalaryLabel(job);
            const footnote = applied ? 'Tracked in your applications board' : getJobFootnote(job, daysSince, applicants);
            let badge = '<span class="job-badge is-open">Open</span>';
            if (applied) {
                badge = '<span class="job-badge is-applied">Applied</span>';
            } else if (daysSince <= 3) {
                badge = '<span class="job-badge new">New</span>';
            } else if (applicants >= 40) {
                badge = '<span class="job-badge hot">Hot</span>';
            }

            const item = document.createElement('div');
            item.className = 'job-item';
            item.style.setProperty('--job-accent', color);
            item.style.setProperty('--job-accent-soft', accentSoft);
            item.innerHTML = `
                <div class="job-avatar" style="background:linear-gradient(135deg,${color},${lighterColor})">${letter}</div>
                <div class="job-body">
                    <div class="job-header">
                        <div class="job-heading">
                            <span class="job-kicker">${job.company}</span>
                            <div class="job-title">${job.title}</div>
                        </div>
                        ${badge}
                    </div>
                    <div class="job-meta">
                        ${job.location ? `<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>` : '<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> Remote-friendly</span>'}
                        ${job.type ? `<span class="job-meta-pill"><i class="fa-solid fa-clock"></i> ${job.type}</span>` : ''}
                        ${salaryLabel ? `<span class="job-meta-pill"><i class="fa-solid fa-wallet"></i> ${salaryLabel}</span>` : ''}
                    </div>
                    <div class="job-insights">
                        <span class="job-insight"><i class="fa-regular fa-clock"></i> ${formatRelativeAge(job.postedAt)}</span>
                        <span class="job-insight"><i class="fa-solid fa-users"></i> <strong>${applicants}</strong> applicant${applicants === 1 ? '' : 's'}</span>
                        ${benefitsCount ? `<span class="job-insight"><i class="fa-solid fa-sparkles"></i> ${benefitsCount} benefit${benefitsCount === 1 ? '' : 's'}</span>` : ''}
                    </div>
                    <div class="job-footer">
                        ${applied
                            ? '<span class="job-applied-label"><i class="fa-solid fa-circle-check"></i> Application submitted</span>'
                            : `<button onclick="openAppModal('${job.id}')" class="job-apply-btn"><i class="fa-solid fa-paper-plane"></i> Apply now</button>`
                        }
                        <span class="job-footnote">${footnote}</span>
                    </div>
                </div>
            `;
            jobList.appendChild(item);
        });
    }

    // Application Modal
    let _appDocSource = { cv: 'system', cl: 'system' };

    window.switchDocSource = function(docType, source) {
        _appDocSource[docType] = source;
        const systemPanel = $(docType + 'SourceSystem');
        const uploadPanel = $(docType + 'SourceUpload');
        if (source === 'system') {
            systemPanel.style.display = '';
            uploadPanel.style.display = 'none';
        } else {
            systemPanel.style.display = 'none';
            uploadPanel.style.display = '';
        }
        // Update tab active state
        document.querySelectorAll(`.app-doc-tab[data-target="${docType}"]`).forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-source') === source);
        });
    };

    window.onFileSelected = function(docType, input) {
        const nameEl = $(docType + 'FileName');
        const box = $(docType + 'UploadBox');
        if (input.files && input.files[0]) {
            nameEl.textContent = input.files[0].name;
            nameEl.style.display = '';
            box.classList.add('has-file');
        } else {
            nameEl.style.display = 'none';
            box.classList.remove('has-file');
        }
    };

    window.toggleJobDetails = function() {
        const body = $('appModalDetailsBody');
        const btn = $('btnToggleDetails');
        const open = body.style.display === 'none';
        body.style.display = open ? '' : 'none';
        btn.innerHTML = open
            ? '<i class="fa-solid fa-chevron-up"></i> Hide job details'
            : '<i class="fa-solid fa-chevron-down"></i> View job details';
    };

    function escText(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function buildJobDetailsHtml(job) {
        let html = '';
        if (job.description) {
            html += `<div class="app-detail-block"><h4><i class="fa-solid fa-align-left"></i> Description</h4><p>${escText(job.description)}</p></div>`;
        }
        if (job.requirements) {
            html += `<div class="app-detail-block"><h4><i class="fa-solid fa-clipboard-check"></i> Requirements</h4><p>${escText(job.requirements)}</p></div>`;
        }
        if (job.skills) {
            const chips = job.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => `<span class="app-detail-chip">${escText(s)}</span>`).join('');
            html += `<div class="app-detail-block"><h4><i class="fa-solid fa-tags"></i> Skills</h4><div class="app-detail-chips">${chips}</div></div>`;
        }
        const salary = formatSalaryLabel(job);
        if (salary) {
            html += `<div class="app-detail-block"><h4><i class="fa-solid fa-wallet"></i> Salary</h4><p>${escText(salary)}</p></div>`;
        }
        if (Array.isArray(job.benefits) && job.benefits.length) {
            const chips = job.benefits.map(b => `<span class="app-detail-chip benefit">${escText(b)}</span>`).join('');
            html += `<div class="app-detail-block"><h4><i class="fa-solid fa-gift"></i> Benefits</h4><div class="app-detail-chips">${chips}</div></div>`;
        }
        if (job.closingDate) {
            html += `<div class="app-detail-block"><h4><i class="fa-regular fa-calendar"></i> Closing Date</h4><p>${new Date(job.closingDate).toLocaleDateString('en-ZA', { year:'numeric', month:'long', day:'numeric' })}</p></div>`;
        }
        return html;
    }

    window.openAppModal = async function(jobId) {
        currentApplyJobId = jobId;
        const job = JobsStore.getJobById(jobId);
        if (!job) return;

        $('appModalTitle').textContent = job.title;
        $('appModalCompany').textContent = job.company + ' • ' + (job.location || '') + ' • ' + (job.type || '');

        // Build job details
        const detailsHtml = buildJobDetailsHtml(job);
        const detailsSection = $('appModalDetails');
        const detailsBody = $('appModalDetailsBody');
        if (detailsHtml) {
            detailsBody.innerHTML = detailsHtml;
            detailsSection.style.display = '';
            detailsBody.style.display = 'none';
            $('btnToggleDetails').innerHTML = '<i class="fa-solid fa-chevron-down"></i> View job details';
        } else {
            detailsSection.style.display = 'none';
        }

        // Reset doc source tabs
        _appDocSource = { cv: 'system', cl: 'system' };
        switchDocSource('cv', 'system');
        switchDocSource('cl', 'system');

        // Clear file inputs
        const cvFile = $('appCvFile'); if (cvFile) cvFile.value = '';
        const clFile = $('appClFile'); if (clFile) clFile.value = '';
        $('cvFileName').style.display = 'none';
        $('clFileName').style.display = 'none';
        const cvBox = $('cvUploadBox'); if (cvBox) cvBox.classList.remove('has-file');
        const clBox = $('clUploadBox'); if (clBox) clBox.classList.remove('has-file');

        // Clear note
        const noteEl = $('appNote'); if (noteEl) noteEl.value = '';

        // Populate document dropdowns
        const cvSelect = $('appCvSelect');
        cvSelect.innerHTML = '<option value="">-- Select a saved CV --</option>';
        const clSelect = $('appClSelect');
        clSelect.innerHTML = '<option value="">-- None --</option>';

        let hasSavedCvs = false;
        let hasSavedCls = false;

        try {
            const res = await fetch('api/documents/index.php', { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.documents) {
                result.documents.forEach(doc => {
                    const opt = `<option value="${doc.id}">${doc.name || 'Untitled'}</option>`;
                    if (doc.doc_type === 'cv') { cvSelect.innerHTML += opt; hasSavedCvs = true; }
                    else if (doc.doc_type === 'cl') { clSelect.innerHTML += opt; hasSavedCls = true; }
                });
            }
        } catch (e) {
            console.warn('Docs API failed:', e);
            getSavedData('joblynk_cvs').forEach(cv => {
                cvSelect.innerHTML += `<option value="${cv.id}">${cv.name || 'Untitled CV'}</option>`;
                hasSavedCvs = true;
            });
            getSavedData('joblynk_cls').forEach(cl => {
                clSelect.innerHTML += `<option value="${cl.id}">${cl.name || 'Untitled Cover Letter'}</option>`;
                hasSavedCls = true;
            });
        }

        // Auto-switch to upload tab when user has no saved documents
        if (!hasSavedCvs) {
            _appDocSource.cv = 'upload';
            switchDocSource('cv', 'upload');
            cvSelect.innerHTML = '<option value="">No saved CVs yet — use Upload</option>';
        }
        if (!hasSavedCls) {
            _appDocSource.cl = 'upload';
            switchDocSource('cl', 'upload');
            clSelect.innerHTML = '<option value="">No saved letters yet — use Upload</option>';
        }

        $('appModalOverlay').style.display = 'flex';

        // Render custom screening questions
        const questionsContainer = $('appCustomQuestions');
        const customFields = Array.isArray(job.customFields) ? job.customFields : [];
        if (customFields.length > 0) {
            let qHtml = '<div class="app-modal-field" style="border-top:1px solid var(--border, #e5e7eb); padding-top:14px; margin-top:6px;"><label style="font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-clipboard-question" style="color:#7E22CE;"></i> Screening Questions</label>';
            customFields.forEach((field, i) => {
                const req = field.required ? ' <span style="color:#DC2626;">*</span>' : '';
                const reqAttr = field.required ? 'required' : '';
                qHtml += `<div class="form-group" style="margin-bottom:12px;"><label>${escText(field.label)}${req}</label>`;
                if (field.type === 'textarea') {
                    qHtml += `<textarea class="app-modal-select app-custom-answer" data-idx="${i}" rows="3" style="resize:vertical; min-height:60px;" placeholder="Your answer..." ${reqAttr}></textarea>`;
                } else if (field.type === 'select') {
                    qHtml += `<select class="app-modal-select app-custom-answer" data-idx="${i}" ${reqAttr}><option value="">-- Select --</option>`;
                    (field.options || []).forEach(opt => {
                        qHtml += `<option value="${escText(opt)}">${escText(opt)}</option>`;
                    });
                    qHtml += '</select>';
                } else if (field.type === 'yesno') {
                    qHtml += `<select class="app-modal-select app-custom-answer" data-idx="${i}" ${reqAttr}><option value="">-- Select --</option><option value="Yes">Yes</option><option value="No">No</option></select>`;
                } else {
                    qHtml += `<input type="text" class="app-modal-select app-custom-answer" data-idx="${i}" placeholder="Your answer..." ${reqAttr}>`;
                }
                qHtml += '</div>';
            });
            qHtml += '</div>';
            questionsContainer.innerHTML = qHtml;
            questionsContainer.style.display = '';
        } else {
            questionsContainer.innerHTML = '';
            questionsContainer.style.display = 'none';
        }
    };

    window.closeAppModal = function() {
        $('appModalOverlay').style.display = 'none';
        currentApplyJobId = null;
    };

    window.submitJobApplication = async function() {
        if (!currentApplyJobId) return;

        // Determine CV source
        let cvId = null, cvFile = null;
        if (_appDocSource.cv === 'system') {
            cvId = $('appCvSelect').value;
            if (!cvId) { alert('Please select a CV to attach.'); return; }
        } else {
            cvFile = $('appCvFile').files[0];
            if (!cvFile) { alert('Please upload a CV file.'); return; }
        }

        // Determine CL source
        let clId = null, clFile = null;
        if (_appDocSource.cl === 'system') {
            clId = $('appClSelect').value || null;
        } else {
            clFile = $('appClFile').files[0] || null;
        }

        const note = ($('appNote')?.value || '').trim();

        // Collect custom field responses
        const job = JobsStore.getJobById(currentApplyJobId);
        const customFields = (job && Array.isArray(job.customFields)) ? job.customFields : [];
        const formResponses = [];
        const answerEls = document.querySelectorAll('.app-custom-answer');
        let customValid = true;
        answerEls.forEach(el => {
            const idx = parseInt(el.dataset.idx, 10);
            const field = customFields[idx];
            const value = (el.value || '').trim();
            if (field && field.required && !value) {
                el.style.borderColor = 'red';
                customValid = false;
            } else {
                el.style.borderColor = '';
            }
            if (field) {
                formResponses.push({ question: field.label, answer: value });
            }
        });
        if (!customValid) {
            alert('Please answer all required screening questions.');
            return;
        }

        const btn = $('btnSubmitApp');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        btn.disabled = true;

        try {
            // Use FormData if there are file uploads
            if (cvFile || clFile) {
                const fd = new FormData();
                fd.append('job_id', currentApplyJobId);
                if (cvId) fd.append('cv_id', cvId);
                if (cvFile) fd.append('cv_file', cvFile);
                if (clId) fd.append('cl_id', clId);
                if (clFile) fd.append('cl_file', clFile);
                if (note) fd.append('note', note);
                if (formResponses.length) fd.append('form_responses', JSON.stringify(formResponses));

                const res = await fetch('api/applications/index.php', {
                    method: 'POST',
                    credentials: 'include',
                    body: fd
                });
                const result = await res.json();
                if (!result.success) throw new Error(result.message || 'Submit failed');

                // Refresh caches
                await JobsStore.fetchApplications();
                await JobsStore.fetchJobs();
            } else {
                await JobsStore.submitApplication(currentApplyJobId, {
                    cvId: cvId || null,
                    clId: clId || null,
                    note: note,
                    formResponses: formResponses.length ? formResponses : null,
                    applicantName: document.querySelector('[data-user-name]')?.textContent || 'Guest User'
                });
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Submitted!';
            btn.style.background = '#059669';

            setTimeout(() => {
                closeAppModal();
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
                btn.style.background = '';
                btn.disabled = false;
                renderJobs();
                renderApplications();
            }, 1200);
        } catch (e) {
            console.error('Submit failed:', e);
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
            btn.disabled = false;
            alert(e.message || 'Failed to submit application. Please try again.');
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
            const accentSoft = color + '22';
            const letter = jobCompany ? jobCompany[0].toUpperCase() : 'J';
            const jobLocation = app.jobLocation || (JobsStore.getJobById(app.jobId)?.location) || '';
            const jobType = app.jobType || (JobsStore.getJobById(app.jobId)?.type) || '';

            const statusMap = {
                submitted: { cls: 'is-submitted', text: 'Submitted' },
                reviewed: { cls: 'is-reviewed', text: 'Reviewed' },
                shortlisted: { cls: 'is-shortlisted', text: 'Shortlisted' },
                rejected: { cls: 'is-rejected', text: 'Rejected' },
            };
            const st = statusMap[app.status] || statusMap.submitted;

            const item = document.createElement('div');
            item.className = 'job-item job-item-application';
            item.style.setProperty('--job-accent', color);
            item.style.setProperty('--job-accent-soft', accentSoft);
            item.innerHTML = `
                <div class="job-avatar" style="background:linear-gradient(135deg,${color},${color}88);">${letter}</div>
                <div class="job-body">
                    <div class="job-header">
                        <div class="job-heading">
                            <span class="job-kicker">${jobCompany || 'Application tracker'}</span>
                            <div class="job-title">${jobTitle}</div>
                        </div>
                        <span class="job-badge ${st.cls}">${st.text}</span>
                    </div>
                    <div class="job-meta">
                        ${jobCompany ? `<span class="job-meta-pill"><i class="fa-solid fa-building"></i> ${jobCompany}</span>` : ''}
                        ${jobLocation ? `<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> ${jobLocation}</span>` : ''}
                        ${jobType ? `<span class="job-meta-pill"><i class="fa-solid fa-briefcase"></i> ${jobType}</span>` : ''}
                    </div>
                    <div class="job-insights">
                        <span class="job-insight"><i class="fa-regular fa-clock"></i> ${getTimeAgo(app.submittedAt)}</span>
                        <span class="job-insight"><i class="fa-solid fa-shield-check"></i> Application status synced</span>
                    </div>
                    <div class="job-footer">
                        <span class="job-footnote">Keep your CV and cover letter updated while the recruiter reviews your profile.</span>
                    </div>
                </div>
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
