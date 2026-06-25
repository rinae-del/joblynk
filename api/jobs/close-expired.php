<?php
/**
 * Close jobs past closing_date — optional manual housekeeping.
 * Weekly refresh already runs this automatically.
 *
 *   php api/jobs/close-expired.php
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/job-schema.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Use Admin → Job Listings to manage jobs.']);
    exit;
}

$pdo = getDB();
ensureJobsSchema($pdo);

$closedExpired = closeExpiredJobs($pdo);

$result = [
    'success' => true,
    'closed_expired' => $closedExpired,
    'closed_total' => $closedExpired,
];

echo json_encode($result) . PHP_EOL;
