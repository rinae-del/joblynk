<?php
/**
 * System user for aggregated job listings (Adzuna, DPSA, etc.).
 */

require_once __DIR__ . '/../config/env.php';

function getSystemUserId(PDO $pdo): int
{
    $override = (int) env('SYSTEM_USER_ID', '0');
    if ($override > 0) {
        return $override;
    }

    $email = 'system@joblynk.internal';
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int) $existing;
    }

    $passwordHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("
        INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified)
        VALUES ('JobLynk', 'System', ?, ?, 'admin', 1)
    ");
    $stmt->execute([$email, $passwordHash]);

    return (int) $pdo->lastInsertId();
}
