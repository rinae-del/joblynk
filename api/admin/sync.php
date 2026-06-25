<?php
/**
 * Admin job sync status and manual trigger.
 *
 * GET  — last sync runs + counts by source
 * POST — trigger sync (action: adzuna | close_expired)
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../lib/job-schema.php';

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
            LIMIT 20
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

    jsonResponse([
        'success' => true,
        'sync_enabled' => filter_var(env('JOBS_SYNC_ENABLED', '1'), FILTER_VALIDATE_BOOLEAN),
        'adzuna_configured' => env('ADZUNA_APP_ID', '') !== '' && env('ADZUNA_APP_KEY', '') !== '',
        'runs' => $runs,
        'source_counts' => $sourceCounts,
    ]);
}

if ($method === 'POST') {
    $body = getJsonBody();
    $action = $body['action'] ?? 'adzuna';

    if ($action === 'close_expired') {
        require_once __DIR__ . '/../lib/job-schema.php';
        $closedExpired = closeExpiredJobs($pdo);
        $closedStale = closeStaleAggregatedJobs($pdo, 7);
        jsonResponse([
            'success' => true,
            'message' => 'Expired jobs closed.',
            'closed_expired' => $closedExpired,
            'closed_stale' => $closedStale,
        ]);
    }

    if ($action === 'adzuna') {
        $secret = env('SYNC_SECRET', '');
        if ($secret === '') {
            jsonResponse(['success' => false, 'message' => 'SYNC_SECRET is not configured on the server.'], 500);
        }

        $syncUrl = rtrim(APP_URL, '/') . '/api/jobs/sync-adzuna.php?secret=' . urlencode($secret);
        $ch = curl_init($syncUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_HTTPHEADER => ['X-Sync-Secret: ' . $secret],
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode((string) $response, true);
        if ($httpCode >= 400 || !is_array($data)) {
            jsonResponse([
                'success' => false,
                'message' => 'Sync trigger failed.',
                'http_code' => $httpCode,
                'raw' => substr((string) $response, 0, 500),
            ], 500);
        }

        jsonResponse($data);
    }

    jsonResponse(['success' => false, 'message' => 'Unknown action.'], 422);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
