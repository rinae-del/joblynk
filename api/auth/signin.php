<?php
/**
 * POST /api/auth/signin.php
 * Authenticate user, start session.
 * Body: { email, password }
 */

session_start();
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

// ── Check if email is verified ──
if (!$user['email_verified']) {
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
    ]
]);
