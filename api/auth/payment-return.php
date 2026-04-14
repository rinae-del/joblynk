<?php
/**
 * GET /api/auth/payment-return.php
 * Handles PayFast return redirect after successful payment.
 * Verifies an HMAC-signed token, logs the recruiter in,
 * generates a 6-digit verification code, emails it, and redirects to verification page.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/helpers.php';

$uid = (int) ($_GET['uid'] ?? 0);
$ts  = (int) ($_GET['ts'] ?? 0);
$sig = $_GET['sig'] ?? '';

$secret   = env('PAYFAST_PASSPHRASE', 'joblynk-fallback-secret');
$expected = hash_hmac('sha256', $uid . ':' . $ts, $secret);

// Verify signature and freshness (valid for 2 hours)
if (!$uid || !$ts || !hash_equals($expected, $sig) || (time() - $ts) > 7200) {
    header('Location: ' . (defined('APP_URL') ? APP_URL : '') . '/sign-in.html');
    exit;
}

$pdo  = getDB();
$stmt = $pdo->prepare('SELECT id, email, first_name, last_name, role, email_verified FROM users WHERE id = ? AND role = ?');
$stmt->execute([$uid, 'recruiter']);
$user = $stmt->fetch();

if (!$user) {
    header('Location: ' . (defined('APP_URL') ? APP_URL : '') . '/sign-in.html');
    exit;
}

// Set session
$_SESSION['user_id']    = $user['id'];
$_SESSION['user_email'] = $user['email'];
$_SESSION['user_role']  = $user['role'];
$_SESSION['user_name']  = $user['first_name'] . ' ' . $user['last_name'];

// If already verified, go straight to post-job
if ($user['email_verified']) {
    header('Location: ' . (defined('APP_URL') ? APP_URL : '') . '/recruiter-post-job.html?payment=success');
    exit;
}

// Generate 6-digit verification code
$code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+30 minutes'));

// Remove old verification tokens for this user
$pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')->execute([$user['id'], 'verification']);

// Store the code
$stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
$stmt->execute([$user['id'], $code, 'verification', $expiresAt]);

// Send verification code email
$emailBody = '
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
        Hi ' . htmlspecialchars($user['first_name']) . ', your payment was successful! Use this code to verify your email:
    </p>
    <div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;padding:20px 40px;background:#F8FAFC;border:2px solid #E2E8F0;border-radius:14px;font-size:36px;font-weight:800;letter-spacing:10px;color:#1E293B;">' . $code . '</div>
    </div>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
        This code expires in 30 minutes. If you didn\'t create this account, please ignore this email.
    </p>';

$emailHtml = buildEmailTemplate('Your verification code', $emailBody);
sendResendEmail($user['email'], 'Your verification code – ' . APP_NAME, $emailHtml);

header('Location: ' . (defined('APP_URL') ? APP_URL : '') . '/recruiter-verify.html?payment=success');
exit;
