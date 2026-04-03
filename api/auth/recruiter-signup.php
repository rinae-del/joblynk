<?php
/**
 * POST /api/auth/recruiter-signup.php
 * Registers a recruiter (creating company, user) and
 * redirects to PayFast for payment.
 * 
 * The actual payment verification happens via ITN callback (api/payments/notify.php).
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/payfast.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = getJsonBody();

$companyName = trim($body['companyName'] ?? '');
$industry    = trim($body['industry'] ?? '');
$companySize = trim($body['companySize'] ?? '');

$firstName   = trim($body['firstName'] ?? '');
$lastName    = trim($body['lastName'] ?? '');
$email       = trim(strtolower($body['email'] ?? ''));
$password    = $body['password'] ?? '';

$packageId   = trim($body['packageId'] ?? '');

$errors = [];
if (!$companyName) $errors[] = 'Company Name is required.';
if (!$firstName)   $errors[] = 'First name is required.';
if (!$lastName)    $errors[] = 'Last name is required.';
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Valid email is required.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
if (!$packageId)   $errors[] = 'Package selection is missing.';

if ($errors) {
    jsonResponse(['success' => false, 'message' => implode(' ', $errors)], 422);
}

// ── Define Expected Prices (in ZAR) — TEST PRICES ──
$packages = [
    'intro' => 1.00,
    '1job'  => 1.00,
    '2job'  => 1.00,
    '3job'  => 1.00,
    '4job'  => 1.00,
    '5job'  => 1.00,
];

if (!isset($packages[$packageId])) {
    jsonResponse(['success' => false, 'message' => 'Invalid package selected.'], 400);
}

$expectedAmount = $packages[$packageId];

$pdo = getDB();
$emailVerificationRequired = isEmailVerificationRequired();
$emailVerified = $emailVerificationRequired ? 0 : 1;

// ── Check if email exists ──
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'An account with this email already exists.'], 409);
}

// ── Save to DB (with pending payment status) ──
try {
    $pdo->beginTransaction();

    // 1. Create Company
    $stmtC = $pdo->prepare('INSERT INTO companies (name, industry, size) VALUES (?, ?, ?)');
    $stmtC->execute([$companyName, $industry, $companySize]);
    $companyId = $pdo->lastInsertId();

    // 2. Create User
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmtU = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password_hash, company_id, role, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmtU->execute([$firstName, $lastName, $email, $hash, $companyId, 'recruiter', $emailVerified]);
    $userId = $pdo->lastInsertId();

    if ($emailVerificationRequired) {
        // 3. Generate Email Verification Token
        $token = generateToken();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $stmtV = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
        $stmtV->execute([$userId, $token, 'verification', $expiresAt]);
    }

    $pdo->commit();

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
}

if ($emailVerificationRequired) {
    // ── Send Verification Email ──
    $verifyUrl = APP_URL . '/verify-email.html?token=' . $token;
    $emailBody = '
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            Hi ' . htmlspecialchars($firstName) . ', welcome to ' . APP_NAME . ' for Employers!<br>
            Please verify your email address to activate your account. 
            Your payment will be processed via PayFast.
        </p>
        <div style="text-align:center;margin:32px 0;">
            <a href="' . $verifyUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                Verify Email Address
            </a>
        </div>
    ';

    $emailHtml = buildEmailTemplate('Verify your recruiter account', $emailBody);
    sendResendEmail($email, 'Verify your email – Joblynk Recruiter', $emailHtml);
}

// ── Build PayFast form data for frontend redirect ──
$pfData = [
    'merchant_id'  => PAYFAST_MERCHANT_ID,
    'merchant_key' => PAYFAST_MERCHANT_KEY,
    'return_url'   => APP_URL . '/recruiter-overview.html?payment=success',
    'cancel_url'   => APP_URL . '/recruiter-pricing.html?payment=cancelled',
    'notify_url'   => APP_URL . '/api/payments/notify.php',
    'name_first'   => $firstName,
    'name_last'    => $lastName,
    'email_address' => $email,
    'amount'       => number_format($expectedAmount, 2, '.', ''),
    'item_name'    => 'Joblynk Recruiter - ' . ucfirst($packageId) . ' Plan',
    'custom_str1'  => $packageId,
    'custom_str2'  => $email,
    'custom_int1'  => $userId,
];

// Generate signature — skip empty values per PayFast spec
$pfPassphrase = trim(PAYFAST_PASSPHRASE);
$sigString = '';
foreach ($pfData as $key => $val) {
    if ($val !== '') {
        $sigString .= $key . '=' . urlencode(trim((string)$val)) . '&';
    }
}
$sigString = rtrim($sigString, '&');
if ($pfPassphrase !== '') {
    $sigString .= '&passphrase=' . urlencode($pfPassphrase);
}
$pfData['signature'] = md5($sigString);

jsonResponse([
    'success'    => true,
    'message'    => $emailVerificationRequired
        ? 'Account created! Redirecting to PayFast for payment.'
        : 'Account created! Email verification is disabled for testing. Redirecting to PayFast for payment.',
    'email'      => $email,
    'payfastUrl' => PAYFAST_URL,
    'payfastData' => $pfData,
    'verificationRequired' => $emailVerificationRequired,
], 201);
