<?php
/**
 * Weekly Adzuna job refresh — bulk import + close jobs not seen in this run.
 */

require_once __DIR__ . '/job-schema.php';
require_once __DIR__ . '/adzuna-client.php';
require_once __DIR__ . '/job-ingest.php';
require_once __DIR__ . '/system-user.php';
require_once __DIR__ . '/../config/env.php';

/**
 * Run a full weekly refresh: fetch up to ADZUNA_MAX_API_CALLS listings, then close
 * Adzuna jobs that were not touched during this run.
 *
 * @return array{success: bool, message: string, stats: array<string, int>}
 */
function runAdzunaWeeklyRefresh(PDO $pdo): array
{
    if (!filter_var(env('JOBS_SYNC_ENABLED', '1'), FILTER_VALIDATE_BOOLEAN)) {
        return [
            'success' => false,
            'message' => 'Job refresh is disabled.',
            'stats' => [],
        ];
    }

    $client = new AdzunaClient();
    if (!$client->isConfigured()) {
        return [
            'success' => false,
            'message' => 'Adzuna credentials not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to .env.',
            'stats' => [],
        ];
    }

    @set_time_limit(900);
    @ini_set('max_execution_time', '900');

    ensureJobsSchema($pdo);

    $maxApiCalls = max(10, min(250, (int) env('ADZUNA_MAX_API_CALLS', '180')));
    $maxPagesPerQuery = max(1, min(20, (int) env('ADZUNA_MAX_PAGES_PER_QUERY', '5')));

    $refreshStartedAt = date('Y-m-d H:i:s');
    $runId = startSyncRun($pdo, 'adzuna');
    $systemUserId = getSystemUserId($pdo);

    $stats = [
        'jobs_fetched' => 0,
        'jobs_upserted' => 0,
        'jobs_closed' => 0,
        'api_calls' => 0,
        'unique_jobs' => 0,
    ];
    $seenExternalIds = [];
    $error = null;

    try {
        $queries = adzunaWeeklySyncQueries();

        foreach ($queries as $queryParams) {
            if ($client->getRequestCount() >= $maxApiCalls) {
                break;
            }

            for ($page = 1; $page <= $maxPagesPerQuery; $page++) {
                if ($client->getRequestCount() >= $maxApiCalls) {
                    break 2;
                }

                $response = $client->search(array_merge($queryParams, [
                    'page' => $page,
                    'results_per_page' => 50,
                ]));

                $stats['api_calls'] = $client->getRequestCount();
                $results = $response['results'] ?? [];

                if ($results === []) {
                    break;
                }

                $stats['jobs_fetched'] += count($results);

                foreach ($results as $ad) {
                    if (empty($ad['id'])) {
                        continue;
                    }

                    $externalId = (string) $ad['id'];
                    $row = mapAdzunaJobToRow($ad, $systemUserId);

                    if (upsertExternalJob($pdo, $row)) {
                        $stats['jobs_upserted']++;
                        if (!isset($seenExternalIds[$externalId])) {
                            $seenExternalIds[$externalId] = true;
                        }
                    }
                }

                if (count($results) < 50) {
                    break;
                }
            }
        }

        $stats['unique_jobs'] = count($seenExternalIds);
        $stats['jobs_closed'] += closeExpiredJobs($pdo);
        $stats['jobs_closed'] += closeAggregatedJobsNotSeenSince($pdo, $refreshStartedAt, 'adzuna');

        finishSyncRun($pdo, $runId, $stats);
    } catch (Throwable $e) {
        $error = $e->getMessage();
        error_log('Adzuna weekly refresh failed: ' . $error);
        finishSyncRun($pdo, $runId, $stats, $error);
    }

    $activeAdzuna = 0;
    try {
        $activeAdzuna = (int) $pdo->query("SELECT COUNT(*) FROM jobs WHERE source = 'adzuna' AND status = 'active'")->fetchColumn();
    } catch (Throwable $e) {
        error_log('Active Adzuna count failed: ' . $e->getMessage());
    }

    if ($error !== null) {
        return [
            'success' => false,
            'message' => 'Refresh failed: ' . $error,
            'stats' => $stats,
            'active_adzuna' => $activeAdzuna,
        ];
    }

    return [
        'success' => true,
        'message' => sprintf(
            'Weekly refresh complete. %d unique jobs imported, %d API calls used, %d active Adzuna listings, %d closed.',
            $stats['unique_jobs'],
            $stats['api_calls'],
            $activeAdzuna,
            $stats['jobs_closed']
        ),
        'stats' => $stats,
        'active_adzuna' => $activeAdzuna,
    ];
}
