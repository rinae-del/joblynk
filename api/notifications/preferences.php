<?php
/**
 * /api/notifications/preferences.php
 * GET  - the signed-in user's email preferences.
 * POST - update one category { category, enabled }  (optional categories only).
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../lib/notifications.php';

setCorsHeaders();
header('Cache-Control: no-store');

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$pdo = getDB();
ensureEmailSchema($pdo);
$userId = (int) $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    jsonResponse(['success' => true, 'preferences' => getEmailPreferences($pdo, $userId)]);
}

if ($method === 'POST') {
    $body = getJsonBody();
    $category = trim((string) ($body['category'] ?? ''));
    $enabled  = !empty($body['enabled']);

    if (!isValidEmailCategory($category)) {
        jsonResponse(['success' => false, 'message' => 'Unknown email category.'], 422);
    }
    $meta = emailCategories()[$category];
    if ($meta['optional'] === false) {
        jsonResponse(['success' => false, 'message' => 'Account emails are required and cannot be changed.'], 422);
    }

    setEmailPreference($pdo, $userId, $category, $enabled);
    jsonResponse(['success' => true, 'preferences' => getEmailPreferences($pdo, $userId)]);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
