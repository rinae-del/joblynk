/**
 * JobLynk Profile Page Logic
 * Includes: progress bar, localStorage persistence, skills, file uploads, inner nav
 */

document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    initProgressBar();
    initSkills();
    initInnerNav();
    initSaveButton();
    initProfilePictureControls();
    initFileUploads();
    loadProfileDocuments();
    initIdValidation();

    // Live progress updates on every input
    document.querySelectorAll('[data-profile]').forEach(inp => {
        inp.addEventListener('input', updateProgress);
    });
});

// ============================
// API + LOCALSTORAGE PERSISTENCE
// ============================
const PROFILE_KEY = 'JobLynk_profile';
const PROFILE_API = 'api/profile/index.php';
const PROFILE_DOCUMENTS_API = 'api/documents/index.php';
const PROFILE_DOCUMENT_SERVE_API = 'api/documents/serve.php';
const DEFAULT_PROFILE_AVATAR_BG = '3B4BA6';

const profileDocuments = {
    cv: null,
    cl: null,
    supporting: [],
};

let profileAvatarUrl = '';
let profileAvatarCustom = false;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
    if (!bytes) {
        return 'Unknown size';
    }

    if (bytes < 1024) {
        return bytes + ' B';
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDocumentUpdated(dateStr) {
    if (!dateStr) {
        return 'Uploaded recently';
    }

    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
        return 'Uploaded recently';
    }

    return 'Updated ' + parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function getDocumentIconClass(doc) {
    const mime = (doc && doc.mime_type ? doc.mime_type : '').toLowerCase();

    if (mime.indexOf('pdf') !== -1) {
        return 'fa-solid fa-file-pdf';
    }
    if (mime.indexOf('word') !== -1 || mime.indexOf('document') !== -1) {
        return 'fa-solid fa-file-word';
    }
    if (mime.indexOf('image') !== -1) {
        return 'fa-regular fa-image';
    }

    return doc && doc.doc_type === 'supporting'
        ? 'fa-solid fa-file-circle-check'
        : 'fa-solid fa-file-lines';
}

function getDocumentViewUrl(docId) {
    return `${PROFILE_DOCUMENT_SERVE_API}?id=${encodeURIComponent(docId)}`;
}

function getProfileDisplayName() {
    const firstName = document.getElementById('profFirstName')?.value.trim() || '';
    const lastName = document.getElementById('profLastName')?.value.trim() || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
        return fullName;
    }

    if (window.__JobLynkUser && window.__JobLynkUser.name) {
        return window.__JobLynkUser.name;
    }

    return 'Guest User';
}

function buildDefaultProfileAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Guest User')}&background=${DEFAULT_PROFILE_AVATAR_BG}&color=fff&size=256`;
}

function renderSidebarAvatar(src, name) {
    const avatarContainer = document.querySelector('.sidebar-user .user-avatar');
    if (!avatarContainer) {
        return;
    }

    let avatarImg = avatarContainer.querySelector('img');
    if (!avatarImg) {
        avatarContainer.textContent = '';
        avatarImg = document.createElement('img');
        avatarContainer.appendChild(avatarImg);
    }

    avatarImg.src = src;
    avatarImg.alt = `${name} avatar`;
}

function renderProfileAvatar() {
    const displayName = getProfileDisplayName();
    const resolvedAvatarUrl = profileAvatarUrl || buildDefaultProfileAvatarUrl(displayName);
    const profilePic = document.getElementById('profilePic');
    const hint = document.getElementById('profilePicHint');

    if (profilePic) {
        profilePic.src = resolvedAvatarUrl;
        profilePic.alt = `${displayName} profile picture`;
    }

    renderSidebarAvatar(resolvedAvatarUrl, displayName);

    if (hint) {
        hint.textContent = profileAvatarCustom
            ? 'Your custom photo is saved.'
            : 'Click the camera to upload JPG, PNG or WebP up to 5MB.';
    }
}

function updateProfileAvatar(avatarUrl) {
    profileAvatarUrl = avatarUrl || '';
    profileAvatarCustom = Boolean(avatarUrl);
    renderProfileAvatar();
}

