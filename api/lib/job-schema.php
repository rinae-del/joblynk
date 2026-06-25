<?php
/**
 * Shared jobs table schema migrations and normalization.
 */

function ensureJobSyncRunsSchema(PDO $pdo): void
{
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS job_sync_runs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                source VARCHAR(50) NOT NULL,
                status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
                jobs_fetched INT NOT NULL DEFAULT 0,
                jobs_upserted INT NOT NULL DEFAULT 0,
                jobs_closed INT NOT NULL DEFAULT 0,
                api_calls INT NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME NULL
            ) ENGINE=InnoDB
        ");
    } catch (Throwable $e) {
        error_log('job_sync_runs schema failed: ' . $e->getMessage());
    }
}

function ensureJobsSchema(PDO $pdo): array
{
    $columns = [];

    try {
        foreach ($pdo->query('SHOW COLUMNS FROM jobs') ?: [] as $column) {
            $columns[$column['Field']] = $column;
        }
    } catch (Throwable $e) {
        error_log('Jobs schema inspection failed: ' . $e->getMessage());
        return array_fill_keys([
            'title', 'job_reference', 'company', 'location', 'type',
            'description', 'requirements', 'skills', 'salary_from', 'salary_to',
            'salary_note', 'status', 'color', 'source',
        ], true);
    }

    $migrations = [
        'job_reference' => "ALTER TABLE jobs ADD COLUMN job_reference VARCHAR(100) DEFAULT '' AFTER title",
        'salary_period' => "ALTER TABLE jobs ADD COLUMN salary_period VARCHAR(50) DEFAULT 'Per Month' AFTER salary_to",
        'salary_note' => "ALTER TABLE jobs ADD COLUMN salary_note VARCHAR(255) DEFAULT '' AFTER salary_period",
        'benefits' => 'ALTER TABLE jobs ADD COLUMN benefits TEXT NULL AFTER salary_period',
        'closing_date' => 'ALTER TABLE jobs ADD COLUMN closing_date DATE NULL AFTER benefits',
        'custom_fields' => 'ALTER TABLE jobs ADD COLUMN custom_fields TEXT NULL AFTER closing_date',
        'hide_salary' => 'ALTER TABLE jobs ADD COLUMN hide_salary TINYINT(1) NOT NULL DEFAULT 0 AFTER salary_period',
        'color' => "ALTER TABLE jobs ADD COLUMN color VARCHAR(20) DEFAULT '#3B4BA6' AFTER status",
        'source' => "ALTER TABLE jobs ADD COLUMN source ENUM('native','adzuna','dpsa','careerjet') NOT NULL DEFAULT 'native' AFTER color",
        'external_id' => "ALTER TABLE jobs ADD COLUMN external_id VARCHAR(100) NULL AFTER source",
        'external_url' => "ALTER TABLE jobs ADD COLUMN external_url VARCHAR(500) NULL AFTER external_id",
        'apply_mode' => "ALTER TABLE jobs ADD COLUMN apply_mode ENUM('native','email_relay','external_completion') NOT NULL DEFAULT 'native' AFTER external_url",
        'apply_email' => "ALTER TABLE jobs ADD COLUMN apply_email VARCHAR(255) NULL AFTER apply_mode",
        'source_payload' => 'ALTER TABLE jobs ADD COLUMN source_payload JSON NULL AFTER apply_email',
        'last_seen_at' => 'ALTER TABLE jobs ADD COLUMN last_seen_at DATETIME NULL AFTER source_payload',
        'synced_at' => 'ALTER TABLE jobs ADD COLUMN synced_at DATETIME NULL AFTER last_seen_at',
    ];

    foreach ($migrations as $field => $sql) {
        if (isset($columns[$field])) {
            continue;
        }

        try {
            $pdo->exec($sql);
            $columns[$field] = ['Field' => $field];
        } catch (Throwable $e) {
            error_log('Jobs schema migration skipped for ' . $field . ': ' . $e->getMessage());
        }
    }

    ensureJobsSourceIndex($pdo);
    ensureJobSyncRunsSchema($pdo);

    return $columns;
}

function ensureJobsSourceIndex(PDO $pdo): void
{
    try {
        $indexes = $pdo->query("SHOW INDEX FROM jobs WHERE Key_name = 'uq_jobs_source_external'")->fetchAll();
        if (!$indexes) {
            $pdo->exec('ALTER TABLE jobs ADD UNIQUE KEY uq_jobs_source_external (source, external_id)');
        }
    } catch (Throwable $e) {
        error_log('Jobs source index migration skipped: ' . $e->getMessage());
    }

    try {
        $indexes = $pdo->query("SHOW INDEX FROM jobs WHERE Key_name = 'idx_jobs_status_seen'")->fetchAll();
        if (!$indexes) {
            $pdo->exec('ALTER TABLE jobs ADD INDEX idx_jobs_status_seen (status, last_seen_at)');
        }
    } catch (Throwable $e) {
        error_log('Jobs status_seen index migration skipped: ' . $e->getMessage());
    }
}

function normalizeJobRow(array &$job): void
{
    $job['job_reference'] = $job['job_reference'] ?? '';
    $job['benefits'] = json_decode($job['benefits'] ?? '[]', true) ?: [];
    $job['custom_fields'] = json_decode($job['custom_fields'] ?? '[]', true) ?: [];
    $job['hide_salary'] = (int) ($job['hide_salary'] ?? 0);
    $job['salary_period'] = $job['salary_period'] ?? 'Per Month';
    $job['salary_note'] = $job['salary_note'] ?? '';
    $job['closing_date'] = $job['closing_date'] ?? null;
    $job['company_logo_url'] = trim((string) ($job['company_logo_url'] ?? ''));
    $job['source'] = $job['source'] ?? 'native';
    $job['external_id'] = $job['external_id'] ?? null;
    $job['external_url'] = $job['external_url'] ?? null;
    $job['apply_mode'] = $job['apply_mode'] ?? 'native';
    $job['apply_email'] = $job['apply_email'] ?? null;
    $job['last_seen_at'] = $job['last_seen_at'] ?? null;
    $job['synced_at'] = $job['synced_at'] ?? null;

    if (isset($job['source_payload']) && is_string($job['source_payload'])) {
        $job['source_payload'] = json_decode($job['source_payload'], true) ?: null;
    }

    if (strcasecmp(trim((string) ($job['company'] ?? '')), 'Confidential') === 0) {
        $job['company_logo_url'] = '';
    }
}

function closeExpiredJobs(PDO $pdo): int
{
    $closed = 0;

    try {
        $stmt = $pdo->exec("
            UPDATE jobs
            SET status = 'closed', updated_at = NOW()
            WHERE status = 'active'
              AND closing_date IS NOT NULL
              AND closing_date < CURDATE()
        ");
        $closed += (int) $stmt;
    } catch (Throwable $e) {
        error_log('closeExpiredJobs (closing_date) failed: ' . $e->getMessage());
    }

    return $closed;
}

function closeStaleAggregatedJobs(PDO $pdo, int $staleDays = 7): int
{
    try {
        $stmt = $pdo->prepare("
            UPDATE jobs
            SET status = 'closed', updated_at = NOW()
            WHERE status = 'active'
              AND source != 'native'
              AND last_seen_at IS NOT NULL
              AND last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        ");
        $stmt->execute([$staleDays]);
        return (int) $stmt->rowCount();
    } catch (Throwable $e) {
        error_log('closeStaleAggregatedJobs failed: ' . $e->getMessage());
        return 0;
    }
}
