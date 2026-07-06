<?php
/**
 * /api/admin/impersonate.php
 * Allows an admin to log in as another user, or revert back to admin.
 * 
 * GET ?user_id=X  - Impersonate user X (admin only)
 * GET ?revert=1   - Revert back to original admin session
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

/**
 * Append a tamper-evident row to the admin audit log. Best-effort: an audit
 * failure must never block the (already-authorised) admin action.
 */
function logAdminAudit(PDO $pdo, ?int $adminId, string $action, ?int $targetUserId = null, string $detail = ''): void {
    try {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS admin_audit_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NULL,
                action VARCHAR(50) NOT NULL,
                target_user_id INT NULL,
                detail VARCHAR(255) NOT NULL DEFAULT '',
                ip_address VARCHAR(45) NOT NULL DEFAULT '',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_audit_action (action),
                INDEX idx_admin_audit_admin (admin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        $stmt = $pdo->prepare(
            'INSERT INTO admin_audit_log (admin_id, action, target_user_id, detail, ip_address) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $adminId,
            $action,
            $targetUserId,
            substr($detail, 0, 255),
            substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
        ]);
    } catch (Throwable $e) {
        error_log('admin_audit_log write failed: ' . $e->getMessage());
    }
}

// ── Revert impersonation ──
if (isset($_GET['revert'])) {
    if (isset($_SESSION['original_admin']) && is_array($_SESSION['original_admin'])) {
        $adminId = (int) $_SESSION['original_admin']['id'];
        $impersonatedId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
        logAdminAudit(getDB(), $adminId, 'impersonate_revert', $impersonatedId, 'Reverted to admin session');
        $_SESSION['user_id']    = $_SESSION['original_admin']['id'];
        $_SESSION['user_role']  = $_SESSION['original_admin']['role'];
        $_SESSION['user_name']  = $_SESSION['original_admin']['name'];
        $_SESSION['user_email'] = $_SESSION['original_admin']['email'];
        unset($_SESSION['original_admin']);
    } elseif (isset($_SESSION['original_admin_id'])) {
        $adminId = (int) $_SESSION['original_admin_id'];
        $impersonatedId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
        logAdminAudit(getDB(), $adminId, 'impersonate_revert', $impersonatedId, 'Reverted to admin session');
        $_SESSION['user_id']   = $_SESSION['original_admin_id'];
        $_SESSION['user_role'] = 'admin';
        unset($_SESSION['original_admin_id']);
    } else {
        // Not impersonating - just redirect
        header('Location: ' . APP_URL . '/admin-overview.html');
        exit;
    }

    // Regenerate session ID for security
    session_regenerate_id(true);
    session_write_close();

    header('Location: ' . APP_URL . '/admin-overview.html');
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

    // Audit trail: record who impersonated whom (admin id is the original admin).
    logAdminAudit(
        $pdo,
        (int) ($_SESSION['original_admin']['id'] ?? $_SESSION['user_id']),
        'impersonate_start',
        (int) $targetUser['id'],
        'Impersonated ' . trim($targetUser['first_name'] . ' ' . $targetUser['last_name']) . ' <' . $targetUser['email'] . '>'
    );

    // Overwrite session with target user
    $_SESSION['user_id']    = $targetUser['id'];
    $_SESSION['user_role']  = $targetUser['role'];
    $_SESSION['user_name']  = trim($targetUser['first_name'] . ' ' . $targetUser['last_name']);
    $_SESSION['user_email'] = $targetUser['email'];

    // Regenerate session ID for security
    session_regenerate_id(true);
    session_write_close();

    // Redirect to appropriate dashboard
    $dashboard = ($targetUser['role'] === 'recruiter')
        ? APP_URL . '/recruiter-overview.html'
        : APP_URL . '/dashboard.html';
    header('Location: ' . $dashboard);
    exit;
}

jsonResponse(['success' => false, 'message' => 'Invalid request. Provide user_id or revert parameter.'], 400);
