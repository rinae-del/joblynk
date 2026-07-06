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
$summary = runReminderBatch($pdo);

if ($isCli) { echo 'Reminders: ' . json_encode($summary) . PHP_EOL; exit(0); }
echo json_encode($summary);
