<?php
/**
 * POST api/coming-soon/notify.php
 * Store an email for the launch-notification list.
 */
require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body  = getJsonBody();
$email = trim(strtolower($body['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Please enter a valid email address.'], 422);
}

$file = __DIR__ . '/../../data/notify-list.txt';
$dir  = dirname($file);

if (!is_dir($dir)) {
    if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
        jsonResponse(['success' => false, 'message' => 'Server storage error.'], 500);
    }
}

$entry = date('Y-m-d H:i:s') . ' | ' . $email . PHP_EOL;
$bytes = @file_put_contents($file, $entry, FILE_APPEND | LOCK_EX);

if ($bytes === false) {
    jsonResponse(['success' => false, 'message' => 'Unable to save subscription.'], 500);
}

jsonResponse(['success' => true, 'message' => 'Subscribed successfully.']);
