<?php
/**
 * Admin Documents API
 * GET /api/admin/documents.php
 */

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden.'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$pdo = getDB();

$stmt = $pdo->query('
    SELECT d.id, d.doc_type, d.name, d.accent_color, d.created_at, d.updated_at,
           u.first_name, u.last_name, u.email
    FROM documents d
    JOIN users u ON u.id = d.user_id
    ORDER BY d.updated_at DESC
');

jsonResponse([
    'success' => true,
    'documents' => $stmt->fetchAll(PDO::FETCH_ASSOC),
]);