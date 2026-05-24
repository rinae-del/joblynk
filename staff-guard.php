<?php
require_once __DIR__ . '/api/config/session.php';
startSecureSession();

$staffRoles = ['admin', 'recruiter'];
$uri        = $_SERVER['REQUEST_URI'] ?? '';
$path       = parse_url($uri, PHP_URL_PATH) ?? '';
$baseName   = basename($path);

/*  Pages that are always public  */
$publicPages = [
    'index.html',
    'sign-in.html',
    'sign-up.html',
    'sign-out.html',
    'reset-password.html',
    'verify-email.html',
    'forgot-password.html',
    'new-password.html',
    'terms-and-conditions.html',
    'recruiter-terms.html',
    'privacy-policy.html',
];

$isRoot = ($path === '/' || $path === '');

/* ── Coming-soon page (index.html / /) ── */
if ($baseName === 'index.html' || $isRoot) {
    // Staff already logged in? Send them straight to work.
    if (!empty($_SESSION['user_role']) && in_array($_SESSION['user_role'], $staffRoles, true)) {
        $dash = 'dashboard.html';
        if ($_SESSION['user_role'] === 'recruiter') $dash = 'recruiter-overview.html';
        if ($_SESSION['user_role'] === 'admin')     $dash = 'admin-overview.html';
        header('Location: ' . $dash);
        exit;
    }
    return;
}

/* ── Auth pages ── */
if (in_array($baseName, ['sign-in.html', 'sign-up.html'], true)) {
    if (!empty($_SESSION['user_role']) && in_array($_SESSION['user_role'], $staffRoles, true)) {
        $dash = 'dashboard.html';
        if ($_SESSION['user_role'] === 'recruiter') $dash = 'recruiter-overview.html';
        if ($_SESSION['user_role'] === 'admin')     $dash = 'admin-overview.html';
        header('Location: ' . $dash);
        exit;
    }
    return;
}

/* ── Legal / helper pages that stay public ── */
if (in_array($baseName, $publicPages, true)) {
    return;
}

/* ── Everything else is staff-only ── */
if (empty($_SESSION['user_role']) || !in_array($_SESSION['user_role'], $staffRoles, true)) {
    header('Location: index.html');
    exit;
}
