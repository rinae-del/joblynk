<?php
/**
 * Shared batch logic for reminder + recommendation emails.
 * Called by the cron scripts (api/cron/*) and the admin panel (api/admin/email.php),
 * so there is a single source of truth.
 */

require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/notifications.php';

/**
 * Nudge candidates whose application is still "submitted" after N days.
 * @return array summary
 */
function runReminderBatch(PDO $pdo): array
{
    ensureEmailSchema($pdo);
    $afterDays  = max(1, (int) env('REMINDER_AFTER_DAYS', 7));
    $maxAgeDays = 60;
    $limit = 300;

    $sql = "
        SELECT a.id AS app_id, a.created_at, a.user_id,
               u.email, u.first_name,
               j.title AS job_title, j.company AS job_company
        FROM applications a
        JOIN users u ON u.id = a.user_id
        JOIN jobs j ON j.id = a.job_id
        WHERE a.status = 'submitted'
          AND a.created_at <= DATE_SUB(NOW(), INTERVAL {$afterDays} DAY)
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL {$maxAgeDays} DAY)
          AND NOT EXISTS (
              SELECT 1 FROM email_log el
              WHERE el.dedup_key = CONCAT('reminder:app:', a.id) AND el.status = 'sent'
          )
        ORDER BY a.created_at ASC
        LIMIT {$limit}
    ";

    $sent = 0; $skipped = 0; $failed = 0;
    try { $rows = $pdo->query($sql)->fetchAll(); }
    catch (Throwable $e) { error_log('runReminderBatch query failed: ' . $e->getMessage()); $rows = []; }

    foreach ($rows as $r) {
        if (empty($r['email'])) continue;
        $firstName = htmlspecialchars(trim($r['first_name'] ?: 'there'), ENT_QUOTES, 'UTF-8');
        $jobTitle  = htmlspecialchars(trim($r['job_title'] ?: 'a role'), ENT_QUOTES, 'UTF-8');
        $company   = htmlspecialchars(trim($r['job_company'] ?: 'the employer'), ENT_QUOTES, 'UTF-8');
        $days = (int) floor((time() - strtotime($r['created_at'])) / 86400);

        $bodyHtml = '
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $firstName . ',</p>
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">It has been about <strong>' . $days . ' days</strong> since you applied for <strong>' . $jobTitle . '</strong> at <strong>' . $company . '</strong> and there is no update yet.</p>
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">That is completely normal — reviews take time. In the meantime, the best thing you can do is keep your options open and apply to a few more roles.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="' . APP_URL . '/jobs.html" style="display:inline-block;padding:13px 30px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;">Browse more jobs</a>
            </div>
            <p style="font-size:14px;line-height:1.7;color:#64748B;margin:24px 0 0;">Keep going — you\'ve got this.<br><strong>The JobLynk Team</strong></p>';

        $result = sendUserEmail(
            $pdo,
            ['id' => (int) $r['user_id'], 'email' => $r['email'], 'first_name' => $r['first_name'] ?? ''],
            'reminders',
            'Still waiting to hear back about ' . html_entity_decode($r['job_title'] ?? 'your application', ENT_QUOTES, 'UTF-8') . '?',
            buildEmailTemplate('A quick nudge on your application', $bodyHtml),
            ['dedupKey' => 'reminder:app:' . (int) $r['app_id']]
        );
        if ($result === 'sent') $sent++; elseif ($result === 'skipped') $skipped++; else $failed++;
    }

    return ['success' => true, 'candidates' => count($rows), 'sent' => $sent, 'skipped' => $skipped, 'failed' => $failed];
}

/**
 * "Jobs like these" weekly digest matched to profile + recent applications.
 * @return array summary
 */
