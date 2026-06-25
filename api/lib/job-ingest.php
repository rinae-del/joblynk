<?php
/**
 * Upsert external job listings into the jobs table.
 */

require_once __DIR__ . '/job-schema.php';
require_once __DIR__ . '/system-user.php';

function mapAdzunaJobToRow(array $ad, int $systemUserId): array
{
    $contractTime = strtolower((string) ($ad['contract_time'] ?? ''));
    $type = 'Full-time';
    if ($contractTime === 'part_time') {
        $type = 'Part-time';
    } elseif (!empty($ad['contract_type']) && strtolower((string) $ad['contract_type']) === 'contract') {
        $type = 'Contract';
    }

    $salaryMin = isset($ad['salary_min']) && $ad['salary_min'] > 0 ? (string) (int) $ad['salary_min'] : '';
    $salaryMax = isset($ad['salary_max']) && $ad['salary_max'] > 0 ? (string) (int) $ad['salary_max'] : '';

    $location = '';
    if (!empty($ad['location']['display_name'])) {
        $location = (string) $ad['location']['display_name'];
    }

    $company = '';
    if (!empty($ad['company']['display_name'])) {
        $company = (string) $ad['company']['display_name'];
    }
    if ($company === '') {
        $company = 'Confidential';
    }

    $createdAt = null;
    if (!empty($ad['created'])) {
        $ts = strtotime((string) $ad['created']);
        if ($ts) {
            $createdAt = date('Y-m-d H:i:s', $ts);
        }
    }

    return [
        'user_id' => $systemUserId,
        'title' => trim((string) ($ad['title'] ?? 'Untitled role')),
        'company' => $company,
        'location' => $location,
        'type' => $type,
        'description' => trim((string) ($ad['description'] ?? '')),
        'requirements' => '',
        'skills' => '',
        'salary_from' => $salaryMin,
        'salary_to' => $salaryMax,
        'salary_period' => 'Per Year',
        'salary_note' => $salaryMin || $salaryMax ? 'Annual (ZAR)' : '',
        'hide_salary' => ($salaryMin === '' && $salaryMax === '') ? 1 : 0,
        'benefits' => '[]',
        'closing_date' => null,
        'custom_fields' => '[]',
        'status' => 'active',
        'source' => 'adzuna',
        'external_id' => (string) ($ad['id'] ?? ''),
        'external_url' => trim((string) ($ad['redirect_url'] ?? '')),
        'apply_mode' => 'external_completion',
        'apply_email' => null,
        'source_payload' => json_encode($ad),
        'created_at' => $createdAt,
    ];
}

function mapDpsaJobToRow(array $job, int $systemUserId): array
{
    $reference = trim((string) ($job['reference'] ?? $job['post_reference'] ?? $job['ref'] ?? ''));
    $title = trim((string) ($job['title'] ?? $job['post_title'] ?? 'Government vacancy'));
    $company = trim((string) ($job['department'] ?? $job['company'] ?? 'Government of South Africa'));
    $location = trim((string) ($job['centre'] ?? $job['location'] ?? ''));
    $description = trim((string) ($job['duties'] ?? $job['description'] ?? ''));
    $requirements = trim((string) ($job['requirements'] ?? $job['minimum_requirements'] ?? ''));
    $applyEmail = trim((string) ($job['apply_email'] ?? $job['email'] ?? ''));
    $closingDate = null;

    $closingRaw = $job['closing_date'] ?? $job['closingDate'] ?? null;
    if ($closingRaw) {
        $ts = strtotime((string) $closingRaw);
        if ($ts) {
            $closingDate = date('Y-m-d', $ts);
        }
    }

    $externalId = $reference !== '' ? $reference : md5($title . '|' . $company . '|' . $location . '|' . ($closingDate ?? ''));

    return [
        'user_id' => $systemUserId,
        'title' => $title,
        'job_reference' => $reference,
        'company' => $company !== '' ? $company : 'Government of South Africa',
        'location' => $location,
        'type' => trim((string) ($job['type'] ?? 'Full-time')) ?: 'Full-time',
        'description' => $description,
        'requirements' => $requirements,
        'skills' => '',
        'salary_from' => trim((string) ($job['salary_from'] ?? $job['salary_level'] ?? '')),
        'salary_to' => trim((string) ($job['salary_to'] ?? '')),
        'salary_period' => 'Per Month',
        'salary_note' => trim((string) ($job['salary_note'] ?? '')),
        'hide_salary' => empty($job['salary_from']) && empty($job['salary_to']) && empty($job['salary_level']) ? 1 : 0,
        'benefits' => '[]',
        'closing_date' => $closingDate,
        'custom_fields' => '[]',
        'status' => 'active',
        'source' => 'dpsa',
        'external_id' => $externalId,
        'external_url' => trim((string) ($job['external_url'] ?? '')),
        'apply_mode' => $applyEmail !== '' ? 'email_relay' : 'external_completion',
        'apply_email' => $applyEmail !== '' ? $applyEmail : null,
        'source_payload' => json_encode($job),
        'created_at' => null,
    ];
}

