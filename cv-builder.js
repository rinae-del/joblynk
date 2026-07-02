document.addEventListener('DOMContentLoaded', () => {

    // ============================
    // AUTH STATE (non-blocking - guests allowed)
    // ============================
    let isLoggedIn = false;
    let currentUser = null;

    const authReady = fetch('api/auth/session.php', { credentials: 'include', cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
            if (data.loggedIn) {
                isLoggedIn = true;
                currentUser = data.user;
                window.__JobLynkUser = data.user;
            } else {
                // Guest mode: update UI
                const backBtn = document.getElementById('btnBack');
                if (backBtn) { backBtn.href = 'index.html'; backBtn.querySelector('span').textContent = 'Home'; }
            }
        })
        .catch(() => {});

    // ============================
    // STATE
    // ============================
    const cvData = {
        firstName: '', lastName: '', jobTitle: '',
        email: '', phone: '', address: '', postCode: '', city: '',
        summary: '', hobbies: '',
        experience: [],   // { id, jobTitle, employer, startDate, endDate, city, description }
        education: [],    // { id, school, degree, startDate, endDate, city, description }
        skills: [],       // { id, name }
        languages: [],    // { id, name, level }
        photoUrl: '',
        // Optional fields
        dateOfBirth: '', placeOfBirth: '', drivingLicence: '',
        gender: '', nationality: '',
        website: '', linkedin: ''
    };

    const activeOptionalFields = new Set();
    const TITLE_DEFAULT = 'Untitled CV';

    const uid = () => Math.random().toString(36).substr(2, 9);

    const monthOptions = [
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' },
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];

    const dayOptions = Array.from({ length: 31 }, (_, index) => ({
        value: String(index + 1).padStart(2, '0'),
        label: String(index + 1)
    }));

    const genderOptions = [
        { value: 'Male', label: 'Male' },
        { value: 'Female', label: 'Female' },
        { value: 'Non-binary', label: 'Non-binary' },
        { value: 'Other', label: 'Other' },
        { value: 'Prefer not to say', label: 'Prefer not to say' }
    ];

    const drivingLicenceOptions = [
        { value: 'No licence', label: 'No licence' },
        { value: 'Learner\'s licence', label: 'Learner\'s licence' },
        { value: 'Code 8', label: 'Code 8' },
        { value: 'Code 10', label: 'Code 10' },
        { value: 'Code 14', label: 'Code 14' },
        { value: 'International licence', label: 'International licence' }
    ];

    const languageOptions = [
        'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana',
        'Sepedi', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele', 'South African Sign Language',
        'French', 'Portuguese', 'German', 'Spanish', 'Arabic', 'Mandarin',
        'Hindi', 'Urdu', 'Swahili'
    ].map(language => ({ value: language, label: language }));

    const languageLevelOptions = [
        { value: 'Native', label: 'Native' },
        { value: 'Fluent', label: 'Fluent' },
        { value: 'Advanced', label: 'Advanced' },
        { value: 'Intermediate', label: 'Intermediate' },
        { value: 'Basic', label: 'Basic' }
    ];

    const cityOptions = [
        'Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Port Elizabeth',
        'Bloemfontein', 'Polokwane', 'Mbombela', 'Nelspruit', 'East London', 'Kimberley',
        'Pietermaritzburg', 'Rustenburg', 'Mthatha', 'George', 'Welkom', 'Vereeniging',
        'Vanderbijlpark', 'Centurion', 'Sandton', 'Midrand', 'Roodepoort', 'Soweto',
        'Benoni', 'Boksburg', 'Kempton Park', 'Alberton', 'Randburg', 'Brakpan',
        'Springs', 'Krugersdorp', 'Tembisa', 'Umlazi', 'Pinetown', 'Chatsworth',
        'Umhlanga', 'Ballito', 'Stellenbosch', 'Paarl', 'Worcester', 'Bellville',
        'Brackenfell', 'Khayelitsha', 'Mitchells Plain', 'Middelburg', 'Emalahleni',
        'Secunda', 'Newcastle', 'Ladysmith', 'Klerksdorp', 'Potchefstroom', 'Mahikeng',
        'Upington', 'Queenstown', 'Other / Remote'
    ].map(city => ({ value: city, label: city }));

    const skillSuggestionValues = [
        'Account management', 'Accounting', 'Administration', 'Adobe Photoshop', 'Agile project delivery',
        'Analytical thinking', 'Attention to detail', 'Auditing', 'AutoCAD', 'Bookkeeping',
        'Budgeting', 'Business analysis', 'Call centre support', 'Calendar management', 'Cash handling',
        'Change management', 'Client relations', 'Cloud computing', 'Communication', 'Compliance',
        'Conflict resolution', 'Content writing', 'Copywriting', 'CRM', 'Customer service',
        'Cybersecurity', 'Data analysis', 'Data capturing', 'Data entry', 'Database administration',
        'Digital marketing', 'Documentation', 'Driving', 'Electrical maintenance', 'Email management',
        'Event coordination', 'Excel', 'Financial reporting', 'Forecasting', 'Forklift operation',
        'Front-end development', 'Graphic design', 'Health and safety', 'HR administration', 'Inspection',
        'Inventory management', 'Invoicing', 'Java', 'JavaScript', 'Leadership',
        'Logistics coordination', 'Machine operation', 'Market research', 'Microsoft Office', 'Negotiation',
        'Network support', 'Nursing support', 'Office administration', 'Order processing', 'Payroll',
        'Patient care', 'Performance management', 'Plumbing', 'Power BI', 'Presentation skills',
        'Problem solving', 'Process improvement', 'Procurement', 'Product knowledge', 'Product management',
        'Project coordination', 'Project management', 'Public speaking', 'Python', 'Quality assurance',
        'Reception', 'Recruitment', 'Relationship management', 'Report writing', 'Research',
        'Retail sales', 'Risk management', 'Scheduling', 'SEO', 'Social media management',
        'Software support', 'Software testing', 'SQL', 'Stakeholder management', 'Stock control',
        'Strategic planning', 'Supervision', 'Teaching', 'Technical support', 'Team leadership',
        'Teamwork', 'Telephone etiquette', 'Time management', 'Training', 'Troubleshooting',
        'UI/UX design', 'Video editing', 'Warehousing', 'Welding', 'WordPress'
    ];

    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function buildYearOptions(startYear, endYear) {
        const options = [];
        for (let year = startYear; year >= endYear; year -= 1) {
            options.push({ value: String(year), label: String(year) });
        }
        return options;
    }

    function ensureSelectedOption(options, selectedValue) {
        if (!selectedValue) return options;
        return options.some(option => option.value === selectedValue)
            ? options
            : [{ value: selectedValue, label: selectedValue }, ...options];
    }

    function buildSelectOptions(options, selectedValue, placeholder) {
        return [`<option value="">${escapeHtml(placeholder)}</option>`]
            .concat(
                ensureSelectedOption(options, selectedValue).map(option =>
                    `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
                )
            )
            .join('');
    }

    function buildCityOptions(selectedValue, placeholder = 'Select city') {
        return buildSelectOptions(cityOptions, selectedValue, placeholder);
    }

    function hydrateCitySelect(select = $('city'), selectedValue = cvData.city, placeholder = 'Select city') {
        if (!select) return;
        select.innerHTML = buildCityOptions(selectedValue, placeholder);
    }

    function normalizeSkillTerm(value = '') {
        return String(value).trim().toLowerCase();
    }

    function getMatchingSkillSuggestions(query, currentSkillId) {
        const normalizedQuery = normalizeSkillTerm(query);
        if (!normalizedQuery) return [];

        const usedSkills = new Set(
            cvData.skills
                .filter(skill => skill.id !== currentSkillId)
                .map(skill => normalizeSkillTerm(skill.name))
                .filter(Boolean)
        );

        return skillSuggestionValues
            .filter(skill => !usedSkills.has(normalizeSkillTerm(skill)))
            .filter(skill => normalizeSkillTerm(skill).includes(normalizedQuery))
            .sort((left, right) => {
                const leftValue = normalizeSkillTerm(left);
                const rightValue = normalizeSkillTerm(right);
                const leftStarts = leftValue.startsWith(normalizedQuery) ? 0 : 1;
                const rightStarts = rightValue.startsWith(normalizedQuery) ? 0 : 1;
                if (leftStarts !== rightStarts) return leftStarts - rightStarts;
                return left.localeCompare(right);
            })
            .slice(0, 8);
    }

    function closeSkillSuggestionPanel(panel) {
        if (!panel) return;
        panel.classList.remove('open');
        panel.innerHTML = '';
    }

    function closeAllSkillSuggestionPanels() {
        document.querySelectorAll('.skill-suggestion-list.open').forEach(closeSkillSuggestionPanel);
    }

    function renderSkillSuggestionPanel(input) {
        const wrapper = input.closest('.skill-input-group');
        const panel = wrapper?.querySelector('.skill-suggestion-list');
        if (!panel) return;

        const suggestions = getMatchingSkillSuggestions(input.value || '', input.getAttribute('data-id'));
        if (!suggestions.length) {
            closeSkillSuggestionPanel(panel);
            return;
        }

        panel.innerHTML = suggestions.map(skill => `
            <button type="button" class="skill-suggestion-option" data-skill-value="${escapeHtml(skill)}">${escapeHtml(skill)}</button>
        `).join('');
        panel.querySelectorAll('.skill-suggestion-option').forEach(button => {
            button.addEventListener('mousedown', (event) => {
                event.preventDefault();
                const value = button.getAttribute('data-skill-value') || '';
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                closeSkillSuggestionPanel(panel);
            });
        });
        panel.classList.add('open');
    }

    function parseStoredDate(value) {
        const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value || '');
        return {
            year: match?.[1] || '',
            month: match?.[2] || '',
            day: match?.[3] || ''
        };
    }

    function buildMonthYearControl(arr, id, key, value) {
        const { year, month } = parseStoredDate(value);
        const currentYear = new Date().getFullYear();
        return `
            <div class="date-select-grid date-select-grid-2">
                <select class="dyn" data-arr="${arr}" data-id="${id}" data-key="${key}" data-date-part="month">
                    ${buildSelectOptions(monthOptions, month, 'Month')}
                </select>
                <select class="dyn" data-arr="${arr}" data-id="${id}" data-key="${key}" data-date-part="year">
                    ${buildSelectOptions(buildYearOptions(currentYear + 5, currentYear - 60), year, 'Year')}
                </select>
            </div>
        `;
    }

    function buildDateOfBirthControl(field, value) {
        const { day, month, year } = parseStoredDate(value);
        const currentYear = new Date().getFullYear();
        return `
            <div class="date-select-grid date-select-grid-3">
                <select data-optional-field="${field}" data-date-part="day">
                    ${buildSelectOptions(dayOptions, day, 'Day')}
                </select>
                <select data-optional-field="${field}" data-date-part="month">
                    ${buildSelectOptions(monthOptions, month, 'Month')}
                </select>
                <select data-optional-field="${field}" data-date-part="year">
                    ${buildSelectOptions(buildYearOptions(currentYear, currentYear - 100), year, 'Year')}
                </select>
            </div>
        `;
    }

    function formatDateRange(startDate, endDate) {
        const start = fmtDate(startDate);
        const end = fmtDate(endDate);

        if (!start && !end) return '';
        if (start && !end) return `${start} - Present`;
        if (!start && end) return end;
        return `${start} - ${end}`;
    }

    function formatDateRangeWithCity(startDate, endDate, city) {
        return [formatDateRange(startDate, endDate), city].filter(Boolean).join(', ');
    }

    function formatOptionalFieldValue(field, value) {
        if (!value) return '';
        if (field === 'dateOfBirth') return fmtFullDate(value);
        return value;
    }

    function fmtFullDate(value) {
        const { year, month, day } = parseStoredDate(value);
        if (!year || !month || !day) return value || '';
        const monthLabel = monthOptions.find(option => option.value === month)?.label || month;
        return `${Number(day)} ${monthLabel} ${year}`;
    }

    function buildDefaultCvName(date = new Date()) {
        const datePart = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
        return `CV ${datePart}`;
    }

    function getCurrentCvTitle() {
        const titleEl = document.querySelector('.topbar-title');
        return titleEl ? titleEl.textContent.trim() : '';
    }

    function sanitizeFileName(name) {
        return (name || buildDefaultCvName())
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/ /g, '_');
    }

    function ensureNewCvName() {
        if (!isNew) return;
        const titleEl = document.querySelector('.topbar-title');
        if (!titleEl) return;

        const currentTitle = titleEl.textContent.trim();
        if (!currentTitle || currentTitle === TITLE_DEFAULT) {
            titleEl.textContent = buildDefaultCvName();
        }
    }

    // ============================
    // DOCUMENT ID & PERSISTENCE
    // ============================
    // Check if we're returning from sign-in with a linked CV
    const linkedCvId = localStorage.getItem('JobLynk_linked_cv_id');
    const urlParams = new URLSearchParams(window.location.search);
    const startBlank = urlParams.get('blank') === '1';
    let docId = linkedCvId || urlParams.get('id');
    if (linkedCvId) {
        localStorage.removeItem('JobLynk_linked_cv_id');
        window.history.replaceState({}, '', '?id=' + linkedCvId);
    }
    const isNew = !docId;
    if (!docId) docId = 'new_' + Date.now().toString();

    let currentAccentColor = '#3B4BA6';
    const isTemporaryDocId = (value) => /^new_\d+/.test(String(value || ''));
    let serverDocId = (isNew || isTemporaryDocId(docId)) ? null : docId; // Track the DB id

    function applyCvRecord(record) {
        const recordData = record?.data || record || {};
        Object.keys(cvData).forEach(key => {
            if (recordData[key] !== undefined) cvData[key] = recordData[key];
        });
        if (record?.accentColor || record?.accent_color) {
            currentAccentColor = record.accentColor || record.accent_color;
        }

        const titleEl = document.querySelector('.topbar-title');
        if (titleEl && record?.name) titleEl.textContent = record.name;

        hydrateCitySelect($('city'), cvData.city);
        document.querySelectorAll('[data-cv]').forEach(input => {
            const key = input.getAttribute('data-cv');
            if (key && cvData[key] !== undefined && !Array.isArray(cvData[key])) input.value = cvData[key];
        });

        if (cvData.photoUrl) {
            const avatarImg = $('avatarPreview');
            const avatarIcon = $('avatarIcon');
            if (avatarImg) { avatarImg.src = cvData.photoUrl; avatarImg.style.display = 'block'; }
            if (avatarIcon) avatarIcon.style.display = 'none';
        }
    }

    async function loadData() {
        await authReady;

        if (isNew && startBlank) {
            localStorage.removeItem('JobLynk_imported_cv_draft');
            localStorage.removeItem('JobLynk_active_cv_draft');
            ensureNewCvName();
            return;
        }

        if (isNew) {
            try {
                const importedRaw = localStorage.getItem('JobLynk_imported_cv_draft');
                if (importedRaw) {
                    applyCvRecord(JSON.parse(importedRaw));
                    localStorage.removeItem('JobLynk_imported_cv_draft');
                    return;
                }
            } catch (error) {
                console.warn('Imported CV draft load failed:', error);
                localStorage.removeItem('JobLynk_imported_cv_draft');
            }
        }

        if (isLoggedIn && isNew) {
            try {
                const draftRaw = localStorage.getItem('JobLynk_active_cv_draft');
                if (draftRaw) {
                    applyCvRecord(JSON.parse(draftRaw));
                    return;
                }
            } catch (error) {
                console.warn('Saved CV draft load failed:', error);
                localStorage.removeItem('JobLynk_active_cv_draft');
            }
        }

        if (!isLoggedIn && isNew) {
            try {
                const guestRaw = localStorage.getItem('JobLynk_guest_cv');
                if (guestRaw) {
                    applyCvRecord(JSON.parse(guestRaw));
                }
            } catch (e) { console.warn('Guest CV load failed:', e); }
            return;
        }

        if (isNew) return;

        // Try API first
        try {
            const res = await fetch('api/documents/index.php?id=' + encodeURIComponent(docId), { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.document) {
                const doc = result.document;
                serverDocId = doc.id;
                docId = String(doc.id);
                applyCvRecord({
                    id: doc.id,
                    name: doc.name || TITLE_DEFAULT,
                    accentColor: doc.accent_color,
                    data: doc.data || {}
                });
                return;
            }
        } catch (e) { console.warn('API load failed, trying localStorage:', e); }

        // Fallback to localStorage
        try {
            const stored = localStorage.getItem('JobLynk_cvs');
            if (stored) {
                const cvs = JSON.parse(stored);
                const ex = cvs.find(c => String(c.id) === String(docId));
                if (ex) {
                    serverDocId = isTemporaryDocId(ex.id) ? null : ex.id;
                    applyCvRecord(ex);
                }
            }
        } catch (e) { console.error('Error loading CV:', e); }
    }

    let saveTimeout;
    let pendingSavePromise = Promise.resolve();

    function setCloudSaving(isSaving) {
        const cloudIcon = document.querySelector('.topbar-cloud');
        if (!cloudIcon) return;

        if (isSaving) {
            cloudIcon.classList.replace('fa-cloud', 'fa-arrows-rotate');
            cloudIcon.classList.add('fa-spin');
        } else {
            cloudIcon.classList.remove('fa-spin');
            cloudIcon.classList.replace('fa-arrows-rotate', 'fa-cloud');
        }
    }

    function buildCurrentCvRecord(idOverride = serverDocId || docId) {
        const title = getCurrentCvTitle() || TITLE_DEFAULT;
        return {
            id: idOverride || docId,
            name: title,
            lastEdited: new Date().toISOString(),
            type: 'cv',
            accentColor: currentAccentColor,
            data: JSON.parse(JSON.stringify(cvData))
        };
    }

    function upsertLocalCvRecord(record) {
        const stored = localStorage.getItem('JobLynk_cvs');
        const parsed = stored ? JSON.parse(stored) : [];
        const cvs = Array.isArray(parsed) ? parsed : [];
        const idx = cvs.findIndex(cv => String(cv.id) === String(record.id));
        if (idx >= 0) cvs[idx] = record;
        else cvs.push(record);
        localStorage.setItem('JobLynk_cvs', JSON.stringify(cvs));
    }

    function removeLocalCvRecord(id) {
        if (!id) return;
        const stored = localStorage.getItem('JobLynk_cvs');
        const parsed = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(parsed)) return;
        const filtered = parsed.filter(cv => String(cv.id) !== String(id));
        localStorage.setItem('JobLynk_cvs', JSON.stringify(filtered));
    }

    function saveLocalCvSnapshot(record = buildCurrentCvRecord()) {
        try {
            if (!isLoggedIn) {
                localStorage.setItem('JobLynk_guest_cv', JSON.stringify(record));
                return;
            }

            upsertLocalCvRecord(record);
            if (!serverDocId) {
                localStorage.setItem('JobLynk_active_cv_draft', JSON.stringify(record));
            }
        } catch (e) {
            console.warn('Local CV snapshot failed:', e);
        }
    }

    async function persistCvData() {
        clearTimeout(saveTimeout);
        const localIdBeforeSave = docId;
        const localRecord = buildCurrentCvRecord();
        setCloudSaving(true);
        saveLocalCvSnapshot(localRecord);

        if (!isLoggedIn) {
            setTimeout(() => setCloudSaving(false), 500);
            return localRecord;
        }

        try {
            const payload = {
                doc_type: 'cv',
                name: localRecord.name || TITLE_DEFAULT,
                accent_color: currentAccentColor,
                data: JSON.parse(JSON.stringify(cvData))
            };
            if (serverDocId) payload.id = serverDocId;

            const res = await fetch('api/documents/index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (!result.success || !result.id) {
                throw new Error(result.message || 'Failed to save CV.');
            }

            serverDocId = result.id;
            docId = String(result.id);
            localStorage.removeItem('JobLynk_active_cv_draft');

            if (String(localIdBeforeSave) !== String(result.id)) {
                try {
                    removeLocalCvRecord(localIdBeforeSave);
                } catch (e) {
                    console.warn('Old local CV cleanup failed:', e);
                }
            }

            if (isNew || !window.location.search.includes('id=')) {
                window.history.replaceState({}, '', '?id=' + serverDocId);
            }

            const savedRecord = buildCurrentCvRecord(serverDocId);
            saveLocalCvSnapshot(savedRecord);
            return savedRecord;
        } catch (e) {
            console.warn('API save failed, using local snapshot:', e);
            return localRecord;
        } finally {
            setTimeout(() => setCloudSaving(false), 500);
        }
    }

    function saveData() {
        clearTimeout(saveTimeout);
        setCloudSaving(true);
        saveLocalCvSnapshot();

        saveTimeout = setTimeout(() => {
            pendingSavePromise = pendingSavePromise
                .catch(() => {})
                .then(() => persistCvData());
        }, 800);
    }

    function flushSaveData() {
        clearTimeout(saveTimeout);
        pendingSavePromise = pendingSavePromise
            .catch(() => {})
            .then(() => persistCvData());
        return pendingSavePromise;
    }

    window.addEventListener('pagehide', () => saveLocalCvSnapshot());
    window.addEventListener('beforeunload', () => saveLocalCvSnapshot());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveLocalCvSnapshot();
    });

    // Save on title change
    document.querySelector('.topbar-title')?.addEventListener('input', saveData);

    // ============================
    // DOM REFS
    // ============================
    const $ = id => document.getElementById(id);

    $('btnBack')?.addEventListener('click', async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        const href = event.currentTarget.getAttribute('href') || 'dashboard.html';
        try {
            await flushSaveData();
        } finally {
            window.location.href = href;
        }
    });

    const preview = {
        name: $('previewName'),
        jobTitle: $('previewJobTitle'),
        address: $('previewAddress'),
        cityPostcode: $('previewCityPostcode'),
        email: $('previewEmail'),
        phone: $('previewPhone'),
        addressRow: $('previewAddressRow'),
        cityRow: $('previewCityRow'),
        emailRow: $('previewEmailRow'),
        phoneRow: $('previewPhoneRow'),
        optionalDetails: $('previewOptionalDetails'),

        photoWrap: $('previewPhotoWrap'),
        photo: $('previewPhoto'),

        summaryBlock: $('previewSummaryBlock'),
        summary: $('previewSummary'),

        experienceBlock: $('previewExperienceBlock'),
        experienceList: $('previewExperienceList'),

        educationBlock: $('previewEducationBlock'),
        educationList: $('previewEducationList'),

        skillsBlock: $('previewSkillsBlock'),
        skillsList: $('previewSkillsList'),

        languagesBlock: $('previewLanguagesBlock'),
        languagesList: $('previewLanguagesList'),

        hobbiesBlock: $('previewHobbiesBlock'),
        hobbies: $('previewHobbies'),
    };

    // ============================
    // SECTION COLLAPSE
    // ============================
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.section-btn:not(.section-toggle)')) return;
            header.closest('.form-section').classList.toggle('collapsed');
        });
    });

    // ============================
    // SIMPLE INPUT BINDING
    // ============================
    function syncSimpleField(target) {
        const field = target.getAttribute('data-cv');
        if (field && field in cvData && !Array.isArray(cvData[field])) {
            cvData[field] = target.value;
            renderPreview();
            saveData();
        }
    }

    document.addEventListener('input', (e) => {
        if (e.target.matches('input[data-cv], textarea[data-cv]')) {
            syncSimpleField(e.target);
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.matches('select[data-cv]')) {
            syncSimpleField(e.target);
        }
    });

    // ============================
    // PHOTO UPLOAD
    // ============================
    const photoTrigger = $('photoTrigger');
    const photoInput = $('photoUpload');
    const avatarImg = $('avatarPreview');
    const avatarIcon = $('avatarIcon');

    photoTrigger?.addEventListener('click', () => photoInput.click());
    photoInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            cvData.photoUrl = ev.target.result;
            avatarImg.src = ev.target.result;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
            renderPreview();
        };
        reader.readAsDataURL(file);
    });

    // ============================
    // OPTIONAL FIELD CHIPS
    // ============================
    const optionalLabels = {
        dateOfBirth: 'Date of birth', placeOfBirth: 'Place of birth',
        drivingLicence: 'Driving licence', gender: 'Gender',
        nationality: 'Nationality',
        website: 'Website', linkedin: 'LinkedIn'
    };

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const field = chip.getAttribute('data-field');
            activeOptionalFields.add(field);
            chip.classList.add('active');
            renderOptionalFields();
        });
    });

    function hydrateOptionalFieldsFromData() {
        Object.keys(optionalLabels).forEach(field => {
            if (cvData[field]) activeOptionalFields.add(field);
            const chip = document.querySelector(`.chip[data-field="${field}"]`);
            if (chip) chip.classList.toggle('active', activeOptionalFields.has(field));
        });
    }

    function renderOptionalFieldControl(field) {
        if (field === 'dateOfBirth') {
            return buildDateOfBirthControl(field, cvData[field] || '');
        }

        if (field === 'drivingLicence') {
            return `
                <select data-cv="${field}">
                    ${buildSelectOptions(drivingLicenceOptions, cvData[field] || '', 'Select licence')}
                </select>
            `;
        }

        if (field === 'gender') {
            return `
                <select data-cv="${field}">
                    ${buildSelectOptions(genderOptions, cvData[field] || '', 'Select gender')}
                </select>
            `;
        }

        return `<input type="text" data-cv="${field}" value="${escapeHtml(cvData[field] || '')}" autocomplete="off">`;
    }

    function syncOptionalCompositeDate(field) {
        const row = document.querySelector(`.optional-field-row[data-field="${field}"]`);
        if (!row) return;

        const day = row.querySelector('[data-date-part="day"]')?.value || '';
        const month = row.querySelector('[data-date-part="month"]')?.value || '';
        const year = row.querySelector('[data-date-part="year"]')?.value || '';

        cvData[field] = day && month && year ? `${year}-${month}-${day}` : '';
        renderPreview();
        saveData();
    }

    function renderOptionalFields() {
        const container = $('optionalFieldsContainer');
        container.innerHTML = '';
        activeOptionalFields.forEach(field => {
            const row = document.createElement('div');
            row.className = 'optional-field-row';
            row.dataset.field = field;
            row.innerHTML = `
                <div class="input-group">
                    <label>${optionalLabels[field]}</label>
                    ${renderOptionalFieldControl(field)}
                </div>
                <button class="btn-remove-field" data-field="${field}"><i class="fa-solid fa-xmark"></i></button>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll('[data-optional-field][data-date-part]').forEach(select => {
            select.addEventListener('change', () => {
                syncOptionalCompositeDate(select.getAttribute('data-optional-field'));
            });
        });

        // Remove button handlers
        container.querySelectorAll('.btn-remove-field').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.getAttribute('data-field');
                activeOptionalFields.delete(field);
                cvData[field] = '';
                document.querySelector(`.chip[data-field="${field}"]`)?.classList.remove('active');
                renderOptionalFields();
                renderPreview();
                saveData();
            });
        });
    }

    // ============================
    // MOBILE TOGGLE
    // ============================
    $('btnMobileFab')?.addEventListener('click', () => {
        const previewPane = $('previewPane');
        const mobileFab = $('btnMobileFab');
        const fabIcon = mobileFab?.querySelector('i');
        if (!previewPane) return;
        const isOpen = previewPane.classList.toggle('open');
        if (fabIcon) fabIcon.className = isOpen ? 'fa-solid fa-pen' : 'fa-solid fa-eye';
        mobileFab?.setAttribute('aria-label', isOpen ? 'Back to editor' : 'Preview CV');
        mobileFab?.setAttribute('data-label', isOpen ? 'Edit' : 'Preview');
    });
    // Close on swipe right or ESC - simplified: click topbar back when preview is open
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $('previewPane')?.classList.remove('open');
            const mobileFab = $('btnMobileFab');
            const fabIcon = mobileFab?.querySelector('i');
            if (fabIcon) fabIcon.className = 'fa-solid fa-eye';
            mobileFab?.setAttribute('aria-label', 'Preview CV');
            mobileFab?.setAttribute('data-label', 'Preview');
        }
    });

    // ============================
    // RENDER PREVIEW
    // ============================
    function renderPreview() {
        const fullName = `${cvData.firstName} ${cvData.lastName}`.trim();
        preview.name.textContent = fullName;
        preview.jobTitle.textContent = cvData.jobTitle;

        preview.address.textContent = cvData.address;
        preview.addressRow.style.display = cvData.address ? 'block' : 'none';

        let cityLine = [cvData.postCode, cvData.city].filter(Boolean).join(' ');
        preview.cityPostcode.textContent = cityLine;
        preview.cityRow.style.display = cityLine ? 'block' : 'none';

        preview.email.textContent = cvData.email;
        preview.emailRow.style.display = cvData.email ? 'block' : 'none';

        preview.phone.textContent = cvData.phone;
        preview.phoneRow.style.display = cvData.phone ? 'block' : 'none';

        // Optional details
        let optHtml = '';
        activeOptionalFields.forEach(field => {
            if (cvData[field]) {
                optHtml += `<div class="cv-detail-row">${optionalLabels[field]}: ${formatOptionalFieldValue(field, cvData[field])}</div>`;
            }
        });
        preview.optionalDetails.innerHTML = optHtml;

        // Photo
        if (cvData.photoUrl) {
            preview.photo.src = cvData.photoUrl;
            preview.photoWrap.style.display = 'block';
        } else {
            preview.photoWrap.style.display = 'none';
        }

        // Summary
        preview.summary.textContent = cvData.summary;
        preview.summaryBlock.style.display = cvData.summary ? 'block' : 'none';

        // Experience
        preview.experienceList.innerHTML = cvData.experience.map(e => `
            <div class="cv-entry">
                <div class="cv-entry-title">${e.jobTitle || '(Not specified)'}${e.employer ? ', '+e.employer : ''}</div>
                <div class="cv-entry-date">${formatDateRangeWithCity(e.startDate, e.endDate, e.city)}</div>
                <div class="cv-entry-desc">${e.description || ''}</div>
            </div>
        `).join('');
        preview.experienceBlock.style.display = cvData.experience.length ? 'block' : 'none';

        // Education
        preview.educationList.innerHTML = cvData.education.map(e => `
            <div class="cv-entry">
                <div class="cv-entry-title">${e.degree || '(Not specified)'}${e.school ? ', '+e.school : ''}</div>
                <div class="cv-entry-date">${formatDateRangeWithCity(e.startDate, e.endDate, e.city)}</div>
                <div class="cv-entry-desc">${e.description || ''}</div>
            </div>
        `).join('');
        preview.educationBlock.style.display = cvData.education.length ? 'block' : 'none';

        // Skills
        preview.skillsList.innerHTML = cvData.skills.map(s => `
            <div class="cv-skill-entry">${s.name || '(Not specified)'}</div>
        `).join('');
        preview.skillsBlock.style.display = cvData.skills.length ? 'block' : 'none';

        // Languages
        preview.languagesList.innerHTML = cvData.languages.map(l => `
            <div class="cv-skill-entry">${l.name || '(Not specified)'}${l.level ? ' - '+l.level : ''}</div>
        `).join('');
        preview.languagesBlock.style.display = cvData.languages.length ? 'block' : 'none';

        // Hobbies
        preview.hobbies.textContent = cvData.hobbies;
        preview.hobbiesBlock.style.display = cvData.hobbies ? 'block' : 'none';

        // Auto-save after every preview render (skip during initial load)
        if (initialized) saveData();
    }

    let initialized = false;

    // ============================
    // DYNAMIC ARRAYS
    // ============================
    function renderExperience() {
        const list = $('experience-list');
        list.innerHTML = cvData.experience.map((exp, i) => `
            <div class="list-card" data-id="${exp.id}">
                <div class="list-card-header" onclick="document.getElementById('exp-${exp.id}').classList.toggle('open')">
                    <div class="list-card-info">
                        <span class="list-card-title">${exp.jobTitle || '(Not specified)'}</span>
                        <span class="list-card-subtitle">${formatDateRange(exp.startDate, exp.endDate) || 'Start - End'}</span>
                    </div>
                    <div class="list-card-actions">
                        <button class="del-exp" data-id="${exp.id}"><i class="fa-solid fa-trash-can"></i></button>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
                <div class="list-card-body ${i===cvData.experience.length-1?'open':''}" id="exp-${exp.id}">
                    <div class="form-row">
                        <div class="input-group"><label>Job title</label><input class="dyn" data-arr="experience" data-id="${exp.id}" data-key="jobTitle" value="${exp.jobTitle}" autocomplete="off"></div>
                        <div class="input-group"><label>Employer</label><input class="dyn" data-arr="experience" data-id="${exp.id}" data-key="employer" value="${exp.employer}" autocomplete="off"></div>
                    </div>
                    <div class="form-row">
                        <div class="input-group"><label>Start date</label>${buildMonthYearControl('experience', exp.id, 'startDate', exp.startDate)}</div>
                        <div class="input-group"><label>End date</label>${buildMonthYearControl('experience', exp.id, 'endDate', exp.endDate)}</div>
                    </div>
                    <div class="form-row">
                        <div class="input-group"><label>City</label><select class="dyn" data-arr="experience" data-id="${exp.id}" data-key="city">${buildCityOptions(exp.city, 'Select city')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="input-group full-width"><label>Job Description</label><textarea class="dyn" data-arr="experience" data-id="${exp.id}" data-key="description" rows="3">${exp.description}</textarea></div>
                    </div>
                </div>
            </div>
        `).join('');
        attachDyn();
    }

    function renderEducation() {
        const list = $('education-list');
        list.innerHTML = cvData.education.map((edu, i) => `
            <div class="list-card" data-id="${edu.id}">
                <div class="list-card-header" onclick="document.getElementById('edu-${edu.id}').classList.toggle('open')">
                    <div class="list-card-info">
                        <span class="list-card-title">${edu.school || '(Not specified)'}</span>
                        <span class="list-card-subtitle">${formatDateRange(edu.startDate, edu.endDate) || 'Start - End'}</span>
                    </div>
                    <div class="list-card-actions">
                        <button class="del-edu" data-id="${edu.id}"><i class="fa-solid fa-trash-can"></i></button>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
                <div class="list-card-body ${i===cvData.education.length-1?'open':''}" id="edu-${edu.id}">
                    <div class="form-row">
                        <div class="input-group"><label>School</label><input class="dyn" data-arr="education" data-id="${edu.id}" data-key="school" value="${edu.school}" autocomplete="off"></div>
                        <div class="input-group"><label>Degree</label><input class="dyn" data-arr="education" data-id="${edu.id}" data-key="degree" value="${edu.degree}" autocomplete="off"></div>
                    </div>
                    <div class="form-row">
                        <div class="input-group"><label>Start date</label>${buildMonthYearControl('education', edu.id, 'startDate', edu.startDate)}</div>
                        <div class="input-group"><label>End date</label>${buildMonthYearControl('education', edu.id, 'endDate', edu.endDate)}</div>
                    </div>
                    <div class="form-row">
                        <div class="input-group"><label>City</label><select class="dyn" data-arr="education" data-id="${edu.id}" data-key="city">${buildCityOptions(edu.city, 'Select city')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="input-group full-width"><label>Education Description</label><textarea class="dyn" data-arr="education" data-id="${edu.id}" data-key="description" rows="3">${edu.description}</textarea></div>
                    </div>
                </div>
            </div>
        `).join('');
        attachDyn();
    }

    function renderSkills() {
        const list = $('skills-list');
        const picker = $('skillPickerSelect');
        const hint = $('skillsPickerHint');
        if (!list) return;

        const used = new Set(cvData.skills.map(skill => normalizeSkillTerm(skill.name)).filter(Boolean));

        list.innerHTML = cvData.skills.length
            ? cvData.skills.map((skill) => `
                <div class="skill-chip-row" data-id="${skill.id}">
                    <span class="skill-chip-label">${escapeHtml(skill.name || '(Not specified)')}</span>
                    <button type="button" class="del-skill" data-id="${skill.id}" aria-label="Remove skill"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('')
            : '<p class="section-hint">No skills added yet.</p>';

        if (picker) {
            const available = skillSuggestionValues.filter(name => !used.has(normalizeSkillTerm(name)));
            picker.innerHTML = ['<option value="">Select a skill</option>']
                .concat(available.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`))
                .join('');
            picker.disabled = cvData.skills.length >= MAX_SKILLS || !available.length;
        }

        if (hint) {
            hint.textContent = cvData.skills.length >= MAX_SKILLS
                ? 'You have reached the maximum of 10 skills.'
                : `${cvData.skills.length} of ${MAX_SKILLS} skills selected.`;
        }
    }

    function initSkillsPicker() {
        $('btnAddSkillFromPicker')?.addEventListener('click', () => {
            const select = $('skillPickerSelect');
            const value = String(select?.value || '').trim();
            if (!value || cvData.skills.length >= MAX_SKILLS) return;
            if (cvData.skills.some(skill => normalizeSkillTerm(skill.name) === normalizeSkillTerm(value))) return;
            cvData.skills.push({ id: uid(), name: value });
            renderSkills();
            renderPreview();
            saveData();
        });

        $('skillPickerSelect')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                $('btnAddSkillFromPicker')?.click();
            }
        });
    }

    function renderLanguages() {
        const list = $('languages-list');
        list.innerHTML = cvData.languages.map((l, i) => `
            <div class="list-card" data-id="${l.id}">
                <div class="list-card-header" onclick="document.getElementById('lng-${l.id}').classList.toggle('open')">
                    <div class="list-card-info">
                        <span class="list-card-title">${l.name || '(Not specified)'}</span>
                        <span class="list-card-subtitle">${l.level || ''}</span>
                    </div>
                    <div class="list-card-actions">
                        <button class="del-lang" data-id="${l.id}"><i class="fa-solid fa-trash-can"></i></button>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
                <div class="list-card-body ${i===cvData.languages.length-1?'open':''}" id="lng-${l.id}">
                    <div class="form-row">
                        <div class="input-group"><label>Language</label><select class="dyn" data-arr="languages" data-id="${l.id}" data-key="name">${buildSelectOptions(languageOptions, l.name, 'Select language')}</select></div>
                        <div class="input-group"><label>Level</label><select class="dyn" data-arr="languages" data-id="${l.id}" data-key="level">${buildSelectOptions(languageLevelOptions, l.level, 'Select level')}</select></div>
                    </div>
                </div>
            </div>
        `).join('');
        attachDyn();
    }

    // ============================
    // DYN INPUT HANDLER
    // ============================
    function attachDyn() {
        const syncDynamicField = (e) => {
            const arr = e.target.getAttribute('data-arr');
            const id = e.target.getAttribute('data-id');
            const key = e.target.getAttribute('data-key');
            const item = cvData[arr].find(x => x.id === id);
            if (!item) return;

            if (e.target.hasAttribute('data-date-part')) {
                const group = e.target.closest('.date-select-grid');
                const month = group.querySelector(`[data-key="${key}"][data-date-part="month"]`)?.value || '';
                const year = group.querySelector(`[data-key="${key}"][data-date-part="year"]`)?.value || '';
                item[key] = month && year ? `${year}-${month}` : '';
            } else {
                item[key] = e.target.value;
            }

            const card = e.target.closest('.list-card');
            if (card && (key === 'jobTitle' || key === 'school' || key === 'name')) {
                card.querySelector('.list-card-title').textContent = item[key] || '(Not specified)';
            }

            if (card && arr === 'languages' && key === 'level') {
                card.querySelector('.list-card-subtitle').textContent = item.level || '';
            }

            if (card && (arr === 'experience' || arr === 'education') && (key === 'startDate' || key === 'endDate')) {
                card.querySelector('.list-card-subtitle').textContent = formatDateRange(item.startDate, item.endDate) || 'Start - End';
            }

            renderPreview();
        };

        document.querySelectorAll('.dyn').forEach(inp => {
            if (inp.tagName === 'SELECT') {
                inp.onchange = syncDynamicField;
            } else {
                inp.oninput = syncDynamicField;
                inp.onchange = syncDynamicField;
            }
        });

        document.querySelectorAll('.skill-input').forEach(input => {
            input.addEventListener('input', () => renderSkillSuggestionPanel(input));
            input.addEventListener('focus', () => renderSkillSuggestionPanel(input));
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const panel = input.closest('.skill-input-group')?.querySelector('.skill-suggestion-list');
                    closeSkillSuggestionPanel(panel);
                }, 120);
            });
        });

        // Delete handlers
        document.querySelectorAll('.del-exp').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.experience = cvData.experience.filter(x=>x.id!==b.dataset.id); renderExperience(); renderPreview(); }; });
        document.querySelectorAll('.del-edu').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.education = cvData.education.filter(x=>x.id!==b.dataset.id); renderEducation(); renderPreview(); }; });
        document.querySelectorAll('.del-skill').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.skills = cvData.skills.filter(x=>x.id!==b.dataset.id); renderSkills(); renderPreview(); saveData(); }; });
        document.querySelectorAll('.del-lang').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.languages = cvData.languages.filter(x=>x.id!==b.dataset.id); renderLanguages(); renderPreview(); }; });
    }

    // ============================
    // ADD BUTTONS
    // ============================
    $('btnAddExperience').addEventListener('click', () => { cvData.experience.push({ id:uid(), jobTitle:'', employer:'', startDate:'', endDate:'', city:'', description:'' }); renderExperience(); renderPreview(); });
    $('btnAddEducation').addEventListener('click', () => { cvData.education.push({ id:uid(), school:'', degree:'', startDate:'', endDate:'', city:'', description:'' }); renderEducation(); renderPreview(); });
    $('btnAddLanguage').addEventListener('click', () => { cvData.languages.push({ id:uid(), name:'', level:'' }); renderLanguages(); renderPreview(); });

    // ============================
    // PDF / DOWNLOAD
    // ============================
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const EXPORT_RENDER_SCALE = 2;
    const MAX_SKILLS = 10;

    function waitForExportImages(root) {
        const pendingImages = Array.from(root.querySelectorAll('img'))
            .filter(img => img.src && !img.complete);

        if (!pendingImages.length) return Promise.resolve();

        return Promise.all(pendingImages.map(img => new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        })));
    }

    function removeExportIds(root) {
        root.removeAttribute?.('id');
        root.querySelectorAll?.('[id]').forEach(el => el.removeAttribute('id'));
    }

    function isVisibleForExport(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function cloneExportNode(node) {
        if (!node) return document.createElement('div');
        const clone = node.cloneNode(true);
        removeExportIds(clone);
        return clone;
    }

    function createExportPage(sourceElement, isFirstPage) {
        const page = sourceElement.cloneNode(false);
        page.classList.add('export-pdf', 'export-pdf-page');
        if (!isFirstPage) page.classList.add('cv-continuation-page');
        page.style.transform = 'none';
        page.style.transition = 'none';
        page.removeAttribute('id');

        const header = cloneExportNode(sourceElement.querySelector('.cv-header-block'));
        const contentSource = sourceElement.querySelector('.cv-content');
        const leftSource = sourceElement.querySelector('.cv-col-left');
        const rightSource = sourceElement.querySelector('.cv-col-right');
        const wave = cloneExportNode(sourceElement.querySelector('.cv-wave'));

        const content = contentSource?.cloneNode(false) || document.createElement('div');
        const left = leftSource?.cloneNode(false) || document.createElement('div');
        const right = rightSource?.cloneNode(false) || document.createElement('div');

        content.classList.add('cv-content');
        left.classList.add('cv-col-left');
        right.classList.add('cv-col-right');
        removeExportIds(content);
        removeExportIds(left);
        removeExportIds(right);

        if (!isFirstPage) {
            const label = header.querySelector('.cv-header-label');
            if (label) label.textContent = 'Curriculum vitae continued';
        }

        content.append(left, right);
        page.append(header, content, wave);
        return { paper: page, left, right };
    }

    function createBlockShell(block, listSelector) {
        const shell = cloneExportNode(block);
        const list = shell.querySelector(listSelector);
        if (list) list.innerHTML = '';
        return { shell, list };
    }

    function createPaginatedExport(sourceElement) {
        const host = document.createElement('div');
        host.className = 'cv-pdf-export-host';
        document.body.appendChild(host);

        const pages = [];
        const columnPageIndex = { left: 0, right: 0 };

        const ensurePage = (index) => {
            while (pages.length <= index) {
                const page = createExportPage(sourceElement, pages.length === 0);
                pages.push(page);
                host.appendChild(page.paper);
            }
            return pages[index];
        };

        const pageOverflows = (page) => page.scrollHeight > page.clientHeight + 2;

        const tryAppend = (columnName, node) => {
            const page = ensurePage(columnPageIndex[columnName]);
            page[columnName].appendChild(node);
            if (!pageOverflows(page.paper)) return true;
            node.remove();
            return false;
        };

        const forceAppend = (columnName, node) => {
            ensurePage(columnPageIndex[columnName])[columnName].appendChild(node);
        };

        const addWholeBlock = (columnName, block) => {
            const node = cloneExportNode(block);
            if (tryAppend(columnName, node)) return;

            columnPageIndex[columnName] += 1;
            if (!tryAppend(columnName, node)) forceAppend(columnName, node);
        };

        const addSplittableBlock = (columnName, block, listSelector) => {
            const sourceList = block.querySelector(listSelector);
            const items = Array.from(sourceList?.children || []).filter(isVisibleForExport);
            if (!items.length) return;

            let currentShell = null;
            let currentList = null;

            const startShell = () => {
                const created = createBlockShell(block, listSelector);
                currentShell = created.shell;
                currentList = created.list;
                const page = ensurePage(columnPageIndex[columnName]);
                page[columnName].appendChild(currentShell);

                if (pageOverflows(page.paper)) {
                    currentShell.remove();
                    columnPageIndex[columnName] += 1;
                    ensurePage(columnPageIndex[columnName])[columnName].appendChild(currentShell);
                }
            };

            startShell();
            items.forEach((item) => {
                const itemClone = cloneExportNode(item);
                currentList.appendChild(itemClone);

                if (!pageOverflows(ensurePage(columnPageIndex[columnName]).paper)) return;

                itemClone.remove();

                if (!currentList.children.length) {
                    currentShell.remove();
                }

                columnPageIndex[columnName] += 1;
                startShell();
                currentList.appendChild(itemClone);
            });
        };

        const addColumnBlock = (columnName, block) => {
            const entries = block.querySelector('.cv-entries');
            const stackedItems = block.querySelector('.cv-skills-stacked');

            if (entries && entries.children.length > 1) {
                addSplittableBlock(columnName, block, '.cv-entries');
                return;
            }

            if (stackedItems && stackedItems.children.length > 1) {
                addSplittableBlock(columnName, block, '.cv-skills-stacked');
                return;
            }

            addWholeBlock(columnName, block);
        };

        ensurePage(0);

        Array.from(sourceElement.querySelector('.cv-col-left')?.children || [])
            .filter(isVisibleForExport)
            .forEach(block => addColumnBlock('left', block));

        Array.from(sourceElement.querySelector('.cv-col-right')?.children || [])
            .filter(isVisibleForExport)
            .forEach(block => addColumnBlock('right', block));

        pages.forEach(page => {
            page.paper.classList.toggle('export-empty-left', !page.left.children.length);
            page.paper.classList.toggle('export-empty-right', !page.right.children.length);
        });

        return { host, pages: pages.map(page => page.paper) };
    }

    function getExportRenderScale() {
        return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    }

    async function captureExportCanvas(element) {
        const rect = element.getBoundingClientRect();
        return html2canvas(element, {
            scale: getExportRenderScale(),
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff',
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
            windowWidth: Math.ceil(rect.width),
            windowHeight: Math.ceil(rect.height),
            imageTimeout: 15000,
            onclone: (_doc, clone) => {
                clone.style.transform = 'none';
                clone.style.webkitFontSmoothing = 'antialiased';
                clone.style.textRendering = 'optimizeLegibility';
            }
        });
    }

    function createOnePageExport(sourceElement) {
        const host = document.createElement('div');
        host.className = 'cv-pdf-export-host';
        document.body.appendChild(host);

        const page = sourceElement.cloneNode(true);
        page.classList.add('export-pdf', 'export-one-page');
        page.style.transform = 'none';
        page.style.transition = 'none';
        page.removeAttribute('id');
        removeExportIds(page);

        host.appendChild(page);
        return { host, page };
    }

    async function downloadOnePagePdf(sourceElement, fileName) {
        if (typeof html2canvas !== 'function') {
            throw new Error('PDF renderer is not ready yet. Please try again.');
        }

        const JsPdf = window.jspdf?.jsPDF || window.jsPDF;
        if (!JsPdf) {
            throw new Error('PDF generator is not ready yet. Please try again.');
        }

        const { host, page } = createOnePageExport(sourceElement);

        try {
            if (document.fonts?.ready) await document.fonts.ready;
            await waitForExportImages(host);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const widthPx = page.offsetWidth;
            const maxHeightPx = widthPx * (A4_HEIGHT_MM / A4_WIDTH_MM);
            const naturalHeight = page.scrollHeight;
            let fitScale = 1;
            if (naturalHeight > maxHeightPx + 2) {
                fitScale = maxHeightPx / naturalHeight;
            }

            let captureNode = page;
            if (fitScale < 0.999) {
                const wrapper = document.createElement('div');
                wrapper.className = 'cv-one-page-fit-wrap';
                wrapper.style.width = `${widthPx}px`;
                wrapper.style.height = `${Math.ceil(naturalHeight * fitScale)}px`;
                wrapper.style.overflow = 'hidden';
                page.style.transformOrigin = 'top left';
                page.style.transform = `scale(${fitScale})`;
                page.style.width = `${widthPx}px`;
                page.style.height = `${naturalHeight}px`;
                host.appendChild(wrapper);
                wrapper.appendChild(page);
                captureNode = wrapper;
            } else {
                page.classList.add('export-pdf-page');
            }

            const canvas = await captureExportCanvas(captureNode);
            const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: false });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'SLOW');
            pdf.save(fileName);
        } finally {
            host.remove();
        }
    }

    async function downloadA4Pdf(sourceElement, fileName) {
        if (typeof html2canvas !== 'function') {
            throw new Error('PDF renderer is not ready yet. Please try again.');
        }

        const JsPdf = window.jspdf?.jsPDF || window.jsPDF;
        if (!JsPdf) {
            throw new Error('PDF generator is not ready yet. Please try again.');
        }

        const { host, pages } = createPaginatedExport(sourceElement);

        try {
            if (document.fonts?.ready) await document.fonts.ready;
            await waitForExportImages(host);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: false });

            for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
                const page = pages[pageIndex];
                const canvas = await captureExportCanvas(page);

                if (pageIndex > 0) pdf.addPage('a4', 'portrait');
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'SLOW');
            }

            pdf.save(fileName);
        } finally {
            host.remove();
        }
    }

    $('btnPdf')?.addEventListener('click', async () => {
        if (!isLoggedIn) {
            await flushSaveData();
            const modal = document.getElementById('guestAuthModal');
            if (modal) modal.style.display = 'flex';
            return;
        }

        const button = $('btnPdf');
        const element = $('cvPaper');
        const cvName = sanitizeFileName(getCurrentCvTitle() || buildDefaultCvName());
        const originalHtml = button?.innerHTML;

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing';
            }
            await flushSaveData();
            await downloadA4Pdf(element, `${cvName}.pdf`);
        } catch (error) {
            console.error('PDF export failed:', error);
            alert(error.message || 'Could not download the CV. Please try again.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        }
    });

    $('btnOnePagePdf')?.addEventListener('click', async () => {
        if (!isLoggedIn) {
            await flushSaveData();
            const modal = document.getElementById('guestAuthModal');
            if (modal) modal.style.display = 'flex';
            return;
        }

        const button = $('btnOnePagePdf');
        const element = $('cvPaper');
        const cvName = sanitizeFileName(getCurrentCvTitle() || buildDefaultCvName());
        const originalHtml = button?.innerHTML;

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing';
            }
            await flushSaveData();
            await downloadOnePagePdf(element, `${cvName}-one-page.pdf`);
        } catch (error) {
            console.error('One-page PDF export failed:', error);
            alert(error.message || 'Could not download the one-page CV. Please try again.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        }
    });

    // ============================
    // ZOOM
    // ============================
    const paper = $('cvPaper');
    let isZoomed = false;
    $('btnFullscreen')?.addEventListener('click', () => {
        isZoomed = !isZoomed;
        const isMobile = window.innerWidth <= 900;
        const normScale = isMobile ? (window.innerWidth <= 480 ? 0.42 : 0.45) : 0.62;
        const zoomedScale = isMobile ? 0.8 : 1;
        
        paper.style.transform = `scale(${isZoomed ? zoomedScale : normScale})`;
        
        // Ensure scroll resets when zooming in/out
        if (isZoomed && isMobile) {
            document.querySelector('.preview-scroll').scrollLeft = 100;
        }
        if (typeof syncTemplateStageMetrics === 'function') {
            requestAnimationFrame(syncTemplateStageMetrics);
        }
    });

    // ============================
    // DATE FORMATTING HELPER
    // ============================
    function fmtDate(val) {
        if (!val) return '';
        const { year, month } = parseStoredDate(val);
        if (!year && !month) return val;
        if (!month) return year;
        const monthLabel = monthOptions.find(option => option.value === month)?.label.slice(0, 3) || month;
        return `${monthLabel} ${year}`;
    }

    // ============================
    // TOOLBAR: Dropdown Toggle
    // ============================
    const allDropdowns = document.querySelectorAll('.toolbar-dropdown');

    function closeAllDropdowns() {
        allDropdowns.forEach(d => d.classList.remove('open'));
    }

    document.querySelectorAll('.toolbar-dropdown-wrap > .toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = btn.nextElementSibling;
            const isOpen = dd.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) dd.classList.add('open');
        });
    });

    document.addEventListener('click', () => closeAllDropdowns());
    document.querySelectorAll('.toolbar-dropdown').forEach(dd => {
        dd.addEventListener('click', e => e.stopPropagation());
    });

    // ============================
    // TOOLBAR: Template Panel Toggle
    // ============================
    const templatePanel = $('templatePanel');
    const templateCarousel = $('templateCarousel');
    const templateCards = Array.from(document.querySelectorAll('.template-card'));
    const templateToggleButtons = Array.from(document.querySelectorAll('[data-template-toggle]'));
    let templateWheelLocked = false;

    function syncTemplateStageMetrics() {
        if (!templatePanel || !paper) return;
        const paperRect = paper.getBoundingClientRect();
        if (paperRect.width > 0) {
            templatePanel.style.setProperty('--paper-preview-half', `${paperRect.width / 2}px`);
        }
    }

    function syncTemplateCardStates() {
        const activeIndex = Math.max(0, templateCards.findIndex(card => card.classList.contains('active')));
        const totalCards = templateCards.length;

        templateCards.forEach((card, index) => {
            const forward = (index - activeIndex + totalCards) % totalCards;
            const backward = (activeIndex - index + totalCards) % totalCards;

            card.classList.remove('is-prev', 'is-next', 'is-far-prev', 'is-far-next');
            if (forward === 0) return;

            if (backward === 1) {
                card.classList.add('is-prev');
            } else if (forward === 1) {
                card.classList.add('is-next');
            } else if (backward < forward) {
                card.classList.add('is-far-prev');
            } else {
                card.classList.add('is-far-next');
            }
        });
    }

    function centerActiveTemplate(behavior = 'smooth') {
        syncTemplateStageMetrics();
        syncTemplateCardStates();
    }

    function setTemplatePanelOpen(isOpen) {
        if (!templatePanel) return;
        templatePanel.classList.toggle('open', isOpen);
        templateToggleButtons.forEach(button => {
            button.classList.toggle('active', isOpen);
            button.setAttribute('aria-pressed', String(isOpen));
            if (button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', String(isOpen));
        });
        if (isOpen) requestAnimationFrame(() => centerActiveTemplate('smooth'));
    }

    templateToggleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            setTemplatePanelOpen(!templatePanel.classList.contains('open'));
        });
    });

    $('btnCloseTemplates')?.addEventListener('click', () => {
        setTemplatePanelOpen(false);
    });

    let currentTemplate = 'classic';
    let currentFont = null;

    function selectTemplateCard(card) {
        if (!card) return;

        const tpl = card.dataset.template;
        currentTemplate = tpl;
        // Reset paper classes, preserve size
        paper.className = 'a4-paper';
        if (tpl !== 'classic') paper.classList.add('tpl-' + tpl);
        if (currentSize !== 'medium') paper.classList.add('size-' + currentSize);
        // Re-apply custom font if set
        if (currentFont) paper.style.fontFamily = `'${currentFont}', sans-serif`;
        // Re-apply accent color
        reapplyAccentColor();
        // Update active state
        templateCards.forEach(c => {
            const isActive = c === card;
            c.classList.toggle('active', isActive);
            c.setAttribute('aria-pressed', String(isActive));
        });
        requestAnimationFrame(() => centerActiveTemplate('smooth'));
    }

    function moveTemplate(direction) {
        const activeIndex = Math.max(0, templateCards.findIndex(card => card.classList.contains('active')));
        const nextIndex = (activeIndex + direction + templateCards.length) % templateCards.length;
        selectTemplateCard(templateCards[nextIndex]);
    }

    templateCards.forEach(card => {
        card.addEventListener('click', () => selectTemplateCard(card));
    });

    $('btnTemplatePrev')?.addEventListener('click', () => moveTemplate(-1));
    $('btnTemplateNext')?.addEventListener('click', () => moveTemplate(1));

    templateCarousel?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            moveTemplate(e.key === 'ArrowLeft' ? -1 : 1);
        }
    });

    templateCarousel?.addEventListener('wheel', (e) => {
        const strongestDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(strongestDelta) < 12) return;

        e.preventDefault();
        if (templateWheelLocked) return;
        templateWheelLocked = true;
        moveTemplate(strongestDelta > 0 ? 1 : -1);
        setTimeout(() => { templateWheelLocked = false; }, 240);
    }, { passive: false });

    window.addEventListener('resize', () => {
        if (templatePanel.classList.contains('open')) {
            syncTemplateStageMetrics();
        }
    });

    syncTemplateCardStates();
    if (templatePanel.classList.contains('open')) {
        requestAnimationFrame(() => centerActiveTemplate('auto'));
    }

    // ============================
    // TOOLBAR: Font Family
    // ============================
    document.querySelectorAll('[data-font]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFont = btn.dataset.font;
            paper.style.fontFamily = `'${currentFont}', sans-serif`;
            document.querySelectorAll('[data-font]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeAllDropdowns();
        });
    });

    // ============================
    // TOOLBAR: Font Size
    // ============================
    let currentSize = 'medium';
    document.querySelectorAll('[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.dataset.size;
            currentSize = size;
            paper.classList.remove('size-small', 'size-medium', 'size-large');
            if (size !== 'medium') paper.classList.add('size-' + size);
            document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeAllDropdowns();
        });
    });

    // ============================
    // TOOLBAR: Accent Color
    // ============================
    // (currentAccentColor declared earlier for persistence)

    function reapplyAccentColor() {
        applyColor(currentAccentColor);
    }

    function applyColor(color) {
        currentAccentColor = color;
        // Only color the header block if template uses a colored header (Classic, Modern)
        const hasColoredHeader = (currentTemplate === 'classic' || currentTemplate === 'modern');
        if (hasColoredHeader) {
            paper.querySelectorAll('.cv-header-block').forEach(el => el.style.background = color);
        } else {
            paper.querySelectorAll('.cv-header-block').forEach(el => el.style.removeProperty('background'));
        }
        paper.querySelectorAll('.cv-wave').forEach(el => el.style.background = color);
        paper.querySelectorAll('.cv-sidebar-heading, .cv-main-heading').forEach(el => {
            el.style.color = color;
            el.style.borderBottomColor = color;
        });
        paper.querySelectorAll('.cv-entry-subtitle').forEach(el => el.style.color = color);
        // Also update the header-block border for elegant template
        if (currentTemplate === 'elegant') {
            paper.querySelectorAll('.cv-header-block').forEach(el => el.style.borderBottomColor = color);
            paper.querySelectorAll('.cv-photo-wrap').forEach(el => el.style.borderColor = color);
        }
    }

    document.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            applyColor(btn.dataset.color);
            document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $('customColorPicker').value = btn.dataset.color;
            saveData();
        });
    });

    $('customColorPicker')?.addEventListener('input', (e) => {
        applyColor(e.target.value);
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        saveData();
    });

    // Close template panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.skill-input-group')) {
            closeAllSkillSuggestionPanels();
        }

        if (!templatePanel.contains(e.target) && !e.target.closest('[data-template-toggle]')) {
            setTemplatePanelOpen(false);
        }
    });

    // ============================
    // INITIALIZE: Load saved data
    // ============================
    hydrateCitySelect();

    initSkillsPicker();

    loadData().then(() => {
        hydrateCitySelect($('city'), cvData.city);
        hydrateOptionalFieldsFromData();
        ensureNewCvName();
        renderOptionalFields();
        renderExperience();
        renderEducation();
        renderSkills();
        renderLanguages();
        renderPreview();
        initialized = true;

        if (isNew) {
            saveData();
        }
    });

});
