/**
 * Joblynk Profile Page Logic
 * Includes: progress bar, localStorage persistence, skills, file uploads, inner nav
 */

document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    initProgressBar();
    initSkills();
    initInnerNav();
    initSaveButton();
    initFileUploads();
    initIdValidation();

    // Live progress updates on every input
    document.querySelectorAll('[data-profile]').forEach(inp => {
        inp.addEventListener('input', updateProgress);
    });
});

// ============================
// API + LOCALSTORAGE PERSISTENCE
// ============================
const PROFILE_KEY = 'joblynk_profile';
const PROFILE_API = 'api/profile/index.php';

function getProfileData() {
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
}

async function saveProfileData() {
    const data = {};
    document.querySelectorAll('[data-profile]').forEach(inp => {
        if (inp.id) data[inp.id] = inp.value;
    });
    const skillTags = document.querySelectorAll('#skillsContainer .skill-tag');
    data._skills = Array.from(skillTags).map(t => t.textContent.trim().replace('×', '').trim());

    // Save to localStorage as backup
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));

    // Save to API
    try {
        await fetch(PROFILE_API, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: data.profFirstName || '',
                lastName: data.profLastName || '',
                phone: data.profPhone || '',
                location: data.profLocation || '',
                bio: data.profBio || '',
                jobTitle: data.profJobTitle || '',
                linkedin: data.profLinkedin || '',
                portfolio: data.profPortfolio || '',
                skills: data._skills || [],
                idNumber: data.profIdNumber || '',
                dob: data.profDob || '',
                gender: data.profGender || '',
                citizenship: data.profCitizenship || '',
                streetAddress: data.profStreetAddress || '',
                city: data.profCity || '',
                province: data.profProvince || '',
                postalCode: data.profPostalCode || '',
                country: data.profCountry || 'South Africa',
            })
        });
    } catch (e) {
        console.warn('Profile API save failed, data saved locally:', e);
    }
}

async function loadProfileData() {
    // Try loading from API first
    let apiLoaded = false;
    try {
        const res = await fetch(PROFILE_API, { credentials: 'include' });
        const result = await res.json();
        if (result.success && result.profile) {
            const p = result.profile;
            const fieldMap = {
                profFirstName: p.first_name || '',
                profLastName: p.last_name || '',
                profEmail: p.email || '',
                profPhone: p.phone || '',
                profLocation: p.location || '',
                profBio: p.bio || '',
                profJobTitle: p.job_title || '',
                profLinkedin: p.linkedin || '',
                profPortfolio: p.portfolio || '',
                profIdNumber: p.id_number || '',
                profDob: p.dob || '',
                profGender: p.gender || '',
                profCitizenship: p.citizenship || '',
                profStreetAddress: p.street_address || '',
                profCity: p.city || '',
                profProvince: p.province || '',
                profPostalCode: p.postal_code || '',
                profCountry: p.country || 'South Africa',
            };
            Object.entries(fieldMap).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el && val) el.value = val;
            });
            // Skills will be loaded in initSkills from localStorage or API
            if (p.skills && Array.isArray(p.skills) && p.skills.length > 0) {
                const local = getProfileData();
                local._skills = p.skills;
                localStorage.setItem(PROFILE_KEY, JSON.stringify(local));
            }
            apiLoaded = true;
        }
    } catch (e) {
        console.warn('Profile API load failed, using localStorage:', e);
    }

    // Fallback: load from localStorage
    if (!apiLoaded) {
        const data = getProfileData();
        document.querySelectorAll('[data-profile]').forEach(inp => {
            if (inp.id && data[inp.id]) inp.value = data[inp.id];
        });
    }

    // Populate from auth user data if fields are still empty
    function tryPopulateFromAuth() {
        if (!window.__joblynkUser) return;
        const user = window.__joblynkUser;
        const nameEl = document.getElementById('profFirstName');
        const emailEl = document.getElementById('profEmail');
        if (nameEl && !nameEl.value && user.name) {
            const parts = user.name.split(' ');
            nameEl.value = parts[0] || '';
            const lastEl = document.getElementById('profLastName');
            if (lastEl && !lastEl.value) lastEl.value = parts.slice(1).join(' ') || '';
        }
        if (emailEl && !emailEl.value && user.email) {
            emailEl.value = user.email;
        }
        updateProgress();
    }

    tryPopulateFromAuth();
    if (!window.__joblynkUser) {
        setTimeout(tryPopulateFromAuth, 1500);
    }
}

// ============================
// PROGRESS BAR
// ============================
function initProgressBar() {
    updateProgress();
}

