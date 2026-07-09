<?php
require_once __DIR__ . '/api/config/maintenance.php';
if (isSiteTakedown()) {
    serveTakedown404();
}

/**
 * sitemap.php — XML sitemap of public pages + every active job.
 * Served at /sitemap.xml (see .htaccess / router.php).
 */

require_once __DIR__ . '/api/config/database.php';
require_once __DIR__ . '/api/config/helpers.php';
require_once __DIR__ . '/api/config/resend.php'; // APP_URL

function sm_slug(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

$base = rtrim(APP_URL, '/');

$staticPages = [
    ['loc' => $base . '/', 'priority' => '1.0', 'freq' => 'daily'],
    ['loc' => $base . '/home.html', 'priority' => '1.0', 'freq' => 'daily'],
    ['loc' => $base . '/jobs.html', 'priority' => '0.9', 'freq' => 'hourly'],
    ['loc' => $base . '/recruiter-pricing.html', 'priority' => '0.6', 'freq' => 'weekly'],
    ['loc' => $base . '/cv-builder.html', 'priority' => '0.6', 'freq' => 'weekly'],
    ['loc' => $base . '/cover-letter.html', 'priority' => '0.5', 'freq' => 'weekly'],
];

$jobs = [];
try {
    $pdo = getDB();
    $stmt = $pdo->query('SELECT id, title, location, updated_at, created_at FROM jobs WHERE status = "active" ORDER BY created_at DESC LIMIT 5000');
    $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
    error_log('sitemap jobs query failed: ' . $e->getMessage());
}

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($staticPages as $page) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($page['loc'], ENT_QUOTES) . "</loc>\n";
    echo '    <changefreq>' . $page['freq'] . "</changefreq>\n";
    echo '    <priority>' . $page['priority'] . "</priority>\n";
    echo "  </url>\n";
}

foreach ($jobs as $job) {
    $slugParts = array_filter([(string) ($job['title'] ?? ''), (string) ($job['location'] ?? '')]);
    $slug = sm_slug(implode(' ', $slugParts)) ?: 'job';
    $loc = $base . '/job/' . (int) $job['id'] . '-' . $slug;
    $lastmod = date('Y-m-d', strtotime((string) ($job['updated_at'] ?: $job['created_at'])) ?: time());
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($loc, ENT_QUOTES) . "</loc>\n";
    echo '    <lastmod>' . $lastmod . "</lastmod>\n";
    echo "    <changefreq>weekly</changefreq>\n";
    echo "    <priority>0.8</priority>\n";
    echo "  </url>\n";
}

echo '</urlset>';
