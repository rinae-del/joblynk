<?php
/**
 * Admin Jobs API
 * GET    /api/admin/jobs.php      List all jobs
 * DELETE /api/admin/jobs.php?id=X Delete a job listing
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('
        SELECT j.*, u.first_name, u.last_name, u.email,
               (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count
        FROM jobs j
        JOIN users u ON u.id = j.user_id
        ORDER BY j.created_at DESC
    ');

    jsonResponse([
        'success' => true,
        'jobs' => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ]);
}

if ($method === 'DELETE') {
    $jobId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$jobId) {
        jsonResponse(['success' => false, 'message' => 'Job ID is required.'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM jobs WHERE id = ?');
    $stmt->execute([$jobId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'Job not found.'], 404);
    }

    jsonResponse(['success' => true, 'message' => 'Job deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);