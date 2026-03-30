<?php
/**
 * GET /api/auth/verify-email.php?token=xxx
 * Verifies the user's email address using the token from the email link.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$token = trim($_GET['token'] ?? '');

if (!$token) {
    jsonResponse(['success' => false, 'message' => 'Verification token is missing.'], 400);
}

$pdo = getDB();

// ── Find the token ──
$stmt = $pdo->prepare('
    SELECT ev.id, ev.user_id, ev.expires_at, u.email_verified
    FROM email_verifications ev
    JOIN users u ON u.id = ev.user_id
    WHERE ev.token = ? AND ev.type = ?
');
$stmt->execute([$token, 'verification']);
$record = $stmt->fetch();

if (!$record) {
    jsonResponse(['success' => false, 'message' => 'Invalid or expired verification link.'], 400);
}

// ── Already verified? ──
if ($record['email_verified']) {
    // Clean up token and return success anyway
    $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$record['id']]);
    jsonResponse(['success' => true, 'message' => 'Your email is already verified. You can sign in.']);
}

// ── Check expiry ──
if (strtotime($record['expires_at']) < time()) {
    $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$record['id']]);
    jsonResponse(['success' => false, 'message' => 'This verification link has expired. Please request a new one.'], 400);
}

// ── Verify the user ──
$pdo->prepare('UPDATE users SET email_verified = 1 WHERE id = ?')->execute([$record['user_id']]);
$pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$record['id']]);

jsonResponse(['success' => true, 'message' => 'Email verified successfully! You can now sign in.']);
