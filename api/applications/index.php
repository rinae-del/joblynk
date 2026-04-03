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

session_start();
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

    // Handle file uploads (CV and/or Cover Letter)
    $allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    $allowedExts = ['pdf', 'doc', 'docx'];
    $maxFileSize = 5 * 1024 * 1024; // 5MB
    $uploadsDir = __DIR__ . '/../../uploads';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

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

        // Verify MIME type
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

        // Create a document record for the uploaded file
        $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
        $fileData = json_encode(['uploaded_file' => $storedName, 'original_name' => $file['name'], 'mime_type' => $mime]);
        $stmt = $pdo->prepare('INSERT INTO documents (user_id, doc_type, name, data) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $docType, $originalName, $fileData]);
        $newDocId = (int)$pdo->lastInsertId();

        if ($docType === 'cv') $cvId = $newDocId;
        else $clId = $newDocId;
    }

    // Get applicant name
    $stmt = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $applicantName = ($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '');

    $stmt = $pdo->prepare('INSERT INTO applications (job_id, user_id, cv_id, cl_id, applicant_name, note, form_responses) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$jobId, $userId, $cvId ?: null, $clId ?: null, trim($applicantName), $note, $formResponsesJson]);

    jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'message' => 'Application submitted!'], 201);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
