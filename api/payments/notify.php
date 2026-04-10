<?php
/**
 * POST /api/payments/notify.php
 * PayFast ITN (Instant Transaction Notification) Handler
 * 
 * PayFast POSTs payment confirmations here after a successful payment.
 * This script verifies the signature, validates with PayFast, and records the payment.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/payfast.php';
require_once __DIR__ . '/../config/recruiter-payments.php';

// Only respond to POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// ── 1. Get POST data ──
$pfData = $_POST;

foreach ($pfData as $key => $value) {
    $pfData[$key] = stripslashes((string) $value);
}

// Build parameter string for ITN verification using all posted fields up to signature.
$pfPassphrase = trim(PAYFAST_PASSPHRASE);
$pfParamString = buildPayFastParameterString($pfData, false, true, false);

// Add passphrase if set
if ($pfPassphrase !== '') {
    $pfParamString .= '&passphrase=' . urlencode($pfPassphrase);
}

// ── 2. Verify Signature ──
$expectedSignature = md5($pfParamString);
if ($expectedSignature !== $pfData['signature']) {
    error_log('PayFast ITN: Signature mismatch');
    http_response_code(400);
    exit('Invalid signature');
}

// ── 3. Verify with PayFast server ──
$ch = curl_init(PAYFAST_VALIDATE_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $pfParamString,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
]);
$pfResponse = curl_exec($ch);
curl_close($ch);

if (trim($pfResponse) !== 'VALID') {
    error_log('PayFast ITN: Server validation failed — ' . $pfResponse);
    http_response_code(400);
    exit('Validation failed');
}

// ── 4. Payment was verified, process it ──
$paymentId   = $pfData['pf_payment_id'];
$paymentStatus = $pfData['payment_status'];
$amountGross = (float) $pfData['amount_gross'];
$customStr1  = $pfData['custom_str1'] ?? '';  // plan ID (e.g. "intro", "3job")
$customStr2  = $pfData['custom_str2'] ?? '';  // user email stored at checkout
$customStr3  = $pfData['custom_str3'] ?? '';  // invoice token for invoice payments
$customInt1  = $pfData['custom_int1'] ?? 0;   // user_id if logged in

if ($paymentStatus !== 'COMPLETE') {
    error_log("PayFast ITN: Payment not complete — status: $paymentStatus");
    http_response_code(200); // Still respond 200 to stop retries
    exit('Not complete');
}

try {
    $pdo = getDB();

    // Check for duplicate
    $stmt = $pdo->prepare('SELECT id FROM payments WHERE payfast_payment_id = ?');
    $stmt->execute([$paymentId]);
    if ($stmt->fetch()) {
        http_response_code(200);
        exit('Already processed');
    }

    // Determine user_id
    $userId = (int) $customInt1;

    // If no user_id, try to find by email
    if (!$userId && $customStr2) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([strtolower(trim($customStr2))]);
        $user = $stmt->fetch();
        if ($user) $userId = (int) $user['id'];
    }

    if (!$userId) {
        error_log("PayFast ITN: Could not resolve user for payment $paymentId");
        http_response_code(200);
        exit('No user found');
    }

    // Record payment
    $stmt = $pdo->prepare('INSERT INTO payments (user_id, payfast_payment_id, amount, package_id, status) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $paymentId, $amountGross, $customStr1, 'success']);
    $paymentDbId = $pdo->lastInsertId();

    $package = getRecruiterPackage($customStr1);
    $totalCredits = (int) ($package['credits'] ?? 1);
    $expiryDays = (int) ($package['expiry_days'] ?? 90);
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiryDays} days"));

    // Link pre-allocated credits to this payment (created at signup with payment_id = NULL)
    $stmt = $pdo->prepare('UPDATE job_credits SET payment_id = ? WHERE user_id = ? AND package_id = ? AND payment_id IS NULL LIMIT 1');
    $stmt->execute([$paymentDbId, $userId, $customStr1]);

    // If no pre-allocated row was found (edge case), create credits now
    if ($stmt->rowCount() === 0) {
        $stmt = $pdo->prepare('INSERT INTO job_credits (user_id, payment_id, package_id, total_credits, used_credits, purchased_at, expires_at) VALUES (?, ?, ?, ?, 0, NOW(), ?)');
        $stmt->execute([$userId, $paymentDbId, $customStr1, $totalCredits, $expiresAt]);
    }

    if ($customStr3 !== '') {
        ensurePaymentInvoicesTable($pdo);
        $stmt = $pdo->prepare("UPDATE payment_invoices SET status = 'paid', payfast_payment_id = ?, paid_at = NOW() WHERE invoice_token = ? AND status = 'pending'");
        $stmt->execute([$paymentId, $customStr3]);
    }

    error_log("PayFast ITN: Payment $paymentId recorded for user $userId — R$amountGross ($customStr1) — $totalCredits credits activated, expires $expiresAt");
    http_response_code(200);
    exit('OK');

} catch (Exception $e) {
    error_log('PayFast ITN: DB error — ' . $e->getMessage());
    http_response_code(500);
    exit('Server error');
}
