<?php
/**
 * job.php — Public, SEO-optimised single job page.
 * Server-rendered so crawlers get full content, meta tags and JobPosting
 * structured data. Hosts the public application form (guests can fill it in
 * and create an account at submit time without losing anything).
 *
 * Pretty URL: /job/{id}-{slug}  (rewritten to job.php?id={id} in .htaccess)
 */

require_once __DIR__ . '/api/config/session.php';
startSecureSession();
require_once __DIR__ . '/api/config/database.php';
require_once __DIR__ . '/api/config/helpers.php';
require_once __DIR__ . '/api/config/resend.php'; // defines APP_URL / APP_NAME
require_once __DIR__ . '/api/lib/job-schema.php';

function e(?string $v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

function jp_slug(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

function jp_job_slug(array $job): string
{
    $parts = array_filter([(string) ($job['title'] ?? ''), (string) ($job['location'] ?? '')]);
    $slug = jp_slug(implode(' ', $parts));
    return $slug !== '' ? $slug : 'job';
}

function jp_excerpt(string $html, int $limit = 155): string
{
    $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
    if (mb_strlen($text) <= $limit) {
        return $text;
    }
    return rtrim(mb_substr($text, 0, $limit - 1)) . '…';
}

function jp_employment_type(string $type): string
{
    $t = strtolower($type);
    if (str_contains($t, 'part')) return 'PART_TIME';
    if (str_contains($t, 'contract')) return 'CONTRACTOR';
    if (str_contains($t, 'temp')) return 'TEMPORARY';
    if (str_contains($t, 'intern') || str_contains($t, 'learner') || str_contains($t, 'graduate')) return 'INTERN';
    if (str_contains($t, 'volunt')) return 'VOLUNTEER';
    return 'FULL_TIME';
}

// ── Resolve the job id (from rewrite ?id= or trailing query) ──
$id = (int) ($_GET['id'] ?? 0);
if (!$id) {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
    if (preg_match('#/job/(\d+)#', $path, $m)) {
        $id = (int) $m[1];
    }
}

$appBase = rtrim(APP_URL, '/');
$pdo = getDB();

$job = null;
if ($id) {
    $stmt = $pdo->prepare('
        SELECT ' . jobListingSelectSql('j') . '
        ' . jobListingJoinSql('j') . '
        WHERE j.id = ?
        LIMIT 1
    ');
    $stmt->execute([$id]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
}

if (!$job) {
    http_response_code(404);
    $notFound = true;
} else {
    $notFound = false;
    normalizeJobRow($job);

    // Canonical slug redirect (301) for SEO.
    $canonicalPath = '/job/' . (int) $job['id'] . '-' . jp_job_slug($job);
    $reqPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
    if ($reqPath !== '' && str_starts_with($reqPath, '/job/') && $reqPath !== $canonicalPath) {
        header('Location: ' . $canonicalPath, true, 301);
        exit;
    }
}

$loggedIn = !empty($_SESSION['user_id']);
$role = $_SESSION['user_role'] ?? '';
$sessionName = trim((string) ($_SESSION['user_name'] ?? ''));
$sessionEmail = (string) ($_SESSION['user_email'] ?? '');
[$sessionFirst, $sessionLast] = array_pad(explode(' ', $sessionName, 2), 2, '');

if ($notFound) {
    $pageTitle = 'Job not found | ' . APP_NAME;
    $metaDesc = 'This job is no longer available on ' . APP_NAME . '.';
    $canonical = $appBase . '/jobs.html';
} else {
    $title = (string) $job['title'];
    $company = (string) ($job['company'] ?: 'Company');
    $location = (string) ($job['location'] ?: 'South Africa');
    $type = (string) ($job['type'] ?: 'Full-time');
    $closed = ($job['status'] ?? 'active') !== 'active';
    $canonical = $appBase . '/job/' . (int) $job['id'] . '-' . jp_job_slug($job);

    $pageTitle = $title . ' at ' . $company . ' — ' . $location . ' | ' . APP_NAME;
    $descSource = $job['description'] ?: ($title . ' at ' . $company . ' in ' . $location . '. Apply now on ' . APP_NAME . '.');
    $metaDesc = jp_excerpt((string) $descSource, 155);

    // ── Salary for display + structured data ──
    $salaryFrom = (float) preg_replace('/[^0-9.]/', '', (string) ($job['salary_from'] ?? ''));
    $salaryTo = (float) preg_replace('/[^0-9.]/', '', (string) ($job['salary_to'] ?? ''));
    $hideSalary = !empty($job['hide_salary']);
    $period = (string) ($job['salary_period'] ?? 'Per Month');
    $salaryUnit = stripos($period, 'year') !== false || stripos($period, 'annum') !== false ? 'YEAR'
        : (stripos($period, 'hour') !== false ? 'HOUR' : (stripos($period, 'week') !== false ? 'WEEK' : 'MONTH'));

    $salaryDisplay = '';
    if (!$hideSalary && ($salaryFrom || $salaryTo)) {
        $fmt = fn($n) => 'R' . number_format($n, 0, '.', ' ');
        if ($salaryFrom && $salaryTo) $salaryDisplay = $fmt($salaryFrom) . ' – ' . $fmt($salaryTo);
        elseif ($salaryFrom) $salaryDisplay = 'From ' . $fmt($salaryFrom);
        elseif ($salaryTo) $salaryDisplay = 'Up to ' . $fmt($salaryTo);
        $salaryDisplay .= ' ' . strtolower(preg_replace('/^Per\s+/i', 'per ', $period));
        $salaryNote = trim((string) ($job['salary_note'] ?? ''));
        if ($salaryNote) $salaryDisplay .= ', ' . $salaryNote;
    }

    $postedAt = $job['created_at'] ?? date('c');
    $datePosted = date('Y-m-d', strtotime((string) $postedAt) ?: time());
    $validThrough = !empty($job['closing_date']) ? date('Y-m-d', strtotime((string) $job['closing_date'])) : '';
    $logo = (string) ($job['company_logo_url'] ?? '');
    if ($logo !== '' && !preg_match('#^https?://#i', $logo)) {
        $logo = $appBase . '/' . ltrim($logo, '/');
    }

    // ── JobPosting structured data ──
    $ld = [
        '@context' => 'https://schema.org/',
        '@type' => 'JobPosting',
        'title' => $title,
        'description' => '<p>' . nl2br(e((string) ($job['description'] ?: $metaDesc))) . '</p>'
            . (!empty($job['requirements']) ? '<h3>Requirements</h3><p>' . nl2br(e((string) $job['requirements'])) . '</p>' : ''),
        'datePosted' => $datePosted,
        'employmentType' => jp_employment_type($type),
        'hiringOrganization' => [
            '@type' => 'Organization',
            'name' => $company,
            'sameAs' => $appBase,
        ],
        'jobLocation' => [
            '@type' => 'Place',
            'address' => [
                '@type' => 'PostalAddress',
                'addressLocality' => $location,
                'addressCountry' => 'ZA',
            ],
        ],
        'identifier' => [
            '@type' => 'PropertyValue',
            'name' => $company,
            'value' => (string) $job['id'],
        ],
        'directApply' => ($job['apply_mode'] ?? 'native') === 'native',
    ];
    if ($logo !== '') {
        $ld['hiringOrganization']['logo'] = $logo;
    }
    if ($validThrough) {
        $ld['validThrough'] = $validThrough;
    }
    if (stripos($location, 'remote') !== false) {
        $ld['jobLocationType'] = 'TELECOMMUTE';
        $ld['applicantLocationRequirements'] = ['@type' => 'Country', 'name' => 'South Africa'];
    }
    if (!$hideSalary && ($salaryFrom || $salaryTo)) {
        $ld['baseSalary'] = [
            '@type' => 'MonetaryAmount',
            'currency' => 'ZAR',
            'value' => array_filter([
                '@type' => 'QuantitativeValue',
                'minValue' => $salaryFrom ?: null,
                'maxValue' => $salaryTo ?: ($salaryFrom ?: null),
                'unitText' => $salaryUnit,
            ], fn($v) => $v !== null),
        ];
    }

    $skills = [];
    $rawSkills = $job['skills'] ?? '';
    if (is_string($rawSkills) && $rawSkills !== '') {
        $decoded = json_decode($rawSkills, true);
        $skills = is_array($decoded) ? $decoded : array_map('trim', explode(',', $rawSkills));
    } elseif (is_array($rawSkills)) {
        $skills = $rawSkills;
    }
    $skills = array_values(array_filter(array_map('trim', $skills)));
    if ($skills) {
        $ld['skills'] = implode(', ', $skills);
    }

    $customFields = is_array($job['custom_fields'] ?? null) ? $job['custom_fields'] : [];
    $applyMode = $job['apply_mode'] ?? 'native';
    $externalUrl = trim((string) ($job['external_url'] ?? ''));
    $isExternal = $applyMode === 'external_completion' && $externalUrl !== '';
    $companyInitial = strtoupper(mb_substr($company, 0, 1)) ?: 'J';
    $accent = preg_match('/^#[0-9A-Fa-f]{3,6}$/', (string) ($job['color'] ?? '')) ? $job['color'] : '#6366F1';
}

// Root path for assets — pretty URLs (/job/123-slug) break relative href/src without this.
$basePath = parse_url(APP_URL, PHP_URL_PATH);
$baseHref = ($basePath && $basePath !== '/') ? rtrim((string) $basePath, '/') . '/' : '/';

function jp_asset(string $path): string
{
    global $baseHref;
    return $baseHref . ltrim($path, '/');
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="<?= e($baseHref) ?>">
    <title><?= e($pageTitle) ?></title>
    <meta name="description" content="<?= e($metaDesc) ?>">
    <link rel="canonical" href="<?= e($canonical) ?>">
    <meta name="robots" content="<?= $notFound ? 'noindex, follow' : 'index, follow, max-image-preview:large' ?>">

    <meta property="og:type" content="website">
    <meta property="og:title" content="<?= e($pageTitle) ?>">
    <meta property="og:description" content="<?= e($metaDesc) ?>">
    <meta property="og:url" content="<?= e($canonical) ?>">
    <meta property="og:site_name" content="<?= e(APP_NAME) ?>">
    <?php if (!$notFound && !empty($logo)): ?>
    <meta property="og:image" content="<?= e($logo) ?>">
    <?php endif; ?>
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="<?= e($pageTitle) ?>">
    <meta name="twitter:description" content="<?= e($metaDesc) ?>">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="<?= e(jp_asset('landing.css?v=20260716')) ?>">
    <link rel="stylesheet" href="<?= e(jp_asset('job-page.css?v=20260627b')) ?>">
    <?php if (!$notFound): ?>
    <script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
    <?php endif; ?>
</head>

<body class="landing-page job-detail-public" data-nav-active="jobs" data-logged-in="<?= $loggedIn ? '1' : '0' ?>" data-user-role="<?= e($_SESSION['user_role'] ?? '') ?>">

    <div id="landingNavMount"></div>

    <main class="jp-main">
    <?php if ($notFound): ?>
        <section class="jp-empty">
            <i class="fa-solid fa-circle-question"></i>
            <h1>This job isn't available</h1>
            <p>The role you're looking for may have closed or moved.</p>
            <a href="jobs.html" class="btn-landing btn-landing-primary">Browse live jobs</a>
        </section>
    <?php else: ?>
        <nav class="jp-breadcrumb" aria-label="Breadcrumb">
            <a href="jobs.html">Jobs</a>
            <i class="fa-solid fa-chevron-right"></i>
            <span><?= e($title) ?></span>
        </nav>

        <div class="jp-grid">
            <article class="jp-primary">
                <header class="jp-header">
                    <div class="jp-logo" style="--jp-accent:<?= e($accent) ?>">
                        <?php if (!empty($logo)): ?>
                            <img src="<?= e($logo) ?>" alt="<?= e($company) ?> logo">
                        <?php else: ?>
                            <?= e($companyInitial) ?>
                        <?php endif; ?>
                    </div>
                    <div class="jp-header-text">
                        <h1><?= e($title) ?></h1>
                        <p class="jp-company"><?= e($company) ?></p>
                        <div class="jp-meta">
                            <span><i class="fa-solid fa-location-dot"></i> <?= e($location) ?></span>
                            <span><i class="fa-solid fa-briefcase"></i> <?= e($type) ?></span>
                            <?php if (!empty($salaryDisplay)): ?>
                            <span class="jp-meta-salary"><i class="fa-solid fa-wallet"></i> <?= e($salaryDisplay) ?></span>
                            <?php endif; ?>
                            <?php if (!empty($validThrough)): ?>
                            <span><i class="fa-regular fa-clock"></i> Closes <?= e(date('j M Y', strtotime($validThrough))) ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                </header>

                <?php if ($closed): ?>
                <div class="jp-closed-banner"><i class="fa-solid fa-lock"></i> This role is now closed. Browse other live jobs.</div>
                <?php endif; ?>

                <?php if (!empty($job['description'])): ?>
                <section class="jp-section">
                    <h2>Job description</h2>
                    <div class="jp-prose"><?= nl2br(e((string) $job['description'])) ?></div>
                </section>
                <?php endif; ?>

                <?php if (!empty($job['requirements'])): ?>
                <section class="jp-section">
                    <h2>Requirements</h2>
                    <div class="jp-prose"><?= nl2br(e((string) $job['requirements'])) ?></div>
                </section>
                <?php endif; ?>

                <?php if (!empty($skills)): ?>
                <section class="jp-section">
                    <h2>Skills</h2>
                    <div class="jp-chips">
                        <?php foreach ($skills as $skill): ?>
                        <span><?= e($skill) ?></span>
                        <?php endforeach; ?>
                    </div>
                </section>
                <?php endif; ?>

                <?php if (!empty($job['benefits']) && is_array($job['benefits'])): ?>
                <section class="jp-section">
                    <h2>Benefits</h2>
                    <ul class="jp-list">
                        <?php foreach ($job['benefits'] as $benefit): ?>
                        <li><?= e((string) $benefit) ?></li>
                        <?php endforeach; ?>
                    </ul>
                </section>
                <?php endif; ?>
            </article>

            <aside class="jp-aside">
                <div class="jp-apply-card" id="jpApplyCard">
                    <?php if ($closed): ?>
                        <h2>Applications closed</h2>
                        <p class="jp-apply-sub">This vacancy is no longer accepting applications.</p>
                        <a href="jobs.html" class="btn-landing btn-landing-outline jp-block-btn">Find similar jobs</a>
                    <?php elseif ($isExternal): ?>
                        <h2>Apply for this role</h2>
                        <p class="jp-apply-sub">This position is hosted on the employer's site. You'll complete your application there.</p>
                        <a href="<?= e($externalUrl) ?>" target="_blank" rel="nofollow noopener" class="btn-landing btn-landing-primary jp-block-btn">
                            Apply on employer site <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    <?php else: ?>
                        <h2>Apply for this role</h2>
                        <p class="jp-apply-sub">Start your application now — <?= $loggedIn ? 'submit in one click.' : 'no account needed to begin. You can create a free account when you submit.' ?></p>

                        <form id="jpApplyForm" novalidate>
                            <input type="hidden" name="job_id" value="<?= (int) $job['id'] ?>">

                            <div class="jp-field-row">
                                <div class="jp-field">
                                    <label for="jpFirstName">First name</label>
                                    <input type="text" id="jpFirstName" name="first_name" value="<?= e($sessionFirst) ?>" autocomplete="given-name" required>
                                </div>
                                <div class="jp-field">
                                    <label for="jpLastName">Last name</label>
                                    <input type="text" id="jpLastName" name="last_name" value="<?= e($sessionLast) ?>" autocomplete="family-name" required>
                                </div>
                            </div>

                            <div class="jp-field">
                                <label for="jpEmail">Email address</label>
                                <input type="email" id="jpEmail" name="email" value="<?= e($sessionEmail) ?>" autocomplete="email" <?= $loggedIn ? 'readonly' : '' ?> required>
                            </div>

                            <div class="jp-field">
                                <label for="jpCv">Attach your CV <span class="jp-optional">(PDF, DOC, DOCX · max 5MB)</span></label>
                                <label class="jp-upload" id="jpUploadBox">
                                    <i class="fa-solid fa-cloud-arrow-up"></i>
                                    <span id="jpUploadText">Click to upload or drag a file</span>
                                    <input type="file" id="jpCv" name="cv_file" accept=".pdf,.doc,.docx" hidden>
                                </label>
                                <div id="jpFileList" class="jp-file-list"></div>
                            </div>

                            <div class="jp-field">
                                <label for="jpNote">Message to the recruiter <span class="jp-optional">(optional)</span></label>
                                <textarea id="jpNote" name="note" rows="3" placeholder="Why are you a great fit for this role?"></textarea>
                            </div>

                            <?php if (!empty($customFields)): ?>
                            <div class="jp-screening">
                                <p class="jp-screening-title"><i class="fa-solid fa-clipboard-question"></i> Screening questions</p>
                                <?php foreach ($customFields as $field):
                                    $label = (string) ($field['label'] ?? 'Question');
                                    $req = !empty($field['required']);
                                    $ftype = (string) ($field['type'] ?? 'text');
                                ?>
                                <div class="jp-field">
                                    <label><?= e($label) ?><?= $req ? ' <span class="jp-req">*</span>' : '' ?></label>
                                    <?php if ($ftype === 'textarea'): ?>
                                        <textarea class="jp-custom-answer" data-label="<?= e($label) ?>" rows="2" <?= $req ? 'data-required="1"' : '' ?>></textarea>
                                    <?php elseif ($ftype === 'select'): ?>
                                        <select class="jp-custom-answer" data-label="<?= e($label) ?>" <?= $req ? 'data-required="1"' : '' ?>>
                                            <option value="">Select</option>
                                            <?php foreach (($field['options'] ?? []) as $opt): ?>
                                            <option value="<?= e((string) $opt) ?>"><?= e((string) $opt) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    <?php elseif ($ftype === 'yesno'): ?>
                                        <select class="jp-custom-answer" data-label="<?= e($label) ?>" <?= $req ? 'data-required="1"' : '' ?>>
                                            <option value="">Select</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    <?php else: ?>
                                        <input type="text" class="jp-custom-answer" data-label="<?= e($label) ?>" <?= $req ? 'data-required="1"' : '' ?>>
                                    <?php endif; ?>
                                </div>
                                <?php endforeach; ?>
                            </div>
                            <?php endif; ?>

                            <!-- Account step (revealed at submit for guests) -->
                            <div class="jp-account-step" id="jpAccountStep" hidden>
                                <div class="jp-account-head">
                                    <i class="fa-solid fa-shield-halved"></i>
                                    <div>
                                        <strong id="jpAccountTitle">Create your free account to submit</strong>
                                        <p id="jpAccountSub">Your application details above are saved — just set a password to finish.</p>
                                    </div>
                                </div>
                                <div class="jp-field">
                                    <label for="jpPassword" id="jpPasswordLabel">Choose a password <span class="jp-optional">(min 8 characters)</span></label>
                                    <div class="jp-password-wrap">
                                        <input type="password" id="jpPassword" name="password" autocomplete="new-password" minlength="8">
                                        <button type="button" class="jp-password-toggle" id="jpPasswordToggle" aria-label="Show password"><i class="fa-regular fa-eye"></i></button>
                                    </div>
                                </div>
                                <p class="jp-account-switch">
                                    <span id="jpSwitchPrompt">Already have an account?</span>
                                    <button type="button" id="jpToggleMode">Sign in instead</button>
                                </p>
                            </div>

                            <div class="jp-apply-feedback" id="jpFeedback" role="alert" hidden></div>

                            <button type="submit" class="btn-landing btn-landing-primary jp-block-btn" id="jpSubmitBtn">
                                <i class="fa-solid fa-paper-plane"></i> <span id="jpSubmitLabel">Submit application</span>
                            </button>
                            <p class="jp-apply-fineprint">By submitting you agree to share your details with this employer.</p>
                        </form>
                    <?php endif; ?>
                </div>

                <div class="jp-share-card">
                    <span>Share this job</span>
                    <div class="jp-share-btns">
                        <a href="https://wa.me/?text=<?= rawurlencode($pageTitle . ' ' . $canonical) ?>" target="_blank" rel="noopener" aria-label="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=<?= rawurlencode($canonical) ?>" target="_blank" rel="noopener" aria-label="Share on LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                        <a href="https://twitter.com/intent/tweet?url=<?= rawurlencode($canonical) ?>&text=<?= rawurlencode($pageTitle) ?>" target="_blank" rel="noopener" aria-label="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
                        <button type="button" class="jp-copy-link" data-url="<?= e($canonical) ?>" aria-label="Copy link"><i class="fa-solid fa-link"></i></button>
                    </div>
                </div>
            </aside>
        </div>

        <div class="jp-success" id="jpSuccess" hidden>
            <i class="fa-solid fa-circle-check"></i>
            <h2>Your application has been sent</h2>
            <p id="jpSuccessMsg">We've received your application. Check your email for confirmation and next steps.</p>
            <div class="jp-success-actions">
                <a href="dashboard.html" class="btn-landing btn-landing-primary">Go to dashboard</a>
                <a href="jobs.html" class="btn-landing btn-landing-outline">Browse more jobs</a>
            </div>
        </div>
    <?php endif; ?>
    </main>

    <footer class="landing-footer">
        <div class="footer-bottom">
            <p>&copy; 2026 JobLynk. Proudly South African. All rights reserved.</p>
            <div class="social-links">
                <a href="index.html">Home</a>
                <a href="jobs.html">Jobs</a>
                <a href="cv-builder.html">CV Builder</a>
            </div>
        </div>
    </footer>

    <?php if (!$notFound): ?>
    <script>
        window.__JOBPAGE__ = {
            loggedIn: <?= $loggedIn ? 'true' : 'false' ?>,
            role: <?= json_encode($role) ?>,
            jobId: <?= (int) $job['id'] ?>,
            jobTitle: <?= json_encode($title) ?>,
            applyMode: <?= json_encode($applyMode) ?>,
            externalUrl: <?= json_encode($externalUrl) ?>
        };
    </script>
    <script src="<?= e(jp_asset('landing-nav.js?v=20260716')) ?>"></script>
    <script src="<?= e(jp_asset('job-page.js?v=20260627b')) ?>"></script>
    <?php endif; ?>
</body>

</html>
