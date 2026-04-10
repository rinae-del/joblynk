<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../config/payfast.php';
require_once __DIR__ . '/../config/recruiter-payments.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$token = trim($_GET['token'] ?? '');

if ($token === '') {
    jsonResponse(['success' => false, 'message' => 'Invoice token is required.'], 422);
}

try {
    $pdo = getDB();
    ensurePaymentInvoicesTable($pdo);

    $stmt = $pdo->prepare(
        'SELECT pi.id, pi.user_id, pi.company_id, pi.invoice_number, pi.invoice_token, pi.package_id, pi.amount, pi.status, pi.payfast_payment_id, pi.expires_at, pi.paid_at, pi.created_at,
                u.first_name, u.last_name, u.email,
                c.name AS company_name, c.vat_number, c.address_line1, c.address_line2, c.city, c.province, c.postal_code, c.country
         FROM payment_invoices pi
         INNER JOIN users u ON u.id = pi.user_id
         LEFT JOIN companies c ON c.id = pi.company_id
         WHERE pi.invoice_token = ?
         LIMIT 1'
    );
    $stmt->execute([$token]);
    $invoice = $stmt->fetch();

    if (!$invoice) {
        jsonResponse(['success' => false, 'message' => 'Invoice not found.'], 404);
    }

    if ($invoice['status'] === 'pending' && strtotime($invoice['expires_at']) < time()) {
        $expireStmt = $pdo->prepare("UPDATE payment_invoices SET status = 'expired' WHERE id = ? AND status = 'pending'");
        $expireStmt->execute([$invoice['id']]);
        $invoice['status'] = 'expired';
    }

    $package = getRecruiterPackage($invoice['package_id']);
    if ($package === null) {
        jsonResponse(['success' => false, 'message' => 'Invoice package is invalid.'], 400);
    }

    $amount = (float) $invoice['amount'];
    $subtotal = round($amount / 1.15, 2);
    $vat = round($amount - $subtotal, 2);
    $addressParts = array_filter([
        $invoice['address_line1'] ?? '',
        $invoice['address_line2'] ?? '',
    ]);

    $response = [
        'success' => true,
        'invoice' => [
            'invoiceNumber' => $invoice['invoice_number'],
            'token' => $invoice['invoice_token'],
            'status' => $invoice['status'],
            'packageId' => $invoice['package_id'],
            'packageLabel' => $package['name'],
            'jobs' => (int) $package['jobs'],
            'amount' => $amount,
            'subtotal' => $subtotal,
            'vat' => $vat,
            'currencyAmount' => formatRecruiterCurrency($amount),
            'currencySubtotal' => formatRecruiterCurrency($subtotal),
            'currencyVat' => formatRecruiterCurrency($vat),
            'contactName' => trim(($invoice['first_name'] ?? '') . ' ' . ($invoice['last_name'] ?? '')),
            'contactEmail' => $invoice['email'],
            'companyName' => $invoice['company_name'] ?? '',
            'vatNumber' => $invoice['vat_number'] ?? '',
            'addressLine' => implode(', ', $addressParts),
            'city' => $invoice['city'] ?? '',
            'province' => $invoice['province'] ?? '',
            'postalCode' => $invoice['postal_code'] ?? '',
            'country' => $invoice['country'] ?? 'South Africa',
            'createdAt' => $invoice['created_at'],
            'expiresAt' => $invoice['expires_at'],
            'paidAt' => $invoice['paid_at'],
        ],
    ];

    if ($invoice['status'] === 'pending') {
        $tokenParam = urlencode($invoice['invoice_token']);
        $response['payfastUrl'] = PAYFAST_URL;
        $response['payfastData'] = buildRecruiterPayFastData([
            'firstName' => $invoice['first_name'],
            'lastName' => $invoice['last_name'],
            'email' => $invoice['email'],
            'amount' => $amount,
            'packageId' => $invoice['package_id'],
            'packageLabel' => $package['payfast_name'],
            'itemName' => 'JobLynk Recruiter - ' . $package['payfast_name'],
            'userId' => (int) $invoice['user_id'],
            'invoiceToken' => $invoice['invoice_token'],
            'returnUrl' => APP_URL . '/recruiter-invoice.html?token=' . $tokenParam . '&payment=success',
            'cancelUrl' => APP_URL . '/recruiter-invoice.html?token=' . $tokenParam . '&payment=cancelled',
        ]);
    }

    jsonResponse($response);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Unable to load invoice right now.'], 500);
}