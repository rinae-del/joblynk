<?php
/**
 * /api/jobs/index.php
 * Jobs API — CRUD with role-based access
 * 
 * GET               — List active jobs (all users)
 * GET  ?id=X        — Get single job
 * GET  ?mine=1      — Recruiter: list own jobs
 * POST              — Recruiter: create/update a job
 * DELETE ?id=X      — Recruiter: delete own job
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

function sendJobLiveConfirmationEmail(PDO $pdo, int $userId, int $jobId, array $jobData): void {
    try {
        $stmt = $pdo->prepare('SELECT first_name, email FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user || empty($user['email'])) {
            return;
        }

        $title = htmlspecialchars((string) ($jobData['title'] ?? 'Your job ad'), ENT_QUOTES, 'UTF-8');
        $company = htmlspecialchars((string) ($jobData['company'] ?? 'Your company'), ENT_QUOTES, 'UTF-8');
        $location = htmlspecialchars((string) ($jobData['location'] ?? 'Remote'), ENT_QUOTES, 'UTF-8');
        $type = htmlspecialchars((string) ($jobData['type'] ?? 'Full-time'), ENT_QUOTES, 'UTF-8');
        $firstName = htmlspecialchars((string) ($user['first_name'] ?? 'there'), ENT_QUOTES, 'UTF-8');
        $expiryDate = !empty($jobData['closingDate'])
            ? date('j F Y', strtotime((string) $jobData['closingDate']))
            : 'Not specified';

        $previewUrl = APP_URL . '/recruiter-my-jobs.html?job=' . urlencode((string) $jobId);
        $editUrl = APP_URL . '/recruiter-post-job.html?edit=' . urlencode((string) $jobId);
        $applicationsUrl = APP_URL . '/recruiter-candidates.html?job=' . urlencode((string) $jobId);

        $emailBody = '
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
                Hi ' . $firstName . ', your job ad is now live on JobLynk.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#F8FAFC;">
                <tr>
                    <td style="padding:16px 18px;font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em;">Live Job Summary</td>
                </tr>
                <tr>
                    <td style="padding:0 18px 18px;">
                        <p style="margin:0 0 10px;font-size:14px;color:#475569;"><strong style="color:#1E293B;">Role:</strong> ' . $title . '</p>
                        <p style="margin:0 0 10px;font-size:14px;color:#475569;"><strong style="color:#1E293B;">Company:</strong> ' . $company . '</p>
                        <p style="margin:0 0 10px;font-size:14px;color:#475569;"><strong style="color:#1E293B;">Location:</strong> ' . $location . '</p>
                        <p style="margin:0 0 10px;font-size:14px;color:#475569;"><strong style="color:#1E293B;">Job type:</strong> ' . $type . '</p>
                        <p style="margin:0;font-size:14px;color:#475569;"><strong style="color:#1E293B;">Expiry date:</strong> ' . htmlspecialchars($expiryDate, ENT_QUOTES, 'UTF-8') . '</p>
                    </td>
                </tr>
            </table>
            <div style="margin:28px 0 12px;">
                <a href="' . $previewUrl . '" style="display:inline-block;margin:0 10px 10px 0;padding:12px 22px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Preview Live Job</a>
                <a href="' . $editUrl . '" style="display:inline-block;margin:0 10px 10px 0;padding:12px 22px;background:#FFFFFF;color:#1E293B;font-size:15px;font-weight:700;text-decoration:none;border:1px solid #CBD5E1;border-radius:10px;">Edit Job Ad</a>
                <a href="' . $applicationsUrl . '" style="display:inline-block;margin:0 10px 10px 0;padding:12px 22px;background:#ECFDF5;color:#047857;font-size:15px;font-weight:700;text-decoration:none;border:1px solid #A7F3D0;border-radius:10px;">View Applications</a>
            </div>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#475569;">
                Keep your advert up to date and monitor incoming candidates from your recruiter dashboard.
            </p>
        ';

        $emailHtml = buildEmailTemplate('Your job ad is live', $emailBody);
        sendResendEmail($user['email'], 'Job ad live — ' . html_entity_decode($title, ENT_QUOTES, 'UTF-8'), $emailHtml);
    } catch (Throwable $e) {
        error_log('Job live email error: ' . $e->getMessage());
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

// Auto-migrate: ensure hide_salary column exists
try {
    $col = $pdo->query("SHOW COLUMNS FROM jobs LIKE 'hide_salary'")->fetch();
    if (!$col) {
        $pdo->exec("ALTER TABLE jobs ADD COLUMN hide_salary TINYINT(1) NOT NULL DEFAULT 0 AFTER salary_period");
    }
} catch (Throwable $e) { /* ignore */ }

