<?php
/**
 * /api/applications/index.php
 * Applications API — role-based access
 * 
 * GET               — Job seeker: my applications | Recruiter: applications to my jobs
 * GET  ?job_id=X    — Recruiter: applications for a specific job
 * POST              — Job seeker: submit application
 * POST (status)     — Recruiter: update application status
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

$userId = $_SESSION['user_id'] ?? null;
$userRole = $_SESSION['user_role'] ?? null;

if (!$userId) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

function ensureApplicationsSchema(PDO $pdo): void
{
    try {
        $columns = [];
        foreach ($pdo->query('SHOW COLUMNS FROM applications') ?: [] as $column) {
            $columns[$column['Field']] = $column;
        }

        if (!isset($columns['document_ids'])) {
            $pdo->exec('ALTER TABLE applications ADD COLUMN document_ids TEXT NULL AFTER cl_id');
        }

        if (!isset($columns['applicant_name'])) {
            $pdo->exec("ALTER TABLE applications ADD COLUMN applicant_name VARCHAR(255) DEFAULT '' AFTER document_ids");
        }

        if (!isset($columns['note'])) {
            $pdo->exec('ALTER TABLE applications ADD COLUMN note TEXT NULL AFTER applicant_name');
        }

        if (!isset($columns['form_responses'])) {
            $pdo->exec('ALTER TABLE applications ADD COLUMN form_responses TEXT NULL AFTER note');
        }

        if (isset($columns['status']) && strpos((string)$columns['status']['Type'], "'shortlisted'") === false) {
            $pdo->exec("ALTER TABLE applications MODIFY COLUMN status ENUM('submitted', 'reviewed', 'shortlisted', 'rejected') NOT NULL DEFAULT 'submitted'");
        }

        if (!isset($columns['viewed_at'])) {
            $pdo->exec('ALTER TABLE applications ADD COLUMN viewed_at DATETIME NULL AFTER status');
        }
    } catch (Throwable $e) {
        // Ignore schema migration issues here so existing compatible schemas continue to work.
    }

    try {
        $docTypeColumn = $pdo->query("SHOW COLUMNS FROM documents LIKE 'doc_type'")->fetch();
        if ($docTypeColumn && strpos((string)$docTypeColumn['Type'], "'supporting'") === false) {
            $pdo->exec("ALTER TABLE documents MODIFY COLUMN doc_type ENUM('cv', 'cl', 'supporting') NOT NULL");
        }
    } catch (Throwable $e) {
        // Ignore schema migration issues here so application submission still uses any compatible schema.
    }
}

function decodeApplicationDocumentIds($value): array
{
    if (is_string($value)) {
        $value = json_decode($value, true);
    }

    if (!is_array($value)) {
        return [];
    }

    return array_values(array_unique(array_map('intval', array_filter($value, static function ($id) {
        return (int)$id > 0;
    }))));
}

ensureApplicationsSchema($pdo);

// ═══════════════════════════
// GET — List applications
// ═══════════════════════════
if ($method === 'GET') {

    $jobId = $_GET['job_id'] ?? null;

    // Recruiter: applications for a specific job they own
    if ($jobId && ($userRole === 'recruiter' || $userRole === 'admin')) {
        $stmt = $pdo->prepare('
            SELECT a.*, u.first_name, u.last_name, u.email,
                   d_cv.name AS cv_name, d_cl.name AS cl_name
            FROM applications a
            JOIN users u ON a.user_id = u.id
            JOIN jobs j ON a.job_id = j.id
            LEFT JOIN documents d_cv ON a.cv_id = d_cv.id
            LEFT JOIN documents d_cl ON a.cl_id = d_cl.id
            WHERE a.job_id = ? AND j.user_id = ?
            ORDER BY a.created_at DESC
        ');
        $stmt->execute([$jobId, $userId]);
        $apps = $stmt->fetchAll();
        foreach ($apps as &$a) {
            $a['form_responses'] = json_decode($a['form_responses'] ?? 'null', true);
            $a['document_ids'] = decodeApplicationDocumentIds($a['document_ids'] ?? null);
        }
        jsonResponse(['success' => true, 'applications' => $apps]);
    }

    // Recruiter: all applications across all their jobs
    if ($userRole === 'recruiter' || $userRole === 'admin') {
        $stmt = $pdo->prepare('
            SELECT a.*, u.first_name, u.last_name, u.email,
                   j.title AS job_title, j.company AS job_company, j.color AS job_color,
                   d_cv.name AS cv_name, d_cl.name AS cl_name
            FROM applications a
            JOIN users u ON a.user_id = u.id
            JOIN jobs j ON a.job_id = j.id
            LEFT JOIN documents d_cv ON a.cv_id = d_cv.id
            LEFT JOIN documents d_cl ON a.cl_id = d_cl.id
            WHERE j.user_id = ?
            ORDER BY a.created_at DESC
        ');
        $stmt->execute([$userId]);
        $apps = $stmt->fetchAll();
        foreach ($apps as &$a) {
            $a['form_responses'] = json_decode($a['form_responses'] ?? 'null', true);
            $a['document_ids'] = decodeApplicationDocumentIds($a['document_ids'] ?? null);
        }
        jsonResponse(['success' => true, 'applications' => $apps]);
    }

    // Job seeker: my applications
    $stmt = $pdo->prepare('
        SELECT a.*, j.title AS job_title, j.company AS job_company, j.location AS job_location,
               j.type AS job_type, j.color AS job_color
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
    ');
    $stmt->execute([$userId]);
    $apps = $stmt->fetchAll();
    foreach ($apps as &$a) {
        $a['document_ids'] = decodeApplicationDocumentIds($a['document_ids'] ?? null);
    }
    jsonResponse(['success' => true, 'applications' => $apps]);
}

// ═══════════════════════════
// POST — Submit or update status
// ═══════════════════════════
if ($method === 'POST') {
    // Support both JSON and multipart/form-data (file uploads)
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $isMultipart = stripos($contentType, 'multipart/form-data') !== false;
    $body = $isMultipart ? $_POST : getJsonBody();

    // Recruiter: update application status
    if (isset($body['application_id']) && isset($body['status'])) {
        if ($userRole !== 'recruiter' && $userRole !== 'admin') {
            jsonResponse(['success' => false, 'message' => 'Not authorized.'], 403);
        }
        $appId = $body['application_id'];
        $newStatus = $body['status'];
        $validStatuses = ['submitted', 'reviewed', 'shortlisted', 'rejected'];
        if (!in_array($newStatus, $validStatuses)) {
            jsonResponse(['success' => false, 'message' => 'Invalid status.'], 422);
        }

        // Verify recruiter owns the job
        $stmt = $pdo->prepare('
            SELECT a.id FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.id = ? AND j.user_id = ?
        ');
        $stmt->execute([$appId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Application not found or not authorized.'], 404);
        }

        $stmt = $pdo->prepare('UPDATE applications SET status = ? WHERE id = ?');
        $stmt->execute([$newStatus, $appId]);
        jsonResponse(['success' => true, 'message' => 'Application status updated.']);
    }

    // Recruiter: mark application as viewed (fires "viewed by employer" email once)
    if (isset($body['application_id']) && isset($body['action']) && $body['action'] === 'mark_viewed') {
        if ($userRole !== 'recruiter' && $userRole !== 'admin') {
            jsonResponse(['success' => false, 'message' => 'Not authorized.'], 403);
        }
        $appId = (int)$body['application_id'];

        // Verify recruiter owns the job and check if already viewed
        $stmt = $pdo->prepare('
            SELECT a.id, a.viewed_at, a.user_id, a.job_id
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.id = ? AND j.user_id = ?
        ');
        $stmt->execute([$appId, $userId]);
        $app = $stmt->fetch();
        if (!$app) {
            jsonResponse(['success' => false, 'message' => 'Application not found or not authorized.'], 404);
        }

        // Only send email on first view
        if (!$app['viewed_at']) {
            $stmt = $pdo->prepare('UPDATE applications SET viewed_at = NOW() WHERE id = ?');
            $stmt->execute([$appId]);

            // Send "application viewed" email to candidate
            try {
                $stmt = $pdo->prepare('SELECT first_name, last_name, email FROM users WHERE id = ?');
                $stmt->execute([$app['user_id']]);
                $candidate = $stmt->fetch();

                $stmt = $pdo->prepare('SELECT title, company FROM jobs WHERE id = ?');
                $stmt->execute([$app['job_id']]);
                $job = $stmt->fetch();

                if ($candidate && $candidate['email'] && $job) {
                    $candidateFirst = htmlspecialchars($candidate['first_name'] ?? 'there', ENT_QUOTES);
                    $jobTitle = htmlspecialchars($job['title'] ?? 'your applied position', ENT_QUOTES);
                    $jobCompany = htmlspecialchars($job['company'] ?? 'the company', ENT_QUOTES);

                    $viewedBody = '
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $candidateFirst . ',</p>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Good news — <strong>a recruiter has viewed your application</strong> for the position below:</p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0;margin:20px 0;">
                            <tr>
                                <td style="padding:20px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding:4px 0;font-size:14px;color:#64748B;width:100px;">Position</td>
                                            <td style="padding:4px 0;font-size:14px;font-weight:600;color:#1E293B;">' . $jobTitle . '</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:4px 0;font-size:14px;color:#64748B;">Company</td>
                                            <td style="padding:4px 0;font-size:14px;font-weight:600;color:#1E293B;">' . $jobCompany . '</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">This is a great sign! Keep your profile and CV up to date so you make the best impression.</p>
                        <div style="text-align:center;margin:24px 0;">
                            <a href="' . APP_URL . '/dashboard.html" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                                View Your Applications
                            </a>
                        </div>
                        <p style="font-size:14px;color:#94A3B8;margin:24px 0 0;">Keep going — you\'re on the right track! 💪</p>';

                    sendResendEmail(
                        $candidate['email'],
                        'Your application was viewed — ' . ($job['title'] ?? 'Job'),
                        buildEmailTemplate('A Recruiter Viewed Your Application 👀', $viewedBody)
                    );
                }
            } catch (Throwable $e) {
                error_log('Application viewed email error: ' . $e->getMessage());
            }
        }

        jsonResponse(['success' => true, 'message' => 'Application marked as viewed.']);
    }

    // Job seeker: submit application
    if ($userRole !== 'job_seeker' && $userRole !== 'admin') {
        jsonResponse(['success' => false, 'message' => 'Only job seekers can apply.'], 403);
    }

    $jobId = $body['job_id'] ?? null;
    $cvId  = $body['cv_id'] ?? null;
    $clId  = $body['cl_id'] ?? null;
    $note  = trim($body['note'] ?? '');
    $formResponses = $body['form_responses'] ?? null;
    // If form_responses came as JSON string (from FormData), decode it
    if (is_string($formResponses)) {
        $formResponses = json_decode($formResponses, true);
    }
    $formResponsesJson = $formResponses ? json_encode($formResponses) : null;

    // Document IDs from saved documents (JSON array from FormData)
    $documentIds = decodeApplicationDocumentIds($body['document_ids'] ?? null);

    // Ensure cv_id and cl_id are included in the list
    if ($cvId && !in_array($cvId, $documentIds)) $documentIds[] = $cvId;
    if ($clId && !in_array($clId, $documentIds)) $documentIds[] = $clId;

    if (!$jobId) jsonResponse(['success' => false, 'message' => 'Job ID is required.'], 422);

    // Check job exists and is active
    $stmt = $pdo->prepare('SELECT id FROM jobs WHERE id = ? AND status = "active"');
    $stmt->execute([$jobId]);
    if (!$stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Job not found or no longer active.'], 404);
    }

    // Check for duplicate application
    $stmt = $pdo->prepare('SELECT id FROM applications WHERE job_id = ? AND user_id = ?');
    $stmt->execute([$jobId, $userId]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'You have already applied to this job.'], 409);
    }

    // Handle file uploads (multiple files via extra_files[])
    $allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    $allowedExts = ['pdf', 'doc', 'docx'];
    $attachmentAllowedMimes = array_merge($allowedMimes, ['image/jpeg', 'image/png']);
    $attachmentAllowedExts = array_merge($allowedExts, ['jpg', 'jpeg', 'png']);
    $maxFileSize = 5 * 1024 * 1024; // 5MB
    $uploadsDir = __DIR__ . '/../../uploads';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

    // Legacy single-file keys (cv_file, cl_file) + new multi-file key (extra_files)
    foreach (['cv_file', 'cl_file'] as $fileKey) {
        if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] === UPLOAD_ERR_NO_FILE) continue;

        $file = $_FILES[$fileKey];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['success' => false, 'message' => 'File upload error.'], 422);
        }
        if ($file['size'] > $maxFileSize) {
            jsonResponse(['success' => false, 'message' => 'File too large. Max 5MB.'], 422);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExts)) {
            jsonResponse(['success' => false, 'message' => 'Invalid file type. Allowed: PDF, DOC, DOCX.'], 422);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!in_array($mime, $allowedMimes)) {
            jsonResponse(['success' => false, 'message' => 'Invalid file content type.'], 422);
        }

        $docType = ($fileKey === 'cv_file') ? 'cv' : 'cl';
        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        $storedName = $docType . '_' . $userId . '_' . time() . '_' . $safeName . '.' . $ext;
        $destPath = $uploadsDir . '/' . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            jsonResponse(['success' => false, 'message' => 'Failed to save uploaded file.'], 500);
        }

        $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
        $fileData = json_encode(['uploaded_file' => $storedName, 'original_name' => $file['name'], 'mime_type' => $mime]);
        $stmt = $pdo->prepare('INSERT INTO documents (user_id, doc_type, name, data) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $docType, $originalName, $fileData]);
        $newDocId = (int)$pdo->lastInsertId();

        if ($docType === 'cv') $cvId = $newDocId;
        else $clId = $newDocId;
        $documentIds[] = $newDocId;
    }

    // Handle multiple extra file uploads
    if (isset($_FILES['extra_files'])) {
        $extraFiles = $_FILES['extra_files'];
        $fileCount = is_array($extraFiles['name']) ? count($extraFiles['name']) : 0;
        for ($i = 0; $i < $fileCount; $i++) {
            if ($extraFiles['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
            if ($extraFiles['error'][$i] !== UPLOAD_ERR_OK) {
                jsonResponse(['success' => false, 'message' => 'File upload error.'], 422);
            }
            if ($extraFiles['size'][$i] > $maxFileSize) {
                jsonResponse(['success' => false, 'message' => 'File "' . $extraFiles['name'][$i] . '" exceeds 5MB limit.'], 422);
            }

            $ext = strtolower(pathinfo($extraFiles['name'][$i], PATHINFO_EXTENSION));
            if (!in_array($ext, $attachmentAllowedExts)) {
                jsonResponse(['success' => false, 'message' => 'Invalid file type for "' . $extraFiles['name'][$i] . '". Allowed: PDF, DOC, DOCX, JPG, PNG.'], 422);
            }

            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($extraFiles['tmp_name'][$i]);
            if (!in_array($mime, $attachmentAllowedMimes)) {
                jsonResponse(['success' => false, 'message' => 'Invalid file content type for "' . $extraFiles['name'][$i] . '".'], 422);
            }

            $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($extraFiles['name'][$i], PATHINFO_FILENAME));
            $storedName = 'doc_' . $userId . '_' . time() . '_' . $i . '_' . $safeName . '.' . $ext;
            $destPath = $uploadsDir . '/' . $storedName;

            if (!move_uploaded_file($extraFiles['tmp_name'][$i], $destPath)) {
                jsonResponse(['success' => false, 'message' => 'Failed to save uploaded file.'], 500);
            }

            $originalName = pathinfo($extraFiles['name'][$i], PATHINFO_FILENAME);
            $fileData = json_encode(['uploaded_file' => $storedName, 'original_name' => $extraFiles['name'][$i], 'mime_type' => $mime, 'file_size' => (int)$extraFiles['size'][$i]]);
            $extraDocType = (!$cvId && in_array($ext, $allowedExts, true)) ? 'cv' : 'supporting';
            $stmt = $pdo->prepare('INSERT INTO documents (user_id, doc_type, name, data) VALUES (?, ?, ?, ?)');
            $stmt->execute([$userId, $extraDocType, $originalName, $fileData]);
            $newDocId = (int)$pdo->lastInsertId();

            // Use first uploaded file as cv_id if none set
            if ($extraDocType === 'cv') $cvId = $newDocId;
            $documentIds[] = $newDocId;
        }
    }

    $documentIdsJson = !empty($documentIds) ? json_encode(array_values(array_unique($documentIds))) : null;

    // Get applicant name
    $stmt = $pdo->prepare('SELECT first_name, last_name, email FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $applicantName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    $applicantEmail = $user['email'] ?? '';

    $stmt = $pdo->prepare('INSERT INTO applications (job_id, user_id, cv_id, cl_id, document_ids, applicant_name, note, form_responses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$jobId, $userId, $cvId ?: null, $clId ?: null, $documentIdsJson, $applicantName, $note, $formResponsesJson]);
    $appId = (int)$pdo->lastInsertId();

    // ── Send notification emails ──
    try {
        // Fetch job and recruiter info
        $stmt = $pdo->prepare('SELECT j.title, j.company, j.location, j.type, u.email AS recruiter_email, u.first_name AS recruiter_first FROM jobs j JOIN users u ON j.user_id = u.id WHERE j.id = ?');
        $stmt->execute([$jobId]);
        $jobInfo = $stmt->fetch();

        if ($jobInfo) {
            $jobTitle = htmlspecialchars($jobInfo['title'] ?? '', ENT_QUOTES);
            $jobCompany = htmlspecialchars($jobInfo['company'] ?? '', ENT_QUOTES);
            $jobLocation = htmlspecialchars($jobInfo['location'] ?? 'Not specified', ENT_QUOTES);
            $jobType = htmlspecialchars($jobInfo['type'] ?? 'Full-time', ENT_QUOTES);
            $recruiterEmail = $jobInfo['recruiter_email'];
            $recruiterFirst = htmlspecialchars($jobInfo['recruiter_first'] ?? 'Recruiter', ENT_QUOTES);
            $safeApplicantName = htmlspecialchars($applicantName ?: 'A candidate', ENT_QUOTES);

            $jobDetailsHtml = '
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;margin:20px 0;">
                    <tr>
                        <td style="padding:20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding:4px 0;font-size:14px;color:#64748B;width:120px;">Position</td>
                                    <td style="padding:4px 0;font-size:14px;font-weight:600;color:#1E293B;">' . $jobTitle . '</td>
                                </tr>
                                <tr>
                                    <td style="padding:4px 0;font-size:14px;color:#64748B;">Company</td>
                                    <td style="padding:4px 0;font-size:14px;font-weight:600;color:#1E293B;">' . $jobCompany . '</td>
                                </tr>
                                <tr>
                                    <td style="padding:4px 0;font-size:14px;color:#64748B;">Location</td>
                                    <td style="padding:4px 0;font-size:14px;color:#1E293B;">' . $jobLocation . '</td>
                                </tr>
                                <tr>
                                    <td style="padding:4px 0;font-size:14px;color:#64748B;">Type</td>
                                    <td style="padding:4px 0;font-size:14px;color:#1E293B;">' . $jobType . '</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>';

            // Email to candidate
            $candidateBody = '
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $safeApplicantName . ',</p>
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Great news — your application has been received! Here\'s a summary:</p>
                ' . $jobDetailsHtml . '
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 8px;"><strong>What happens next?</strong></p>
                <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;color:#475569;">
                    <li>The recruiter at <strong>' . $jobCompany . '</strong> will review your application</li>
                    <li>You\'ll receive an email when your application is viewed</li>
                    <li>You can track your application status anytime from your dashboard</li>
                </ul>
                <div style="text-align:center;margin:24px 0;">
                    <a href="' . APP_URL . '/dashboard.html" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                        View Application Status
                    </a>
                </div>
                <p style="font-size:14px;color:#94A3B8;margin:24px 0 0;">Good luck! 🍀</p>';

            if ($applicantEmail) {
                sendResendEmail($applicantEmail, 'Application Submitted — ' . ($jobInfo['title'] ?? 'Job'), buildEmailTemplate('Application Submitted ✓', $candidateBody));
            }

            // Email to recruiter
            $recruiterBody = '
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $recruiterFirst . ',</p>
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">You have a new application for your job posting:</p>
                ' . $jobDetailsHtml . '
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2FF;border-radius:12px;border:1px solid #C7D2FE;margin:20px 0;">
                    <tr>
                        <td style="padding:20px;">
                            <p style="margin:0 0 4px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Applicant</p>
                            <p style="margin:0;font-size:16px;font-weight:700;color:#1E293B;">' . $safeApplicantName . '</p>
                        </td>
                    </tr>
                </table>
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 24px;">Review the full application and attached documents on your <a href="' . APP_URL . '/recruiter-candidates.html" style="color:#4F46E5;font-weight:600;text-decoration:none;">candidates dashboard</a>.</p>';

            if ($recruiterEmail) {
                sendResendEmail($recruiterEmail, 'New Application — ' . $safeApplicantName . ' for ' . ($jobInfo['title'] ?? 'Job'), buildEmailTemplate('New Application Received', $recruiterBody));
            }
        }
    } catch (Throwable $e) {
        // Don't fail the application if email sending fails
        error_log('Application email error: ' . $e->getMessage());
    }

    jsonResponse(['success' => true, 'id' => $appId, 'message' => 'Application submitted!'], 201);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
