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
require_once __DIR__ . '/../config/recruiter-payments.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = getJsonBody();

$companyName = trim($body['companyName'] ?? '');
$industry    = trim($body['industry'] ?? '');
$companySize = trim($body['companySize'] ?? '');
$vatNumber   = trim($body['vatNumber'] ?? '');
$addressLine1 = trim($body['addressLine1'] ?? '');
$addressLine2 = trim($body['addressLine2'] ?? '');
$city        = trim($body['city'] ?? '');
$province    = trim($body['province'] ?? '');
$postalCode  = trim($body['postalCode'] ?? '');
$country     = trim($body['country'] ?? 'South Africa');

$title       = trim($body['title'] ?? '');
$firstName   = trim($body['firstName'] ?? '');
$lastName    = trim($body['lastName'] ?? '');
$email       = trim(strtolower($body['email'] ?? ''));
$phone       = trim($body['phone'] ?? '');
$password    = $body['password'] ?? '';

$packageId   = trim($body['packageId'] ?? '');
$paymentMethod = trim(strtolower($body['paymentMethod'] ?? 'payfast'));

$errors = [];
if (!$companyName) $errors[] = 'Company Name is required.';
if (!$addressLine1) $errors[] = 'Street address is required.';
if (!$city)        $errors[] = 'City is required.';
if (!$province)    $errors[] = 'Province is required.';
if (!$postalCode)  $errors[] = 'Postal code is required.';
if (!$firstName)   $errors[] = 'First name is required.';
if (!$lastName)    $errors[] = 'Last name is required.';
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Valid email is required.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
if (!$packageId)   $errors[] = 'Package selection is missing.';
if (!in_array($paymentMethod, ['payfast', 'invoice'], true)) $errors[] = 'Invalid payment method selected.';

if ($errors) {
    jsonResponse(['success' => false, 'message' => implode(' ', $errors)], 422);
}

// ── Resolve selected recruiter package ──
$package = getRecruiterPackage($packageId);

if ($package === null) {
    jsonResponse(['success' => false, 'message' => 'Invalid package selected.'], 400);
}

$expectedAmount = (float) $package['price'];
$packageLabel = $package['name'];
$packagePayFastLabel = $package['payfast_name'];

$pdo = getDB();
$emailVerificationRequired = isEmailVerificationRequired();
$emailVerified = $emailVerificationRequired ? 0 : 1;
$invoiceToken = null;
$invoiceNumber = null;
$invoiceExpiresAt = null;

