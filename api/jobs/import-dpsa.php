<?php
/**
 * DPSA vacancy circular JSON import (admin upload).
 *
 * POST JSON body: { "jobs": [ { "title", "department", "centre", "requirements", "duties", "closing_date", "apply_email", "reference" } ] }
 * Or: { "circular_name": "...", "jobs": [...] }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../lib/job-schema.php';
require_once __DIR__ . '/../lib/job-ingest.php';
require_once __DIR__ . '/../lib/system-user.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$pdo = getDB();
ensureJobsSchema($pdo);

$body = getJsonBody();
$jobs = $body['jobs'] ?? $body;

if (!is_array($jobs)) {
    jsonResponse(['success' => false, 'message' => 'Expected a jobs array.'], 422);
}

// Support wrapped circular format
if (isset($jobs['jobs']) && is_array($jobs['jobs'])) {
    $jobs = $jobs['jobs'];
}

if (empty($jobs)) {
    jsonResponse(['success' => false, 'message' => 'No jobs to import.'], 422);
}

$systemUserId = getSystemUserId($pdo);
$imported = 0;
$skipped = 0;

foreach ($jobs as $job) {
    if (!is_array($job)) {
        $skipped++;
        continue;
    }
    $row = mapDpsaJobToRow($job, $systemUserId);
    if (($row['title'] ?? '') === '' || ($row['external_id'] ?? '') === '') {
        $skipped++;
        continue;
    }
    if (upsertExternalJob($pdo, $row)) {
        $imported++;
    }
}

closeExpiredJobs($pdo);

jsonResponse([
    'success' => true,
    'message' => "Imported {$imported} DPSA vacancies.",
    'imported' => $imported,
    'skipped' => $skipped,
]);
