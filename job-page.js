(() => {
    const cfg = window.__JOBPAGE__ || {};
    const $ = id => document.getElementById(id);

    const form = $('jpApplyForm');
    if (!form) return;

    const state = {
        file: null,
        accountRevealed: false,
        mode: 'create', // 'create' | 'signin'
        submitting: false,
    };

    const els = {
        firstName: $('jpFirstName'),
        lastName: $('jpLastName'),
        email: $('jpEmail'),
        cv: $('jpCv'),
        uploadBox: $('jpUploadBox'),
        uploadText: $('jpUploadText'),
        fileList: $('jpFileList'),
        note: $('jpNote'),
        accountStep: $('jpAccountStep'),
        accountTitle: $('jpAccountTitle'),
        accountSub: $('jpAccountSub'),
        password: $('jpPassword'),
        passwordLabel: $('jpPasswordLabel'),
        passwordToggle: $('jpPasswordToggle'),
        switchPrompt: $('jpSwitchPrompt'),
        toggleMode: $('jpToggleMode'),
        feedback: $('jpFeedback'),
        submitBtn: $('jpSubmitBtn'),
        submitLabel: $('jpSubmitLabel'),
        successMsg: $('jpSuccessMsg'),
    };

    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED = ['pdf', 'doc', 'docx'];

    function setFeedback(message, kind = 'error') {
        if (!els.feedback) return;
        if (!message) {
            els.feedback.hidden = true;
            els.feedback.textContent = '';
            return;
        }
        els.feedback.hidden = false;
        els.feedback.textContent = message;
        els.feedback.className = 'jp-apply-feedback ' + (kind === 'info' ? 'is-info' : 'is-error');
    }

    function setSubmitting(on, label) {
        state.submitting = on;
        els.submitBtn.disabled = on;
        if (label) els.submitLabel.textContent = label;
    }

    // ── File handling ──
    function renderFile() {
        if (!els.fileList) return;
        if (!state.file) {
            els.fileList.innerHTML = '';
            els.uploadText.textContent = 'Click to upload or drag a file';
            return;
        }
        const sizeKb = Math.round(state.file.size / 1024);
        els.uploadText.textContent = 'Replace file';
        els.fileList.innerHTML = `
            <div class="jp-file-pill">
                <i class="fa-solid fa-file-lines"></i>
                <span class="jp-file-name">${escapeHtml(state.file.name)}</span>
                <span style="opacity:.7">${sizeKb} KB</span>
                <button type="button" id="jpRemoveFile" aria-label="Remove file"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        $('jpRemoveFile')?.addEventListener('click', () => {
            state.file = null;
            els.cv.value = '';
            renderFile();
        });
    }

    function acceptFile(file) {
        if (!file) return;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED.includes(ext)) {
            setFeedback('Please upload a PDF, DOC or DOCX file.');
            return;
        }
        if (file.size > MAX_SIZE) {
            setFeedback('File is too large. Maximum size is 5MB.');
            return;
        }
        setFeedback('');
        state.file = file;
        renderFile();
    }

    els.cv?.addEventListener('change', e => acceptFile(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(evt => els.uploadBox?.addEventListener(evt, e => {
        e.preventDefault();
        els.uploadBox.classList.add('is-drag');
    }));
    ['dragleave', 'drop'].forEach(evt => els.uploadBox?.addEventListener(evt, e => {
        e.preventDefault();
        els.uploadBox.classList.remove('is-drag');
    }));
    els.uploadBox?.addEventListener('drop', e => acceptFile(e.dataTransfer.files[0]));

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str || '');
        return div.innerHTML;
    }

    // ── Validation ──
    function validateApplicationFields() {
        const first = els.firstName.value.trim();
        const last = els.lastName.value.trim();
        const email = els.email.value.trim();
        if (!first || !last) {
            setFeedback('Please enter your first and last name.');
            return false;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            setFeedback('Please enter a valid email address.');
            return false;
        }
        // Required screening questions
        let ok = true;
        document.querySelectorAll('.jp-custom-answer[data-required="1"]').forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = '#f87171';
                ok = false;
            } else {
                input.style.borderColor = '';
            }
        });
        if (!ok) {
            setFeedback('Please answer all required screening questions.');
            return false;
        }
        setFeedback('');
        return true;
    }

    function collectFormResponses() {
        const responses = [];
        document.querySelectorAll('.jp-custom-answer').forEach(input => {
            responses.push({ question: input.dataset.label || 'Question', answer: input.value.trim() });
        });
        return responses;
    }

    // ── Account step ──
    function revealAccountStep() {
        state.accountRevealed = true;
        els.accountStep.hidden = false;
        applyMode();
        els.password.focus();
        els.accountStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function applyMode() {
        if (state.mode === 'create') {
            els.accountTitle.textContent = 'Create your free account to submit';
            els.accountSub.textContent = 'Your application details above are saved. Just set a password to finish.';
            els.passwordLabel.innerHTML = 'Choose a password <span class="jp-optional">(min 8 characters)</span>';
            els.password.setAttribute('autocomplete', 'new-password');
            els.switchPrompt.textContent = 'Already have an account?';
            els.toggleMode.textContent = 'Sign in instead';
            els.submitLabel.textContent = 'Create account & submit';
        } else {
            els.accountTitle.textContent = 'Sign in to submit your application';
            els.accountSub.textContent = "Enter your password. We'll attach the application you just filled in.";
            els.passwordLabel.innerHTML = 'Your password';
            els.password.setAttribute('autocomplete', 'current-password');
            els.switchPrompt.textContent = 'New to JobLynk?';
            els.toggleMode.textContent = 'Create an account instead';
            els.submitLabel.textContent = 'Sign in & submit';
        }
    }

    els.toggleMode?.addEventListener('click', () => {
        state.mode = state.mode === 'create' ? 'signin' : 'create';
        setFeedback('');
        applyMode();
        els.password.focus();
    });

    els.passwordToggle?.addEventListener('click', () => {
        const showing = els.password.type === 'text';
        els.password.type = showing ? 'password' : 'text';
        els.passwordToggle.innerHTML = showing
            ? '<i class="fa-regular fa-eye"></i>'
            : '<i class="fa-regular fa-eye-slash"></i>';
    });

    // ── Network steps ──
    async function postJson(url, payload) {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        let data = {};
        try { data = await res.json(); } catch (e) {}
        return { res, data };
    }

    async function createAccount() {
        const { res, data } = await postJson('/api/auth/guest-signup.php', {
            firstName: els.firstName.value.trim(),
            lastName: els.lastName.value.trim(),
            email: els.email.value.trim().toLowerCase(),
            password: els.password.value,
        });
        if (res.status === 409 && data.accountExists) {
            state.mode = 'signin';
            applyMode();
            setFeedback('That email is already registered. Enter your password to sign in and submit.', 'info');
            return false;
        }
        if (!data.success) {
            setFeedback(data.message || 'Could not create your account. Please try again.');
            return false;
        }
        return true;
    }

    async function signIn() {
        const { data } = await postJson('/api/auth/signin.php', {
            email: els.email.value.trim().toLowerCase(),
            password: els.password.value,
        });
        if (data.needsVerify) {
            setFeedback('Please verify your email first. Check your inbox, then sign in to submit.', 'info');
            return false;
        }
        if (!data.success) {
            setFeedback(data.message || 'Invalid email or password.');
            return false;
        }
        if (data.user && data.user.role !== 'job_seeker' && data.user.role !== 'admin') {
            setFeedback('Please use a job seeker account to apply for roles.');
            return false;
        }
        return true;
    }

    async function submitApplication() {
        const fd = new FormData();
        fd.append('job_id', cfg.jobId);
        const note = els.note.value.trim();
        if (note) fd.append('note', note);
        const responses = collectFormResponses();
        if (responses.length) fd.append('form_responses', JSON.stringify(responses));
        if (state.file) fd.append('cv_file', state.file);

        const res = await fetch('/api/applications/index.php', {
            method: 'POST',
            credentials: 'include',
            body: fd,
        });
        let data = {};
        try { data = await res.json(); } catch (e) {}

        if (data.success) {
            showSuccess(data);
            return true;
        }
        if (res.status === 409) {
            setFeedback(data.message || 'You have already applied to this job.', 'info');
            return false;
        }
        setFeedback(data.message || 'Could not submit your application. Please try again.');
        return false;
    }

    function showSuccess(data) {
        const card = $('jpApplyCard');
        const success = $('jpSuccess');
        if (card) card.style.display = 'none';
        if (success) {
            success.hidden = false;
            if (data && data.apply_mode === 'external_completion' && data.external_url) {
                els.successMsg.innerHTML = 'Your application is logged. Finish on the employer site: '
                    + `<a href="${escapeHtml(data.external_url)}" target="_blank" rel="noopener" style="color:#a5b4fc;font-weight:700;">complete application</a>.`;
            }
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // ── Submit orchestration ──
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (state.submitting) return;
        if (!validateApplicationFields()) return;

        // Logged-in job seeker (or admin) → submit directly.
        if (cfg.loggedIn) {
            setSubmitting(true, 'Submitting...');
            await submitApplication();
            setSubmitting(false, 'Submit application');
            return;
        }

        // Guest: first click reveals the account step.
        if (!state.accountRevealed) {
            revealAccountStep();
            return;
        }

        // Guest: account step confirmed.
        const pwd = els.password.value;
        if (state.mode === 'create' && pwd.length < 8) {
            setFeedback('Password must be at least 8 characters.');
            els.password.focus();
            return;
        }
        if (state.mode === 'signin' && !pwd) {
            setFeedback('Please enter your password.');
            els.password.focus();
            return;
        }

        setSubmitting(true, state.mode === 'create' ? 'Creating account...' : 'Signing in...');
        const authed = state.mode === 'create' ? await createAccount() : await signIn();
        if (!authed) {
            setSubmitting(false, state.mode === 'create' ? 'Create account & submit' : 'Sign in & submit');
            return;
        }

        setSubmitting(true, 'Submitting application...');
        await submitApplication();
        setSubmitting(false, state.mode === 'create' ? 'Create account & submit' : 'Sign in & submit');
    });

    // ── Copy link ──
    document.querySelector('.jp-copy-link')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const url = btn.dataset.url;
        try {
            await navigator.clipboard.writeText(url);
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { btn.innerHTML = original; }, 1500);
        } catch (err) {
            window.prompt('Copy this link:', url);
        }
    });
})();
