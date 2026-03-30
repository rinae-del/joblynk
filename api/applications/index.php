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
    $body = getJsonBody();

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

    // Get applicant name
    $stmt = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $applicantName = ($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '');

    $stmt = $pdo->prepare('INSERT INTO applications (job_id, user_id, cv_id, cl_id, applicant_name, note) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$jobId, $userId, $cvId ?: null, $clId ?: null, trim($applicantName), $note]);

    jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'message' => 'Application submitted!'], 201);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
