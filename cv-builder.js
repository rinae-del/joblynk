document.addEventListener('DOMContentLoaded', () => {

    // ============================
    // AUTH STATE (non-blocking — guests allowed)
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
        gender: '', nationality: '', civilStatus: '',
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
        if (start && !end) return `${start} — Present`;
        if (!start && end) return end;
        return `${start} — ${end}`;
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
        const timePart = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
        return `CV ${datePart} ${timePart}`;
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
    let docId = linkedCvId || new URLSearchParams(window.location.search).get('id');
    if (linkedCvId) {
        localStorage.removeItem('JobLynk_linked_cv_id');
        window.history.replaceState({}, '', '?id=' + linkedCvId);
    }
    const isNew = !docId;
    if (!docId) docId = 'new_' + Date.now().toString();

    let currentAccentColor = '#3B4BA6';
    let serverDocId = isNew ? null : docId; // Track the DB id

    async function loadData() {
        // Wait for auth check to complete
        await authReady;

        // Guest mode with no doc ID: try loading guest CV from localStorage
        if (!isLoggedIn && isNew) {
            try {
                const guestRaw = localStorage.getItem('JobLynk_guest_cv');
                if (guestRaw) {
                    const guest = JSON.parse(guestRaw);
                    if (guest.data) {
                        Object.keys(cvData).forEach(key => {
                            if (guest.data[key] !== undefined) cvData[key] = guest.data[key];
                        });
                    }
                    if (guest.accentColor) currentAccentColor = guest.accentColor;
                    const titleEl = document.querySelector('.topbar-title');
                    if (titleEl && guest.name) titleEl.textContent = guest.name;
                    document.querySelectorAll('[data-cv]').forEach(inp => {
                        const key = inp.getAttribute('data-cv');
                        if (key && cvData[key] !== undefined && !Array.isArray(cvData[key])) inp.value = cvData[key];
                    });
                    if (cvData.photoUrl) {
                        const avatarImg = $('avatarPreview');
                        const avatarIcon = $('avatarIcon');
                        if (avatarImg) { avatarImg.src = cvData.photoUrl; avatarImg.style.display = 'block'; }
                        if (avatarIcon) avatarIcon.style.display = 'none';
                    }
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
                if (doc.data) {
                    Object.keys(cvData).forEach(key => {
                        if (doc.data[key] !== undefined) cvData[key] = doc.data[key];
                    });
                }
                if (doc.accent_color) currentAccentColor = doc.accent_color;
                const titleEl = document.querySelector('.topbar-title');
                if (titleEl) titleEl.textContent = doc.name || TITLE_DEFAULT;
                document.querySelectorAll('[data-cv]').forEach(inp => {
                    const key = inp.getAttribute('data-cv');
                    if (key && cvData[key] !== undefined && !Array.isArray(cvData[key])) inp.value = cvData[key];
                });
                if (cvData.photoUrl) {
                    const avatarImg = $('avatarPreview');
                    const avatarIcon = $('avatarIcon');
                    if (avatarImg) { avatarImg.src = cvData.photoUrl; avatarImg.style.display = 'block'; }
                    if (avatarIcon) avatarIcon.style.display = 'none';
                }
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
                    Object.keys(cvData).forEach(key => {
                        if (ex.data && ex.data[key] !== undefined) cvData[key] = ex.data[key];
                    });
                    if (ex.accentColor) currentAccentColor = ex.accentColor;
                    const titleEl = document.querySelector('.topbar-title');
                    if (titleEl) titleEl.textContent = ex.name || TITLE_DEFAULT;
                    document.querySelectorAll('[data-cv]').forEach(inp => {
                        const key = inp.getAttribute('data-cv');
                        if (key && cvData[key] !== undefined && !Array.isArray(cvData[key])) inp.value = cvData[key];
                    });
                    if (cvData.photoUrl) {
                        const avatarImg = $('avatarPreview');
                        const avatarIcon = $('avatarIcon');
                        if (avatarImg) { avatarImg.src = cvData.photoUrl; avatarImg.style.display = 'block'; }
                        if (avatarIcon) avatarIcon.style.display = 'none';
                    }
                }
            }
        } catch (e) { console.error('Error loading CV:', e); }
    }

    let saveTimeout;
    function saveData() {
        clearTimeout(saveTimeout);
        const cloudIcon = document.querySelector('.topbar-cloud');
        if (cloudIcon) {
            cloudIcon.classList.replace('fa-cloud', 'fa-arrows-rotate');
            cloudIcon.classList.add('fa-spin');
        }

        saveTimeout = setTimeout(async () => {
            const titleEl = document.querySelector('.topbar-title');
            const title = titleEl ? titleEl.textContent.trim() : TITLE_DEFAULT;

            // Guest mode: save to localStorage only
            if (!isLoggedIn) {
                try {
                    const guestRecord = {
                        id: docId,
                        name: title || TITLE_DEFAULT,
                        lastEdited: new Date().toISOString(),
                        type: 'cv',
                        accentColor: currentAccentColor,
                        data: { ...cvData }
                    };
                    localStorage.setItem('JobLynk_guest_cv', JSON.stringify(guestRecord));
                } catch (e) { console.warn('Guest save failed:', e); }

                setTimeout(() => {
                    if (cloudIcon) {
                        cloudIcon.classList.remove('fa-spin');
                        cloudIcon.classList.replace('fa-arrows-rotate', 'fa-cloud');
                    }
                }, 500);
                return;
            }

            // Logged-in: Try API save
            try {
                const payload = {
                    doc_type: 'cv',
                    name: title || TITLE_DEFAULT,
                    accent_color: currentAccentColor,
                    data: { ...cvData }
                };
                if (serverDocId) payload.id = serverDocId;

                const res = await fetch('api/documents/index.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success && result.id) {
                    serverDocId = result.id;
                    // Update URL if this was a new doc
                    if (isNew || !window.location.search.includes('id=')) {
                        window.history.replaceState({}, '', '?id=' + serverDocId);
                    }
                }
            } catch (e) {
                // Fallback: save to localStorage
                console.warn('API save failed, using localStorage:', e);
                try {
                    const stored = localStorage.getItem('JobLynk_cvs');
                    let cvs = stored ? JSON.parse(stored) : [];
                    const fallbackId = serverDocId || docId;
                    const idx = cvs.findIndex(c => String(c.id) === String(fallbackId));
                    const record = { id: fallbackId, name: title || TITLE_DEFAULT, lastEdited: new Date().toISOString(), type: 'cv', accentColor: currentAccentColor, data: { ...cvData } };
                    if (idx >= 0) cvs[idx] = record; else cvs.push(record);
                    localStorage.setItem('JobLynk_cvs', JSON.stringify(cvs));
                } catch (e2) { console.error('localStorage save failed:', e2); }
            }

            setTimeout(() => {
                if (cloudIcon) {
                    cloudIcon.classList.remove('fa-spin');
                    cloudIcon.classList.replace('fa-arrows-rotate', 'fa-cloud');
                }
            }, 500);
        }, 800);
    }

    // Save on title change
    document.querySelector('.topbar-title')?.addEventListener('input', saveData);

    // ============================
    // DOM REFS
    // ============================
    const $ = id => document.getElementById(id);

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
        nationality: 'Nationality', civilStatus: 'Civil status',
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
        $('previewPane').classList.add('open');
    });
    // Close on swipe right or ESC – simplified: click topbar back when preview is open
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') $('previewPane')?.classList.remove('open');
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
            <div class="cv-skill-entry">${l.name || '(Not specified)'}${l.level ? ' — '+l.level : ''}</div>
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
                        <div class="input-group"><label>City</label><input class="dyn" data-arr="experience" data-id="${exp.id}" data-key="city" value="${exp.city}" autocomplete="off"></div>
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
                        <div class="input-group full-width"><label>Education Description</label><textarea class="dyn" data-arr="education" data-id="${edu.id}" data-key="description" rows="3">${edu.description}</textarea></div>
                    </div>
                </div>
            </div>
        `).join('');
        attachDyn();
    }

    function renderSkills() {
        const list = $('skills-list');
        list.innerHTML = cvData.skills.map((s, i) => `
            <div class="list-card" data-id="${s.id}">
                <div class="list-card-header" onclick="document.getElementById('sk-${s.id}').classList.toggle('open')">
                    <div class="list-card-info"><span class="list-card-title">${s.name || '(Not specified)'}</span></div>
                    <div class="list-card-actions">
                        <button class="del-skill" data-id="${s.id}"><i class="fa-solid fa-trash-can"></i></button>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
                <div class="list-card-body ${i===cvData.skills.length-1?'open':''}" id="sk-${s.id}">
                    <div class="form-row">
                        <div class="input-group full-width"><label>Skill</label><input class="dyn" data-arr="skills" data-id="${s.id}" data-key="name" value="${s.name}" autocomplete="off"></div>
                    </div>
                </div>
            </div>
        `).join('');
        attachDyn();
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

        // Delete handlers
        document.querySelectorAll('.del-exp').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.experience = cvData.experience.filter(x=>x.id!==b.dataset.id); renderExperience(); renderPreview(); }; });
        document.querySelectorAll('.del-edu').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.education = cvData.education.filter(x=>x.id!==b.dataset.id); renderEducation(); renderPreview(); }; });
        document.querySelectorAll('.del-skill').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.skills = cvData.skills.filter(x=>x.id!==b.dataset.id); renderSkills(); renderPreview(); }; });
        document.querySelectorAll('.del-lang').forEach(b => { b.onclick = (e) => { e.stopPropagation(); cvData.languages = cvData.languages.filter(x=>x.id!==b.dataset.id); renderLanguages(); renderPreview(); }; });
    }

    // ============================
    // ADD BUTTONS
    // ============================
    $('btnAddExperience').addEventListener('click', () => { cvData.experience.push({ id:uid(), jobTitle:'', employer:'', startDate:'', endDate:'', city:'', description:'' }); renderExperience(); renderPreview(); });
    $('btnAddEducation').addEventListener('click', () => { cvData.education.push({ id:uid(), school:'', degree:'', startDate:'', endDate:'', city:'', description:'' }); renderEducation(); renderPreview(); });
    $('btnAddSkill').addEventListener('click', () => { cvData.skills.push({ id:uid(), name:'' }); renderSkills(); renderPreview(); });
    $('btnAddLanguage').addEventListener('click', () => { cvData.languages.push({ id:uid(), name:'', level:'' }); renderLanguages(); renderPreview(); });

    // ============================
    // PDF / DOWNLOAD
    // ============================
    $('btnPdf')?.addEventListener('click', () => {
        // Guest mode: save state and prompt sign-in
        if (!isLoggedIn) {
            // Ensure latest state is saved
            const titleEl = document.querySelector('.topbar-title');
            const title = titleEl ? titleEl.textContent.trim() : TITLE_DEFAULT;
            try {
                localStorage.setItem('JobLynk_guest_cv', JSON.stringify({
                    id: docId,
                    name: title || TITLE_DEFAULT,
                    lastEdited: new Date().toISOString(),
                    type: 'cv',
                    accentColor: currentAccentColor,
                    data: { ...cvData }
                }));
            } catch (e) { console.warn('Guest save failed:', e); }

            // Show auth modal
            const modal = document.getElementById('guestAuthModal');
            if (modal) modal.style.display = 'flex';
            return;
        }

        const element = $('cvPaper');
        const cvName = sanitizeFileName(getCurrentCvTitle() || buildDefaultCvName());
        const opt = {
            margin:       0,
            filename:     `${cvName}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 3, useCORS: true, logging: false, backgroundColor: '#fff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        // Add export-pdf class and remove transform for clean capture
        element.classList.add('export-pdf');
        const origTransform = element.style.transform;
        element.style.transform = 'none';
        html2pdf().set(opt).from(element).save().then(() => {
            // Restore state
            element.classList.remove('export-pdf');
            element.style.transform = origTransform;
        }).catch(() => {
            element.classList.remove('export-pdf');
            element.style.transform = origTransform;
        });
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
    $('btnTemplate')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        templatePanel.classList.toggle('open');
    });
    $('btnCloseTemplates')?.addEventListener('click', () => {
        templatePanel.classList.remove('open');
    });

    let currentTemplate = 'classic';
    let currentFont = null;

    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
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
            document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });

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
        });
    });

    $('customColorPicker')?.addEventListener('input', (e) => {
        applyColor(e.target.value);
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
    });

    // Close template panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!templatePanel.contains(e.target) && e.target !== $('btnTemplate') && !$('btnTemplate').contains(e.target)) {
            templatePanel.classList.remove('open');
        }
    });

    // ============================
    // INITIALIZE: Load saved data
    // ============================
    loadData().then(() => {
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
