<?php
/**
 * Admin Applications API
 * GET /api/admin/applications.php
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$pdo = getDB();

$stmt = $pdo->query('
    SELECT a.*, u.first_name, u.last_name, u.email,
           j.title AS job_title, j.company AS job_company, j.color AS job_color,
           recruiter.first_name AS recruiter_first_name, recruiter.last_name AS recruiter_last_name,
           d_cv.name AS cv_name, d_cl.name AS cl_name
    FROM applications a
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON a.job_id = j.id
    JOIN users recruiter ON j.user_id = recruiter.id
    LEFT JOIN documents d_cv ON a.cv_id = d_cv.id
    LEFT JOIN documents d_cl ON a.cl_id = d_cl.id
    ORDER BY a.created_at DESC
');

jsonResponse([
    'success' => true,
    'applications' => $stmt->fetchAll(PDO::FETCH_ASSOC),
]);