$userId = $_SESSION['user_id'] ?? null;
$userRole = $_SESSION['user_role'] ?? null;

// ═══════════════════════════
// GET — List or single job
// ═══════════════════════════
if ($method === 'GET') {

    $jobId = $_GET['id'] ?? null;

    // Single job
    if ($jobId) {
        $stmt = $pdo->prepare('SELECT j.*, u.first_name, u.last_name, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count FROM jobs j LEFT JOIN users u ON j.user_id = u.id WHERE j.id = ?');
        $stmt->execute([$jobId]);
        $job = $stmt->fetch();
        if (!$job) jsonResponse(['success' => false, 'message' => 'Job not found.'], 404);
        $job['benefits'] = json_decode($job['benefits'], true) ?: [];
        $job['custom_fields'] = json_decode($job['custom_fields'] ?? '[]', true) ?: [];
        jsonResponse(['success' => true, 'job' => $job]);
    }

    // Recruiter: my jobs
    if (isset($_GET['mine']) && $userId) {
        $stmt = $pdo->prepare('SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count FROM jobs j WHERE j.user_id = ? ORDER BY j.created_at DESC');
        $stmt->execute([$userId]);
        $jobs = $stmt->fetchAll();
        foreach ($jobs as &$j) {
            $j['benefits'] = json_decode($j['benefits'], true) ?: [];
            $j['custom_fields'] = json_decode($j['custom_fields'] ?? '[]', true) ?: [];
        }
        jsonResponse(['success' => true, 'jobs' => $jobs]);
    }

    // All active jobs
    $stmt = $pdo->query('SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count FROM jobs j WHERE j.status = "active" ORDER BY j.created_at DESC');
    $jobs = $stmt->fetchAll();
    foreach ($jobs as &$j) {
        $j['benefits'] = json_decode($j['benefits'], true) ?: [];
        $j['custom_fields'] = json_decode($j['custom_fields'] ?? '[]', true) ?: [];
    }
    jsonResponse(['success' => true, 'jobs' => $jobs]);
}

