<?php
/**
 * POST /api/auth/guest-signup.php
 * Lightweight account creation used by the public apply-before-signin flow.
 * Creates a job_seeker account and immediately starts a session so the
 * application the guest already filled in can be submitted in the same flow
 * (nothing they entered is lost). A verification email is still sent.
 *
 * Body: { firstName, lastName, email, password }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = getJsonBody();

$firstName = trim($body['firstName'] ?? $body['first_name'] ?? '');
$lastName  = trim($body['lastName'] ?? $body['last_name'] ?? '');
$email     = trim(strtolower($body['email'] ?? ''));
$password  = $body['password'] ?? '';

$errors = [];
if (!$firstName) $errors[] = 'First name is required.';
if (!$lastName)  $errors[] = 'Last name is required.';
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'A valid email is required.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';

if ($errors) {
    jsonResponse(['success' => false, 'message' => implode(' ', $errors)], 422);
}

$pdo = getDB();

// ── Existing account? Tell the caller to sign in instead (don't overwrite) ──
$stmt = $pdo->prepare('SELECT id, role FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($existing = $stmt->fetch()) {
    jsonResponse([
        'success'      => false,
        'accountExists' => true,
        'message'      => 'An account with this email already exists. Please sign in to apply.',
    ], 409);
}

$emailVerificationRequired = isEmailVerificationRequired();
$emailVerified = $emailVerificationRequired ? 0 : 1;

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$firstName, $lastName, $email, $hash, 'job_seeker', $emailVerified]);
$userId = (int) $pdo->lastInsertId();

// ── Establish a session immediately so the application can be submitted now ──
$_SESSION['user_id']    = $userId;
$_SESSION['user_email'] = $email;
$_SESSION['user_role']  = 'job_seeker';
$_SESSION['user_name']  = $firstName . ' ' . $lastName;

// ── Send verification / welcome email (best-effort) ──
try {
    $safeName = htmlspecialchars($firstName, ENT_QUOTES);
    if ($emailVerificationRequired) {
        $token = generateToken();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $token, 'verification', $expiresAt]);
        $verifyUrl = APP_URL . '/verify-email.html?token=' . $token;

        $emailBody = '
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">Hi ' . $safeName . ', 👋</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
                Thanks for applying through <strong>' . APP_NAME . '</strong>! Your application has been received.
                Verify your email to track its status and apply to more jobs in one click.
            </p>
            <div style="text-align:center;margin:32px 0;">
                <a href="' . $verifyUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">Verify Email Address</a>
            </div>
            <p style="margin:0;font-size:14px;color:#94A3B8;">This link expires in 24 hours.</p>';
        sendResendEmail($email, 'Verify your ' . APP_NAME . ' account', buildEmailTemplate('Welcome to ' . APP_NAME . '!', $emailBody));
    } else {
        $emailBody = '
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">Hi ' . $safeName . ', 👋</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
                Welcome to <strong>' . APP_NAME . '</strong>! Your account is ready and your application has been received.
            </p>
            <div style="text-align:center;margin:24px 0;">
                <a href="' . APP_URL . '/dashboard.html" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">Go to Dashboard</a>
            </div>';
        sendResendEmail($email, 'Welcome to ' . APP_NAME . '!', buildEmailTemplate('Welcome to ' . APP_NAME . '!', $emailBody));
    }
} catch (Throwable $e) {
    error_log('Guest signup email error: ' . $e->getMessage());
}

jsonResponse([
    'success' => true,
    'message' => 'Account created.',
    'user' => [
        'id'    => $userId,
        'name'  => $firstName . ' ' . $lastName,
        'email' => $email,
        'role'  => 'job_seeker',
    ],
    'verificationRequired' => $emailVerificationRequired,
], 201);
