<?php
/**
 * Application reminder emails (cron).
 *
 *   php api/cron/send-reminders.php
 *
 * Nudges candidates whose application is still "submitted" (no recruiter
 * action) after REMINDER_AFTER_DAYS, encouraging them to keep applying.
 * Runs once/day via cPanel cron. HTTP access requires MAIL_CRON_SECRET.
 *
 * Idempotent: one reminder per application (email_log dedup).
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../lib/notifications.php';

$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    header('Content-Type: application/json');
    $secret = env('MAIL_CRON_SECRET', '');
    if ($secret === '') { http_response_code(403); echo json_encode(['success' => false, 'message' => 'Disabled over HTTP. Set MAIL_CRON_SECRET.']); exit; }
    $provided = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');
    if (!hash_equals($secret, (string) $provided)) { http_response_code(403); echo json_encode(['success' => false, 'message' => 'Forbidden.']); exit; }
}

$pdo = getDB();
ensureEmailSchema($pdo);

$afterDays = max(1, (int) env('REMINDER_AFTER_DAYS', 7));
$maxAgeDays = 60; // stop nagging very old applications
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
try {
    $rows = $pdo->query($sql)->fetchAll();
} catch (Throwable $e) {
    error_log('send-reminders query failed: ' . $e->getMessage());
    $rows = [];
}

foreach ($rows as $r) {
    if (empty($r['email'])) { continue; }
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

$summary = ['success' => true, 'candidates' => count($rows), 'sent' => $sent, 'skipped' => $skipped, 'failed' => $failed];
if ($isCli) { echo 'Reminders: ' . json_encode($summary) . PHP_EOL; exit(0); }
echo json_encode($summary);