function updateProgress() {
    const fields = [
        { id: 'profFirstName', label: 'First Name' },
        { id: 'profLastName', label: 'Last Name' },
        { id: 'profEmail', label: 'Email' },
        { id: 'profPhone', label: 'Phone' },
        { id: 'profLocation', label: 'Location' },
        { id: 'profBio', label: 'Bio' },
        { id: 'profJobTitle', label: 'Job Title' },
        { id: 'profLinkedin', label: 'LinkedIn' },
        { id: 'profPortfolio', label: 'Portfolio' },
        { id: 'profIdNumber', label: 'ID Number' },
        { id: 'profStreetAddress', label: 'Address' },
        { id: 'profCity', label: 'City' },
        { id: 'profProvince', label: 'Province' },
    ];

    let filled = 0;
    let total = fields.length + 1; // +1 for skills

    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el && el.value.trim()) filled++;
    });

    // Skills count as filled if at least 1 skill tag exists
    const skillTags = document.querySelectorAll('#skillsContainer .skill-tag');
    if (skillTags.length > 0) filled++;

    const percent = Math.round((filled / total) * 100);

    const fillEl = document.getElementById('progressFill');
    const percentEl = document.getElementById('progressPercent');
    const hintEl = document.getElementById('progressHint');

    if (fillEl) fillEl.style.width = percent + '%';
    if (percentEl) percentEl.textContent = percent + '%';

    if (hintEl) {
        if (percent === 100) {
            hintEl.textContent = '🎉 Your profile is complete!';
            if (fillEl) fillEl.style.background = 'linear-gradient(90deg, #059669, #10B981)';
        } else if (percent >= 70) {
            hintEl.textContent = 'Almost there! Add a few more details';
        } else if (percent >= 40) {
            hintEl.textContent = 'Good start — keep going!';
        } else {
            hintEl.textContent = 'Complete your profile to stand out';
        }
    }
}

// ============================
// FILE UPLOADS
// ============================
function initFileUploads() {
    setupUploadZone('cvUploadZone', 'profileCvInput', 'cvPreview', 'cvFileName', 'cvFileSize', 'btnRemoveCv');
    setupUploadZone('clUploadZone', 'profileClInput', 'clPreview', 'clFileName', 'clFileSize', 'btnRemoveCl');
}

function setupUploadZone(zoneId, inputId, previewId, nameId, sizeId, removeBtnId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const nameDisplay = document.getElementById(nameId);
    const sizeDisplay = document.getElementById(sizeId);
    const removeBtn = document.getElementById(removeBtnId);

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--profile-accent)';
        zone.style.background = '#f8fafc';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '';
        zone.style.background = '';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        zone.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            handleFiles(input.files[0]);
        }
    });

    const handleFiles = (file) => {
        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid document (PDF, DOC, or DOCX)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        nameDisplay.textContent = file.name;
        sizeDisplay.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        zone.style.display = 'none';
        preview.style.display = 'flex';
        updateProgress();
    };

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        zone.style.display = 'flex';
        preview.style.display = 'none';
        updateProgress();
    });
}

// ============================
// SKILLS
// ============================
function initSkills() {
    const skillInput = document.getElementById('skillInput');
    const skillsContainer = document.getElementById('skillsContainer');
    
    // Load saved skills
    const saved = getProfileData();
    const skills = saved._skills && saved._skills.length > 0 ? [...saved._skills] : [];

    const renderSkills = () => {
        skillsContainer.innerHTML = '';
        skills.forEach((skill, index) => {
            const tag = document.createElement('div');
            tag.className = 'skill-tag';
            tag.innerHTML = `${skill} <button onclick="removeSkill(${index})"><i class="fa-solid fa-xmark"></i></button>`;
            skillsContainer.appendChild(tag);
        });
        updateProgress();
    };

    window.removeSkill = (index) => {
        skills.splice(index, 1);
        renderSkills();
    };

    window._profileSkills = skills;

    skillInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && skillInput.value.trim() !== '') {
            e.preventDefault();
            skills.push(skillInput.value.trim());
            skillInput.value = '';
            renderSkills();
        }
    });

    renderSkills();
}

// ============================
// INNER NAV
// ============================
function initInnerNav() {
    const navItems = document.querySelectorAll('.inner-nav-item');
    const sections = document.querySelectorAll('.profile-card');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (pageYOffset >= (sectionTop - 100)) {
                current = section.getAttribute('id');
            }
        });
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href').substring(1) === current) {
                item.classList.add('active');
            }
        });
    });
}

