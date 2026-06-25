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
    $secret = env('SYNC_SECRET', '');
    if ($secret !== '') {
        $provided = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_SYNC_SECRET'] ?? '');
        if (!hash_equals($secret, (string) $provided)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Forbidden.']);
            exit;
        }
    }
    header('Content-Type: application/json');
}

$pdo = getDB();
$result = runAdzunaWeeklyRefresh($pdo);

if ($isCli) {
    echo ($result['success'] ? 'OK: ' : 'FAILED: ') . json_encode($result) . PHP_EOL;
    exit($result['success'] ? 0 : 1);
}

echo json_encode($result);
