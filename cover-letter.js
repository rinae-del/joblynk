document.addEventListener('DOMContentLoaded', () => {

    // ============================
    // DOM REFS (must be first!)
    // ============================
    const $ = id => document.getElementById(id);

    // ============================
    // STATE
    // ============================
    const clData = {
        firstName: '', lastName: '', email: '', phone: '', address: '',
        companyName: '', hiringManager: '', targetJobTitle: '',
        jobDescription: '', keyHighlights: '',
        letterContent: ''
    };

    let docId = new URLSearchParams(window.location.search).get('id');
    const isNew = !docId;
    if (!docId) docId = 'new_' + Date.now().toString();

    // ============================
    // ACCENT COLOR (declared early for saveData)
    // ============================
    let currentAccentColor = '#0F766E';
    let serverDocId = isNew ? null : docId;

    // ============================
    // LOAD / SAVE
    // ============================
    async function loadData() {
        if (isNew) return;

        // Try API first
        try {
            const res = await fetch('api/documents/index.php?id=' + encodeURIComponent(docId), { credentials: 'include' });
            const result = await res.json();
            if (result.success && result.document) {
                const doc = result.document;
                serverDocId = doc.id;
                Object.assign(clData, doc.data || {});
                if (doc.accent_color) currentAccentColor = doc.accent_color;
                $('docTitle').textContent = doc.name || 'Untitled Cover Letter';
                populateInputs();
                return;
            }
        } catch (e) { console.warn('API load failed, trying localStorage:', e); }

        // Fallback to localStorage
        try {
            const stored = localStorage.getItem('JobLynk_cls');
            if (stored) {
                const cls = JSON.parse(stored);
                const ex = cls.find(c => String(c.id) === String(docId));
                if (ex) {
                    Object.assign(clData, ex.data || {});
                    if (ex.accentColor) currentAccentColor = ex.accentColor;
                    $('docTitle').textContent = ex.name || 'Untitled Cover Letter';
                    populateInputs();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    function populateInputs() {
        document.querySelectorAll('[data-cl]').forEach(inp => {
            const key = inp.getAttribute('data-cl');
            inp.value = clData[key] || '';
        });
    }

    let saveTimeout;
    function saveData() {
        clearTimeout(saveTimeout);
        const icon = $('saveIcon');
        if (icon) {
            icon.classList.replace('fa-cloud', 'fa-arrows-rotate');
            icon.classList.add('fa-spin');
        }

        saveTimeout = setTimeout(async () => {
            const titleEl = $('docTitle');
            const title = titleEl ? titleEl.textContent.trim() : 'Untitled Cover Letter';

            // Try API save
            try {
                const payload = {
                    doc_type: 'cl',
                    name: title || 'Untitled Cover Letter',
                    accent_color: currentAccentColor,
                    data: { ...clData }
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
                    if (isNew || !window.location.search.includes('id=')) {
                        window.history.replaceState({}, '', '?id=' + serverDocId);
                    }
                }
            } catch (e) {
                // Fallback to localStorage
                console.warn('API save failed, using localStorage:', e);
                try {
                    const stored = localStorage.getItem('JobLynk_cls');
                    let cls = stored ? JSON.parse(stored) : [];
                    const fallbackId = serverDocId || docId;
                    const idx = cls.findIndex(c => String(c.id) === String(fallbackId));
                    const record = { id: fallbackId, name: title || 'Untitled Cover Letter', lastEdited: new Date().toISOString(), type: 'cl', accentColor: currentAccentColor, data: { ...clData } };
                    if (idx >= 0) cls[idx] = record; else cls.push(record);
                    localStorage.setItem('JobLynk_cls', JSON.stringify(cls));
                } catch (e2) { console.error('localStorage save failed:', e2); }
            }

            setTimeout(() => {
                if (icon) {
                    icon.classList.remove('fa-spin');
                    icon.classList.replace('fa-arrows-rotate', 'fa-cloud');
                }
            }, 500);
        }, 800);
    }

    $('docTitle')?.addEventListener('input', saveData);

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
    // INPUT BINDING
    // ============================
    document.addEventListener('input', (e) => {
        const field = e.target.getAttribute('data-cl');
        if (field && field in clData) {
            clData[field] = e.target.value;
            renderPreview();
            saveData();
        }
    });

    // ============================
    // PREVIEW RENDERING
    // ============================
    function renderPreview() {
        const fullName = `${clData.firstName} ${clData.lastName}`.trim();
        $('previewSenderName').textContent = fullName;
        $('previewSignoffName').textContent = fullName;

        const contactParts = [clData.email, clData.phone, clData.address].filter(Boolean);
        $('previewSenderContact').innerHTML = contactParts.join(' &nbsp;|&nbsp; ');

        // Date
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        $('previewDate').textContent = today;

        $('previewHiringManager').textContent = clData.hiringManager || '';
        $('previewCompanyName').textContent = clData.companyName || '';

        if (clData.hiringManager) {
            $('previewSalutation').textContent = `Dear ${clData.hiringManager},`;
        } else if (clData.companyName) {
            $('previewSalutation').textContent = `Dear Hiring Manager at ${clData.companyName},`;
        } else {
            $('previewSalutation').textContent = `Dear Hiring Manager,`;
        }

        if (clData.letterContent) {
            const paragraphs = clData.letterContent.split('\n').filter(p => p.trim() !== '');
            $('previewBody').innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
        } else {
            $('previewBody').innerHTML = '<p>Your cover letter content will appear here. Start by filling out the details on the left and clicking "Generate Cover Letter".</p>';
        }
    }

    // ============================
    // API INTEGRATION (server-side proxy)
    // ============================

    // Generate action
    $('btnGenerate')?.addEventListener('click', async () => {

        if (!clData.jobDescription) {
            alert('Please paste a job description first.');
            return;
        }

        const btn = $('btnGenerate');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        const prompt = `You are an expert career coach and professional resume writer.
Write a highly professional, engaging, and concise cover letter for the following job application. Do NOT include placeholder tags for sender address, recipient address, or date at the top, since I will handle the document header and salutation formatting separately. Just provide the main body paragraphs of the cover letter. Do not include the sign-off (e.g., "Sincerely") either.

Job Title: ${clData.targetJobTitle || 'Not specified'}
Company: ${clData.companyName || 'Not specified'}
Applicant Name: ${clData.firstName} ${clData.lastName}

Key Applicant Highlights to include:
${clData.keyHighlights || 'Focus on general enthusiasm and adaptability.'}

Job Description:
${clData.jobDescription}

Tone: Professional, confident, and concise (around 3-4 paragraphs max). Do not hallucinate experiences not mentioned in the highlights, but lean heavily into enthusiasm and cultural fit.`;

        try {
            const res = await fetch('api/ai/generate.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'Generation failed');
            }

            clData.letterContent = data.content;
            $('letterContent').value = clData.letterContent;
            renderPreview();
            saveData();

            $('letterContent').closest('.form-section').classList.remove('collapsed');

        } catch (err) {
            console.error(err);
            alert('Error generating cover letter: ' + err.message);
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Cover Letter';
            btn.disabled = false;
        }
    });

    // ============================
    // PDF EXPORT
    // ============================
    $('btnPdf')?.addEventListener('click', () => {
        const element = $('cvPaper');
        const docName = `${clData.firstName || 'Cover'}_${clData.lastName || 'Letter'}`.replace(/\s+/g, '_');
        const opt = {
            margin: 0,
            filename: `${docName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const origTransform = element.style.transform;
        element.style.transform = 'none';
        html2pdf().set(opt).from(element).save().then(() => {
            element.style.transform = origTransform;
        });
    });

    // ============================
    // TOOLBAR: Zoom
    // ============================
    const paper = $('cvPaper');
    let isZoomed = false;
    $('btnFullscreen')?.addEventListener('click', () => {
        isZoomed = !isZoomed;
        const isMobile = window.innerWidth <= 900;
        const normScale = isMobile ? 0.45 : 0.62;
        const zoomedScale = isMobile ? 0.8 : 1;
        paper.style.transform = `scale(${isZoomed ? zoomedScale : normScale})`;
    });

    // ============================
    // TOOLBAR: Dropdown Toggle
    // ============================
    const allDropdowns = document.querySelectorAll('.toolbar-dropdown');
    function closeAllDropdowns() { allDropdowns.forEach(d => d.classList.remove('open')); }

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
    // TOOLBAR: Font Family
    // ============================
    let currentFont = 'Inter';
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
    // TOOLBAR: Accent Color
    // ============================
    function applyAccentColor(color) {
        currentAccentColor = color;
        // Apply the accent color to paper top border
        paper.style.borderTop = `10px solid ${currentAccentColor}`;
        // Also update the name color and divider color
        const nameEl = $('previewSenderName');
        if (nameEl) nameEl.style.color = currentAccentColor;
        const divider = document.querySelector('.cl-divider');
        if (divider) divider.style.background = currentAccentColor;
    }

    document.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            applyAccentColor(btn.dataset.color);
            document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeAllDropdowns();
            saveData();
        });
    });

    // ============================
    // INITIALIZE
    // ============================
    loadData();
    populateInputs();
    applyAccentColor(currentAccentColor);
    renderPreview();
    checkApiKey();

});
