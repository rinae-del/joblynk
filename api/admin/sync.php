<?php
/**
 * Admin job feed refresh — status and weekly trigger.
 *
 * GET  — last refresh runs + counts by source
 * POST — action: refresh (default) | close_expired
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../lib/job-schema.php';
require_once __DIR__ . '/../lib/adzuna-sync.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

$pdo = getDB();
ensureJobsSchema($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $runs = [];
    try {
        $stmt = $pdo->query('
            SELECT id, source, status, jobs_fetched, jobs_upserted, jobs_closed, api_calls,
                   error_message, started_at, finished_at
            FROM job_sync_runs
            ORDER BY started_at DESC
            LIMIT 10
        ');
        $runs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        error_log('Sync runs fetch failed: ' . $e->getMessage());
    }

    $sourceCounts = [];
    try {
        $stmt = $pdo->query('
            SELECT source, status, COUNT(*) AS cnt
            FROM jobs
            GROUP BY source, status
        ');
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $source = $row['source'] ?? 'native';
            if (!isset($sourceCounts[$source])) {
                $sourceCounts[$source] = ['active' => 0, 'closed' => 0, 'draft' => 0, 'total' => 0];
            }
            $status = $row['status'] ?? 'active';
            $cnt = (int) ($row['cnt'] ?? 0);
            $sourceCounts[$source][$status] = $cnt;
            $sourceCounts[$source]['total'] += $cnt;
        }
    } catch (Throwable $e) {
        error_log('Source counts failed: ' . $e->getMessage());
    }

    $lastSuccess = null;
    foreach ($runs as $run) {
        if (($run['status'] ?? '') === 'success') {
            $lastSuccess = $run;
            break;
        }
    }

    jsonResponse([
        'success' => true,
        'sync_enabled' => filter_var(env('JOBS_SYNC_ENABLED', '1'), FILTER_VALIDATE_BOOLEAN),
        'adzuna_configured' => env('ADZUNA_APP_ID', '') !== '' && env('ADZUNA_APP_KEY', '') !== '',
        'last_refresh' => $lastSuccess,
        'runs' => $runs,
        'source_counts' => $sourceCounts,
    ]);
}

if ($method === 'POST') {
    $body = getJsonBody();
    $action = $body['action'] ?? 'refresh';

    if ($action === 'close_expired') {
        $closedExpired = closeExpiredJobs($pdo);
        jsonResponse([
            'success' => true,
            'message' => "Closed {$closedExpired} job(s) past their closing date.",
            'closed_expired' => $closedExpired,
        ]);
    }

    if ($action === 'refresh' || $action === 'adzuna') {
        $result = runAdzunaWeeklyRefresh($pdo);
        jsonResponse($result, $result['success'] ? 200 : 500);
    }

    jsonResponse(['success' => false, 'message' => 'Unknown action.'], 422);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
