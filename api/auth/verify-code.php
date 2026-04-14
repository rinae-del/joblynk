<?php
/**
 * POST /api/auth/verify-code.php
 * Verifies a 6-digit email verification code for the logged-in user.
 * Body: { code }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$body = getJsonBody();
$code = trim($body['code'] ?? '');

if (!$code || strlen($code) !== 6) {
    jsonResponse(['success' => false, 'message' => 'Please enter the 6-digit code.'], 422);
}

$pdo = getDB();
$userId = (int) $_SESSION['user_id'];

// Find matching code
$stmt = $pdo->prepare('
    SELECT id, expires_at FROM email_verifications
    WHERE user_id = ? AND token = ? AND type = ?
');
$stmt->execute([$userId, $code, 'verification']);
$record = $stmt->fetch();

if (!$record) {
    jsonResponse(['success' => false, 'message' => 'Invalid code. Please check and try again.'], 400);
}

if (strtotime($record['expires_at']) < time()) {
    $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$record['id']]);
    jsonResponse(['success' => false, 'message' => 'This code has expired. Please request a new one.'], 400);
}

// Mark email as verified
$pdo->prepare('UPDATE users SET email_verified = 1 WHERE id = ?')->execute([$userId]);
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$userId, 'verification']);

jsonResponse(['success' => true, 'message' => 'Email verified successfully!']);
