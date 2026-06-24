<?php
/**
 * GET /api/auth/session.php
 * Check if the user is logged in. Returns user data if so.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

// Prevent browser from caching session status
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if (isset($_SESSION['user_id'])) {
    // Look up email_verified from DB for recruiter verification flow
    require_once __DIR__ . '/../config/database.php';
    $pdo = getDB();
    $avatarColumnExists = false;

    try {
        $avatarColumnExists = (bool) $pdo->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->fetch();
    } catch (Throwable $e) {
        $avatarColumnExists = false;
    }

    $select = $avatarColumnExists
        ? 'SELECT u.email_verified, u.avatar_url, c.name AS company_name FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.id = ?'
        : 'SELECT u.email_verified, c.name AS company_name FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.id = ?';

    $stmt = $pdo->prepare($select);
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    $emailVerified = $row ? (bool) $row['email_verified'] : false;
    $avatarUrl = $avatarColumnExists ? ($row['avatar_url'] ?? '') : '';
    $companyName = $row['company_name'] ?? '';

    jsonResponse([
        'loggedIn' => true,
        'user'     => [
            'id'    => $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role'  => $_SESSION['user_role'],
            'avatar_url' => $avatarUrl,
            'company_name' => $companyName,
            'email_verified' => $emailVerified,
            'is_impersonating' => isset($_SESSION['original_admin']) || isset($_SESSION['original_admin_id'])
        ]
    ]);
} else {
    jsonResponse(['loggedIn' => false]);
}
