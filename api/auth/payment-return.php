<?php
/**
 * GET /api/auth/payment-return.php
 * Handles PayFast return redirect after successful payment.
 * Verifies an HMAC-signed token, logs the recruiter in, and redirects to post-job page.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';

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
$stmt = $pdo->prepare('SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND role = ?');
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

header('Location: ' . (defined('APP_URL') ? APP_URL : '') . '/recruiter-post-job.html?payment=success');
exit;
