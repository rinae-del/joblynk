<?php
/**
 * POST /api/auth/update-email.php
 * Updates the logged-in user's email and sends a new verification code.
 * Body: { email }
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

$body  = getJsonBody();
$email = trim(strtolower($body['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Please enter a valid email address.'], 422);
}

$pdo    = getDB();
$userId = (int) $_SESSION['user_id'];

// Check if another user already has this email
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
$stmt->execute([$email, $userId]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'This email is already in use by another account.'], 409);
}

// Get user info
$stmt = $pdo->prepare('SELECT first_name FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
}

// Update email and reset verification
$pdo->prepare('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?')->execute([$email, $userId]);
$_SESSION['user_email'] = $email;

// Delete old codes and generate new one
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$userId, 'verification']);

$code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+30 minutes'));

$stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
$stmt->execute([$userId, $code, 'verification', $expiresAt]);

// Send code
$emailBody = '
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
        Hi ' . htmlspecialchars($user['first_name']) . ', here is your verification code:
    </p>
    <div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;padding:20px 40px;background:#F8FAFC;border:2px solid #E2E8F0;border-radius:14px;font-size:36px;font-weight:800;letter-spacing:10px;color:#1E293B;">' . $code . '</div>
    </div>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
        This code expires in 30 minutes.
    </p>';

$emailHtml = buildEmailTemplate('Your verification code', $emailBody);
sendResendEmail($email, 'Your verification code – ' . APP_NAME, $emailHtml);

jsonResponse(['success' => true, 'message' => 'Email updated and a new code has been sent.']);
