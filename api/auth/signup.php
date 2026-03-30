<?php
/**
 * POST /api/auth/signup.php
 * Register a new user and send email verification.
 * Body: { firstName, lastName, email, password }
 */

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = getJsonBody();

$firstName = trim($body['firstName'] ?? '');
$lastName  = trim($body['lastName'] ?? '');
$email     = trim(strtolower($body['email'] ?? ''));
$password  = $body['password'] ?? '';

// ── Validation ──
$errors = [];
if (!$firstName) $errors[] = 'First name is required.';
if (!$lastName)  $errors[] = 'Last name is required.';
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Valid email is required.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';

if ($errors) {
    jsonResponse(['success' => false, 'message' => implode(' ', $errors)], 422);
}

$pdo = getDB();

// ── Check duplicate email ──
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'An account with this email already exists.'], 409);
}

// ── Create user ──
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$firstName, $lastName, $email, $hash, 'job_seeker']);
$userId = $pdo->lastInsertId();

// ── Generate verification token ──
$token = generateToken();
$expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
$stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
$stmt->execute([$userId, $token, 'verification', $expiresAt]);

// ── Send verification email ──
$verifyUrl = APP_URL . '/verify-email.html?token=' . $token;
$emailBody = '
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
        Hi ' . htmlspecialchars($firstName) . ', welcome to ' . APP_NAME . '! Please verify your email address to get started.
    </p>
    <div style="text-align:center;margin:32px 0;">
        <a href="' . $verifyUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
            Verify Email Address
        </a>
    </div>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
        This link expires in 24 hours. If you didn\'t create an account, please ignore this email.
    </p>';

$emailHtml = buildEmailTemplate('Verify your email', $emailBody);
sendResendEmail($email, 'Verify your email – ' . APP_NAME, $emailHtml);

jsonResponse([
    'success' => true,
    'message' => 'Account created! Please check your email to verify your account.',
    'email'   => $email
], 201);
