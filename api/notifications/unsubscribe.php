<?php
/**
 * GET/POST /api/notifications/unsubscribe.php?u=ID&c=CATEGORY&t=TOKEN
 * One-click unsubscribe from a single optional email category.
 * No auth — the HMAC token in the link proves ownership.
 * Supports RFC 8058 one-click POST (List-Unsubscribe-Post).
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../lib/notifications.php';

$userId   = (int) ($_GET['u'] ?? 0);
$category = (string) ($_GET['c'] ?? '');
$token    = (string) ($_GET['t'] ?? '');

$isPost = ($_SERVER['REQUEST_METHOD'] === 'POST'); // email-client one-click

function unsubPage(string $title, string $message, bool $ok = true): void
{
    http_response_code($ok ? 200 : 400);
    header('Content-Type: text/html; charset=utf-8');
    $appName = htmlspecialchars(APP_NAME, ENT_QUOTES);
    $home    = htmlspecialchars(rtrim(APP_URL, '/') . '/home.html', ENT_QUOTES);
    $prefs   = htmlspecialchars(preferencesUrl(), ENT_QUOTES);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES);
    $safeMsg   = htmlspecialchars($message, ENT_QUOTES);
    $accent = $ok ? '#3B4BA6' : '#DC2626';
    echo "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'>"
        . "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
        . "<title>{$safeTitle} | {$appName}</title></head>"
        . "<body style='margin:0;background:#EEF2F7;font-family:Inter,Arial,sans-serif;color:#1E293B;'>"
        . "<div style='max-width:520px;margin:60px auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:40px 34px;text-align:center;box-shadow:0 18px 50px rgba(15,23,42,0.08);'>"
        . "<div style='font-size:26px;font-weight:800;color:{$accent};margin-bottom:14px;'>{$appName}</div>"
        . "<h1 style='font-size:20px;margin:0 0 12px;'>{$safeTitle}</h1>"
        . "<p style='color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;'>{$safeMsg}</p>"
        . "<a href='{$prefs}' style='display:inline-block;padding:11px 22px;background:{$accent};color:#fff;text-decoration:none;border-radius:9px;font-weight:600;margin-right:8px;'>Manage email preferences</a>"
        . "<a href='{$home}' style='display:inline-block;padding:11px 22px;color:#475569;text-decoration:none;font-weight:600;'>Back to " . $appName . "</a>"
        . "</div></body></html>";
    exit;
}

if (!$userId || $category === '' || $token === '') {
    if ($isPost) { http_response_code(400); exit; }
    unsubPage('Invalid link', 'This unsubscribe link is missing information. Please use the link from your latest email.', false);
}

if (!isValidEmailCategory($category) || !verifyUnsubscribeToken($userId, $category, $token)) {
    if ($isPost) { http_response_code(400); exit; }
    unsubPage('Invalid link', 'This unsubscribe link is invalid or has expired.', false);
}

$pdo = getDB();
ensureEmailSchema($pdo);

$meta = emailCategories()[$category];
if ($meta['optional'] === false) {
    if ($isPost) { http_response_code(200); exit; }
    unsubPage('Cannot unsubscribe', 'Account and security emails are required and cannot be turned off.', false);
}

setEmailPreference($pdo, $userId, $category, false);

if ($isPost) { http_response_code(200); echo 'Unsubscribed'; exit; }

unsubPage(
    'You are unsubscribed',
    'You will no longer receive “' . $meta['label'] . '” emails. You can re-enable them anytime from your email preferences.'
);
