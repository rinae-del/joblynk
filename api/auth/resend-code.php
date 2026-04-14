<?php
/**
 * POST /api/auth/resend-code.php
 * Generates and sends a new 6-digit verification code for the logged-in user.
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

$pdo    = getDB();
$userId = (int) $_SESSION['user_id'];

// Get user info
$stmt = $pdo->prepare('SELECT first_name, email, email_verified FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
}

if ($user['email_verified']) {
    jsonResponse(['success' => true, 'message' => 'Your email is already verified.', 'email' => $user['email']]);
}

// Delete old codes and generate new one
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$userId, 'verification']);

$code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+30 minutes'));

$stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
$stmt->execute([$userId, $code, 'verification', $expiresAt]);

// Send code
$emailBody = '
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
        Hi ' . htmlspecialchars($user['first_name']) . ', here is your new verification code:
    </p>
    <div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;padding:20px 40px;background:#F8FAFC;border:2px solid #E2E8F0;border-radius:14px;font-size:36px;font-weight:800;letter-spacing:10px;color:#1E293B;">' . $code . '</div>
    </div>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
        This code expires in 30 minutes.
    </p>';

$emailHtml = buildEmailTemplate('Your verification code', $emailBody);
sendResendEmail($user['email'], 'Your verification code – ' . APP_NAME, $emailHtml);

jsonResponse(['success' => true, 'message' => 'A new code has been sent to your email.', 'email' => $user['email']]);
