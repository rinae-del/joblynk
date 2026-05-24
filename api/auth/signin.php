<?php
/**
 * POST /api/auth/signin.php
 * Authenticate user, start session.
 * Body: { email, password }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body     = getJsonBody();
$email    = trim(strtolower($body['email'] ?? ''));
$password = $body['password'] ?? '';

if (!$email || !$password) {
    jsonResponse(['success' => false, 'message' => 'Email and password are required.'], 422);
}

$pdo = getDB();

// ── Find user ──
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['success' => false, 'message' => 'Invalid email or password.'], 401);
}

// ── Staff-only preview gate ──
$staffRoles = ['admin', 'recruiter'];
if (!in_array($user['role'], $staffRoles, true)) {
    jsonResponse([
        'success'    => false,
        'message'    => 'JobLynk is currently in staff-only preview mode. Public access is coming soon.',
        'comingSoon' => true
    ], 403);
}

// ── Check if email is verified ──
if (isEmailVerificationRequired() && !$user['email_verified'] && $user['role'] !== 'recruiter') {
    jsonResponse([
        'success'      => false,
        'message'      => 'Please verify your email before signing in.',
        'needsVerify'  => true,
        'email'        => $user['email']
    ], 403);
}

// ── Start session ──
$_SESSION['user_id']    = $user['id'];
$_SESSION['user_email'] = $user['email'];
$_SESSION['user_role']  = $user['role'];
$_SESSION['user_name']  = $user['first_name'] . ' ' . $user['last_name'];

jsonResponse([
    'success' => true,
    'message' => 'Signed in successfully.',
    'user'    => [
        'id'    => $user['id'],
        'name'  => $user['first_name'] . ' ' . $user['last_name'],
        'email' => $user['email'],
        'role'  => $user['role'],
        'email_verified' => (bool) $user['email_verified'],
    ]
]);
