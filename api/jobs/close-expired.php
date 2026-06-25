<?php
/**
 * Close expired jobs — run daily via cPanel cron:
 * php api/jobs/close-expired.php
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/job-schema.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    $secret = env('SYNC_SECRET', '');
    $provided = $_GET['secret'] ?? $_POST['secret'] ?? '';
    if ($secret === '' || !hash_equals($secret, (string) $provided)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
    header('Content-Type: application/json');
}

$pdo = getDB();
ensureJobsSchema($pdo);

$closedExpired = closeExpiredJobs($pdo);
$closedStale = closeStaleAggregatedJobs($pdo, 7);

$result = [
    'success' => true,
    'closed_expired' => $closedExpired,
    'closed_stale' => $closedStale,
    'closed_total' => $closedExpired + $closedStale,
];

if ($isCli) {
    echo json_encode($result) . PHP_EOL;
    exit(0);
}

echo json_encode($result);
