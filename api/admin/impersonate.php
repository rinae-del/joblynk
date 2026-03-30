<?php
/**
 * /api/admin/impersonate.php
 * Allows an admin to log in as another user, or revert back to admin.
 * 
 * GET ?user_id=X  — Impersonate user X (admin only)
 * GET ?revert=1   — Revert back to original admin session
 */

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

// ── Revert impersonation ──
if (isset($_GET['revert'])) {
    if (isset($_SESSION['original_admin']) && is_array($_SESSION['original_admin'])) {
        $_SESSION['user_id']    = $_SESSION['original_admin']['id'];
        $_SESSION['user_role']  = $_SESSION['original_admin']['role'];
        $_SESSION['user_name']  = $_SESSION['original_admin']['name'];
        $_SESSION['user_email'] = $_SESSION['original_admin']['email'];
        unset($_SESSION['original_admin']);
    } elseif (isset($_SESSION['original_admin_id'])) {
        $_SESSION['user_id']   = $_SESSION['original_admin_id'];
        $_SESSION['user_role'] = 'admin';
        unset($_SESSION['original_admin_id']);
    } else {
        // Not impersonating — just redirect
        header('Location: ../../admin-dashboard.html');
        exit;
    }

    // Regenerate session ID for security
    session_regenerate_id(true);

    header('Location: ../../admin-dashboard.html');
    exit;
}

// ── Auth: must be admin ──
if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden: Admin access required.'], 403);
}

// ── Impersonate a target user ──
if (isset($_GET['user_id'])) {
    $targetId = (int)$_GET['user_id'];
    if ($targetId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Invalid user ID.'], 422);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id, role, first_name, last_name, email FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    $targetUser = $stmt->fetch();

    if (!$targetUser) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    // Prevent impersonating another admin
    if ($targetUser['role'] === 'admin') {
        jsonResponse(['success' => false, 'message' => 'Cannot impersonate another admin.'], 403);
    }

    // Store current admin context before overwriting (only on first impersonation)
    if (!isset($_SESSION['original_admin'])) {
        $_SESSION['original_admin'] = [
            'id'    => $_SESSION['user_id'],
            'role'  => $_SESSION['user_role'],
            'name'  => $_SESSION['user_name'] ?? 'Admin',
            'email' => $_SESSION['user_email'] ?? '',
        ];
    }

    // Overwrite session with target user
    $_SESSION['user_id']    = $targetUser['id'];
    $_SESSION['user_role']  = $targetUser['role'];
    $_SESSION['user_name']  = trim($targetUser['first_name'] . ' ' . $targetUser['last_name']);
    $_SESSION['user_email'] = $targetUser['email'];

    // Regenerate session ID for security
    session_regenerate_id(true);

    // Redirect to appropriate dashboard
    $dashboard = ($targetUser['role'] === 'recruiter')
        ? '../../recruiter-dashboard.html'
        : '../../dashboard.html';
    header('Location: ' . $dashboard);
    exit;
}

jsonResponse(['success' => false, 'message' => 'Invalid request. Provide user_id or revert parameter.'], 400);