function upsertExternalJob(PDO $pdo, array $row): bool
{
    if (($row['external_id'] ?? '') === '') {
        return false;
    }

    $source = $row['source'] ?? 'adzuna';
    $now = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare('SELECT id, created_at FROM jobs WHERE source = ? AND external_id = ? LIMIT 1');
    $stmt->execute([$source, $row['external_id']]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        $stmt = $pdo->prepare('
            UPDATE jobs SET
                title = ?, company = ?, location = ?, type = ?,
                description = ?, requirements = ?, skills = ?,
                salary_from = ?, salary_to = ?, salary_period = ?, salary_note = ?, hide_salary = ?,
                benefits = ?, closing_date = ?, job_reference = COALESCE(NULLIF(?, ""), job_reference),
                status = "active", external_url = ?, apply_mode = ?, apply_email = ?,
                source_payload = ?, last_seen_at = ?, synced_at = ?, updated_at = NOW()
            WHERE id = ?
        ');
        $stmt->execute([
            $row['title'],
            $row['company'],
            $row['location'],
            $row['type'],
            $row['description'],
            $row['requirements'] ?? '',
            $row['skills'] ?? '',
            $row['salary_from'] ?? '',
            $row['salary_to'] ?? '',
            $row['salary_period'] ?? 'Per Month',
            $row['salary_note'] ?? '',
            (int) ($row['hide_salary'] ?? 0),
            $row['benefits'] ?? '[]',
            $row['closing_date'] ?? null,
            $row['job_reference'] ?? '',
            $row['external_url'] ?? '',
            $row['apply_mode'] ?? 'external_completion',
            $row['apply_email'] ?? null,
            $row['source_payload'] ?? null,
            $now,
            $now,
            $existing['id'],
        ]);
        return true;
    }

    $colors = ['#DC2626', '#2563EB', '#059669', '#7C3AED', '#D97706', '#EC4899'];
    $cnt = (int) $pdo->query('SELECT COUNT(*) FROM jobs')->fetchColumn();
    $color = $colors[$cnt % count($colors)];

    $createdAt = $row['created_at'] ?? $now;

    $stmt = $pdo->prepare('
        INSERT INTO jobs (
            user_id, title, job_reference, company, location, type,
            description, requirements, skills,
            salary_from, salary_to, salary_period, salary_note, hide_salary,
            benefits, closing_date, custom_fields, status, color,
            source, external_id, external_url, apply_mode, apply_email,
            source_payload, last_seen_at, synced_at, created_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, "active", ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
    ');

    $stmt->execute([
        $row['user_id'],
        $row['title'],
        $row['job_reference'] ?? '',
        $row['company'],
        $row['location'],
        $row['type'],
        $row['description'],
        $row['requirements'] ?? '',
        $row['skills'] ?? '',
        $row['salary_from'] ?? '',
        $row['salary_to'] ?? '',
        $row['salary_period'] ?? 'Per Month',
        $row['salary_note'] ?? '',
        (int) ($row['hide_salary'] ?? 0),
        $row['benefits'] ?? '[]',
        $row['closing_date'] ?? null,
        $row['custom_fields'] ?? '[]',
        $color,
        $source,
        $row['external_id'],
        $row['external_url'] ?? '',
        $row['apply_mode'] ?? 'external_completion',
        $row['apply_email'] ?? null,
        $row['source_payload'] ?? null,
        $now,
        $now,
        $createdAt,
    ]);

    return true;
}

function startSyncRun(PDO $pdo, string $source): int
{
    $stmt = $pdo->prepare('INSERT INTO job_sync_runs (source, status) VALUES (?, "running")');
    $stmt->execute([$source]);
    return (int) $pdo->lastInsertId();
}

function finishSyncRun(PDO $pdo, int $runId, array $stats, ?string $error = null): void
{
    $status = $error ? 'failed' : 'success';
    $stmt = $pdo->prepare('
        UPDATE job_sync_runs SET
            status = ?, jobs_fetched = ?, jobs_upserted = ?, jobs_closed = ?,
            api_calls = ?, error_message = ?, finished_at = NOW()
        WHERE id = ?
    ');
    $stmt->execute([
        $status,
        (int) ($stats['jobs_fetched'] ?? 0),
        (int) ($stats['jobs_upserted'] ?? 0),
        (int) ($stats['jobs_closed'] ?? 0),
        (int) ($stats['api_calls'] ?? 0),
        $error,
        $runId,
    ]);
}
