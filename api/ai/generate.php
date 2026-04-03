<?php
/**
 * /api/ai/generate.php
 * Server-side proxy for DeepSeek AI cover letter generation.
 * 
 * POST — Accepts cover letter context, calls DeepSeek API using admin-configured key,
 *         returns generated content. Authenticated users only.
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = getJsonBody();
$prompt = trim($body['prompt'] ?? '');

if (!$prompt) {
    jsonResponse(['success' => false, 'message' => 'Prompt is required.'], 422);
}

// ── Retrieve DeepSeek API key from admin settings ──
$pdo = getDB();

try {
    $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'deepseek_api_key'");
    $stmt->execute();
    $row = $stmt->fetch();
} catch (PDOException $e) {
    jsonResponse(['success' => false, 'message' => 'AI generation is not configured. Please contact the administrator.'], 503);
}

if (!$row) {
    jsonResponse(['success' => false, 'message' => 'AI generation is not configured. The administrator needs to set the DeepSeek API key in Settings.'], 503);
}

$apiKey = json_decode($row['setting_value'], true);
if (!$apiKey || !is_string($apiKey)) {
    jsonResponse(['success' => false, 'message' => 'AI API key is invalid. Please contact the administrator.'], 503);
}

// ── Call DeepSeek API ──
$payload = json_encode([
    'model' => 'deepseek-chat',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a professional cover letter writer.'],
        ['role' => 'user', 'content' => $prompt],
    ],
    'temperature' => 0.7,
]);

$ch = curl_init('https://api.deepseek.com/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_TIMEOUT => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    jsonResponse(['success' => false, 'message' => 'Failed to reach AI service: ' . $curlError], 502);
}

if ($httpCode === 401) {
    jsonResponse(['success' => false, 'message' => 'AI API key is invalid or expired. Please contact the administrator.'], 502);
}

if ($httpCode !== 200) {
    jsonResponse(['success' => false, 'message' => 'AI service returned an error (HTTP ' . $httpCode . ').'], 502);
}

$data = json_decode($response, true);
if (!$data || !isset($data['choices'][0]['message']['content'])) {
    jsonResponse(['success' => false, 'message' => 'Unexpected response from AI service.'], 502);
}

$content = trim($data['choices'][0]['message']['content']);

jsonResponse(['success' => true, 'content' => $content]);