// ============================
// SAVE BUTTON
// ============================
function initSaveButton() {
    const btnSave = document.getElementById('btnSaveProfile');
    btnSave.addEventListener('click', async () => {
        // Validate ID before saving
        const idInput = document.getElementById('profIdNumber');
        if (idInput && idInput.value.trim()) {
            const result = validateSaId(idInput.value.trim());
            if (!result.valid) {
                const idError = document.getElementById('idError');
                if (idError) idError.textContent = result.error;
                idInput.classList.add('input-error');
                idInput.classList.remove('input-success');
                idInput.focus();
                return;
            }
        }

        btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
        btnSave.disabled = true;

        await saveProfileData();

        btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        btnSave.style.background = '#10B981';
        
        setTimeout(() => {
            btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
            btnSave.style.background = '';
            btnSave.disabled = false;
        }, 2000);
    });
}

// ============================
// SA ID NUMBER VALIDATION
// ============================
function validateSaId(id) {
    if (!/^\d{13}$/.test(id)) {
        return { valid: false, error: 'ID number must be exactly 13 digits.' };
    }

    // Extract date components (YYMMDD)
    var yy = parseInt(id.substring(0, 2), 10);
    var mm = parseInt(id.substring(2, 4), 10);
    var dd = parseInt(id.substring(4, 6), 10);

    // Determine full year (1900s or 2000s)
    var currentYear = new Date().getFullYear() % 100;
    var fullYear = yy <= currentYear ? 2000 + yy : 1900 + yy;

    // Validate month
    if (mm < 1 || mm > 12) {
        return { valid: false, error: 'Invalid month in ID number.' };
    }

    // Validate day
    var daysInMonth = new Date(fullYear, mm, 0).getDate();
    if (dd < 1 || dd > daysInMonth) {
        return { valid: false, error: 'Invalid day in ID number.' };
    }

    // Citizenship digit (position 11, 0-indexed 10): 0 = SA, 1 = permanent resident
    var citizenDigit = parseInt(id.charAt(10), 10);
    if (citizenDigit !== 0 && citizenDigit !== 1) {
        return { valid: false, error: 'Invalid citizenship digit in ID.' };
    }

    // Luhn checksum validation
    var sum = 0;
    for (var i = 0; i < 13; i++) {
        var digit = parseInt(id.charAt(i), 10);
        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    if (sum % 10 !== 0) {
        return { valid: false, error: 'Invalid ID number (checksum failed).' };
    }

    // Gender: digits 6-9 (0000-4999 = female, 5000-9999 = male)
    var genderSeq = parseInt(id.substring(6, 10), 10);
    var gender = genderSeq >= 5000 ? 'Male' : 'Female';

    var citizenship = citizenDigit === 0 ? 'SA Citizen' : 'Permanent Resident';

    var dob = fullYear + '-' +
        String(mm).padStart(2, '0') + '-' +
        String(dd).padStart(2, '0');

    return { valid: true, dob: dob, gender: gender, citizenship: citizenship };
}

function initIdValidation() {
    var idInput = document.getElementById('profIdNumber');
    if (!idInput) return;

    idInput.addEventListener('input', function () {
        var val = idInput.value.replace(/\D/g, '');
        idInput.value = val;

        var idError = document.getElementById('idError');
        var idHint = document.getElementById('idHint');
        var dobInput = document.getElementById('profDob');
        var genderInput = document.getElementById('profGender');
        var citizenshipInput = document.getElementById('profCitizenship');

        // Clear previous state
        if (idError) idError.textContent = '';
        if (idHint) idHint.textContent = '';
        idInput.classList.remove('input-error', 'input-success');

        if (val.length === 0) {
            if (dobInput) dobInput.value = '';
            if (genderInput) genderInput.value = '';
            if (citizenshipInput) citizenshipInput.value = '';
            return;
        }

        if (val.length < 13) {
            if (idHint) idHint.textContent = (13 - val.length) + ' digits remaining';
            return;
        }

        var result = validateSaId(val);
        if (result.valid) {
            idInput.classList.add('input-success');
            if (idHint) idHint.textContent = 'Valid SA ID number';
            if (idHint) idHint.style.color = '#10B981';
            if (dobInput) dobInput.value = result.dob;
            if (genderInput) genderInput.value = result.gender;
            if (citizenshipInput) citizenshipInput.value = result.citizenship;
        } else {
            idInput.classList.add('input-error');
            if (idError) idError.textContent = result.error;
            if (dobInput) dobInput.value = '';
            if (genderInput) genderInput.value = '';
            if (citizenshipInput) citizenshipInput.value = '';
        }

        updateProgress();
    });
}
