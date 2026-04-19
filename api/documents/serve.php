<?php
/**
 * /api/documents/serve.php
 * Serve uploaded document files (PDF, DOC, DOCX).
 * 
 * GET ?id=123                         — Owner: serve own uploaded document
 * GET ?id=123&application_id=456      — Recruiter: serve applicant's uploaded document
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit('Not authenticated.');
}

$userId = $_SESSION['user_id'];
$userRole = $_SESSION['user_role'] ?? 'job_seeker';
$pdo = getDB();

$docId = $_GET['id'] ?? null;
$appId = $_GET['application_id'] ?? null;

if (!$docId) {
    http_response_code(400);
    exit('Document ID required.');
}

$doc = null;

// Recruiter access via application
if ($appId && ($userRole === 'recruiter' || $userRole === 'admin')) {
    $stmt = $pdo->prepare('
        SELECT a.cv_id, a.cl_id, a.document_ids FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = ? AND j.user_id = ?
    ');
    $stmt->execute([$appId, $userId]);
    $application = $stmt->fetch();

    if (!$application) {
        http_response_code(404);
        exit('Application not found or not authorized.');
    }

    $applicationDocIds = json_decode($application['document_ids'] ?? '[]', true);
    if (!is_array($applicationDocIds)) {
        $applicationDocIds = [];
    }

    $allowedDocIds = array_values(array_unique(array_map('intval', array_merge(
        [$application['cv_id'] ?? null, $application['cl_id'] ?? null],
        $applicationDocIds
    ))));

    if (!in_array((int)$docId, $allowedDocIds, true)) {
        http_response_code(403);
        exit('Document does not belong to this application.');
    }

    $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
} else {
    // Owner access
    $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?');
    $stmt->execute([$docId, $userId]);
    $doc = $stmt->fetch();
}

if (!$doc) {
    http_response_code(404);
    exit('Document not found.');
}

$data = json_decode($doc['data'], true);
if (!isset($data['uploaded_file'])) {
    http_response_code(400);
    exit('This document has no uploaded file.');
}

$uploadsDir = __DIR__ . '/../../uploads';
$filePath = $uploadsDir . '/' . basename($data['uploaded_file']);

if (!file_exists($filePath)) {
    http_response_code(404);
    exit('File not found on server.');
}

$mime = $data['mime_type'] ?? 'application/octet-stream';
$originalName = $data['original_name'] ?? $data['uploaded_file'];

header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="' . addslashes($originalName) . '"');
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: private, max-age=3600');

readfile($filePath);
exit;
