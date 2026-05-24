<?php
/**
 * POST /api/auth/staff-login.php
 * Authenticate staff via shared passphrase and grant preview session.
 * Body: { passphrase }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body       = getJsonBody();
$passphrase = trim($body['passphrase'] ?? '');

$expected = env('STAFF_PREVIEW_PASSWORD');
if (!$expected) {
    jsonResponse(['success' => false, 'message' => 'Staff portal is not configured. Contact the administrator.'], 500);
}

if (!hash_equals($expected, $passphrase)) {
    jsonResponse(['success' => false, 'message' => 'Invalid passphrase.'], 401);
}

$_SESSION['staff_preview'] = true;

jsonResponse(['success' => true, 'message' => 'Staff access granted.']);
