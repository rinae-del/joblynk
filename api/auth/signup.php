<?php
/**
 * POST /api/auth/signup.php
 * Register a new user and optionally send email verification.
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
$emailVerificationRequired = isEmailVerificationRequired();
$emailVerified = $emailVerificationRequired ? 0 : 1;

// ── Check duplicate email ──
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'An account with this email already exists.'], 409);
}

// ── Create user ──
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$firstName, $lastName, $email, $hash, 'job_seeker', $emailVerified]);
$userId = $pdo->lastInsertId();

$message = 'Account created! Please check your email to verify your account.';

if ($emailVerificationRequired) {
    // ── Generate verification token ──
    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmt = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $token, 'verification', $expiresAt]);

    // ── Send welcome + verification email ──
    $verifyUrl = APP_URL . '/verify-email.html?token=' . $token;
    $profileUrl = APP_URL . '/profile.html';
    $cvBuilderUrl = APP_URL . '/cv-builder.html';
    $safeName = htmlspecialchars($firstName);

    $emailBody = '
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            Hi ' . $safeName . ', 👋
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            <strong>Welcome to ' . APP_NAME . '!</strong> We\'re excited to have you on board. You\'re one step closer to landing your dream job.
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            First, please verify your email address to activate your account:
        </p>
        <div style="text-align:center;margin:32px 0;">
            <a href="' . $verifyUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                Verify Email Address
            </a>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;margin:24px 0;">
            <tr>
                <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1E293B;">Here\'s what to do next:</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">1</span>
                                <a href="' . $profileUrl . '" style="color:#4F46E5;font-weight:600;text-decoration:none;">Complete your profile</a> — add your skills, experience and contact details
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">2</span>
                                <a href="' . $cvBuilderUrl . '" style="color:#4F46E5;font-weight:600;text-decoration:none;">Upload or build your CV</a> — stand out to employers with a polished CV
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">3</span>
                                Browse jobs and start applying — we\'ll notify you on every update
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        <p style="margin:0;font-size:14px;color:#94A3B8;">
            This verification link expires in 24 hours. If you didn\'t create an account, please ignore this email.
        </p>';

    $emailHtml = buildEmailTemplate('Welcome to ' . APP_NAME . '!', $emailBody);
    sendResendEmail($email, 'Welcome to ' . APP_NAME . '! Verify your email to get started', $emailHtml);
} else {
    // ── Send welcome email (no verification needed) ──
    $profileUrl = APP_URL . '/profile.html';
    $cvBuilderUrl = APP_URL . '/cv-builder.html';
    $dashboardUrl = APP_URL . '/dashboard.html';
    $safeName = htmlspecialchars($firstName);

    $welcomeBody = '
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            Hi ' . $safeName . ', 👋
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            <strong>Welcome to ' . APP_NAME . '!</strong> We\'re excited to have you on board. Your account is all set — you can sign in right away and start your job search.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;margin:24px 0;">
            <tr>
                <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1E293B;">Here\'s what to do next:</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">1</span>
                                <a href="' . $profileUrl . '" style="color:#4F46E5;font-weight:600;text-decoration:none;">Complete your profile</a> — add your skills, experience and contact details
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">2</span>
                                <a href="' . $cvBuilderUrl . '" style="color:#4F46E5;font-weight:600;text-decoration:none;">Upload or build your CV</a> — stand out to employers with a polished CV
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;font-size:14px;color:#475569;">
                                <span style="display:inline-block;width:24px;height:24px;background:#EEF2FF;color:#4F46E5;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px;margin-right:10px;">3</span>
                                Browse jobs and start applying — we\'ll notify you on every update
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        <div style="text-align:center;margin:24px 0;">
            <a href="' . $dashboardUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                Go to Dashboard
            </a>
        </div>';

    $emailHtml = buildEmailTemplate('Welcome to ' . APP_NAME . '!', $welcomeBody);
    sendResendEmail($email, 'Welcome to ' . APP_NAME . '! Let\'s get you started', $emailHtml);

    $message = 'Account created! Email verification is disabled for testing, so you can sign in immediately.';
}

jsonResponse([
    'success' => true,
    'message' => $message,
    'email'   => $email,
    'verificationRequired' => $emailVerificationRequired
], 201);
