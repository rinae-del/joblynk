<?php
require_once __DIR__ . '/api/config/session.php';
startSecureSession();

$uri      = $_SERVER['REQUEST_URI'] ?? '';
$path     = parse_url($uri, PHP_URL_PATH) ?? '';
$baseName = basename($path);
$isRoot   = ($path === '/' || $path === '');

$userRole = $_SESSION['user_role'] ?? '';

function redirectToDashboard(string $role): void
{
    $dash = 'dashboard.html';
    if ($role === 'recruiter') $dash = 'recruiter-overview.html';
    if ($role === 'admin')     $dash = 'admin-overview.html';
    header('Location: ' . $dash);
    exit;
}

/* ── Landing page: send visitors to the public home ── */
if ($baseName === 'index.html' || $isRoot) {
    if ($userRole) {
        redirectToDashboard($userRole);
    }
    header('Location: home.html');
    exit;
}

/* ── Auth pages: skip if already signed in ── */
if (in_array($baseName, ['sign-in.html', 'sign-up.html'], true) && $userRole) {
    redirectToDashboard($userRole);
}
