<?php
/**
 * Admin Users API
 * GET    /api/admin/users.php         List all users
 * DELETE /api/admin/users.php?id=X    Delete a user
 * POST   /api/admin/users.php         Update user role/status  { id, role?, suspended? }
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: List all users ──
if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT u.id, u.first_name, u.last_name, u.email, u.role,
               u.email_verified, u.created_at, u.updated_at,
               c.name AS company_name
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        ORDER BY u.created_at DESC
    ");

    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(['success' => true, 'count' => count($users), 'users' => $users]);
}

// ── POST: Update user role or verification status ──
if ($method === 'POST') {
    $body = getJsonBody();
    $targetId = isset($body['id']) ? (int)$body['id'] : 0;
    if (!$targetId) {
        jsonResponse(['success' => false, 'message' => 'User ID is required.'], 422);
    }

    // Prevent self-modification
    if ($targetId === (int)$_SESSION['user_id']) {
        jsonResponse(['success' => false, 'message' => 'Cannot modify your own account.'], 403);
    }

    $fields = [];
    $params = [];

    if (isset($body['role'])) {
        $validRoles = ['job_seeker', 'recruiter', 'admin'];
        if (!in_array($body['role'], $validRoles)) {
            jsonResponse(['success' => false, 'message' => 'Invalid role.'], 422);
        }
        $fields[] = 'role = ?';
        $params[] = $body['role'];
    }

    if (isset($body['email_verified'])) {
        $fields[] = 'email_verified = ?';
        $params[] = $body['email_verified'] ? 1 : 0;
    }

    if (empty($fields)) {
        jsonResponse(['success' => false, 'message' => 'No fields to update.'], 422);
    }

    $params[] = $targetId;
    $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    jsonResponse(['success' => true, 'message' => 'User updated.']);
}

// ── DELETE: Remove a user ──
if ($method === 'DELETE') {
    $targetId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$targetId) {
        jsonResponse(['success' => false, 'message' => 'User ID is required.'], 422);
    }

    // Prevent self-deletion
    if ($targetId === (int)$_SESSION['user_id']) {
        jsonResponse(['success' => false, 'message' => 'Cannot delete your own account.'], 403);
    }

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$targetId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    jsonResponse(['success' => true, 'message' => 'User deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
