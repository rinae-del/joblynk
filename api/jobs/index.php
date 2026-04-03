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

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

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
        $stmt = $pdo->prepare('SELECT id FROM jobs WHERE id = ? AND user_id = ?');
        $stmt->execute([$jobId, $userId]);
        if (!$stmt->fetch()) jsonResponse(['success' => false, 'message' => 'Job not found or not authorized.'], 404);

        $stmt = $pdo->prepare('UPDATE jobs SET title=?, company=?, location=?, type=?, description=?, requirements=?, skills=?, salary_from=?, salary_to=?, salary_period=?, benefits=?, closing_date=?, custom_fields=?, status=?, color=? WHERE id=? AND user_id=?');
        $stmt->execute([$title, $company, $location, $type, $description, $requirements, $skills, $salaryFrom, $salaryTo, $salaryPeriod, $benefitsJson, $closingDate ?: null, $customFieldsJson, $status, $color, $jobId, $userId]);

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

    $stmt = $pdo->prepare('INSERT INTO jobs (user_id, title, company, location, type, description, requirements, skills, salary_from, salary_to, salary_period, benefits, closing_date, custom_fields, status, color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$userId, $title, $company, $location, $type, $description, $requirements, $skills, $salaryFrom, $salaryTo, $salaryPeriod, $benefitsJson, $closingDate ?: null, $customFieldsJson, $status, $color]);
    $newId = (int)$pdo->lastInsertId();

    // Decrement credit (recruiter only)
    if ($userRole === 'recruiter' && isset($credit)) {
        $stmt = $pdo->prepare('UPDATE job_credits SET used_credits = used_credits + 1 WHERE id = ?');
        $stmt->execute([$credit['id']]);
    }

    jsonResponse(['success' => true, 'id' => $newId, 'message' => 'Job posted.'], 201);
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
