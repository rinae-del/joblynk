// Recruiter Dashboard Logic

const recruiterState = {
    jobs: [],
    applications: [],
};

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

function renderCandidateCard(app, compact = false) {
    const applicantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.applicant_name || 'Unknown Applicant';
    const jobTitle = app.job_title || 'Unknown Job';
    const submitted = compact ? '' : ` • ${formatRecruiterDate(app.created_at)}`;
    const reviewLabel = compact ? 'Review' : 'Review Profile';

    return `
        <div class="candidate-item">
            <div class="candidate-info-wrapper">
                <div class="candidate-avatar">${getInitials(applicantName)}</div>
                <div class="candidate-details">
                    <h4>${applicantName}</h4>
                    <p>Applied for <strong>${jobTitle}</strong>${submitted}</p>
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
            <div class="candidate-item">
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
            <div class="job-item" style="border: 1px solid var(--border)">
                <div class="job-info">
                    <div class="job-title">No active postings yet</div>
                    <div class="job-company">Published jobs will appear here.</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = activeJobs.map((job, index) => `
        <div class="job-item" style="border: 1px solid var(--border); ${index < activeJobs.length - 1 ? 'margin-bottom: 8px;' : ''}">
            <div class="job-info">
                <div class="job-title">${job.title}</div>
                <div class="job-company">${job.applicant_count || 0} Applicants • Posted ${timeSince(job.created_at)}</div>
            </div>
            <span class="job-status active">Active</span>
        </div>
    `).join('');
}

function populateCandidateFilter() {
    const select = document.getElementById('candidateJobFilter');
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = '<option value="">Filter by Job: All</option>';
    recruiterState.jobs.forEach(job => {
        select.innerHTML += `<option value="${job.id}">${job.title}</option>`;
    });
    if ([...select.options].some(option => option.value === previousValue)) {
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
            <div class="candidate-item">
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
            const location = document.getElementById('wizLocation').value;
            const type = document.getElementById('wizType').value;
            const description = document.getElementById('wizDesc')?.value || '';
            const requirements = document.getElementById('wizReqs')?.value || '';
            const skills = document.getElementById('wizSkills')?.value || '';
            const salaryFrom = document.getElementById('wizSalaryFrom')?.value || '';
            const salaryTo = document.getElementById('wizSalaryTo')?.value || '';
            const salaryPeriod = document.getElementById('wizSalaryPeriod')?.value || 'Per Month';
            const closingDate = document.getElementById('wizDate')?.value || '';

            // Collect benefits
            const benefits = [];
            document.querySelectorAll('.checkbox-grid input[type="checkbox"]:checked').forEach(cb => {
                benefits.push(cb.value);
            });

            var jobData = {
                title, company, location, type,
                description, requirements, skills,
                salaryFrom, salaryTo, salaryPeriod,
                benefits, closingDate
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

        try {
            const res = await fetch('api/jobs/index.php?mine=1', { credentials: 'include' });
            const result = await res.json();
            if (!result.success || !Array.isArray(result.jobs)) return;

            recruiterState.jobs = result.jobs;

            tbody.innerHTML = '';

            if (result.jobs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No jobs posted yet. Click "Post a Job" to get started.</td></tr>';
                renderActivePostingsPreview();
                populateCandidateFilter();
                renderCandidatesView();
                return;
            }

            // Update overview stat
            const statJobs = document.getElementById('statActiveJobs');
            if (statJobs) statJobs.textContent = result.jobs.length;

            let totalApplicants = 0;

            result.jobs.forEach(job => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                const applicants = job.applicant_count || 0;
                totalApplicants += parseInt(applicants, 10);

                const statusClass = job.status === 'active' ? 'active' : 'closed';
                const statusLabel = job.status.charAt(0).toUpperCase() + job.status.slice(1);

                tr.innerHTML = `
                    <td style="padding: 16px;">
                        <div style="font-weight: 600;">${job.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${job.location || ''} • ${job.type || ''}</div>
                    </td>
                    <td style="padding: 16px;"><span class="job-status ${statusClass}">${statusLabel}</span></td>
                    <td style="padding: 16px; font-weight: 600;">${applicants}</td>
                    <td style="padding: 16px; font-size: 0.85rem; color: var(--text-muted);">${formatRecruiterDate(job.created_at)}</td>
                    <td style="padding: 16px;">
                        <button class="section-arrow" style="width: 30px; height: 30px;" title="Edit" onclick="editMyJob(${job.id})"><i class="fa-solid fa-pen"></i></button>
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
        }
    }

    window.editMyJob = async function(jobId) {
        try {
            var res = await fetch('api/jobs/index.php?id=' + encodeURIComponent(jobId), { credentials: 'include' });
            var data = await res.json();
            if (!data.success || !data.job) {
                alert('Could not load job details.');
                return;
            }
            var job = data.job;

            // Pre-fill wizard fields
            var f = document.getElementById;
            document.getElementById('wizJobTitle').value = job.title || '';
            document.getElementById('wizCompany').value = job.company || '';
            document.getElementById('wizLocation').value = job.location || '';
            document.getElementById('wizType').value = job.type || 'Full-time';
            if (document.getElementById('wizDesc')) document.getElementById('wizDesc').value = job.description || '';
            if (document.getElementById('wizReqs')) document.getElementById('wizReqs').value = job.requirements || '';
            if (document.getElementById('wizSkills')) document.getElementById('wizSkills').value = job.skills || '';
            if (document.getElementById('wizSalaryFrom')) document.getElementById('wizSalaryFrom').value = job.salary_from || '';
            if (document.getElementById('wizSalaryTo')) document.getElementById('wizSalaryTo').value = job.salary_to || '';
            if (document.getElementById('wizSalaryPeriod')) document.getElementById('wizSalaryPeriod').value = job.salary_period || 'Per Month';
            if (document.getElementById('wizDate')) document.getElementById('wizDate').value = job.closing_date || '';

            // Set benefit checkboxes
            var benefits = Array.isArray(job.benefits) ? job.benefits : [];
            document.querySelectorAll('.checkbox-grid input[type="checkbox"]').forEach(function(cb) {
                cb.checked = benefits.indexOf(cb.value) !== -1;
            });

            // Store editing job ID on the form
            var form = document.getElementById('postJobFormWizard');
            if (form) form.dataset.editingJobId = jobId;

            // Switch to post-job view
            switchView('post-job');
        } catch (e) {
            console.error('Error loading job for edit:', e);
            alert('Failed to load job for editing.');
        }
    };

    window.reviewCandidate = function(applicationId) {
        const app = recruiterState.applications.find(item => item.id === applicationId);
        if (!app) return;

        const applicantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.applicant_name || 'Unknown Applicant';
        const statusColors = {
            submitted: '#F59E0B',
            reviewed: '#3B82F6',
            shortlisted: '#059669',
            rejected: '#DC2626',
            hired: '#7C3AED'
        };
        const statusColor = statusColors[app.status] || '#6B7280';

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
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">CV</div>
                    <div style="font-weight:600; font-size:0.9rem;">${app.cv_name ? '<i class="fa-solid fa-check-circle" style="color:#059669;"></i> ' + app.cv_name : '<span style="color:var(--text-muted);">None attached</span>'}</div>
                </div>
                <div style="background:var(--bg); padding:12px; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Cover Letter</div>
                    <div style="font-weight:600; font-size:0.9rem;">${app.cl_name ? '<i class="fa-solid fa-check-circle" style="color:#7E22CE;"></i> ' + app.cl_name : '<span style="color:var(--text-muted);">None attached</span>'}</div>
                </div>
            </div>
            <div style="background:var(--bg); padding:12px; border-radius:10px;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Applied On</div>
                <div style="font-weight:600; font-size:0.9rem;">${formatRecruiterDate(app.created_at)}</div>
            </div>
        `;

        const actions = document.getElementById('candidateModalActions');
        const isTerminal = app.status === 'rejected' || app.status === 'hired';
        actions.innerHTML = isTerminal ? '' : `
            <button class="btn-action accept" onclick="updateCandidateStatus(${app.id}, 'shortlisted'); closeCandidateModal();">Shortlist</button>
            <button class="btn-action reject" onclick="updateCandidateStatus(${app.id}, 'rejected'); closeCandidateModal();">Reject</button>
        `;

        const modal = document.getElementById('candidateModal');
        modal.style.display = 'flex';
    };

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

// View Setup
function switchView(viewId) {
    // Hide all sections
    const sections = document.querySelectorAll('.dashboard-view-section');
    sections.forEach(sec => sec.classList.remove('active'));
    
    // Show target section
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
    }
    
    // Update nav active states
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Map viewId to nav item ID
    const navMap = {
        'overview': 'navDashboard',
        'my-jobs': 'navMyJobs',
        'candidates': 'navCandidates',
        'messages': 'navMessages'
    };
    
    if (navMap[viewId]) {
        const activeNav = document.getElementById(navMap[viewId]);
        if (activeNav) activeNav.classList.add('active');
    }
    
    // Close sidebar on mobile after clicking
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        sidebar.style.transform = 'translateX(-100%)';
    }
}
