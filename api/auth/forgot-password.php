<?php
/**
 * POST /api/auth/forgot-password.php
 * Sends a password reset link via email.
 * Body: { email }
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body  = getJsonBody();
$email = trim(strtolower($body['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Valid email is required.'], 422);
}

$pdo = getDB();

// ── Find user (always return success to prevent enumeration) ──
$stmt = $pdo->prepare('SELECT id, first_name FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    // Clean up old reset tokens
    $pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$user['id'], 'password_reset']);

    // Generate token
    $token     = generateToken();
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));
    $stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $token, 'password_reset', $expiresAt]);

    // Send email
    $resetUrl = APP_URL . '/new-password.html?token=' . $token;
    $emailBody = '
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            Hi ' . htmlspecialchars($user['first_name']) . ', we received a request to reset your password.
        </p>
        <div style="text-align:center;margin:32px 0;">
            <a href="' . $resetUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                Reset Password
            </a>
        </div>
        <p style="margin:0;font-size:14px;color:#94A3B8;">
            This link expires in 1 hour. If you didn\'t request this, you can safely ignore this email.
        </p>';

    $emailHtml = buildEmailTemplate('Reset your password', $emailBody);
    sendResendEmail($email, 'Reset your password – ' . APP_NAME, $emailHtml);
}

// Always return success
jsonResponse(['success' => true, 'message' => 'If an account exists with that email, a reset link has been sent.']);
