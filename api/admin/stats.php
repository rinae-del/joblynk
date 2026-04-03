<?php
/**
 * /api/admin/stats.php
 * Admin Statistics API — returns real-time platform stats
 * 
 * GET — Overview KPIs, 30-day metrics, recent activity, report breakdowns
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Forbidden: Admin access required.'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$pdo = getDB();

// ── Total Counts ──
$totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$totalJobs  = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'active'")->fetchColumn();
$totalApps  = (int)$pdo->query("SELECT COUNT(*) FROM applications")->fetchColumn();
$totalDocs  = (int)$pdo->query("SELECT COUNT(*) FROM documents")->fetchColumn();
$totalRevenue = (float)$pdo->query("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success'")->fetchColumn();

// ── 30-Day Metrics ──
$thirtyDaysAgo = date('Y-m-d H:i:s', strtotime('-30 days'));

$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE created_at >= ?");
$stmt->execute([$thirtyDaysAgo]);
$newUsers30d = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'recruiter' AND created_at >= ?");
$stmt->execute([$thirtyDaysAgo]);
$newRecruiters30d = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM applications WHERE created_at >= ?");
$stmt->execute([$thirtyDaysAgo]);
$newApps30d = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success' AND created_at >= ?");
$stmt->execute([$thirtyDaysAgo]);
$revenue30d = (float)$stmt->fetchColumn();

// ── Recent Activity (last 15 items across tables) ──
$activities = [];

// Recent user registrations
$stmt = $pdo->query("SELECT id, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5");
foreach ($stmt->fetchAll() as $u) {
    $name = trim($u['first_name'] . ' ' . $u['last_name']);
    $roleLabel = $u['role'] === 'recruiter' ? 'recruiter' : ($u['role'] === 'admin' ? 'admin' : 'user');
    $activities[] = [
        'type' => 'user_registered',
        'color' => '#3B82F6',
        'text' => "<strong>{$name}</strong> registered as a new {$roleLabel}",
        'time' => $u['created_at'],
    ];
}

// Recent job postings
$stmt = $pdo->query("SELECT j.title, j.company, j.created_at FROM jobs j ORDER BY j.created_at DESC LIMIT 5");
foreach ($stmt->fetchAll() as $j) {
    $activities[] = [
        'type' => 'job_posted',
        'color' => '#7E22CE',
        'text' => "<strong>{$j['company']}</strong> posted \"{$j['title']}\"",
        'time' => $j['created_at'],
    ];
}

// Recent applications
$stmt = $pdo->query("
    SELECT a.applicant_name, j.title AS job_title, a.created_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    ORDER BY a.created_at DESC LIMIT 5
");
foreach ($stmt->fetchAll() as $a) {
    $name = $a['applicant_name'] ?: 'Someone';
    $activities[] = [
        'type' => 'application_submitted',
        'color' => '#059669',
        'text' => "<strong>{$name}</strong> applied for \"{$a['job_title']}\"",
        'time' => $a['created_at'],
    ];
}

// Recent payments
$stmt = $pdo->query("
    SELECT p.amount, p.package_id, p.created_at, u.first_name, u.last_name
    FROM payments p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'success'
    ORDER BY p.created_at DESC LIMIT 5
");
foreach ($stmt->fetchAll() as $p) {
    $name = trim($p['first_name'] . ' ' . $p['last_name']);
    $amt = number_format($p['amount'], 0);
    $activities[] = [
        'type' => 'payment_received',
        'color' => '#EC4899',
        'text' => "<strong>Revenue:</strong> R{$amt} payment from {$name}",
        'time' => $p['created_at'],
    ];
}

// Sort all activities by time descending, take top 10
usort($activities, function($a, $b) {
    return strtotime($b['time']) - strtotime($a['time']);
});
$activities = array_slice($activities, 0, 10);

// ── Report Breakdowns ──
// Users by status
$verifiedUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE email_verified = 1")->fetchColumn();
$unverifiedUsers = $totalUsers - $verifiedUsers;
$verifiedPct = $totalUsers > 0 ? round($verifiedUsers / $totalUsers * 100) : 0;
$unverifiedPct = 100 - $verifiedPct;

// Users by role
$seekerCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'job_seeker'")->fetchColumn();
$recruiterCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'recruiter'")->fetchColumn();
$adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();

// Jobs by status
$totalJobsAll = (int)$pdo->query("SELECT COUNT(*) FROM jobs")->fetchColumn();
$activeJobs = $totalJobs;
$closedJobs = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'closed'")->fetchColumn();
$draftJobs  = (int)$pdo->query("SELECT COUNT(*) FROM jobs WHERE status = 'draft'")->fetchColumn();
$activePct = $totalJobsAll > 0 ? round($activeJobs / $totalJobsAll * 100) : 0;
$closedPct = $totalJobsAll > 0 ? round($closedJobs / $totalJobsAll * 100) : 0;
$draftPct  = $totalJobsAll > 0 ? round($draftJobs / $totalJobsAll * 100) : 0;

// Applications by status
$appStatuses = $pdo->query("SELECT status, COUNT(*) AS cnt FROM applications GROUP BY status")->fetchAll();
$appBreakdown = ['submitted' => 0, 'reviewed' => 0, 'shortlisted' => 0, 'rejected' => 0];
foreach ($appStatuses as $as) {
    $appBreakdown[$as['status']] = (int)$as['cnt'];
}
$reviewedApps = $appBreakdown['reviewed'] + $appBreakdown['shortlisted'];
$pendingApps  = $appBreakdown['submitted'];
$rejectedApps = $appBreakdown['rejected'];
$reviewedPct = $totalApps > 0 ? round($reviewedApps / $totalApps * 100) : 0;
$pendingPct  = $totalApps > 0 ? round($pendingApps / $totalApps * 100) : 0;
$rejectedPct = $totalApps > 0 ? round($rejectedApps / $totalApps * 100) : 0;

jsonResponse([
    'success' => true,
    'overview' => [
        'totalUsers'   => $totalUsers,
        'totalJobs'    => $totalJobs,
        'totalApps'    => $totalApps,
        'totalDocs'    => $totalDocs,
        'totalRevenue' => $totalRevenue,
    ],
    'kpi30d' => [
        'newUsers'      => $newUsers30d,
        'newRecruiters' => $newRecruiters30d,
        'newApps'       => $newApps30d,
        'revenue'       => $revenue30d,
    ],
    'activity' => $activities,
    'reports' => [
        'users' => [
            'total'      => $totalUsers,
            'verified'   => $verifiedUsers,
            'unverified' => $unverifiedUsers,
            'verifiedPct'   => $verifiedPct,
            'unverifiedPct' => $unverifiedPct,
            'seekers'    => $seekerCount,
            'recruiters' => $recruiterCount,
            'admins'     => $adminCount,
        ],
        'jobs' => [
            'total'     => $totalJobsAll,
            'active'    => $activeJobs,
            'closed'    => $closedJobs,
            'draft'     => $draftJobs,
            'activePct' => $activePct,
            'closedPct' => $closedPct,
            'draftPct'  => $draftPct,
        ],
        'applications' => [
            'total'       => $totalApps,
            'reviewed'    => $reviewedApps,
            'pending'     => $pendingApps,
            'rejected'    => $rejectedApps,
            'reviewedPct' => $reviewedPct,
            'pendingPct'  => $pendingPct,
            'rejectedPct' => $rejectedPct,
        ],
    ],
]);
