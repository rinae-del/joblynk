<?php
/**
 * Adzuna job sync — run via cPanel cron or CLI:
 * php api/jobs/sync-adzuna.php
 *
 * Optional HTTP trigger (admin/cron): GET/POST with ?secret=SYNC_SECRET
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/job-schema.php';
require_once __DIR__ . '/../lib/adzuna-client.php';
require_once __DIR__ . '/../lib/job-ingest.php';
require_once __DIR__ . '/../lib/system-user.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    $secret = env('SYNC_SECRET', '');
    $provided = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_SYNC_SECRET'] ?? '');
    if ($secret === '' || !hash_equals($secret, (string) $provided)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
    header('Content-Type: application/json');
}

if (!filter_var(env('JOBS_SYNC_ENABLED', '1'), FILTER_VALIDATE_BOOLEAN)) {
    $msg = ['success' => false, 'message' => 'Job sync is disabled.'];
    if ($isCli) {
        fwrite(STDERR, $msg['message'] . PHP_EOL);
        exit(0);
    }
    echo json_encode($msg);
    exit;
}

$pdo = getDB();
ensureJobsSchema($pdo);

$client = new AdzunaClient();
if (!$client->isConfigured()) {
    $msg = ['success' => false, 'message' => 'Adzuna credentials not configured.'];
    if ($isCli) {
        fwrite(STDERR, $msg['message'] . PHP_EOL);
        exit(1);
    }
    echo json_encode($msg);
    exit;
}

$runId = startSyncRun($pdo, 'adzuna');
$systemUserId = getSystemUserId($pdo);
$stats = ['jobs_fetched' => 0, 'jobs_upserted' => 0, 'jobs_closed' => 0, 'api_calls' => 0];
$error = null;

try {
    $queries = adzunaDefaultSyncQueries();
    $maxPagesPerQuery = 1;

    foreach ($queries as $queryParams) {
        for ($page = 1; $page <= $maxPagesPerQuery; $page++) {
            $response = $client->search(array_merge($queryParams, ['page' => $page]));
            $stats['api_calls'] = $client->getRequestCount();
            $results = $response['results'] ?? [];
            $stats['jobs_fetched'] += count($results);

            foreach ($results as $ad) {
                if (empty($ad['id'])) {
                    continue;
                }
                $row = mapAdzunaJobToRow($ad, $systemUserId);
                if (upsertExternalJob($pdo, $row)) {
                    $stats['jobs_upserted']++;
                }
            }

            if (count($results) < 50) {
                break;
            }
        }
    }

    $stats['jobs_closed'] += closeExpiredJobs($pdo);
    $stats['jobs_closed'] += closeStaleAggregatedJobs($pdo, 7);
    finishSyncRun($pdo, $runId, $stats);
} catch (Throwable $e) {
    $error = $e->getMessage();
    error_log('Adzuna sync failed: ' . $error);
    finishSyncRun($pdo, $runId, $stats, $error);
}

$result = [
    'success' => $error === null,
    'message' => $error ?? 'Adzuna sync completed.',
    'stats' => $stats,
];

if ($isCli) {
    echo ($error ? 'FAILED: ' : 'OK: ') . json_encode($result) . PHP_EOL;
    exit($error ? 1 : 0);
}

echo json_encode($result);