// ═══════════════════════════
// POST — Create or update (recruiter only)
// ═══════════════════════════
if ($method === 'POST') {
    if (!$userId) jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
    if ($userRole !== 'recruiter' && $userRole !== 'admin') {
        jsonResponse(['success' => false, 'message' => 'Only recruiters can post jobs.'], 403);
    }

    try {
        $body = getJsonBody();

        $jobId       = $body['id'] ?? null;
        $title       = trim($body['title'] ?? '');
        $company     = trim($body['company'] ?? '');
        $location    = trim($body['location'] ?? '');
        $type        = trim($body['type'] ?? 'Full-time');
        $description = trim($body['description'] ?? '');
        $requirements = trim($body['requirements'] ?? '');
        $skills      = trim($body['skills'] ?? '');
        $salaryFrom  = trim($body['salaryFrom'] ?? $body['salary_from'] ?? '');
        $salaryTo    = trim($body['salaryTo'] ?? $body['salary_to'] ?? '');
        $salaryPeriod = trim($body['salaryPeriod'] ?? $body['salary_period'] ?? 'Per Month');
        $hideSalary  = !empty($body['hideSalary'] ?? $body['hide_salary'] ?? false) ? 1 : 0;
        $benefits    = $body['benefits'] ?? [];
        $closingDate = $body['closingDate'] ?? $body['closing_date'] ?? null;
        $status      = $body['status'] ?? 'active';
        $color       = $body['color'] ?? '#3B4BA6';

        if (!$title) jsonResponse(['success' => false, 'message' => 'Job title is required.'], 422);
        if (!$company) jsonResponse(['success' => false, 'message' => 'Company name is required.'], 422);

        $benefitsJson = json_encode(is_array($benefits) ? $benefits : []);

        $customFields = $body['customFields'] ?? $body['custom_fields'] ?? [];
        $customFieldsJson = json_encode(is_array($customFields) ? $customFields : []);

        if ($jobId) {
            // Update — verify ownership
            $stmt = $pdo->prepare('SELECT id, status FROM jobs WHERE id = ? AND user_id = ?');
            $stmt->execute([$jobId, $userId]);
            $existingJob = $stmt->fetch();
            if (!$existingJob) jsonResponse(['success' => false, 'message' => 'Job not found or not authorized.'], 404);

            $stmt = $pdo->prepare('UPDATE jobs SET title=?, company=?, location=?, type=?, description=?, requirements=?, skills=?, salary_from=?, salary_to=?, salary_period=?, hide_salary=?, benefits=?, closing_date=?, custom_fields=?, status=?, color=? WHERE id=? AND user_id=?');
            $stmt->execute([$title, $company, $location, $type, $description, $requirements, $skills, $salaryFrom, $salaryTo, $salaryPeriod, $hideSalary, $benefitsJson, $closingDate ?: null, $customFieldsJson, $status, $color, $jobId, $userId]);

            if ($status === 'active' && ($existingJob['status'] ?? '') !== 'active') {
                sendJobLiveConfirmationEmail($pdo, (int) $userId, (int) $jobId, [
                    'title' => $title,
                    'company' => $company,
                    'location' => $location,
                    'type' => $type,
                    'closingDate' => $closingDate,
                ]);
            }

            jsonResponse(['success' => true, 'id' => (int)$jobId, 'message' => 'Job updated.']);
        }

        // Create new — check job credits (admins bypass)
        if ($userRole === 'recruiter') {
            $stmt = $pdo->prepare('SELECT id, total_credits, used_credits FROM job_credits WHERE user_id = ? AND used_credits < total_credits AND expires_at > NOW() ORDER BY expires_at ASC LIMIT 1');
            $stmt->execute([$userId]);
            $credit = $stmt->fetch();
            if (!$credit) {
                jsonResponse(['success' => false, 'message' => 'No job credits available. Please purchase a plan to post jobs.', 'no_credits' => true], 403);
            }
        }

        $colors = ['#DC2626', '#2563EB', '#059669', '#7C3AED', '#D97706', '#EC4899'];
        $cnt = $pdo->query('SELECT COUNT(*) FROM jobs')->fetchColumn();
        $color = $colors[$cnt % count($colors)];

        $stmt = $pdo->prepare('INSERT INTO jobs (user_id, title, company, location, type, description, requirements, skills, salary_from, salary_to, salary_period, hide_salary, benefits, closing_date, custom_fields, status, color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$userId, $title, $company, $location, $type, $description, $requirements, $skills, $salaryFrom, $salaryTo, $salaryPeriod, $hideSalary, $benefitsJson, $closingDate ?: null, $customFieldsJson, $status, $color]);
        $newId = (int)$pdo->lastInsertId();

        // Decrement credit (recruiter only)
        if ($userRole === 'recruiter' && isset($credit)) {
            $stmt = $pdo->prepare('UPDATE job_credits SET used_credits = used_credits + 1 WHERE id = ?');
            $stmt->execute([$credit['id']]);
        }

        if ($status === 'active') {
            sendJobLiveConfirmationEmail($pdo, (int) $userId, $newId, [
                'title' => $title,
                'company' => $company,
                'location' => $location,
                'type' => $type,
                'closingDate' => $closingDate,
            ]);
        }

        jsonResponse(['success' => true, 'id' => $newId, 'message' => 'Job posted.'], 201);
    } catch (Throwable $e) {
        error_log('Jobs POST error: ' . $e->getMessage());
        jsonResponse(['success' => false, 'message' => 'Failed to save job. Please try again.'], 500);
    }
}

// ═══════════════════════════
// DELETE — Recruiter deletes own job
// ═══════════════════════════
if ($method === 'DELETE') {
    if (!$userId) jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);

    $jobId = $_GET['id'] ?? null;
    if (!$jobId) jsonResponse(['success' => false, 'message' => 'Job ID is required.'], 422);

    // Admins can delete any, recruiters only their own
    if ($userRole === 'admin') {
        $stmt = $pdo->prepare('DELETE FROM jobs WHERE id = ?');
        $stmt->execute([$jobId]);
    } else {
        $stmt = $pdo->prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?');
        $stmt->execute([$jobId, $userId]);
    }

    if ($stmt->rowCount() === 0) jsonResponse(['success' => false, 'message' => 'Job not found or not authorized.'], 404);
    jsonResponse(['success' => true, 'message' => 'Job deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
