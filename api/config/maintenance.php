<?php
/**
 * Temporary site takedown toggle.
 * Set SITE_TAKEDOWN to false to restore normal operation.
 */
const SITE_TAKEDOWN = true;

function isSiteTakedown(): bool
{
    return SITE_TAKEDOWN;
}

function serveTakedown404(): void
{
    http_response_code(404);

    $file = dirname(__DIR__, 2) . '/404.html';
    if (!is_readable($file)) {
        echo 'Not found.';
        exit;
    }

    $content = file_get_contents($file);
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }

    echo $content;
    exit;
}

function abortIfSiteTakedown(): void
{
    if (!isSiteTakedown()) {
        return;
    }

    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
    if (str_contains($path, '/api/')) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Not found.']);
        exit;
    }

    serveTakedown404();
}
