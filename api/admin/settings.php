<?php
/**
 * /api/admin/settings.php
 * Admin Platform Settings API
 * 
 * GET           — Retrieve all settings (or a single key via ?key=X)
 * POST          — Save settings (expects JSON body with key-value pairs)
 * 
 * Settings are stored in a `settings` table (auto-created if missing).
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden: Admin access required.'], 403);
}

$pdo = getDB();

// ── Auto-create settings table ──
try {
    $pdo->query("SELECT 1 FROM settings LIMIT 0");
} catch (PDOException $e) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `settings` (
            `setting_key` VARCHAR(100) PRIMARY KEY,
            `setting_value` TEXT NOT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

$method = $_SERVER['REQUEST_METHOD'];

// ═══════════════════════════
// GET — Retrieve settings
// ═══════════════════════════
if ($method === 'GET') {
    $key = isset($_GET['key']) ? trim($_GET['key']) : null;

    if ($key) {
        $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        $value = $row ? json_decode($row['setting_value'], true) : null;
        jsonResponse(['success' => true, 'key' => $key, 'value' => $value]);
    }

    // Return all settings
    $stmt = $pdo->query("SELECT setting_key, setting_value, updated_at FROM settings ORDER BY setting_key");
    $all = [];
    foreach ($stmt->fetchAll() as $row) {
        $decoded = json_decode($row['setting_value'], true);
        $all[$row['setting_key']] = $decoded !== null ? $decoded : $row['setting_value'];
    }
    jsonResponse(['success' => true, 'settings' => $all]);
}

// ═══════════════════════════
// POST — Save settings
// ═══════════════════════════
if ($method === 'POST') {
    $body = getJsonBody();

    if (empty($body)) {
        jsonResponse(['success' => false, 'message' => 'No settings provided.'], 422);
    }

    // Each top-level key in the body becomes a setting row
    // Use REPLACE INTO for upsert (MySQL 5.6 compatible)
    $stmt = $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)");

    $saved = [];
    foreach ($body as $key => $value) {
        $safeKey = preg_replace('/[^a-zA-Z0-9_]/', '', $key);
        if (!$safeKey) continue;
        $stmt->execute([$safeKey, json_encode($value)]);
        $saved[] = $safeKey;
    }

    jsonResponse(['success' => true, 'message' => 'Settings saved.', 'keys' => $saved]);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
