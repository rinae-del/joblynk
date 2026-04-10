<?php

function getRecruiterPackageCatalog(): array {
    return [
        'intro' => [
            'id' => 'intro',
            'name' => 'Intro Listing',
            'payfast_name' => 'Intro Plan',
            'price' => 750.00,
            'credits' => 1,
            'jobs' => 1,
            'expiry_days' => 30,
        ],
        '1job' => [
            'id' => '1job',
            'name' => 'Standard Listing',
            'payfast_name' => 'Standard Plan',
            'price' => 1300.00,
            'credits' => 1,
            'jobs' => 1,
            'expiry_days' => 90,
        ],
        '2job' => [
            'id' => '2job',
            'name' => '2-Job Bundle',
            'payfast_name' => '2-Job Bundle',
            'price' => 2200.00,
            'credits' => 2,
            'jobs' => 2,
            'expiry_days' => 90,
        ],
        '3job' => [
            'id' => '3job',
            'name' => '3-Job Bundle',
            'payfast_name' => '3-Job Bundle',
            'price' => 2950.00,
            'credits' => 3,
            'jobs' => 3,
            'expiry_days' => 90,
        ],
        '4job' => [
            'id' => '4job',
            'name' => '4-Job Bundle',
            'payfast_name' => '4-Job Bundle',
            'price' => 3500.00,
            'credits' => 4,
            'jobs' => 4,
            'expiry_days' => 90,
        ],
        '5job' => [
            'id' => '5job',
            'name' => '5-Job Bundle',
            'payfast_name' => '5-Job Bundle',
            'price' => 3900.00,
            'credits' => 5,
            'jobs' => 5,
            'expiry_days' => 90,
        ],
    ];
}

function getRecruiterPackage(string $packageId): ?array {
    $packages = getRecruiterPackageCatalog();
    return $packages[$packageId] ?? null;
}

function formatRecruiterCurrency(float $amount): string {
    return 'R ' . number_format($amount, 2, '.', ',');
}

function buildRecruiterPayFastData(array $checkout): array {
    $itemName = $checkout['itemName'] ?? ('JobLynk Recruiter - ' . ($checkout['packageLabel'] ?? 'Plan'));

    $pfData = [
        'merchant_id' => PAYFAST_MERCHANT_ID,
        'merchant_key' => PAYFAST_MERCHANT_KEY,
        'return_url' => $checkout['returnUrl'],
        'cancel_url' => $checkout['cancelUrl'],
        'notify_url' => APP_URL . '/api/payments/notify.php',
        'name_first' => $checkout['firstName'],
        'name_last' => $checkout['lastName'],
        'email_address' => $checkout['email'],
        'amount' => number_format((float) $checkout['amount'], 2, '.', ''),
        'item_name' => $itemName,
        'custom_int1' => (int) $checkout['userId'],
        'custom_str1' => $checkout['packageId'],
        'custom_str2' => $checkout['email'],
    ];

    if (!empty($checkout['invoiceToken'])) {
        $pfData['custom_str3'] = $checkout['invoiceToken'];
    }

    $pfData['signature'] = generatePayFastSignature($pfData, PAYFAST_PASSPHRASE);

    return $pfData;
}

function ensurePaymentInvoicesTable(PDO $pdo): void {
    static $isEnsured = false;

    if ($isEnsured) {
        return;
    }

    try {
        $pdo->query('SELECT 1 FROM payment_invoices LIMIT 1');
    } catch (PDOException $e) {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS `payment_invoices` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `company_id` INT NULL,
                `invoice_number` VARCHAR(64) NOT NULL UNIQUE,
                `invoice_token` VARCHAR(64) NOT NULL UNIQUE,
                `package_id` VARCHAR(50) NOT NULL,
                `amount` DECIMAL(10,2) NOT NULL,
                `status` ENUM('pending', 'paid', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
                `payfast_payment_id` VARCHAR(255) NULL,
                `expires_at` DATETIME NOT NULL,
                `paid_at` DATETIME NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    $isEnsured = true;
}

function generateRecruiterInvoiceToken(): string {
    return bin2hex(random_bytes(32));
}

function generateRecruiterInvoiceNumber(string $invoiceToken): string {
    return 'INV-' . date('Ymd') . '-' . strtoupper(substr($invoiceToken, 0, 8));
}