// Recruiter Dashboard Logic

const recruiterState = {
    jobs: [],
    applications: [],
};

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatRecruiterDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });
}

function timeSince(dateString) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const days = Math.max(0, Math.floor(diffMs / 86400000));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

function getInitials(name) {
    return (name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('');
}

function formatStatusLabel(value) {
    const safeValue = String(value || 'submitted').toLowerCase();
    return safeValue.charAt(0).toUpperCase() + safeValue.slice(1);
}

function renderCandidateCard(app, compact = false) {
    const applicantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.applicant_name || 'Unknown Applicant';
    const jobTitle = app.job_title || 'Unknown Job';
    const reviewLabel = compact ? 'Review' : 'Review Profile';
    const statusValue = String(app.status || 'submitted').toLowerCase();
    const statusLabel = formatStatusLabel(statusValue);
    const statusTone = {
        submitted: 'warm',
        reviewed: 'accent',
        shortlisted: 'success',
        rejected: 'muted',
        hired: 'success'
    }[statusValue] || 'warm';

    return `
        <div class="candidate-item${compact ? ' is-compact' : ''}">
            <div class="candidate-info-wrapper">
                <div class="candidate-avatar">${getInitials(applicantName)}</div>
                <div class="candidate-details">
                    <span class="candidate-kicker">${compact ? 'Recent applicant' : statusLabel}</span>
                    <h4>${applicantName}</h4>
                    <div class="candidate-meta">
                        <span class="candidate-chip"><i class="fa-solid fa-briefcase"></i> ${jobTitle}</span>
                        <span class="candidate-chip muted"><i class="fa-regular fa-calendar"></i> ${formatRecruiterDate(app.created_at)}</span>
                        ${compact ? '' : `<span class="candidate-chip ${statusTone}"><i class="fa-solid fa-signal"></i> ${statusLabel}</span>`}
                    </div>
                </div>
            </div>
            <div class="candidate-actions">
                <button class="btn-action view" onclick="reviewCandidate(${app.id})">${reviewLabel}</button>
                ${compact ? '' : `
                <button class="btn-action accept" onclick="updateCandidateStatus(${app.id}, 'shortlisted')">Shortlist</button>
                <button class="btn-action reject" onclick="updateCandidateStatus(${app.id}, 'rejected')">Reject</button>
                `}
            </div>
        </div>
    `;
}

function renderCandidatesPreview() {
    const container = document.getElementById('recentCandidatesList');
    if (!container) return;

    if (recruiterState.applications.length === 0) {
        container.innerHTML = `
            <div class="candidate-item is-empty">
                <div class="candidate-info-wrapper">
                    <div class="candidate-details">
                        <h4>No candidates yet</h4>
                        <p>Your most recent applications will appear here.</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = recruiterState.applications.slice(0, 3).map(app => renderCandidateCard(app, true)).join('');
}

function renderActivePostingsPreview() {
    const container = document.getElementById('activePostingsList');
    if (!container) return;

    const activeJobs = recruiterState.jobs.filter(job => job.status === 'active').slice(0, 3);
    if (activeJobs.length === 0) {
        container.innerHTML = `
            <div class="recruiter-mini-posting is-empty">
                <div class="entity-block">
                    <span class="entity-title">No active postings yet</span>
                    <span class="entity-sub">Published jobs will appear here once you go live.</span>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = activeJobs.map(job => {
        const applicantCount = parseInt(job.applicant_count, 10) || 0;
        return `
        <div class="recruiter-mini-posting">
            <div class="recruiter-mini-posting-head">
                <div class="entity-block">
                    <span class="recruiter-mini-posting-kicker">Active posting</span>
                    <span class="entity-title">${job.title}</span>
                </div>
                <span class="job-status active">Active</span>
            </div>
            <div class="entity-meta recruiter-mini-posting-meta">
                <span class="meta-chip"><i class="fa-solid fa-location-dot"></i> ${job.location || 'Remote'}</span>
                <span class="meta-chip"><i class="fa-regular fa-clock"></i> ${job.type || 'Full-time'}</span>
            </div>
            <div class="recruiter-mini-posting-foot">
                <span>${applicantCount} applicant${applicantCount === 1 ? '' : 's'}</span>
                <span>Posted ${timeSince(job.created_at)}</span>
            </div>
        </div>`;
    }).join('');
}

function populateCandidateFilter() {
    const select = document.getElementById('candidateJobFilter');
    if (!select) return;

    const queryJobId = new URLSearchParams(window.location.search).get('job') || '';
    const previousValue = select.value;
    select.innerHTML = '<option value="">Filter by Job: All</option>';
    recruiterState.jobs.forEach(job => {
        select.innerHTML += `<option value="${job.id}">${job.title}</option>`;
    });
    if (queryJobId && [...select.options].some(option => option.value === queryJobId)) {
        select.value = queryJobId;
    } else if ([...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function renderCandidatesView() {
    const container = document.getElementById('candidatesList');
    const select = document.getElementById('candidateJobFilter');
    if (!container) return;

    const filteredApps = recruiterState.applications.filter(app => !select?.value || String(app.job_id) === String(select.value));
    if (filteredApps.length === 0) {
        container.innerHTML = `
            <div class="candidate-item is-empty">
                <div class="candidate-info-wrapper">
                    <div class="candidate-details">
                        <h4>No matching candidates</h4>
                        <p>Applications to your jobs will appear here.</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredApps.map(app => renderCandidateCard(app)).join('');
}

async function loadCandidates() {
    try {
        const res = await fetch('api/applications/index.php', { credentials: 'include' });
        const result = await res.json();
        if (!result.success || !Array.isArray(result.applications)) {
            throw new Error(result.message || 'Failed to load applications');
        }

        recruiterState.applications = result.applications;
        const statApps = document.getElementById('statApplicants');
        if (statApps) statApps.textContent = recruiterState.applications.length;
        populateCandidateFilter();
        renderCandidatesPreview();
        renderCandidatesView();
    } catch (e) {
        console.warn('Failed to load applications from API:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Hamburger menu toggle
    const btnHamburger = document.getElementById('btnHamburger');
    const btnHamburgerTop = document.getElementById('btnHamburgerTop');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    if (btnHamburger) btnHamburger.addEventListener('click', toggleSidebar);
    if (btnHamburgerTop) btnHamburgerTop.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // Wizard Logic
    window.nextWizardStep = function(currentStep) {
        // Basic validation for current step
        const stepElement = document.getElementById(`step-${currentStep}`);
        const inputs = stepElement.querySelectorAll('[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = 'red';
                isValid = false;
            } else {
                input.style.borderColor = 'var(--border)';
            }
        });
        
        if (!isValid) {
            alert('Please fill out all required fields before proceeding.');
            return;
        }

        const nextStep = currentStep + 1;
        if (document.getElementById(`step-${nextStep}`)) {
            // Hide current
            stepElement.classList.remove('active');
            // Show next
            document.getElementById(`step-${nextStep}`).classList.add('active');
            
            // Update indicators
            document.getElementById(`indicator-${currentStep}`).classList.add('completed');
            document.getElementById(`indicator-${currentStep}`).classList.remove('active');
            document.getElementById(`indicator-${nextStep}`).classList.add('active');
        }
    };

    window.prevWizardStep = function(currentStep) {
        const prevStep = currentStep - 1;
        if (document.getElementById(`step-${prevStep}`)) {
            // Hide current
            document.getElementById(`step-${currentStep}`).classList.remove('active');
            // Show previous
            document.getElementById(`step-${prevStep}`).classList.add('active');
            
            // Update indicators
            document.getElementById(`indicator-${currentStep}`).classList.remove('active');
            document.getElementById(`indicator-${prevStep}`).classList.add('active');
            document.getElementById(`indicator-${prevStep}`).classList.remove('completed');
        }
    };

    // ── Custom Screening Questions Builder ──
    let _customFieldCounter = 0;

    window.addCustomField = function(prefill) {
        const list = document.getElementById('customFieldsList');
        if (!list) return;

        _customFieldCounter++;
        const idx = _customFieldCounter;
        const label = (prefill && prefill.label) || '';
        const type = (prefill && prefill.type) || 'text';
        const required = prefill ? !!prefill.required : true;
        const options = (prefill && Array.isArray(prefill.options)) ? prefill.options.join(', ') : '';

        const item = document.createElement('div');
        item.className = 'custom-field-item';
        item.dataset.idx = idx;
        item.innerHTML = `
            <div class="custom-field-header">
                <span class="custom-field-num">${list.children.length + 1}</span>
                <button type="button" class="custom-field-remove" onclick="removeCustomField(this)" title="Remove question">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <div class="custom-field-body">
                <div class="dash-row" style="gap: 12px;">
                    <div class="form-group" style="flex: 2;">
                        <label>Question</label>
                        <input type="text" class="form-control cf-label" value="${escAttr(label)}" placeholder="e.g. Do you have a valid driver's license?">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Answer Type</label>
                        <select class="form-control cf-type" onchange="onFieldTypeChange(this)">
                            <option value="text" ${type === 'text' ? 'selected' : ''}>Short Text</option>
                            <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Long Text</option>
                            <option value="select" ${type === 'select' ? 'selected' : ''}>Dropdown</option>
                            <option value="yesno" ${type === 'yesno' ? 'selected' : ''}>Yes / No</option>
                        </select>
                    </div>
                </div>
                <div class="cf-options-row" style="${type === 'select' ? '' : 'display:none;'}">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Dropdown Options <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(comma separated)</span></label>
                        <input type="text" class="form-control cf-options" value="${escAttr(options)}" placeholder="e.g. 0-1 years, 2-5 years, 5+ years">
                    </div>
                </div>
                <label class="checkbox-item" style="display:inline-flex; width:auto; border:none; background:none; padding:4px 0 0;">
                    <input type="checkbox" class="cf-required" ${required ? 'checked' : ''}>
                    <span style="font-weight:500; font-size:0.85rem;">Required</span>
                </label>
            </div>
        `;
        list.appendChild(item);
    };

    window.removeCustomField = function(btn) {
        const item = btn.closest('.custom-field-item');
        if (item) {
            item.remove();
            // Re-number
            document.querySelectorAll('#customFieldsList .custom-field-num').forEach((el, i) => {
                el.textContent = i + 1;
            });
        }
    };

    window.onFieldTypeChange = function(sel) {
        const row = sel.closest('.custom-field-body').querySelector('.cf-options-row');
        row.style.display = sel.value === 'select' ? '' : 'none';
    };

    function escAttr(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function collectCustomFields() {
        const items = document.querySelectorAll('#customFieldsList .custom-field-item');
        const fields = [];
        items.forEach(item => {
            const label = item.querySelector('.cf-label')?.value.trim();
            if (!label) return;
            const type = item.querySelector('.cf-type')?.value || 'text';
            const required = item.querySelector('.cf-required')?.checked || false;
            const field = { label, type, required };
            if (type === 'select') {
                const raw = item.querySelector('.cf-options')?.value || '';
                field.options = raw.split(',').map(o => o.trim()).filter(Boolean);
            }
            fields.push(field);
        });
        return fields;
    }

    // Form submission — save to jobs-store
    const postJobFormWizard = document.getElementById('postJobFormWizard');
    if (postJobFormWizard) {
        postJobFormWizard.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check if editing
            var editingId = postJobFormWizard.dataset.editingJobId || null;
            
            // Collect all wizard data
            const title = document.getElementById('wizJobTitle').value;
            const company = document.getElementById('wizCompany').value;
            const provEl = document.getElementById('wizProvince');
            const cityEl = document.getElementById('wizCity');
            const location = provEl ? ((provEl.value === 'Remote') ? 'Remote' : [cityEl?.value, provEl.value].filter(Boolean).join(', ')) : (document.getElementById('wizLocation')?.value || '');
            const type = document.getElementById('wizType').value;
            const description = document.getElementById('wizDesc')?.value || '';
            const requirements = document.getElementById('wizReqs')?.value || '';
            const skills = document.getElementById('wizSkills')?.value || '';
            const salaryFrom = document.getElementById('wizSalaryFrom')?.value || '';
            const salaryTo = document.getElementById('wizSalaryTo')?.value || '';
            const salaryPeriod = document.getElementById('wizSalaryPeriod')?.value || 'Per Month';
            const hideSalary = document.getElementById('wizHideSalary')?.checked || false;
            const closingDate = document.getElementById('wizDate')?.value || '';

            // Collect benefits
            const benefits = [];
            document.querySelectorAll('.checkbox-grid input[type="checkbox"]:checked').forEach(cb => {
                benefits.push(cb.value);
            });

            var jobData = {
                title, company, location, type,
                description, requirements, skills,
                salaryFrom, salaryTo, salaryPeriod, hideSalary,
                benefits, closingDate,
                customFields: collectCustomFields()
            };

            if (editingId) {
                // Update existing job via API directly
                jobData.id = parseInt(editingId);
                try {
                    var res = await fetch('api/jobs/index.php', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(jobData)
                    });
                    var result = await res.json();
                    if (!result.success) {
                        alert(result.message || 'Failed to update job.');
                        return;
                    }
                } catch (err) {
                    console.error('Error updating job:', err);
                    alert('Failed to update job.');
                    return;
                }
            } else {
                // Save via API-backed JobsStore (new job, checks credits)
                if (typeof JobsStore !== 'undefined') {
                    const result = await JobsStore.addJob(jobData);

                    // Handle no-credits error
                    if (result && result.no_credits) {
                        alert('You have no job credits remaining. Please purchase a package to post jobs.');
                        window.location.href = 'recruiter-pricing.html';
                        return;
                    }

                    // Handle other API errors
                    if (result && result.error) {
                        alert(result.message || 'Failed to post job. Please try again.');
                        return;
                    }
                }
            }
            
            // Reset wizard
            postJobFormWizard.reset();
            delete postJobFormWizard.dataset.editingJobId;
            
            // Reset UI steps
            const steps = document.querySelectorAll('.wizard-step');
            steps.forEach(s => s.classList.remove('active'));
            document.getElementById('step-1').classList.add('active');
            
            const indicators = document.querySelectorAll('.step-indicator');
            indicators.forEach(ind => {
                ind.classList.remove('active', 'completed');
            });
            document.getElementById('indicator-1').classList.add('active');
            
            alert(editingId ? 'Job updated successfully!' : 'Job successfully posted! It will now appear on the Job Seeker dashboard.');
            switchView('my-jobs');
            loadMyJobs();
        });
    }

    // ── Load My Jobs from API ──
    async function loadMyJobs() {
        const tbody = document.getElementById('myJobsTableBody');
        if (!tbody) return;
        const queryJobId = new URLSearchParams(window.location.search).get('job') || '';

        try {
            const res = await fetch('api/jobs/index.php?mine=1', { credentials: 'include' });
            const result = await res.json();
            if (!result.success || !Array.isArray(result.jobs)) return;

            recruiterState.jobs = result.jobs;

            tbody.innerHTML = '';

            const jobsToRender = queryJobId
                ? result.jobs.filter(job => String(job.id) === String(queryJobId))
                : result.jobs;

            if (jobsToRender.length === 0) {
                tbody.innerHTML = queryJobId
                    ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">This job could not be found. It may have been removed or closed.</td></tr>'
                    : '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No jobs posted yet. Click "Post a Job" to get started.</td></tr>';
                renderActivePostingsPreview();
                populateCandidateFilter();
                renderCandidatesView();
                return;
            }

            // Update overview stat
            const statJobs = document.getElementById('statActiveJobs');
            if (statJobs) statJobs.textContent = result.jobs.length;

            let totalApplicants = 0;

            jobsToRender.forEach(job => {
                const tr = document.createElement('tr');
                tr.className = 'card-row card-row-recruiter';
                const applicants = job.applicant_count || 0;
                totalApplicants += parseInt(applicants, 10);

                const statusClass = job.status === 'active' ? 'active' : 'closed';
                const statusLabel = job.status.charAt(0).toUpperCase() + job.status.slice(1);

                tr.innerHTML = `
                    <td data-label="Job">
                        <div class="entity-block">
                            <span class="entity-title">${job.title}</span>
                            <div class="entity-meta">
                                <span class="meta-chip"><i class="fa-solid fa-location-dot"></i> ${job.location || 'Remote'}</span>
                                <span class="meta-chip"><i class="fa-regular fa-clock"></i> ${job.type || 'Full-time'}</span>
                            </div>
                        </div>
                    </td>
                    <td data-label="Status"><span class="job-status ${statusClass}">${statusLabel}</span></td>
                    <td data-label="Applicants">
                        <div class="table-value">
                            <span class="table-metric">${applicants}</span>
                            <span class="table-note">candidate${parseInt(applicants, 10) === 1 ? '' : 's'}</span>
                        </div>
                    </td>
                    <td data-label="Posted">
                        <div class="table-value">
                            <span>${formatRecruiterDate(job.created_at)}</span>
                            <span class="table-note">${timeSince(job.created_at)}</span>
                        </div>
                    </td>
                    <td class="actions-cell" data-label="Actions">
                        <button class="tbl-btn" title="Edit" onclick="editMyJob(${job.id})"><i class="fa-solid fa-pen"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            const statApps = document.getElementById('statApplicants');
            if (statApps && recruiterState.applications.length === 0) statApps.textContent = totalApplicants;

            renderActivePostingsPreview();
            populateCandidateFilter();
            renderCandidatesView();
        } catch (e) {
            console.warn('Failed to load jobs from API:', e);
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">Failed to load jobs. Please refresh the page.</td></tr>';
        }
    }

    window.editMyJob = async function(jobId) {
        // Redirect to post-job page with edit parameter
        window.location.href = 'recruiter-post-job.html?edit=' + encodeURIComponent(jobId);
    };

    window.reviewCandidate = function(applicationId) {
        const app = recruiterState.applications.find(item => item.id === applicationId);
        if (!app) return;

        // Mark application as viewed (fires email to candidate on first view)
        fetch('/api/applications/index.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ application_id: applicationId, action: 'mark_viewed' })
        }).catch(() => {});

        const applicantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.applicant_name || 'Unknown Applicant';
        const statusColors = {
            submitted: '#F59E0B',
            reviewed: '#3B82F6',
            shortlisted: '#059669',
            rejected: '#DC2626',
            hired: '#7C3AED'
        };
        const statusColor = statusColors[app.status] || '#6B7280';

        const responses = Array.isArray(app.form_responses) ? app.form_responses : [];
        const hasResponses = responses.length > 0;

        const body = document.getElementById('candidateModalBody');
        body.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
                <div style="width:50px; height:50px; border-radius:50%; background:#DBEAFE; color:#2563EB; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem;">${getInitials(applicantName)}</div>
                <div>
                    <div style="font-weight:600; font-size:1.05rem;">${applicantName}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${app.email || '—'}</div>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div style="background:var(--bg); padding:12px; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Applied For</div>
                    <div style="font-weight:600; font-size:0.9rem;">${app.job_title || 'Unknown Job'}</div>
                </div>
                <div style="background:var(--bg); padding:12px; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Status</div>
                    <div style="font-weight:600; font-size:0.9rem; color:${statusColor};">${(app.status || 'submitted').charAt(0).toUpperCase() + (app.status || 'submitted').slice(1)}</div>
                </div>
                <div style="background:var(--bg); padding:12px; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Applied On</div>
                    <div style="font-weight:600; font-size:0.9rem;">${formatRecruiterDate(app.created_at)}</div>
                </div>
                <div style="background:var(--bg); padding:12px; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Applicant Note</div>
                    <div style="font-weight:500; font-size:0.85rem;">${app.note || '<span style="color:var(--text-muted);">No note</span>'}</div>
                </div>
            </div>

            <!-- Document tabs -->
            <div class="candidate-doc-tabs">
                <button class="candidate-doc-tab active" data-tab="cv" onclick="switchCandidateDocTab('cv')">
                    <i class="fa-regular fa-file-lines"></i> CV ${app.cv_name ? '' : '<span style="opacity:0.5;">(None)</span>'}
                </button>
                <button class="candidate-doc-tab" data-tab="cl" onclick="switchCandidateDocTab('cl')">
                    <i class="fa-solid fa-envelope-open-text"></i> Cover Letter ${app.cl_name ? '' : '<span style="opacity:0.5;">(None)</span>'}
                </button>
                ${(() => {
                    const extraDocIds = (Array.isArray(app.document_ids) ? app.document_ids : [])
                        .map(id => parseInt(id, 10))
                        .filter(id => id && id !== parseInt(app.cv_id || 0, 10) && id !== parseInt(app.cl_id || 0, 10));
                    return extraDocIds.length
                        ? `<button class="candidate-doc-tab" data-tab="attachments" onclick="switchCandidateDocTab('attachments')"><i class="fa-solid fa-paperclip"></i> Attachments (${extraDocIds.length})</button>`
                        : '';
                })()}
                ${hasResponses ? '<button class="candidate-doc-tab" data-tab="responses" onclick="switchCandidateDocTab(\'responses\')"><i class="fa-solid fa-clipboard-question"></i> Responses</button>' : ''}
            </div>
            <div class="candidate-doc-panel" id="candidateDocPanel">
                ${app.cv_id
                    ? '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;"></i><div style="margin-top:8px; font-size:0.85rem;">Loading CV...</div></div>'
                    : '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-regular fa-file-lines" style="font-size:2rem; margin-bottom:8px; display:block; opacity:0.3;"></i>No CV was attached to this application.</div>'
                }
            </div>
        `;

        // Store app reference for tab switching
        window._currentReviewApp = app;
        window._docCache = {};

        const actions = document.getElementById('candidateModalActions');
        const isTerminal = app.status === 'rejected' || app.status === 'hired';
        actions.innerHTML = isTerminal ? '' : `
            <button class="btn-action accept" onclick="updateCandidateStatus(${app.id}, 'shortlisted'); closeCandidateModal();">Shortlist</button>
            <button class="btn-action reject" onclick="updateCandidateStatus(${app.id}, 'rejected'); closeCandidateModal();">Reject</button>
        `;

        const modal = document.getElementById('candidateModal');
        modal.style.display = 'flex';

        // Auto-load CV tab
        if (app.cv_id) {
            loadCandidateDocument(app, 'cv');
        }
    };

    window.switchCandidateDocTab = function(tab) {
        document.querySelectorAll('.candidate-doc-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.candidate-doc-tab[data-tab="${tab}"]`).classList.add('active');

        const app = window._currentReviewApp;
        if (!app) return;

        const panel = document.getElementById('candidateDocPanel');

        // Handle responses tab
        if (tab === 'responses') {
            const responses = Array.isArray(app.form_responses) ? app.form_responses : [];
            if (responses.length === 0) {
                panel.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-clipboard-question" style="font-size:2rem; margin-bottom:8px; display:block; opacity:0.3;"></i>No screening responses.</div>';
                return;
            }
            let html = '<div class="candidate-responses-list">';
            responses.forEach((r, i) => {
                const answer = r.answer || '<span style="color:var(--text-muted); font-style:italic;">No answer</span>';
                html += `
                    <div class="candidate-response-item">
                        <div class="candidate-response-q"><span class="candidate-response-num">${i + 1}</span> ${escapeHtml(r.question || 'Question')}</div>
                        <div class="candidate-response-a">${escapeHtml(r.answer || '') || '<span style="color:var(--text-muted); font-style:italic;">No answer</span>'}</div>
                    </div>
                `;
            });
            html += '</div>';
            panel.innerHTML = html;
            return;
        }

        if (tab === 'attachments') {
            renderCandidateAttachments(app);
            return;
        }

        const docId = tab === 'cv' ? app.cv_id : app.cl_id;
        const docName = tab === 'cv' ? app.cv_name : app.cl_name;
        const docLabel = tab === 'cv' ? 'CV' : 'Cover Letter';
        const docIcon = tab === 'cv' ? 'fa-regular fa-file-lines' : 'fa-solid fa-envelope-open-text';

        if (!docId) {
            panel.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="${docIcon}" style="font-size:2rem; margin-bottom:8px; display:block; opacity:0.3;"></i>No ${docLabel.toLowerCase()} was attached to this application.</div>`;
            return;
        }

        // Check cache
        if (window._docCache[docId]) {
            renderDocumentInPanel(window._docCache[docId], tab, app.id);
            return;
        }

        panel.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;"></i><div style="margin-top:8px; font-size:0.85rem;">Loading ${docLabel}...</div></div>`;
        loadCandidateDocument(app, tab);
    };

    async function loadCandidateDocument(app, tab) {
        const docId = tab === 'cv' ? app.cv_id : app.cl_id;
        if (!docId) return;

        try {
            const res = await fetch(`api/documents/index.php?id=${encodeURIComponent(docId)}&application_id=${encodeURIComponent(app.id)}`, { credentials: 'include' });
            const result = await res.json();
            if (!result.success || !result.document) {
                document.getElementById('candidateDocPanel').innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">Failed to load document.</div>`;
                return;
            }
            window._docCache[docId] = result.document;
            renderDocumentInPanel(result.document, tab, app.id);
        } catch (e) {
            console.warn('Error loading document:', e);
            document.getElementById('candidateDocPanel').innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">Failed to load document.</div>`;
        }
    }

    async function renderCandidateAttachments(app) {
        const panel = document.getElementById('candidateDocPanel');
        const attachmentIds = (Array.isArray(app.document_ids) ? app.document_ids : [])
            .map(id => parseInt(id, 10))
            .filter(id => id && id !== parseInt(app.cv_id || 0, 10) && id !== parseInt(app.cl_id || 0, 10));

        if (!attachmentIds.length) {
            panel.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-paperclip" style="font-size:2rem; margin-bottom:8px; display:block; opacity:0.3;"></i>No additional attachments were included with this application.</div>';
            return;
        }

        panel.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;"></i><div style="margin-top:8px; font-size:0.85rem;">Loading attachments...</div></div>';

        try {
            const docs = await Promise.all(attachmentIds.map(async (docId) => {
                if (window._docCache[docId]) {
                    return window._docCache[docId];
                }

                const res = await fetch(`api/documents/index.php?id=${encodeURIComponent(docId)}&application_id=${encodeURIComponent(app.id)}`, { credentials: 'include' });
                const result = await res.json();
                if (!result.success || !result.document) {
                    return null;
                }
                window._docCache[docId] = result.document;
                return result.document;
            }));

            const validDocs = docs.filter(Boolean);
            if (!validDocs.length) {
                panel.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);">No additional attachments were available.</div>';
                return;
            }

            panel.innerHTML = `<div class="doc-preview-card"><div class="doc-preview-header"><h4>Additional Attachments</h4><div class="doc-preview-contact">${validDocs.length} attached document${validDocs.length === 1 ? '' : 's'}</div></div><div class="doc-preview-section">${validDocs.map((doc) => {
                const data = doc.data || {};
                const serveUrl = `api/documents/serve.php?id=${encodeURIComponent(doc.id)}&application_id=${encodeURIComponent(app.id)}`;
                const fileName = escHtml(data.original_name || doc.name || `Document #${doc.id}`);
                const mime = String(data.mime_type || '').toLowerCase();
                const icon = mime.indexOf('pdf') !== -1 ? 'fa-file-pdf' : (mime.indexOf('image') !== -1 ? 'fa-file-image' : 'fa-file-word');
                return `<div class="doc-preview-entry" style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><div><div class="doc-preview-entry-title"><i class="fa-solid ${icon}" style="margin-right:8px;"></i>${fileName}</div><div class="doc-preview-entry-meta">${escHtml(doc.doc_type || 'supporting')}</div></div><a href="${serveUrl}" target="_blank" class="btn-action btn-shortlist" style="display:inline-flex; text-decoration:none;"><i class="fa-solid fa-eye"></i> View</a></div>`;
            }).join('')}</div></div>`;
        } catch (e) {
            console.warn('Error loading attachment documents:', e);
            panel.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);">Failed to load attachments.</div>';
        }
    }

    function renderDocumentInPanel(doc, tab, appId) {
        const panel = document.getElementById('candidateDocPanel');
        const data = doc.data || {};

        // Uploaded file — show PDF embed or download link
        if (data.uploaded_file) {
            const serveUrl = `api/documents/serve.php?id=${encodeURIComponent(doc.id)}&application_id=${encodeURIComponent(appId)}`;
            const isPdf = (data.mime_type || '').indexOf('pdf') !== -1;
            const originalName = escHtml(data.original_name || data.uploaded_file);
            let html = `<div class="doc-preview-card">`;
            html += `<div class="doc-preview-header"><h4>${escHtml(doc.name || 'Uploaded Document')}</h4><div class="doc-preview-contact">${originalName}</div></div>`;
            if (isPdf) {
                html += `<div class="doc-preview-section"><iframe src="${serveUrl}" style="width:100%; height:500px; border:1px solid var(--border); border-radius:8px;" title="${originalName}"></iframe></div>`;
            } else {
                html += `<div class="doc-preview-section" style="text-align:center; padding:32px;"><i class="fa-solid fa-file-word" style="font-size:3rem; color:#2563EB; margin-bottom:12px; display:block;"></i><p style="margin-bottom:12px;">This document is a Word file and cannot be previewed inline.</p><a href="${serveUrl}" target="_blank" class="btn-action btn-shortlist" style="display:inline-flex; text-decoration:none;"><i class="fa-solid fa-download"></i> Download ${originalName}</a></div>`;
            }
            html += `</div>`;
            panel.innerHTML = html;
            return;
        }

        // System-built document — render from JSON data
        if (tab === 'cv') {
            panel.innerHTML = renderCVPreview(data, doc.name);
        } else {
            panel.innerHTML = renderCLPreview(data, doc.name);
        }
    }

    function renderCVPreview(d, docName) {
        const fullName = escHtml(`${d.firstName || ''} ${d.lastName || ''}`.trim()) || 'Unnamed';
        const contactParts = [d.email, d.phone, d.address, [d.postCode, d.city].filter(Boolean).join(' ')].filter(Boolean).map(escHtml);

        let html = `<div class="doc-preview-card">`;
        html += `<div class="doc-preview-header"><h4>${fullName}</h4>`;
        if (d.jobTitle) html += `<div class="doc-preview-subtitle">${escHtml(d.jobTitle)}</div>`;
        if (contactParts.length) html += `<div class="doc-preview-contact">${contactParts.join(' &bull; ')}</div>`;
        html += `</div>`;

        if (d.summary) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Professional Summary</div><p>${escHtml(d.summary)}</p></div>`;
        }

        if (d.experience && d.experience.length) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Experience</div>`;
            d.experience.forEach(e => {
                html += `<div class="doc-preview-entry">`;
                html += `<div class="doc-preview-entry-title">${escHtml(e.jobTitle) || 'Untitled'}${e.employer ? ' at ' + escHtml(e.employer) : ''}</div>`;
                const dates = [escHtml(e.startDate), escHtml(e.endDate) || 'Present'].filter(Boolean).join(' — ');
                if (dates || e.city) html += `<div class="doc-preview-entry-meta">${dates}${e.city ? ' &bull; ' + escHtml(e.city) : ''}</div>`;
                if (e.description) html += `<div class="doc-preview-entry-desc">${escHtml(e.description)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        }

        if (d.education && d.education.length) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Education</div>`;
            d.education.forEach(e => {
                html += `<div class="doc-preview-entry">`;
                html += `<div class="doc-preview-entry-title">${escHtml(e.degree) || 'Untitled'}${e.school ? ' at ' + escHtml(e.school) : ''}</div>`;
                const dates = [escHtml(e.startDate), escHtml(e.endDate) || 'Present'].filter(Boolean).join(' — ');
                if (dates || e.city) html += `<div class="doc-preview-entry-meta">${dates}${e.city ? ' &bull; ' + escHtml(e.city) : ''}</div>`;
                if (e.description) html += `<div class="doc-preview-entry-desc">${escHtml(e.description)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        }

        if (d.skills && d.skills.length) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Skills</div><div class="doc-preview-chips">`;
            d.skills.forEach(s => { html += `<span class="doc-preview-chip">${escHtml(s.name || s)}</span>`; });
            html += `</div></div>`;
        }

        if (d.languages && d.languages.length) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Languages</div><div class="doc-preview-chips">`;
            d.languages.forEach(l => { html += `<span class="doc-preview-chip">${escHtml(l.name || l)}${l.level ? ' — ' + escHtml(l.level) : ''}</span>`; });
            html += `</div></div>`;
        }

        if (d.hobbies) {
            html += `<div class="doc-preview-section"><div class="doc-preview-section-title">Hobbies & Interests</div><p>${escHtml(d.hobbies)}</p></div>`;
        }

        html += `</div>`;
        return html;
    }

    function renderCLPreview(d, docName) {
        const fullName = escHtml(`${d.firstName || ''} ${d.lastName || ''}`.trim()) || 'Unnamed';
        const contactParts = [d.email, d.phone, d.address].filter(Boolean).map(escHtml);

        let html = `<div class="doc-preview-card">`;
        html += `<div class="doc-preview-header"><h4>${fullName}</h4>`;
        if (contactParts.length) html += `<div class="doc-preview-contact">${contactParts.join(' &bull; ')}</div>`;
        html += `</div>`;

        if (d.companyName || d.hiringManager) {
            html += `<div class="doc-preview-section">`;
            if (d.hiringManager) html += `<p>Dear ${escHtml(d.hiringManager)},</p>`;
            else if (d.companyName) html += `<p>Dear Hiring Manager at ${escHtml(d.companyName)},</p>`;
            html += `</div>`;
        }

        if (d.letterContent) {
            html += `<div class="doc-preview-section doc-preview-letter-body">`;
            const paragraphs = d.letterContent.split('\n').filter(p => p.trim());
            paragraphs.forEach(p => { html += `<p>${escHtml(p.trim())}</p>`; });
            html += `</div>`;
        } else {
            html += `<div class="doc-preview-section" style="color:var(--text-muted); text-align:center; padding:20px;">No cover letter content available.</div>`;
        }

        if (d.letterContent) {
            html += `<div class="doc-preview-section"><p>Sincerely,<br><strong>${fullName}</strong></p></div>`;
        }

        html += `</div>`;
        return html;
    }

    window.closeCandidateModal = function() {
        var modal = document.getElementById('candidateModal');
        if (modal) modal.style.display = 'none';
    };

    window.updateCandidateStatus = async function(applicationId, status) {
        try {
            const res = await fetch('api/applications/index.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ application_id: applicationId, status })
            });
            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || 'Status update failed');
            }

            await loadCandidates();
        } catch (e) {
            console.warn('Failed to update application status:', e);
            alert('Failed to update candidate status.');
        }
    };

    document.getElementById('candidateJobFilter')?.addEventListener('change', renderCandidatesView);

    // Load on page ready
    loadMyJobs();
    loadCandidates();
});

// View Navigation (redirects to separate pages)
function switchView(viewId) {
    const pageMap = {
        'overview': 'recruiter-overview.html',
        'post-job': 'recruiter-post-job.html',
        'my-jobs': 'recruiter-my-jobs.html',
        'candidates': 'recruiter-candidates.html',
        'messages': 'recruiter-messages.html',
        'company': 'recruiter-company.html'
    };
    window.location.href = pageMap[viewId] || 'recruiter-overview.html';
}
