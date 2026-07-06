<?php
/**
 * Recommended-jobs digest emails (cron).
 *
 *   php api/cron/send-recommendations.php
 *
 * "Jobs like these are available" — matches recently-active job seekers to
 * new active jobs (by skills / job title / recently-applied roles) and sends
 * a small digest. De-duplicated to at most once per ISO week per user, so it
 * is safe to run daily; schedule weekly via cPanel cron.
 * HTTP access requires MAIL_CRON_SECRET.
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

$jobWindowDays  = max(1, (int) env('RECO_JOB_WINDOW_DAYS', 10));
$userWindowDays = 45;   // only email seekers who've been active recently
$maxUsers = 400;        // cap work per run
$week = gmdate('oW');   // ISO year+week, for weekly dedup

// Active job seekers: applied recently, or have a profile to match on.
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
catch (Throwable $e) { error_log('send-recommendations users query failed: ' . $e->getMessage()); $users = []; }

$emails = 0; $skipped = 0; $failed = 0; $noMatch = 0;

foreach ($users as $u) {
    $userId = (int) $u['id'];
    $dedupKey = 'reco:' . $userId . ':' . $week;
    if (emailAlreadySent($pdo, $dedupKey)) { $skipped++; continue; }

    // Build keyword set from profile + recently-applied titles.
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

    // Match new active jobs the user hasn't applied to.
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
        error_log('send-recommendations match query failed: ' . $e->getMessage());
        $matches = [];
    }
    if (count($matches) < 2) { $noMatch++; continue; } // don't email a near-empty digest

    $firstName = htmlspecialchars(trim($u['first_name'] ?: 'there'), ENT_QUOTES, 'UTF-8');
    $rows = '';
    foreach ($matches as $m) {
        $t = htmlspecialchars($m['title'] ?: 'Role', ENT_QUOTES, 'UTF-8');
        $c = htmlspecialchars($m['company'] ?: 'Company', ENT_QUOTES, 'UTF-8');
        $loc = htmlspecialchars(trim(($m['location'] ?: 'SA') . ' · ' . ($m['type'] ?: 'Full-time')), ENT_QUOTES, 'UTF-8');
        $url = APP_URL . '/job/' . (int) $m['id'];
        $rows .= '
            <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                <a href="' . $url . '" style="font-size:15px;font-weight:700;color:#3B4BA6;text-decoration:none;">' . $t . '</a>
                <div style="font-size:13px;color:#64748B;margin-top:2px;">' . $c . ' — ' . $loc . '</div>
            </td></tr>';
    }

    $bodyHtml = '
        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Hi ' . $firstName . ',</p>
        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">Based on your profile and recent applications, here are new roles on JobLynk you might like:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">' . $rows . '</table>
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

$summary = ['success' => true, 'users' => count($users), 'sent' => $emails, 'skipped' => $skipped, 'no_match' => $noMatch, 'failed' => $failed];
if ($isCli) { echo 'Recommendations: ' . json_encode($summary) . PHP_EOL; exit(0); }
echo json_encode($summary);