function validateProfileAvatarFile(file) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (!allowedExts.includes(ext)) {
        return 'Please upload JPG, PNG or WEBP images only.';
    }

    if (file.type && !allowedMimes.includes(file.type)) {
        return 'Only JPG, PNG or WEBP images are supported.';
    }

    if (file.size > 5 * 1024 * 1024) {
        return 'Profile photo must be less than 5MB.';
    }

    return '';
}

function setProfilePictureLoading(isLoading) {
    const button = document.getElementById('btnChangePic');
    const container = document.querySelector('.profile-pic-container');
    const hint = document.getElementById('profilePicHint');

    if (button) {
        button.disabled = isLoading;
        button.innerHTML = isLoading
            ? '<i class="fa-solid fa-circle-notch fa-spin"></i>'
            : '<i class="fa-solid fa-camera"></i>';
    }

    if (container) {
        container.classList.toggle('is-uploading', isLoading);
    }

    if (hint && isLoading) {
        hint.textContent = 'Uploading profile photo...';
    }
}

async function uploadProfileAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(PROFILE_API, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });
    const result = await res.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to upload profile picture.');
    }

    return result.avatar_url || result.profile?.avatar_url || '';
}

function initProfilePictureControls() {
    const changeButton = document.getElementById('btnChangePic');
    const fileInput = document.getElementById('profilePicInput');

    if (changeButton && fileInput) {
        changeButton.addEventListener('click', () => {
            if (!changeButton.disabled) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
                return;
            }

            const validationMessage = validateProfileAvatarFile(file);
            if (validationMessage) {
                alert(validationMessage);
                fileInput.value = '';
                return;
            }

            setProfilePictureLoading(true);

            try {
                const avatarUrl = await uploadProfileAvatar(file);
                updateProfileAvatar(avatarUrl);
            } catch (e) {
                console.error('Failed to upload profile picture:', e);
                alert(e.message || 'Failed to upload profile picture.');
            } finally {
                fileInput.value = '';
                setProfilePictureLoading(false);
                renderProfileAvatar();
            }
        });
    }

    ['profFirstName', 'profLastName'].forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => {
                if (!profileAvatarCustom) {
                    renderProfileAvatar();
                }
            });
        }
    });

    renderProfileAvatar();
}

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
            updateProfileAvatar(p.avatar_url || '');
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
        renderProfileAvatar();
    }

    // Populate from auth user data if fields are still empty
    function tryPopulateFromAuth() {
        if (!window.__JobLynkUser) return;
        const user = window.__JobLynkUser;
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
        if (user.avatar_url) {
            updateProfileAvatar(user.avatar_url);
        } else if (!profileAvatarCustom) {
            renderProfileAvatar();
        }
        updateProgress();
    }

    tryPopulateFromAuth();
    if (!window.__JobLynkUser) {
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
    setupUploadZone({ zoneId: 'cvUploadZone', inputId: 'profileCvInput', docType: 'cv', multiple: false });
    setupUploadZone({ zoneId: 'clUploadZone', inputId: 'profileClInput', docType: 'cl', multiple: false });
    setupUploadZone({ zoneId: 'supportingUploadZone', inputId: 'profileSupportingInput', docType: 'supporting', multiple: true });

    const viewCvBtn = document.getElementById('btnViewCv');
    const removeCvBtn = document.getElementById('btnRemoveCv');
    const viewClBtn = document.getElementById('btnViewCl');
    const removeClBtn = document.getElementById('btnRemoveCl');

    if (viewCvBtn) {
        viewCvBtn.addEventListener('click', () => openProfileDocument(profileDocuments.cv));
    }
    if (removeCvBtn) {
        removeCvBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await removeProfileDocument('cv');
        });
    }
    if (viewClBtn) {
        viewClBtn.addEventListener('click', () => openProfileDocument(profileDocuments.cl));
    }
    if (removeClBtn) {
        removeClBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await removeProfileDocument('cl');
        });
    }
}

