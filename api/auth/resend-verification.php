<?php
/**
 * POST /api/auth/resend-verification.php
 * Resends the verification email.
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

// ── Find user ──
$stmt = $pdo->prepare('SELECT id, first_name, email_verified FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Always return success to prevent email enumeration
if (!$user || $user['email_verified']) {
    jsonResponse(['success' => true, 'message' => 'If an unverified account exists, a new verification email has been sent.']);
}

// ── Delete old verification tokens ──
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$user['id'], 'verification']);

// ── Generate new token ──
$token     = generateToken();
$expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
$stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
$stmt->execute([$user['id'], $token, 'verification', $expiresAt]);

// ── Send email ──
$verifyUrl = APP_URL . '/verify-email.html?token=' . $token;
$emailBody = '
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
        Hi ' . htmlspecialchars($user['first_name']) . ', here\'s your new verification link.
    </p>
    <div style="text-align:center;margin:32px 0;">
        <a href="' . $verifyUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
            Verify Email Address
        </a>
    </div>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
        This link expires in 24 hours.
    </p>';

$emailHtml = buildEmailTemplate('Verify your email', $emailBody);
sendResendEmail($email, 'Verify your email – ' . APP_NAME, $emailHtml);

jsonResponse(['success' => true, 'message' => 'A new verification email has been sent.']);
