<?php
/**
 * /api/admin/email.php  (admin only)
 *
 * GET                          - SES config status, recent email_log, counts.
 * POST { action: 'test', to }  - send a test email via SES to `to`.
 * POST { action: 'run_reminders' }        - run the reminder batch now.
 * POST { action: 'run_recommendations' }  - run the recommendation batch now.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../lib/notifications.php';
require_once __DIR__ . '/../lib/notification-batches.php';

setCorsHeaders();
header('Cache-Control: no-store');

if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden: admin access required.'], 403);
}

$pdo = getDB();
ensureEmailSchema($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $counts = [];
    try {
        foreach ($pdo->query("SELECT status, COUNT(*) c FROM email_log GROUP BY status") as $r) {
            $counts[$r['status']] = (int) $r['c'];
        }
    } catch (Throwable $e) { /* ignore */ }

    $recent = [];
    try {
        $stmt = $pdo->query("SELECT id, email, category, subject, status, error, created_at FROM email_log ORDER BY id DESC LIMIT 50");
        $recent = $stmt->fetchAll();
    } catch (Throwable $e) { /* ignore */ }

    jsonResponse([
        'success' => true,
        'ses' => [
            'configured' => mailerIsConfigured(),
            'region'     => AWS_SES_REGION,
            'from'       => MAIL_FROM_EMAIL,
            'from_name'  => MAIL_FROM_NAME,
        ],
        'counts' => $counts,
        'recent' => $recent,
    ]);
}

if ($method === 'POST') {
    $body = getJsonBody();
    $action = (string) ($body['action'] ?? '');

    if ($action === 'test') {
        $to = trim((string) ($body['to'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Enter a valid recipient email.'], 422);
        }
        if (!mailerIsConfigured()) {
            jsonResponse(['success' => false, 'message' => 'AWS SES is not configured. Set AWS_SES_* and MAIL_FROM_EMAIL in .env.'], 503);
        }
        $html = buildEmailTemplate('SES test email', '
            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">This is a test email from JobLynk to confirm AWS SES is configured correctly.</p>
            <p style="font-size:14px;color:#64748B;margin:0;">If you received this, sending works. Region: <strong>' . htmlspecialchars(AWS_SES_REGION) . '</strong>, from <strong>' . htmlspecialchars(MAIL_FROM_EMAIL) . '</strong>.</p>');
        $ok = sendEmail($to, 'JobLynk SES test email', $html);
        logEmail($pdo, (int) $_SESSION['user_id'], $to, 'account', 'JobLynk SES test email', $ok ? 'sent' : 'failed', null, $ok ? null : 'ses_error');
        jsonResponse([
            'success' => $ok,
            'message' => $ok ? 'Test email sent to ' . $to . '.' : 'SES send failed — check the server error log and your SES setup.',
        ], $ok ? 200 : 502);
    }

    if ($action === 'run_reminders') {
        jsonResponse(['success' => true, 'result' => runReminderBatch($pdo)]);
    }
    if ($action === 'run_recommendations') {
        jsonResponse(['success' => true, 'result' => runRecommendationBatch($pdo)]);
    }

    jsonResponse(['success' => false, 'message' => 'Unknown action.'], 422);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
