<?php
/**
 * Adzuna weekly job refresh — CLI entrypoint (optional).
 *
 *   php api/jobs/sync-adzuna.php
 *
 * Recommended: use Admin → Job Listings → "Refresh job feed (weekly)" instead.
 * Optional HTTP (cron): GET/POST with ?secret=SYNC_SECRET if configured.
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/adzuna-sync.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: application/json');
    // HTTP access requires a configured secret. Without one, this endpoint is
    // CLI-only (use the Admin → "Refresh job feed" button, which is auth-gated).
    $secret = env('SYNC_SECRET', '');
    if ($secret === '') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'This endpoint is disabled over HTTP. Set SYNC_SECRET to enable cron access.']);
        exit;
    }
    $provided = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_SYNC_SECRET'] ?? '');
    if (!hash_equals($secret, (string) $provided)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
}

$pdo = getDB();
$result = runAdzunaWeeklyRefresh($pdo);

if ($isCli) {
    echo ($result['success'] ? 'OK: ' : 'FAILED: ') . json_encode($result) . PHP_EOL;
    exit($result['success'] ? 0 : 1);
}

echo json_encode($result);