if ($paymentMethod === 'invoice') {
    ensurePaymentInvoicesTable($pdo);
}

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
    $stmtC = $pdo->prepare('INSERT INTO companies (name, industry, size, vat_number, address_line1, address_line2, city, province, postal_code, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtC->execute([$companyName, $industry, $companySize, $vatNumber, $addressLine1, $addressLine2, $city, $province, $postalCode, $country]);
    $companyId = $pdo->lastInsertId();

    // 2. Create User
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmtU = $pdo->prepare('INSERT INTO users (title, first_name, last_name, email, phone, password_hash, company_id, role, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtU->execute([$title, $firstName, $lastName, $email, $phone, $hash, $companyId, 'recruiter', $emailVerified]);
    $userId = $pdo->lastInsertId();

    if ($emailVerificationRequired) {
        // 3. Generate Email Verification Token
        $token = generateToken();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $stmtV = $pdo->prepare('INSERT INTO email_verifications (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)');
        $stmtV->execute([$userId, $token, 'verification', $expiresAt]);
    }

    // 4. Pre-allocate job credits (confirmed by ITN callback later)
    $totalCredits = (int) $package['credits'];
    $expiryDays = (int) $package['expiry_days'];
    $creditExpiry = date('Y-m-d H:i:s', strtotime("+{$expiryDays} days"));

    $stmtCr = $pdo->prepare('INSERT INTO job_credits (user_id, payment_id, package_id, total_credits, used_credits, purchased_at, expires_at) VALUES (?, NULL, ?, ?, 0, NOW(), ?)');
    $stmtCr->execute([$userId, $packageId, $totalCredits, $creditExpiry]);

    if ($paymentMethod === 'invoice') {
        $invoiceToken = generateRecruiterInvoiceToken();
        $invoiceNumber = generateRecruiterInvoiceNumber($invoiceToken);
        $invoiceExpiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));

        $stmtInvoice = $pdo->prepare('INSERT INTO payment_invoices (user_id, company_id, invoice_number, invoice_token, package_id, amount, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmtInvoice->execute([$userId, $companyId, $invoiceNumber, $invoiceToken, $packageId, $expectedAmount, 'pending', $invoiceExpiresAt]);
    }

    $pdo->commit();

    // ── Log the recruiter in immediately so session persists through PayFast redirect ──
    $_SESSION['user_id']    = $userId;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_role']  = 'recruiter';
    $_SESSION['user_name']  = $firstName . ' ' . $lastName;

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

if ($paymentMethod === 'invoice') {
    $invoiceUrl = APP_URL . '/recruiter-invoice.html?token=' . urlencode($invoiceToken) . '&emailed=1';
    $invoiceSubtotal = round($expectedAmount / 1.15, 2);
    $invoiceVat = round($expectedAmount - $invoiceSubtotal, 2);

    $invoiceEmailBody = '
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">
            Hi ' . htmlspecialchars($firstName) . ', your recruiter account has been created and your invoice is ready.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
            <tr>
                <td style="padding:14px 18px;background:#F8FAFC;font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em;">Invoice Number</td>
                <td style="padding:14px 18px;background:#F8FAFC;font-size:15px;font-weight:700;color:#1E293B;text-align:right;">' . htmlspecialchars($invoiceNumber) . '</td>
            </tr>
            <tr>
                <td style="padding:14px 18px;font-size:14px;color:#64748B;">Package</td>
                <td style="padding:14px 18px;font-size:14px;color:#1E293B;text-align:right;">' . htmlspecialchars($packageLabel) . '</td>
            </tr>
            <tr>
                <td style="padding:14px 18px;font-size:14px;color:#64748B;">Subtotal</td>
                <td style="padding:14px 18px;font-size:14px;color:#1E293B;text-align:right;">' . formatRecruiterCurrency($invoiceSubtotal) . '</td>
            </tr>
            <tr>
                <td style="padding:14px 18px;font-size:14px;color:#64748B;">VAT (15%)</td>
                <td style="padding:14px 18px;font-size:14px;color:#1E293B;text-align:right;">' . formatRecruiterCurrency($invoiceVat) . '</td>
            </tr>
            <tr>
                <td style="padding:14px 18px;font-size:15px;font-weight:700;color:#1E293B;border-top:1px solid #E2E8F0;">Total Due</td>
                <td style="padding:14px 18px;font-size:18px;font-weight:800;color:#1E293B;text-align:right;border-top:1px solid #E2E8F0;">' . formatRecruiterCurrency($expectedAmount) . '</td>
            </tr>
        </table>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
            Please pay this invoice before ' . htmlspecialchars(date('j F Y', strtotime($invoiceExpiresAt))) . '. The secure invoice page includes your PayFast payment link.
        </p>
        <div style="text-align:center;margin:32px 0;">
            <a href="' . $invoiceUrl . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B4BA6,#7C3AED);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(59,75,166,0.3);">
                View Invoice &amp; Pay with PayFast
            </a>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
            If you selected invoice by mistake, you can ignore this email and sign up again when you are ready to pay immediately.
        </p>
    ';

    $invoiceEmailHtml = buildEmailTemplate('Your recruiter invoice', $invoiceEmailBody);
    sendResendEmail($email, 'Your recruiter invoice – JobLynk', $invoiceEmailHtml);

    jsonResponse([
        'success' => true,
        'message' => $emailVerificationRequired
            ? 'Account created. We sent your invoice and a separate email verification link.'
            : 'Account created. We sent your invoice email with a PayFast payment link.',
        'email' => $email,
        'paymentMethod' => 'invoice',
        'invoiceUrl' => $invoiceUrl,
        'invoiceNumber' => $invoiceNumber,
        'verificationRequired' => $emailVerificationRequired,
    ], 201);
}

// Build signed return URL so the recruiter is auto-logged-in after PayFast redirect
$returnTs  = time();
$returnSig = hash_hmac('sha256', $userId . ':' . $returnTs, PAYFAST_PASSPHRASE);
$returnUrl = APP_URL . '/api/auth/payment-return.php?uid=' . $userId . '&ts=' . $returnTs . '&sig=' . $returnSig;

$pfData = buildRecruiterPayFastData([
    'firstName' => $firstName,
    'lastName' => $lastName,
    'email' => $email,
    'amount' => $expectedAmount,
    'packageId' => $packageId,
    'packageLabel' => $packagePayFastLabel,
    'itemName' => 'JobLynk Recruiter - ' . $packagePayFastLabel,
    'userId' => $userId,
    'returnUrl' => $returnUrl,
    'cancelUrl' => APP_URL . '/recruiter-pricing.html?payment=cancelled',
]);

jsonResponse([
    'success'    => true,
    'message'    => $emailVerificationRequired
        ? 'Account created! Redirecting to PayFast for payment.'
        : 'Account created! Email verification is disabled for testing. Redirecting to PayFast for payment.',
    'email'      => $email,
    'paymentMethod' => 'payfast',
    'payfastUrl' => PAYFAST_URL,
    'payfastData' => $pfData,
    'verificationRequired' => $emailVerificationRequired,
], 201);
