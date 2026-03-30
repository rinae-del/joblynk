<?php
/**
 * GET /api/auth/session.php
 * Check if the user is logged in. Returns user data if so.
 */

session_start();
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (isset($_SESSION['user_id'])) {
    jsonResponse([
        'loggedIn' => true,
        'user'     => [
            'id'    => $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role'  => $_SESSION['user_role'],
            'is_impersonating' => isset($_SESSION['original_admin']) || isset($_SESSION['original_admin_id'])
        ]
    ]);
} else {
    jsonResponse(['loggedIn' => false]);
}
