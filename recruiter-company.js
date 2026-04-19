document.addEventListener('DOMContentLoaded', () => {
    const COMPANY_API = 'api/company/index.php';
    const DEFAULT_LOGO_BG = '7C3AED';

    const fieldMap = {
        name: 'companyName',
        industry: 'companyIndustry',
        size: 'companySize',
        website: 'companyWebsite',
        vat_number: 'companyVatNumber',
        description: 'companyDescription',
        address_line1: 'companyAddressLine1',
        address_line2: 'companyAddressLine2',
        city: 'companyCity',
        province: 'companyProvince',
        postal_code: 'companyPostalCode',
        country: 'companyCountry',
    };

    let companyState = null;

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildDefaultLogoUrl(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Company')}&background=${DEFAULT_LOGO_BG}&color=fff&size=256&rounded=true`;
    }

    function setStatus(message, tone) {
        const el = $('companySaveStatus');
        if (!el) return;

        el.textContent = message;
        el.classList.remove('is-success', 'is-error');
        if (tone === 'success') el.classList.add('is-success');
        if (tone === 'error') el.classList.add('is-error');
    }

    function setSaveLoading(isLoading) {
        const button = $('btnSaveCompany');
        if (!button) return;

        button.disabled = isLoading;
        button.innerHTML = isLoading
            ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...'
            : '<i class="fa-solid fa-floppy-disk"></i> Save Company';
    }

    function setLogoLoading(isLoading) {
        const button = $('btnUploadLogo');
        const hint = $('companyLogoHint');
        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fa-solid fa-circle-notch fa-spin"></i>'
                : '<i class="fa-solid fa-camera"></i>';
        }
        if (hint && isLoading) {
            hint.textContent = 'Uploading company logo...';
        }
    }

    function collectFormData() {
        return {
            name: $('companyName')?.value.trim() || '',
            industry: $('companyIndustry')?.value.trim() || '',
            size: $('companySize')?.value || '',
            website: $('companyWebsite')?.value.trim() || '',
            vatNumber: $('companyVatNumber')?.value.trim() || '',
            description: $('companyDescription')?.value.trim() || '',
            addressLine1: $('companyAddressLine1')?.value.trim() || '',
            addressLine2: $('companyAddressLine2')?.value.trim() || '',
            city: $('companyCity')?.value.trim() || '',
            province: $('companyProvince')?.value || '',
            postalCode: $('companyPostalCode')?.value.trim() || '',
            country: $('companyCountry')?.value.trim() || 'South Africa',
        };
    }

    function applyCompanyData(company) {
        companyState = company || {};

        Object.entries(fieldMap).forEach(([apiKey, inputId]) => {
            const input = $(inputId);
            if (input) {
                input.value = company?.[apiKey] || '';
            }
        });

        updatePreview();
    }

    function updatePreview() {
        const formData = collectFormData();
        const companyName = formData.name || window.__JobLynkUser?.company_name || 'Your company';
        const logoUrl = (companyState && companyState.logo_url) ? companyState.logo_url : buildDefaultLogoUrl(companyName);
        const logo = $('companyLogoPreview');
        const previewName = $('companyPreviewName');
        const previewMeta = $('companyPreviewMeta');
        const previewWebsite = $('companyPreviewWebsite');

        if (logo) {
            logo.src = logoUrl;
            logo.alt = `${companyName} logo`;
        }

        if (previewName) {
            previewName.textContent = companyName;
        }

        const metaParts = [formData.industry, formData.city, formData.province].filter(Boolean);
        if (previewMeta) {
            previewMeta.textContent = metaParts.length
                ? metaParts.join(' | ')
                : 'Add your company information and branding.';
        }

        if (previewWebsite) {
            if (formData.website) {
                previewWebsite.href = formData.website;
                previewWebsite.textContent = formData.website.replace(/^https?:\/\//i, '');
                previewWebsite.style.display = 'inline-flex';
            } else {
                previewWebsite.style.display = 'none';
                previewWebsite.removeAttribute('href');
            }
        }

        if (window.__JobLynkUser) {
            window.__JobLynkUser.company_name = companyName;
        }

        document.querySelectorAll('[data-company-name]').forEach(el => {
            el.textContent = companyName;
            if (el.tagName === 'OPTION' || el.tagName === 'INPUT') {
                el.value = companyName;
            }
        });
    }

    async function loadCompany() {
        setStatus('Loading company information...', '');

        const res = await fetch(COMPANY_API, {
            credentials: 'include',
            cache: 'no-store',
        });
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to load company information.');
        }

        applyCompanyData(result.company || {});
        setStatus('Company information loaded', 'success');
    }

    async function saveCompany() {
        const payload = collectFormData();
        if (!payload.name) {
            setStatus('Company name is required', 'error');
            $('companyName')?.focus();
            return;
        }

        setSaveLoading(true);
        setStatus('Saving company details...', '');

        try {
            const res = await fetch(COMPANY_API, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to save company details.');
            }

            applyCompanyData(result.company || {});
            setStatus(result.message || 'Company details saved', 'success');
        } catch (error) {
            console.error('Failed to save company details:', error);
            setStatus(error.message || 'Failed to save company details', 'error');
        } finally {
            setSaveLoading(false);
        }
    }

    function validateLogoFile(file) {
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
            return 'Company logo must be less than 5MB.';
        }

        return '';
    }

    async function uploadLogo(file) {
        const formData = new FormData();
        formData.append('logo', file);

        const res = await fetch(COMPANY_API, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to upload company logo.');
        }

        return result.company || {};
    }

    function initLogoUpload() {
        const button = $('btnUploadLogo');
        const input = $('companyLogoInput');
        if (!button || !input) return;

        button.addEventListener('click', () => {
            if (!button.disabled) {
                input.click();
            }
        });

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;

            const validationMessage = validateLogoFile(file);
            if (validationMessage) {
                setStatus(validationMessage, 'error');
                input.value = '';
                return;
            }

            setLogoLoading(true);
            setStatus('Uploading company logo...', '');

            try {
                const company = await uploadLogo(file);
                applyCompanyData(company);
                setStatus('Company logo updated', 'success');
            } catch (error) {
                console.error('Failed to upload company logo:', error);
                setStatus(error.message || 'Failed to upload company logo', 'error');
            } finally {
                setLogoLoading(false);
                input.value = '';
            }
        });
    }

    function initEvents() {
        $('btnSaveCompany')?.addEventListener('click', saveCompany);
        document.querySelectorAll('[data-company-field]').forEach(input => {
            input.addEventListener('input', updatePreview);
            input.addEventListener('change', updatePreview);
        });
        initLogoUpload();
    }

    initEvents();
    loadCompany().catch(error => {
        console.error('Failed to load company information:', error);
        setStatus(error.message || 'Failed to load company information', 'error');
        updatePreview();
    });
});