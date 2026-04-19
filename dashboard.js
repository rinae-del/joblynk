/* ======================================
   JobLynk DASHBOARD – Script
   ====================================== */
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);
    const pageParams = new URLSearchParams(window.location.search);
    const previewJobId = pageParams.get('job') || '';

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
            getSavedData('JobLynk_cvs').forEach(d => cvs.push(normalizeDoc(d, 'local')));
            getSavedData('JobLynk_cls').forEach(d => cls.push(normalizeDoc(d, 'local')));
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
        const key = type === 'cv' ? 'JobLynk_cvs' : 'JobLynk_cls';
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
        const key = type === 'cv' ? 'JobLynk_cvs' : 'JobLynk_cls';
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
        const key = type === 'cv' ? 'JobLynk_cvs' : 'JobLynk_cls';
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
        let jobs = JobsStore.getActiveJobs();

        // Populate location filter with unique locations
        const locSelect = $('jobFilterLocation');
        if (locSelect && locSelect.options.length <= 1) {
            const locs = [...new Set(jobs.map(j => j.location).filter(Boolean))].sort();
            locs.forEach(l => {
                const o = document.createElement('option');
                o.value = l; o.textContent = l;
                locSelect.appendChild(o);
            });
        }

        // Apply filters
        const keyword = ($('jobSearchKeyword')?.value || '').trim().toLowerCase();
        const filterLoc = $('jobFilterLocation')?.value || '';
        const filterType = $('jobFilterType')?.value || '';

        if (keyword) {
            jobs = jobs.filter(j =>
                (j.title || '').toLowerCase().includes(keyword) ||
                (j.company || '').toLowerCase().includes(keyword) ||
                (j.description || '').toLowerCase().includes(keyword)
            );
        }
        if (filterLoc) {
            jobs = jobs.filter(j => (j.location || '').includes(filterLoc));
        }
        if (filterType) {
            jobs = jobs.filter(j => (j.type || '').toLowerCase() === filterType.toLowerCase());
        }
        if (previewJobId) {
            jobs = jobs.filter(j => String(j.id) === String(previewJobId));
        }

        jobList.innerHTML = '';

        if (jobs.length === 0) {
            const emptyMessage = previewJobId
                ? '<div class="job-empty-state"><i class="fa-solid fa-eye-slash job-empty-icon"></i><p>This job is no longer live</p><span>The preview link may have expired or the advert may have been closed.</span></div>'
                : '<div class="job-empty-state"><i class="fa-solid fa-briefcase job-empty-icon"></i><p>No jobs available yet</p><span>Fresh matches will appear here as soon as recruiters publish them.</span></div>';
            jobList.innerHTML = emptyMessage;
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
                        ${salaryLabel && !job.hideSalary ? `<span class="job-meta-pill"><i class="fa-solid fa-wallet"></i> ${salaryLabel}</span>` : ''}
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
    let _uploadedFiles = []; // staged file uploads

    function getApplyDocMeta(docType) {
        if (docType === 'cl') {
            return { typeClass: 'cl', typeLabel: 'Cover Letter', icon: 'fa-envelope-open-text' };
        }
        if (docType === 'supporting') {
            return { typeClass: 'supporting', typeLabel: 'Supporting Document', icon: 'fa-file-circle-check' };
        }
        return { typeClass: 'cv', typeLabel: 'CV', icon: 'fa-file-lines' };
    }

    function setExclusiveDocTypeSelection(docType, currentInput) {
        document.querySelectorAll(`input[name="app_doc_ids"][data-doc-type="${docType}"]`).forEach(cb => {
            if (cb !== currentInput) {
                cb.checked = false;
                cb.closest('.app-doc-check-item')?.classList.remove('checked');
            }
        });
    }

    function syncApplyDocSelectionState(input) {
        const item = input.closest('.app-doc-check-item');
        if (item) {
            item.classList.toggle('checked', input.checked);
        }

        if (input.checked && (input.dataset.docType === 'cv' || input.dataset.docType === 'cl')) {
            setExclusiveDocTypeSelection(input.dataset.docType, input);
        }
    }

    function buildSavedDocItem(doc, defaultSelected) {
        const meta = getApplyDocMeta(doc.doc_type);
        const item = document.createElement('label');
        item.className = `app-doc-check-item${defaultSelected ? ' is-default checked' : ''}`;
        item.innerHTML = `
            <input type="checkbox" name="app_doc_ids" value="${doc.id}" data-doc-type="${doc.doc_type}" ${defaultSelected ? 'checked' : ''}>
            <div class="doc-icon ${meta.typeClass}"><i class="fa-solid ${meta.icon}"></i></div>
            <span class="doc-name">${escText(doc.name || doc.original_name || 'Untitled')}</span>
            ${defaultSelected ? '<span class="doc-default-flag">Selected</span>' : ''}
            <span class="doc-type-label ${meta.typeClass}">${meta.typeLabel}</span>`;

        const input = item.querySelector('input');
        input.addEventListener('change', () => {
            syncApplyDocSelectionState(input);
        });

        item.addEventListener('click', function(e) {
            if (e.target !== input && !e.target.closest('input')) {
                input.checked = !input.checked;
                syncApplyDocSelectionState(input);
                e.preventDefault();
            }
        });

        return item;
    }

    function renderSavedDocGroup(container, title, docs, defaultDocId) {
        if (!docs.length) return;

        const heading = document.createElement('div');
        heading.className = 'app-doc-group-title';
        heading.textContent = title;
        container.appendChild(heading);

        docs.forEach(doc => {
            container.appendChild(buildSavedDocItem(doc, defaultDocId && String(doc.id) === String(defaultDocId)));
        });
    }

    window.onMultiFilesSelected = function(input) {
        if (!input.files) return;
        for (const file of input.files) {
            if (file.size > 5 * 1024 * 1024) { alert(`${file.name} exceeds 5 MB limit.`); continue; }
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(ext)) {
                alert(`${file.name} is not a supported file type.`);
                continue;
            }
            _uploadedFiles.push(file);
        }
        input.value = ''; // allow re-selecting same files
        renderUploadedFiles();
    };

    window.removeUploadedFile = function(idx) {
        _uploadedFiles.splice(idx, 1);
        renderUploadedFiles();
    };

    function renderUploadedFiles() {
        const list = $('appUploadedFilesList');
        const box = $('multiUploadBox');
        if (_uploadedFiles.length === 0) {
            list.style.display = 'none';
            list.innerHTML = '';
            if (box) box.classList.remove('has-file');
            return;
        }
        if (box) box.classList.add('has-file');
        list.style.display = '';
        list.innerHTML = _uploadedFiles.map((f, i) =>
            `<div class="app-uploaded-file-item">
                <i class="fa-solid fa-file-circle-check"></i>
                <span class="file-name">${escText(f.name)}</span>
                <button type="button" class="file-remove" onclick="removeUploadedFile(${i})" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>`
        ).join('');
    }

    function toggleDocCheckItem(el) {
        const cb = el.querySelector('input[type="checkbox"]');
        cb.checked = !cb.checked;
        el.classList.toggle('checked', cb.checked);
    }

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

        // Reset document selections
        _uploadedFiles = [];
        renderUploadedFiles();
        const fileInput = $('appFileUpload'); if (fileInput) fileInput.value = '';
        const uploadBox = $('multiUploadBox'); if (uploadBox) uploadBox.classList.remove('has-file');

        // Clear note
        const noteEl = $('appNote'); if (noteEl) noteEl.value = '';

        // Populate saved documents checklist
        const docsList = $('appSavedDocsList');
        const noDocsMsg = $('appNoSavedDocs');
        docsList.innerHTML = '';
        let hasAnyDocs = false;

        try {
            const res = await fetch('api/documents/index.php', { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.documents && result.documents.length) {
                const selectableDocs = [...result.documents].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
                const cvDocs = selectableDocs.filter(doc => doc.doc_type === 'cv');
                const clDocs = selectableDocs.filter(doc => doc.doc_type === 'cl');
                const supportingDocs = selectableDocs.filter(doc => doc.doc_type === 'supporting');
                const defaultCvId = cvDocs.length ? cvDocs[0].id : null;

                hasAnyDocs = selectableDocs.length > 0;
                renderSavedDocGroup(docsList, 'Saved CVs', cvDocs, defaultCvId);
                renderSavedDocGroup(docsList, 'Saved Cover Letters', clDocs);
                renderSavedDocGroup(docsList, 'Supporting Documents', supportingDocs);
            }
        } catch (e) {
            console.warn('Docs API failed:', e);
        }

        if (hasAnyDocs) {
            docsList.style.display = '';
            noDocsMsg.style.display = 'none';
        } else {
            docsList.style.display = 'none';
            noDocsMsg.style.display = '';
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

        // Separate first CV and CL for backward compatibility
        let cvId = null, clId = null;
        const allDocIds = [];
        document.querySelectorAll('input[name="app_doc_ids"]:checked').forEach(cb => {
            const docType = cb.dataset.docType;
            if (docType === 'cv' && !cvId) cvId = cb.value;
            else if (docType === 'cl' && !clId) clId = cb.value;
            allDocIds.push(cb.value);
        });

        const hasUploadedCv = _uploadedFiles.some(file => {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            return ['pdf', 'doc', 'docx'].includes(ext);
        });

        if (!cvId && !hasUploadedCv) {
            alert('Select a saved CV or upload one before submitting your application.');
            return;
        }

        // Must have at least one document (saved or uploaded)
        if (allDocIds.length === 0 && _uploadedFiles.length === 0) {
            alert('Please select or upload at least one document.');
            return;
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
            // Always use FormData to support file uploads
            const fd = new FormData();
            fd.append('job_id', currentApplyJobId);
            if (cvId) fd.append('cv_id', cvId);
            if (clId) fd.append('cl_id', clId);
            if (allDocIds.length) fd.append('document_ids', JSON.stringify(allDocIds));
            _uploadedFiles.forEach(file => fd.append('extra_files[]', file));
            if (note) fd.append('note', note);
            if (formResponses.length) fd.append('form_responses', JSON.stringify(formResponses));

            const res = await fetch('api/applications/index.php', {
                method: 'POST',
                credentials: 'include',
                body: fd
            });
            const rawResult = await res.text();
            if (!rawResult.trim()) {
                throw new Error('The server returned an empty response while submitting your application.');
            }

            let result;
            try {
                result = JSON.parse(rawResult);
            } catch (parseError) {
                throw new Error('The server returned an invalid response while submitting your application.');
            }

            if (!res.ok || !result.success) throw new Error(result.message || 'Submit failed');

            // Refresh caches
            await JobsStore.fetchApplications();
            await JobsStore.fetchJobs();

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

        // Wire up job search / filter controls
        const searchInput = $('jobSearchKeyword');
        const locFilter = $('jobFilterLocation');
        const typeFilter = $('jobFilterType');
        if (searchInput) searchInput.addEventListener('input', () => renderJobs());
        if (locFilter) locFilter.addEventListener('change', () => renderJobs());
        if (typeFilter) typeFilter.addEventListener('change', () => renderJobs());
    })();

});