function setupUploadZone(options) {
    const zone = document.getElementById(options.zoneId);
    const input = document.getElementById(options.inputId);

    if (!zone || !input) {
        return;
    }

    zone.addEventListener('click', () => {
        if (!zone.classList.contains('is-uploading')) {
            input.click();
        }
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('is-dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('is-dragover');
    });

    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('is-dragover');

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            await uploadProfileFiles(options.docType, files, zone, input, options.multiple);
        }
    });

    input.addEventListener('change', async () => {
        const files = Array.from(input.files || []);
        if (files.length > 0) {
            await uploadProfileFiles(options.docType, files, zone, input, options.multiple);
        }
    });
}

function validateProfileUploadFile(docType, file) {
    const baseAllowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const baseAllowedExts = ['pdf', 'doc', 'docx'];
    const allowedMimes = docType === 'supporting'
        ? baseAllowedMimes.concat(['image/jpeg', 'image/png'])
        : baseAllowedMimes;
    const allowedExts = docType === 'supporting'
        ? baseAllowedExts.concat(['jpg', 'jpeg', 'png'])
        : baseAllowedExts;
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (!allowedExts.includes(ext)) {
        return docType === 'supporting'
            ? 'Please upload PDF, DOC, DOCX, JPG or PNG files only.'
            : 'Please upload a valid document (PDF, DOC, or DOCX).';
    }

    if (file.type && !allowedMimes.includes(file.type)) {
        return docType === 'supporting'
            ? 'This supporting document type is not supported.'
            : 'Please upload a valid document (PDF, DOC, or DOCX).';
    }

    if (file.size > 5 * 1024 * 1024) {
        return 'File size must be less than 5MB.';
    }

    return '';
}

async function uploadProfileFiles(docType, files, zone, input, multiple) {
    const queue = multiple ? files : files.slice(0, 1);
    const previousDoc = (docType === 'cv' || docType === 'cl') ? profileDocuments[docType] : null;

    for (const file of queue) {
        const validationMessage = validateProfileUploadFile(docType, file);
        if (validationMessage) {
            alert(validationMessage);
            input.value = '';
            return;
        }
    }

    zone.classList.add('is-uploading');

    try {
        for (const file of queue) {
            await uploadProfileDocument(file, docType);
        }

        if (previousDoc && previousDoc.id) {
            await deleteProfileDocumentById(previousDoc.id, true);
        }

        await loadProfileDocuments();
    } catch (e) {
        console.error('Profile document upload failed:', e);
        alert(e.message || 'Failed to upload document. Please try again.');
    } finally {
        input.value = '';
        zone.classList.remove('is-uploading');
        zone.classList.remove('is-dragover');
    }
}

async function uploadProfileDocument(file, docType) {
    const formData = new FormData();
    formData.append('doc_type', docType);
    formData.append('name', file.name.replace(/\.[^.]+$/, ''));
    formData.append('file', file);

    const res = await fetch(PROFILE_DOCUMENTS_API, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });
    const result = await res.json();

    if (!result.success) {
        throw new Error(result.message || 'Upload failed.');
    }

    return result.document;
}

async function loadProfileDocuments() {
    try {
        const res = await fetch(`${PROFILE_DOCUMENTS_API}?uploaded=1`, { credentials: 'include' });
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to load uploaded documents.');
        }

        const docs = Array.isArray(result.documents) ? result.documents : [];
        profileDocuments.cv = docs.find(doc => doc.doc_type === 'cv') || null;
        profileDocuments.cl = docs.find(doc => doc.doc_type === 'cl') || null;
        profileDocuments.supporting = docs.filter(doc => doc.doc_type === 'supporting');
    } catch (e) {
        console.warn('Failed to load profile documents:', e);
        profileDocuments.cv = null;
        profileDocuments.cl = null;
        profileDocuments.supporting = [];
    }

    renderUploadedDocumentSlot('cv', profileDocuments.cv);
    renderUploadedDocumentSlot('cl', profileDocuments.cl);
    renderSupportingDocuments();
}

