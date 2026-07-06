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
require_once __DIR__ . '/../lib/notification-batches.php';

$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    header('Content-Type: application/json');
    $secret = env('MAIL_CRON_SECRET', '');
    if ($secret === '') { http_response_code(403); echo json_encode(['success' => false, 'message' => 'Disabled over HTTP. Set MAIL_CRON_SECRET.']); exit; }
    $provided = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');
    if (!hash_equals($secret, (string) $provided)) { http_response_code(403); echo json_encode(['success' => false, 'message' => 'Forbidden.']); exit; }
}

$pdo = getDB();
$summary = runRecommendationBatch($pdo);

if ($isCli) { echo 'Recommendations: ' . json_encode($summary) . PHP_EOL; exit(0); }
echo json_encode($summary);
