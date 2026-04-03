<?php
/**
 * Job Credits API
 * GET — returns the authenticated user's active credit packages.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();
require_once __DIR__ . '/../config/session.php';
startSecureSession();

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'error' => 'Unauthorized'], 401);
}

$userId = $_SESSION['user_id'];
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("
        SELECT jc.id, jc.package_id, jc.total_credits, jc.used_credits,
               (jc.total_credits - jc.used_credits) AS remaining,
               jc.purchased_at, jc.expires_at,
               CASE WHEN jc.expires_at > NOW() AND jc.used_credits < jc.total_credits THEN 1 ELSE 0 END AS is_active
        FROM job_credits jc
        WHERE jc.user_id = ?
        ORDER BY jc.expires_at DESC
    ");
    $stmt->execute([$userId]);
    $credits = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalRemaining = 0;
    foreach ($credits as $c) {
        if ($c['is_active']) {
            $totalRemaining += (int) $c['remaining'];
        }
    }

    jsonResponse([
        'success' => true,
        'total_remaining' => $totalRemaining,
        'credits' => $credits
    ]);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
