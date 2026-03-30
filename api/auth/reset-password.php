<?php
/**
 * POST /api/auth/reset-password.php
 * Resets the user's password using a valid token.
 * Body: { token, password }
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body     = getJsonBody();
$token    = trim($body['token'] ?? '');
$password = $body['password'] ?? '';

if (!$token) {
    jsonResponse(['success' => false, 'message' => 'Reset token is missing.'], 400);
}
if (strlen($password) < 8) {
    jsonResponse(['success' => false, 'message' => 'Password must be at least 8 characters.'], 422);
}

$pdo = getDB();

// ── Find the token ──
$stmt = $pdo->prepare('
    SELECT ev.id, ev.user_id, ev.expires_at
    FROM email_verifications ev
    WHERE ev.token = ? AND ev.type = ?
');
$stmt->execute([$token, 'password_reset']);
$record = $stmt->fetch();

if (!$record) {
    jsonResponse(['success' => false, 'message' => 'Invalid or expired reset link.'], 400);
}

// ── Check expiry ──
if (strtotime($record['expires_at']) < time()) {
    $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$record['id']]);
    jsonResponse(['success' => false, 'message' => 'This reset link has expired. Please request a new one.'], 400);
}

// ── Update password ──
$hash = password_hash($password, PASSWORD_BCRYPT);
$pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $record['user_id']]);

// ── Clean up all reset tokens for this user ──
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$record['user_id'], 'password_reset']);

jsonResponse(['success' => true, 'message' => 'Password reset successfully. You can now sign in with your new password.']);
