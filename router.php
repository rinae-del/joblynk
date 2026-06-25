<?php
/**
 * router.php
 * Routes all .html requests (and the root /) through staff-guard.php for
 * landing/auth redirects,
 * then serves the matching HTML file. Works with both mod_php and PHP-FPM.
 */

$uri  = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH) ?? '';

// SEO-friendly single job pages: /job/{id}-{slug}
if (preg_match('#^/job/(\d+)(?:-[^/]*)?/?$#', $path, $m)) {
    $_GET['id'] = $m[1];
    require __DIR__ . '/job.php';
    exit;
}

// XML sitemap
if ($path === '/sitemap.xml') {
    require __DIR__ . '/sitemap.php';
    exit;
}

// Only serve the root path or .html files — reject everything else
if ($path !== '/' && !str_ends_with($path, '.html')) {
    // Pass through to the real file (needed for .php / .css / .js / images)
    return false;
}

require __DIR__ . '/staff-guard.php';

// Map root to index.html
if ($path === '/' || $path === '') {
    $path = '/index.html';
}

$file = __DIR__ . $path;

if (!file_exists($file) || !is_file($file) || !is_readable($file)) {
    http_response_code(404);
    echo 'Not found.';
    exit;
}

$content = file_get_contents($file);

// Strip UTF-8 BOM if present so browsers don't choke
if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
    $content = substr($content, 3);
}

echo $content;