function runRecommendationBatch(PDO $pdo): array
{
    ensureEmailSchema($pdo);
    $jobWindowDays  = max(1, (int) env('RECO_JOB_WINDOW_DAYS', 10));
    $userWindowDays = 45;
    $maxUsers = 400;
    $week = gmdate('oW');

    $usersSql = "
        SELECT DISTINCT u.id, u.email, u.first_name, u.job_title, u.skills
        FROM users u
        JOIN applications a ON a.user_id = u.id
        WHERE u.role = 'job_seeker'
          AND u.email <> ''
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL {$userWindowDays} DAY)
        LIMIT {$maxUsers}
    ";
    try { $users = $pdo->query($usersSql)->fetchAll(); }
    catch (Throwable $e) { error_log('runRecommendationBatch users query failed: ' . $e->getMessage()); $users = []; }

    $emails = 0; $skipped = 0; $failed = 0; $noMatch = 0;

    foreach ($users as $u) {
        $userId = (int) $u['id'];
        $dedupKey = 'reco:' . $userId . ':' . $week;
        if (emailAlreadySent($pdo, $dedupKey)) { $skipped++; continue; }

        $keywords = [];
        foreach ([$u['job_title'] ?? '', $u['skills'] ?? ''] as $src) {
            foreach (preg_split('/[,\n;\/|]+/', (string) $src) as $tok) {
                $tok = trim($tok);
                if (strlen($tok) >= 3) $keywords[strtolower($tok)] = $tok;
            }
        }
        try {
            $recent = $pdo->prepare("SELECT j.title FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 3");
            $recent->execute([$userId]);
            foreach ($recent->fetchAll() as $rj) {
                $t = trim((string) $rj['title']);
                if (strlen($t) >= 3) $keywords[strtolower($t)] = $t;
            }
        } catch (Throwable $e) { /* ignore */ }

        $keywords = array_slice(array_values($keywords), 0, 6);
        if (!$keywords) { $noMatch++; continue; }

        $conds = []; $params = [];
        foreach ($keywords as $kw) {
            $conds[] = '(j.title LIKE ? OR j.skills LIKE ?)';
            $params[] = '%' . $kw . '%';
            $params[] = '%' . $kw . '%';
        }
        $matchSql = "
            SELECT j.id, j.title, j.company, j.location, j.type
            FROM jobs j
            WHERE j.status = 'active'
              AND j.created_at >= DATE_SUB(NOW(), INTERVAL {$jobWindowDays} DAY)
              AND (" . implode(' OR ', $conds) . ")
              AND j.id NOT IN (SELECT job_id FROM applications WHERE user_id = ?)
            ORDER BY j.created_at DESC
            LIMIT 5
        ";
        $params[] = $userId;

        try {
            $stmt = $pdo->prepare($matchSql);
            $stmt->execute($params);
            $matches = $stmt->fetchAll();
        } catch (Throwable $e) {
            error_log('runRecommendationBatch match query failed: ' . $e->getMessage());
            $matches = [];
        }
        if (count($matches) < 2) { $noMatch++; continue; }

        $firstName = htmlspecialchars(trim($u['first_name'] ?: 'there'), ENT_QUOTES, 'UTF-8');
        $listRows = '';
        foreach ($matches as $m) {
            $t = htmlspecialchars($m['title'] ?: 'Role', ENT_QUOTES, 'UTF-8');
            $c = htmlspecialchars($m['company'] ?: 'Company', ENT_QUOTES, 'UTF-8');
            $loc = htmlspecialchars(trim(($m['location'] ?: 'SA') . ' · ' . ($m['type'] ?: 'Full-time')), ENT_QUOTES, 'UTF-8');
            $url = APP_URL . '/job/' . (int) $m['id'];
            $listRows .= '
                <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                    <a href="' . $url . '" style="font-size:15px;font-weight:700;color:#3B4BA6;text-decoration:none;">' . $t . '</a>
                    <div style="font-size:13px;color:#64748B;margin-top:2px;">' . $c . ' — ' . $loc . '</div>
                </td></tr>';
        }

        $bodyHtml = '
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $firstName . ',</p>
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Based on your profile and recent applications, here are new roles on JobLynk you might like:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">' . $listRows . '</table>
            <div style="text-align:center;margin:24px 0;">
                <a href="' . APP_URL . '/jobs.html" style="display:inline-block;padding:13px 30px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;">See all jobs</a>
            </div>
            <p style="font-size:14px;line-height:1.7;color:#64748B;margin:24px 0 0;">Happy job hunting,<br><strong>The JobLynk Team</strong></p>';

        $result = sendUserEmail(
            $pdo,
            ['id' => $userId, 'email' => $u['email'], 'first_name' => $u['first_name'] ?? ''],
            'recommendations',
            count($matches) . ' new jobs matched to your profile',
            buildEmailTemplate('Recommended jobs for you', $bodyHtml),
            ['dedupKey' => $dedupKey]
        );
        if ($result === 'sent') $emails++; elseif ($result === 'skipped') $skipped++; else $failed++;
    }

    return ['success' => true, 'users' => count($users), 'sent' => $emails, 'skipped' => $skipped, 'no_match' => $noMatch, 'failed' => $failed];
}
