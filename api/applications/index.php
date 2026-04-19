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
    $stmt = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $applicantName = ($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '');

    $stmt = $pdo->prepare('INSERT INTO applications (job_id, user_id, cv_id, cl_id, document_ids, applicant_name, note, form_responses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$jobId, $userId, $cvId ?: null, $clId ?: null, $documentIdsJson, trim($applicantName), $note, $formResponsesJson]);

    jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'message' => 'Application submitted!'], 201);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