function renderUploadedDocumentSlot(docType, doc) {
    const zone = document.getElementById(docType === 'cv' ? 'cvUploadZone' : 'clUploadZone');
    const preview = document.getElementById(docType === 'cv' ? 'cvPreview' : 'clPreview');
    const nameDisplay = document.getElementById(docType === 'cv' ? 'cvFileName' : 'clFileName');
    const sizeDisplay = document.getElementById(docType === 'cv' ? 'cvFileSize' : 'clFileSize');
    const icon = preview ? preview.querySelector('.file-info i') : null;

    if (!zone || !preview || !nameDisplay || !sizeDisplay) {
        return;
    }

    if (!doc) {
        zone.style.display = 'flex';
        preview.style.display = 'none';
        return;
    }

    nameDisplay.textContent = doc.original_name || doc.name || 'Uploaded document';
    sizeDisplay.textContent = doc.file_size ? formatFileSize(doc.file_size) : formatDocumentUpdated(doc.updated_at);
    if (icon) {
        icon.className = getDocumentIconClass(doc);
    }

    zone.style.display = 'none';
    preview.style.display = 'flex';
}

function renderSupportingDocuments() {
    const list = document.getElementById('supportingDocsList');
    const empty = document.getElementById('supportingDocsEmpty');
    if (!list || !empty) {
        return;
    }

    const docs = profileDocuments.supporting || [];
    if (!docs.length) {
        list.innerHTML = '';
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    list.style.display = 'flex';
    empty.style.display = 'none';
    list.innerHTML = docs.map(doc => `
        <div class="supporting-doc-item">
            <div class="supporting-doc-main">
                <span class="supporting-doc-icon"><i class="${getDocumentIconClass(doc)}"></i></span>
                <div class="supporting-doc-details">
                    <span class="supporting-doc-name">${escapeHtml(doc.original_name || doc.name || 'Supporting Document')}</span>
                    <span class="supporting-doc-meta">${escapeHtml(formatFileSize(doc.file_size))} • ${escapeHtml(formatDocumentUpdated(doc.updated_at))}</span>
                </div>
            </div>
            <div class="supporting-doc-actions">
                <button type="button" class="btn-view-file" data-support-view="${doc.id}"><i class="fa-solid fa-eye"></i> View</button>
                <button type="button" class="btn-remove-file" data-support-delete="${doc.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('[data-support-view]').forEach(button => {
        button.addEventListener('click', () => {
            const docId = button.getAttribute('data-support-view');
            const doc = profileDocuments.supporting.find(item => String(item.id) === String(docId));
            openProfileDocument(doc);
        });
    });

    list.querySelectorAll('[data-support-delete]').forEach(button => {
        button.addEventListener('click', async () => {
            const docId = button.getAttribute('data-support-delete');
            const doc = profileDocuments.supporting.find(item => String(item.id) === String(docId));
            if (!doc) {
                return;
            }

            if (!confirm(`Delete ${doc.original_name || doc.name || 'this document'}?`)) {
                return;
            }

            try {
                await deleteProfileDocumentById(doc.id);
                await loadProfileDocuments();
            } catch (e) {
                console.error('Failed to delete supporting document:', e);
                alert(e.message || 'Failed to delete document.');
            }
        });
    });
}

function openProfileDocument(doc) {
    if (!doc || !doc.id) {
        return;
    }

    window.open(getDocumentViewUrl(doc.id), '_blank', 'noopener');
}

async function removeProfileDocument(docType) {
    const doc = profileDocuments[docType];
    if (!doc || !doc.id) {
        return;
    }

    const label = docType === 'cv' ? 'CV' : 'cover letter';
    if (!confirm(`Remove your uploaded ${label}?`)) {
        return;
    }

    try {
        await deleteProfileDocumentById(doc.id);
        await loadProfileDocuments();
    } catch (e) {
        console.error(`Failed to delete ${docType} document:`, e);
        alert(e.message || 'Failed to delete document.');
    }
}

async function deleteProfileDocumentById(docId, silent) {
    const res = await fetch(`${PROFILE_DOCUMENTS_API}?id=${encodeURIComponent(docId)}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    const result = await res.json();

    if (!result.success) {
        if (silent) {
            return false;
        }
        throw new Error(result.message || 'Failed to delete document.');
    }

    return true;
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
