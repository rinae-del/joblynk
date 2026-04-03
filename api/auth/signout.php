<?php
/**
 * POST /api/auth/signout.php
 * Destroy the user session.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params['path'], $params['domain'],
        $params['secure'], $params['httponly']
    );
}
session_destroy();

jsonResponse(['success' => true, 'message' => 'Signed out successfully.']);
