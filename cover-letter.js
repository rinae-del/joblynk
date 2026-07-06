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

Tone: Professional, confident, and concise. Keep it to 2-3 short paragraphs and 230-300 words maximum. Do not hallucinate experiences not mentioned in the highlights, but lean into enthusiasm and cultural fit.`;

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
        const docName = `${clData.firstName || 'Cover'}_${clData.lastName || 'Letter'}`.replace(/\s+/g, '_');
        try {
            downloadCoverLetterPdf(`${docName}.pdf`);
        } catch (err) {
            console.error(err);
            alert(err.message || 'PDF generator is not ready yet. Please try again.');
        }
    });

    function hexToRgb(hex) {
        const value = String(hex || '#0F766E').replace('#', '').trim();
        const normalized = value.length === 3
            ? value.split('').map(ch => ch + ch).join('')
            : value.padEnd(6, '0').slice(0, 6);
        const number = parseInt(normalized, 16);
        return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
    }

    function normalizePdfText(value) {
        return String(value || '')
            .replace(/\r/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    function getCoverLetterParagraphs() {
        const content = normalizePdfText(clData.letterContent);
        if (!content) {
            return ['Your cover letter content will appear here. Generate or write your letter before downloading.'];
        }
        return content.split(/\n+/).map(p => p.trim()).filter(Boolean);
    }

    function fitBodyText(pdf, paragraphs, width, availableHeight) {
        const sizes = [10.5, 10, 9.5, 9, 8.5, 8, 7.5];
        let fitted = null;

        for (const fontSize of sizes) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(fontSize);
            const lineHeight = fontSize * 0.46;
            const paragraphGap = Math.max(2, fontSize * 0.2);
            const wrapped = paragraphs.map(paragraph => pdf.splitTextToSize(paragraph, width));
            const height = wrapped.reduce((total, lines) => total + (lines.length * lineHeight) + paragraphGap, 0);
            fitted = { fontSize, lineHeight, paragraphGap, wrapped };
            if (height <= availableHeight) break;
        }

        return fitted;
    }

    function downloadCoverLetterPdf(fileName) {
        const JsPdf = window.jspdf?.jsPDF || window.jsPDF;
        if (!JsPdf) {
            throw new Error('PDF generator is not ready yet. Please try again.');
        }

        const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        const pageWidth = 210;
        const pageHeight = 297;
        const marginX = 22;
        const textWidth = pageWidth - (marginX * 2);
        const accent = hexToRgb(currentAccentColor);
        const fullName = `${clData.firstName} ${clData.lastName}`.trim() || $('docTitle')?.textContent.trim() || 'Cover Letter';
        const contact = [clData.email, clData.phone, clData.address].filter(Boolean).join(' | ');
        const today = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
        const recipientLines = [clData.hiringManager, clData.companyName].filter(Boolean);
        const salutation = clData.hiringManager
            ? `Dear ${clData.hiringManager},`
            : clData.companyName
                ? `Dear Hiring Manager at ${clData.companyName},`
                : 'Dear Hiring Manager,';
        const paragraphs = getCoverLetterParagraphs();

        pdf.setProperties({ title: fullName + ' Cover Letter' });
        pdf.setFillColor(...accent);
        pdf.rect(0, 0, pageWidth, 5, 'F');

        let y = 22;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(...accent);
        pdf.text(fullName, pageWidth / 2, y, { align: 'center' });

        if (contact) {
            y += 7;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.8);
            pdf.setTextColor(75, 85, 99);
            pdf.text(pdf.splitTextToSize(contact, textWidth), pageWidth / 2, y, { align: 'center' });
        }

        y += 9;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(marginX, y, pageWidth - marginX, y);

        y += 13;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(31, 41, 55);
        pdf.text(today, marginX, y);

        if (recipientLines.length) {
            y += 11;
            pdf.setFont('helvetica', 'bold');
            pdf.text(recipientLines[0], marginX, y);
            pdf.setFont('helvetica', 'normal');
            if (recipientLines[1]) {
                y += 5;
                pdf.text(recipientLines[1], marginX, y);
            }
        }

        y += 13;
        pdf.setFont('helvetica', 'normal');
        pdf.text(salutation, marginX, y);
        y += 9;

        const bottomLimit = pageHeight - 23;
        const signoffHeight = 20;
        const fitted = fitBodyText(pdf, paragraphs, textWidth, bottomLimit - y - signoffHeight);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fitted.fontSize);
        pdf.setTextColor(55, 65, 81);
        fitted.wrapped.forEach(lines => {
            lines.forEach(line => {
                pdf.text(line, marginX, y);
                y += fitted.lineHeight;
            });
            y += fitted.paragraphGap;
        });

        y = Math.min(y + 5, bottomLimit - 15);
        pdf.setFontSize(10);
        pdf.setTextColor(31, 41, 55);
        pdf.text('Sincerely,', marginX, y);
        y += 12;
        pdf.setFont('helvetica', 'bold');
        pdf.text(fullName, marginX, y);

        pdf.save(fileName);
    }

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

});
