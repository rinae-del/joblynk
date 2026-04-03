<?php
/**
 * Shared helper functions for the API.
 */

require_once __DIR__ . '/resend.php';

/**
 * Set CORS and JSON response headers.
 */
function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');

    // Use the requesting origin instead of wildcard (required when credentials are included)
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = [APP_URL, 'http://localhost', 'http://127.0.0.1'];
    // Also allow any localhost port for dev
    if ($origin && (in_array($origin, $allowed) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin))) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }

    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');

    // Handle preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * Send a JSON response and exit.
 */
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

/**
 * Read JSON body from POST request.
 */
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Generate a secure random token.
 */
function generateToken(int $length = 32): string {
    return bin2hex(random_bytes($length));
}

/**
 * Whether email verification is required for account access.
 */
function isEmailVerificationRequired(): bool {
    return filter_var(env('EMAIL_VERIFICATION_REQUIRED', '1'), FILTER_VALIDATE_BOOLEAN);
}

/**
 * Send an email using the Resend API (via cURL).
 */
function sendResendEmail(string $to, string $subject, string $htmlBody): bool {
    $ch = curl_init('https://api.resend.com/emails');

    $payload = json_encode([
        'from'    => RESEND_FROM_EMAIL,
        'to'      => [$to],
        'subject' => $subject,
        'html'    => $htmlBody,
    ]);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . RESEND_API_KEY,
            'Content-Type: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
}

/**
 * Build a styled HTML email template.
 */
function buildEmailTemplate(string $title, string $bodyContent): string {
    return '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#F1F5F9;font-family:\'Inter\',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                        <!-- Header -->
                        <tr>
                            <td style="background:linear-gradient(135deg,#3B4BA6,#7C3AED);padding:32px 40px;text-align:center;">
                                <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.02em;">' . APP_NAME . '</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding:40px;">
                                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1E293B;">' . $title . '</h2>
                                ' . $bodyContent . '
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:24px 40px;background:#F8FAFC;text-align:center;border-top:1px solid #E2E8F0;">
                                <p style="margin:0;font-size:13px;color:#94A3B8;">© ' . date('Y') . ' ' . APP_NAME . '. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>';
}
