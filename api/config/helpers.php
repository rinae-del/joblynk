<?php
/**
 * Shared helper functions for the API.
 */

require_once __DIR__ . '/maintenance.php';
require_once __DIR__ . '/mailer.php';

abortIfSiteTakedown();

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
 * Deprecated alias — email now sends via AWS SES (see config/mailer.php).
 * Retained so existing callers keep working without edits.
 */
function sendResendEmail(string $to, string $subject, string $htmlBody): bool {
    return sendEmail($to, $subject, $htmlBody);
}

/**
 * Build a styled HTML email template.
 */
function buildEmailTemplate(string $title, string $bodyContent): string {
    $appName = htmlspecialchars(APP_NAME, ENT_QUOTES);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES);
    $logoUrl = htmlspecialchars(rtrim(APP_URL, '/') . '/images/logo.png', ENT_QUOTES);

    return '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#EEF2F7;font-family:\'Inter\',Arial,sans-serif;color:#1E293B;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:42px 18px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 18px 50px rgba(15,23,42,0.10);">
                        <!-- Header -->
                        <tr>
                            <td style="background:#0F172A;padding:28px 34px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="68" valign="middle">
                                            <img src="' . $logoUrl . '" width="58" height="58" alt="' . $appName . '" style="display:block;width:58px;height:58px;border-radius:16px;object-fit:cover;border:1px solid rgba(255,255,255,0.18);">
                                        </td>
                                        <td valign="middle" style="padding-left:14px;">
                                            <div style="margin:0;color:#FFFFFF;font-size:24px;font-weight:900;letter-spacing:0;">' . $appName . '</div>
                                            <div style="margin-top:4px;color:#CBD5E1;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Career platform</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding:38px 40px 34px;">
                                <h2 style="margin:0 0 18px;font-size:23px;line-height:1.25;font-weight:800;color:#0F172A;letter-spacing:0;">' . $safeTitle . '</h2>
                                ' . $bodyContent . '
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:22px 40px;background:#F8FAFC;text-align:center;border-top:1px solid #E2E8F0;">
                                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;">This message was sent by ' . $appName . '.</p>
                                <p style="margin:6px 0 0;font-size:12px;color:#94A3B8;">&copy; ' . date('Y') . ' ' . $appName . '. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>';
}
