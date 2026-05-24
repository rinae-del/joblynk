document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    const pageMode = document.body?.dataset.jobPage || '';
    let currentApplyJobId = null;
    let uploadedFiles = [];
    let allJobs = [];

    function escText(value = '') {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function escAttr(value = '') {
        return escText(value).replace(/`/g, '&#96;');
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
        return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
    }

    function compactMoney(value) {
        return new Intl.NumberFormat('en', {
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

        const salaryFrom = formatSalaryValue(job.salaryFrom);
        const salaryTo = formatSalaryValue(job.salaryTo);
        const salaryNote = String(job.salaryNote || '').trim();
        const period = String(job.salaryPeriod || 'Per Month').replace(/^Per\s+/i, '/');
        let salaryText = '';

        if (salaryFrom && salaryTo) salaryText = `${salaryFrom} to ${salaryTo} ${period}`;
        else if (salaryFrom) salaryText = `${salaryFrom} ${period}`;
        else if (salaryTo) salaryText = `${salaryTo} ${period}`;

        return salaryNote && salaryText ? `${salaryText}, ${salaryNote}` : (salaryText || salaryNote);
    }

    function getSalaryNumber(job) {
        const raw = String(job.salaryTo || job.salaryFrom || '').replace(/[^\d.]/g, '');
        return Number(raw) || 0;
    }

    function getDateTime(value) {
        return new Date(value || '').getTime() || 0;
    }

    function getDaysSince(value) {
        const time = getDateTime(value);
        if (!time) return 0;
        return Math.max(0, Math.floor((Date.now() - time) / 86400000));
    }

    function formatRelativeAge(value) {
        const days = getDaysSince(value);
        if (days === 0) return 'Posted today';
        if (days === 1) return 'Posted yesterday';
        return `Posted ${days} days ago`;
    }

    function formatClosingLabel(job) {
        if (!job.closingDate) return '';
        const closingTime = getDateTime(job.closingDate);
        if (!closingTime) return '';
        const days = Math.ceil((closingTime - Date.now()) / 86400000);
        if (days <= 0) return 'Closing today';
        if (days === 1) return 'Closes tomorrow';
        return `Closes in ${days} days`;
    }

    function getJobStatus(job) {
        const applied = JobsStore.hasApplied(job.id);
        if (applied) return { cls: 'is-applied', label: 'Applied' };
        if (getDaysSince(job.postedAt) <= 3) return { cls: 'new', label: 'New' };
        if ((Number(job.applicants) || 0) >= 40) return { cls: 'hot', label: 'Hot' };
        return { cls: 'is-open', label: 'Open' };
    }

    function buildLogo(job, className = 'job-avatar') {
        const color = job.color || '#3B4BA6';
        const logo = job.companyLogoUrl || '';
        const company = job.company || 'Company';
        const initial = company.trim().charAt(0).toUpperCase() || 'J';

        if (logo) {
            return `<div class="${className}" style="--job-accent:${escAttr(color)};background:linear-gradient(135deg,${escAttr(color)},${escAttr(color)}88)"><img src="${escAttr(logo)}" alt="${escAttr(company)} logo" loading="lazy"></div>`;
        }

        return `<div class="${className}" style="--job-accent:${escAttr(color)};background:linear-gradient(135deg,${escAttr(color)},${escAttr(color)}88)">${escText(initial)}</div>`;
    }

    function buildMetaPills(job) {
        const salary = formatSalaryLabel(job);
        return [
            job.location ? `<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> ${escText(job.location)}</span>` : '<span class="job-meta-pill"><i class="fa-solid fa-location-dot"></i> Remote-friendly</span>',
            job.type ? `<span class="job-meta-pill"><i class="fa-solid fa-clock"></i> ${escText(job.type)}</span>` : '',
            salary ? `<span class="job-meta-pill"><i class="fa-solid fa-wallet"></i> ${escText(salary)}</span>` : '',
            job.jobReference ? `<span class="job-meta-pill"><i class="fa-solid fa-hashtag"></i> Ref ${escText(job.jobReference)}</span>` : ''
        ].filter(Boolean).join('');
    }

    function buildDetailsSections(job) {
        const sections = [];
        const skills = normalizeList(job.skills);
        const benefits = normalizeList(job.benefits);
        const salary = formatSalaryLabel(job);

        if (job.description) {
            sections.push(`<section class="job-detail-section"><h2>Description</h2><p>${escText(job.description)}</p></section>`);
        }
        if (job.requirements) {
            sections.push(`<section class="job-detail-section"><h2>Requirements</h2><p>${escText(job.requirements)}</p></section>`);
        }
        if (skills.length) {
            sections.push(`<section class="job-detail-section"><h2>Skills</h2><div class="job-detail-chip-row">${skills.map(skill => `<span>${escText(skill)}</span>`).join('')}</div></section>`);
        }
        if (salary) {
            sections.push(`<section class="job-detail-section"><h2>Salary</h2><p>${escText(salary)}</p></section>`);
        }
        if (benefits.length) {
            sections.push(`<section class="job-detail-section"><h2>Benefits</h2><div class="job-detail-chip-row">${benefits.map(benefit => `<span>${escText(benefit)}</span>`).join('')}</div></section>`);
        }
        if (job.closingDate) {
            const label = new Date(job.closingDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
            sections.push(`<section class="job-detail-section"><h2>Closing Date</h2><p>${escText(label)}</p></section>`);
        }

        return sections.join('') || '<section class="job-detail-section"><h2>Details</h2><p>The recruiter has not added more details for this listing yet.</p></section>';
    }

    function renderListCard(job) {
        const status = getJobStatus(job);
        const salary = formatSalaryLabel(job);
        const description = String(job.description || job.requirements || 'Open the full advert to view more role details.').trim();
        const closingLabel = formatClosingLabel(job);
        const applicants = Number(job.applicants) || 0;
        const applied = JobsStore.hasApplied(job.id);
        const detailUrl = `job-details.html?id=${encodeURIComponent(job.id)}`;

        return `
            <article class="jobs-page-card" style="--job-accent:${escAttr(job.color || '#3B4BA6')}">
                ${buildLogo(job)}
                <div class="jobs-page-card-body">
                    <div class="jobs-page-card-top">
                        <div>
                            <span class="job-kicker">${escText(job.company || 'Company')}</span>
                            <a href="${detailUrl}" class="jobs-page-title">${escText(job.title || 'Untitled role')}</a>
                        </div>
                        <span class="job-badge ${status.cls}">${status.label}</span>
                    </div>
                    <div class="job-meta">${buildMetaPills(job)}</div>
                    <p>${escText(description).slice(0, 220)}${description.length > 220 ? '...' : ''}</p>
                    <div class="jobs-page-card-foot">
                        <div class="job-insights">
                            <span class="job-insight"><i class="fa-regular fa-clock"></i> ${escText(formatRelativeAge(job.postedAt))}</span>
                            <span class="job-insight"><i class="fa-solid fa-users"></i> ${applicants} applicant${applicants === 1 ? '' : 's'}</span>
                            ${closingLabel ? `<span class="job-insight"><i class="fa-regular fa-calendar"></i> ${escText(closingLabel)}</span>` : ''}
                            ${salary ? `<span class="job-insight"><i class="fa-solid fa-wallet"></i> Salary shown</span>` : ''}
                        </div>
                        <div class="job-action-group">
                            <a href="${detailUrl}" class="job-preview-btn"><i class="fa-regular fa-eye"></i> View details</a>
                            ${applied
                                ? '<span class="job-applied-label"><i class="fa-solid fa-circle-check"></i> Applied</span>'
                                : `<button type="button" class="job-apply-btn" data-apply-job="${escAttr(job.id)}"><i class="fa-solid fa-paper-plane"></i> Apply now</button>`
                            }
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function getFilteredJobs() {
        const keyword = ($('jobsPageKeyword')?.value || '').trim().toLowerCase();
        const location = $('jobsPageLocation')?.value || '';
        const type = $('jobsPageType')?.value || '';
        const sort = $('jobsPageSort')?.value || 'newest';

        const filtered = allJobs.filter(job => {
            const haystack = [
                job.title, job.company, job.location, job.type, job.description,
                job.requirements, job.skills, formatSalaryLabel(job)
            ].join(' ').toLowerCase();

            return (!keyword || haystack.includes(keyword))
                && (!location || String(job.location || '') === location)
                && (!type || String(job.type || '').toLowerCase() === type.toLowerCase());
        });

        return filtered.sort((left, right) => {
            if (sort === 'salary') return getSalaryNumber(right) - getSalaryNumber(left);
            if (sort === 'closing') {
                const leftTime = getDateTime(left.closingDate) || Number.MAX_SAFE_INTEGER;
                const rightTime = getDateTime(right.closingDate) || Number.MAX_SAFE_INTEGER;
                return leftTime - rightTime;
            }
            return getDateTime(right.postedAt) - getDateTime(left.postedAt);
        });
    }

    function populateListFilters() {
        const locationSelect = $('jobsPageLocation');
        if (!locationSelect || locationSelect.options.length > 1) return;
        [...new Set(allJobs.map(job => job.location).filter(Boolean))].sort().forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationSelect.appendChild(option);
        });
    }

    function renderListPage() {
        const list = $('jobsPageList');
        const summary = $('jobsPageSummary');
        if (!list) return;

        populateListFilters();
        const jobs = getFilteredJobs();

        if ($('jobsPageTotal')) $('jobsPageTotal').textContent = String(allJobs.length);
        if ($('jobsPageFiltered')) $('jobsPageFiltered').textContent = String(jobs.length);
        if (summary) {
            summary.textContent = jobs.length === 1
                ? `Showing 1 of ${allJobs.length} live jobs.`
                : `Showing ${jobs.length} of ${allJobs.length} live jobs.`;
        }

        if (!jobs.length) {
            list.innerHTML = `
                <div class="job-empty-state jobs-page-empty">
                    <i class="fa-solid fa-briefcase job-empty-icon"></i>
                    <p>No matching jobs found</p>
                    <span>Try clearing the filters or searching a different keyword.</span>
                </div>
            `;
            return;
        }

        list.innerHTML = jobs.map(renderListCard).join('');
        list.querySelectorAll('[data-apply-job]').forEach(button => {
            button.addEventListener('click', () => openAppModal(button.getAttribute('data-apply-job')));
        });
    }

    function renderDetailPage() {
        const root = $('jobDetailsRoot');
        const jobId = params.get('id');
        const job = JobsStore.getJobById(jobId);
        if (!root) return;

        if (!job) {
            root.innerHTML = `
                <div class="job-empty-state">
                    <i class="fa-solid fa-eye-slash job-empty-icon"></i>
                    <p>This job is no longer live</p>
                    <span>The advert may have been closed or the link may be incorrect.</span>
                    <a href="dashboard-jobs.html" class="job-preview-btn job-detail-back"><i class="fa-solid fa-arrow-left"></i> Back to jobs</a>
                </div>
            `;
            return;
        }

        const status = getJobStatus(job);
        const applied = JobsStore.hasApplied(job.id);
        const closingLabel = formatClosingLabel(job);
        const applicants = Number(job.applicants) || 0;

        root.innerHTML = `
            <section class="job-detail-hero" style="--job-accent:${escAttr(job.color || '#3B4BA6')}">
                <div class="job-detail-hero-main">
                    ${buildLogo(job, 'job-detail-logo')}
                    <div>
                        <div class="job-detail-kicker-row">
                            <span>${escText(job.company || 'Company')}</span>
                            <span class="job-badge ${status.cls}">${status.label}</span>
                        </div>
                        <h1>${escText(job.title || 'Untitled role')}</h1>
                        <div class="job-meta job-detail-meta">${buildMetaPills(job)}</div>
                    </div>
                </div>
                <div class="job-detail-actions">
                    <a href="dashboard-jobs.html" class="job-preview-btn"><i class="fa-solid fa-arrow-left"></i> Back to jobs</a>
                    ${applied
                        ? '<span class="job-applied-label"><i class="fa-solid fa-circle-check"></i> Application submitted</span>'
                        : `<button type="button" class="job-apply-btn" id="jobDetailApply"><i class="fa-solid fa-paper-plane"></i> Apply now</button>`
                    }
                </div>
            </section>

            <section class="job-detail-layout">
                <article class="job-detail-content">
                    ${buildDetailsSections(job)}
                </article>
                <aside class="job-detail-sidebar">
                    <div class="job-detail-side-card">
                        <h2>Advert Snapshot</h2>
                        <dl>
                            <div><dt>Posted</dt><dd>${escText(formatRelativeAge(job.postedAt))}</dd></div>
                            <div><dt>Applicants</dt><dd>${applicants}</dd></div>
                            ${closingLabel ? `<div><dt>Closing</dt><dd>${escText(closingLabel)}</dd></div>` : ''}
                            ${job.jobReference ? `<div><dt>Reference</dt><dd>${escText(job.jobReference)}</dd></div>` : ''}
                        </dl>
                    </div>
                    <div class="job-detail-side-card">
                        <h2>Before You Apply</h2>
                        <p>Make sure your saved CV is current. You can attach one CV, an optional cover letter, and any supporting documents.</p>
                    </div>
                </aside>
            </section>
        `;

        $('jobDetailApply')?.addEventListener('click', () => openAppModal(job.id));
        if (params.get('apply') === '1' && !applied) {
            setTimeout(() => openAppModal(job.id), 250);
        }
    }

    function getApplyDocMeta(docType) {
        if (docType === 'cl') return { typeClass: 'cl', typeLabel: 'Cover Letter', icon: 'fa-envelope-open-text' };
        if (docType === 'supporting') return { typeClass: 'supporting', typeLabel: 'Supporting Document', icon: 'fa-file-circle-check' };
        return { typeClass: 'cv', typeLabel: 'CV', icon: 'fa-file-lines' };
    }

    function setExclusiveDocTypeSelection(docType, currentInput) {
        document.querySelectorAll(`input[name="app_doc_ids"][data-doc-type="${docType}"]`).forEach(input => {
            if (input !== currentInput) {
                input.checked = false;
                input.closest('.app-doc-check-item')?.classList.remove('checked');
            }
        });
    }

    function syncApplyDocSelectionState(input) {
        input.closest('.app-doc-check-item')?.classList.toggle('checked', input.checked);
        if (input.checked && (input.dataset.docType === 'cv' || input.dataset.docType === 'cl')) {
            setExclusiveDocTypeSelection(input.dataset.docType, input);
        }
    }

    function buildSavedDocItem(doc, defaultSelected) {
        const meta = getApplyDocMeta(doc.doc_type);
        const item = document.createElement('label');
        item.className = `app-doc-check-item${defaultSelected ? ' is-default checked' : ''}`;
        item.innerHTML = `
            <input type="checkbox" name="app_doc_ids" value="${escAttr(doc.id)}" data-doc-type="${escAttr(doc.doc_type)}" ${defaultSelected ? 'checked' : ''}>
            <div class="doc-icon ${meta.typeClass}"><i class="fa-solid ${meta.icon}"></i></div>
            <span class="doc-name">${escText(doc.name || doc.original_name || 'Untitled')}</span>
            ${defaultSelected ? '<span class="doc-default-flag">Selected</span>' : ''}
            <span class="doc-type-label ${meta.typeClass}">${meta.typeLabel}</span>`;

        const input = item.querySelector('input');
        input.addEventListener('change', () => syncApplyDocSelectionState(input));
        item.addEventListener('click', event => {
            if (event.target === input || event.target.closest('input')) return;
            event.preventDefault();
            input.checked = !input.checked;
            syncApplyDocSelectionState(input);
        });
        return item;
    }

    function renderSavedDocGroup(container, title, docs, defaultDocId) {
        if (!docs.length) return;
        const heading = document.createElement('div');
        heading.className = 'app-doc-group-title';
        heading.textContent = title;
        container.appendChild(heading);
        docs.forEach(doc => container.appendChild(buildSavedDocItem(doc, defaultDocId && String(doc.id) === String(defaultDocId))));
    }

    window.onMultiFilesSelected = function(input) {
        if (!input.files) return;
        for (const file of input.files) {
            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name} exceeds 5 MB limit.`);
                continue;
            }
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(ext)) {
                alert(`${file.name} is not a supported file type.`);
                continue;
            }
            uploadedFiles.push(file);
        }
        input.value = '';
        renderUploadedFiles();
    };

    window.removeUploadedFile = function(index) {
        uploadedFiles.splice(index, 1);
        renderUploadedFiles();
    };

    function renderUploadedFiles() {
        const list = $('appUploadedFilesList');
        const box = $('multiUploadBox');
        if (!list) return;
        if (!uploadedFiles.length) {
            list.style.display = 'none';
            list.innerHTML = '';
            box?.classList.remove('has-file');
            return;
        }
        box?.classList.add('has-file');
        list.style.display = '';
        list.innerHTML = uploadedFiles.map((file, index) => `
            <div class="app-uploaded-file-item">
                <i class="fa-solid fa-file-circle-check"></i>
                <span class="file-name">${escText(file.name)}</span>
                <button type="button" class="file-remove" onclick="removeUploadedFile(${index})" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    }

    function renderCustomQuestions(job) {
        const container = $('appCustomQuestions');
        if (!container) return;
        const customFields = Array.isArray(job.customFields) ? job.customFields : [];
        if (!customFields.length) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        let html = '<div class="app-modal-field" style="border-top:1px solid var(--border, #e5e7eb); padding-top:14px; margin-top:6px;"><label style="font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-clipboard-question" style="color:#7E22CE;"></i> Screening Questions</label>';
        customFields.forEach((field, index) => {
            const required = field.required ? ' <span style="color:#DC2626;">*</span>' : '';
            const requiredAttr = field.required ? 'required' : '';
            html += `<div class="form-group" style="margin-bottom:12px;"><label>${escText(field.label)}${required}</label>`;
            if (field.type === 'textarea') {
                html += `<textarea class="app-modal-select app-custom-answer" data-idx="${index}" rows="3" style="resize:vertical; min-height:60px;" placeholder="Your answer..." ${requiredAttr}></textarea>`;
            } else if (field.type === 'select') {
                html += `<select class="app-modal-select app-custom-answer" data-idx="${index}" ${requiredAttr}><option value="">Select</option>`;
                (field.options || []).forEach(option => {
                    html += `<option value="${escAttr(option)}">${escText(option)}</option>`;
                });
                html += '</select>';
            } else if (field.type === 'yesno') {
                html += `<select class="app-modal-select app-custom-answer" data-idx="${index}" ${requiredAttr}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>`;
            } else {
                html += `<input type="text" class="app-modal-select app-custom-answer" data-idx="${index}" placeholder="Your answer..." ${requiredAttr}>`;
            }
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
        container.style.display = '';
    }

    window.openAppModal = async function(jobId) {
        currentApplyJobId = jobId;
        const job = JobsStore.getJobById(jobId);
        if (!job || JobsStore.hasApplied(job.id)) return;

        $('appModalTitle').textContent = job.title || 'Untitled role';
        $('appModalCompany').textContent = [job.company, job.location, job.type].filter(Boolean).join(', ');

        uploadedFiles = [];
        renderUploadedFiles();
        const fileInput = $('appFileUpload');
        if (fileInput) fileInput.value = '';
        const noteEl = $('appNote');
        if (noteEl) noteEl.value = '';

        const docsList = $('appSavedDocsList');
        const noDocsMsg = $('appNoSavedDocs');
        docsList.innerHTML = '';
        let hasAnyDocs = false;

        try {
            const res = await fetch('api/documents/index.php', { credentials: 'include' });
            const result = await res.json();
            if (result.success && Array.isArray(result.documents)) {
                const docs = [...result.documents].sort((a, b) => getDateTime(b.updated_at || b.created_at) - getDateTime(a.updated_at || a.created_at));
                const cvDocs = docs.filter(doc => doc.doc_type === 'cv');
                const clDocs = docs.filter(doc => doc.doc_type === 'cl');
                const supportingDocs = docs.filter(doc => doc.doc_type === 'supporting');
                hasAnyDocs = docs.length > 0;
                renderSavedDocGroup(docsList, 'Saved CVs', cvDocs, cvDocs[0]?.id);
                renderSavedDocGroup(docsList, 'Saved Cover Letters', clDocs);
                renderSavedDocGroup(docsList, 'Supporting Documents', supportingDocs);
            }
        } catch (error) {
            console.warn('Docs API failed:', error);
        }

        docsList.style.display = hasAnyDocs ? '' : 'none';
        noDocsMsg.style.display = hasAnyDocs ? 'none' : '';
        renderCustomQuestions(job);
        $('appModalOverlay').style.display = 'flex';
    };

    window.closeAppModal = function() {
        $('appModalOverlay').style.display = 'none';
        currentApplyJobId = null;
    };

    window.submitJobApplication = async function() {
        if (!currentApplyJobId) return;

        let cvId = null;
        let clId = null;
        const allDocIds = [];
        document.querySelectorAll('input[name="app_doc_ids"]:checked').forEach(input => {
            if (input.dataset.docType === 'cv' && !cvId) cvId = input.value;
            else if (input.dataset.docType === 'cl' && !clId) clId = input.value;
            allDocIds.push(input.value);
        });

        const hasUploadedCv = uploadedFiles.some(file => ['pdf', 'doc', 'docx'].includes((file.name.split('.').pop() || '').toLowerCase()));
        if (!cvId && !hasUploadedCv) {
            alert('Select a saved CV or upload one before submitting your application.');
            return;
        }

        if (!allDocIds.length && !uploadedFiles.length) {
            alert('Please select or upload at least one document.');
            return;
        }

        const job = JobsStore.getJobById(currentApplyJobId);
        const customFields = job && Array.isArray(job.customFields) ? job.customFields : [];
        const formResponses = [];
        let customValid = true;
        document.querySelectorAll('.app-custom-answer').forEach(input => {
            const index = Number(input.dataset.idx);
            const field = customFields[index];
            const value = (input.value || '').trim();
            if (field?.required && !value) {
                input.style.borderColor = 'red';
                customValid = false;
            } else {
                input.style.borderColor = '';
            }
            if (field) formResponses.push({ question: field.label, answer: value });
        });

        if (!customValid) {
            alert('Please answer all required screening questions.');
            return;
        }

        const button = $('btnSubmitApp');
        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const formData = new FormData();
            formData.append('job_id', currentApplyJobId);
            if (cvId) formData.append('cv_id', cvId);
            if (clId) formData.append('cl_id', clId);
            if (allDocIds.length) formData.append('document_ids', JSON.stringify(allDocIds));
            uploadedFiles.forEach(file => formData.append('extra_files[]', file));
            const note = ($('appNote')?.value || '').trim();
            if (note) formData.append('note', note);
            if (formResponses.length) formData.append('form_responses', JSON.stringify(formResponses));

            const res = await fetch('api/applications/index.php', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message || 'Submit failed');

            await Promise.all([JobsStore.fetchApplications(), JobsStore.fetchJobs()]);
            button.innerHTML = '<i class="fa-solid fa-check"></i> Submitted';

            setTimeout(() => {
                closeAppModal();
                button.disabled = false;
                button.innerHTML = originalHtml;
                if (pageMode === 'list') renderListPage();
                if (pageMode === 'detail') renderDetailPage();
            }, 900);
        } catch (error) {
            console.error('Submit failed:', error);
            button.disabled = false;
            button.innerHTML = originalHtml;
            alert(error.message || 'Failed to submit application. Please try again.');
        }
    };

    async function init() {
        if (typeof JobsStore === 'undefined') return;
        await Promise.all([JobsStore.fetchJobs(), JobsStore.fetchApplications()]);
        allJobs = JobsStore.getActiveJobs();

        if (pageMode === 'list') {
            renderListPage();
            [$('jobsPageKeyword'), $('jobsPageLocation'), $('jobsPageType'), $('jobsPageSort')].forEach(input => {
                input?.addEventListener('input', renderListPage);
                input?.addEventListener('change', renderListPage);
            });
        }

        if (pageMode === 'detail') {
            renderDetailPage();
        }
    }

    init();
});
