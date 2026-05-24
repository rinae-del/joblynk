<?php
/**
 * POST /api/payments/checkout.php
 * Create a signed PayFast checkout payload for an authenticated recruiter.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/payfast.php';
require_once __DIR__ . '/../config/recruiter-payments.php';

setCorsHeaders();

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'You must be signed in to continue.'], 401);
}

$role = (string) ($_SESSION['user_role'] ?? '');
if (!in_array($role, ['recruiter', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Only recruiters can purchase packages.'], 403);
}

$body = getJsonBody();
$packageId = trim((string) ($body['packageId'] ?? ''));

if ($packageId === '') {
    jsonResponse(['success' => false, 'message' => 'Package ID is required.'], 422);
}

$package = getRecruiterPackage($packageId);
if ($package === null) {
    jsonResponse(['success' => false, 'message' => 'Selected package is invalid.'], 422);
}

if (!isRecruiterPackageAvailable($package)) {
    jsonResponse(['success' => false, 'message' => 'The selected introductory offer has expired. Please choose another package.'], 422);
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'User account was not found.'], 404);
    }

    $sessionName = trim((string) ($_SESSION['user_name'] ?? ''));
    $nameParts = $sessionName === '' ? [] : preg_split('/\s+/', $sessionName);

    $firstName = trim((string) ($user['first_name'] ?? ''));
    if ($firstName === '' && !empty($nameParts)) {
        $firstName = (string) array_shift($nameParts);
    }

    $lastName = trim((string) ($user['last_name'] ?? ''));
    if ($lastName === '' && !empty($nameParts)) {
        $lastName = implode(' ', $nameParts);
    }

    $email = trim((string) ($user['email'] ?? ($_SESSION['user_email'] ?? '')));
    if ($email === '') {
        jsonResponse(['success' => false, 'message' => 'Your account is missing an email address.'], 422);
    }

    $payfastData = buildRecruiterPayFastData([
        'firstName' => $firstName,
        'lastName' => $lastName,
        'email' => $email,
        'amount' => (float) $package['price'],
        'packageId' => $package['id'],
        'packageLabel' => $package['payfast_name'],
        'itemName' => 'JobLynk Recruiter - ' . $package['payfast_name'],
        'userId' => (int) $_SESSION['user_id'],
        'returnUrl' => APP_URL . '/recruiter-pricing.html?payment=success',
        'cancelUrl' => APP_URL . '/recruiter-pricing.html?payment=cancelled',
    ]);

    jsonResponse([
        'success' => true,
        'payfastUrl' => PAYFAST_URL,
        'payfastData' => $payfastData,
    ]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Unable to start checkout right now.'], 500);
}
