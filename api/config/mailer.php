<?php
/**
 * Mailer configuration + AWS SES (v2) sender.
 *
 * Transport: AWS SES v2 "SendEmail" over HTTPS, signed with Signature V4.
 * We use the HTTPS API (not SMTP) because it uses the same outbound-HTTPS
 * path that already works on shared hosting, and needs no SDK.
 *
 * Required .env keys:
 *   AWS_SES_REGION            e.g. eu-west-1  (or af-south-1)
 *   AWS_SES_ACCESS_KEY_ID
 *   AWS_SES_SECRET_ACCESS_KEY
 *   MAIL_FROM_EMAIL           a verified SES sender/domain, e.g. no-reply@joblynk.co.za
 *   MAIL_FROM_NAME            optional display name (defaults to APP_NAME)
 *   AWS_SES_CONFIGURATION_SET optional, for open/click/bounce tracking
 */

require_once __DIR__ . '/env.php';

// Shared app identity (previously defined in resend.php).
if (!defined('APP_URL'))  define('APP_URL', env('APP_URL', 'http://localhost'));
if (!defined('APP_NAME')) define('APP_NAME', env('APP_NAME', 'Joblynk'));

define('AWS_SES_REGION', env('AWS_SES_REGION', ''));
define('AWS_SES_ACCESS_KEY_ID', env('AWS_SES_ACCESS_KEY_ID', ''));
define('AWS_SES_SECRET_ACCESS_KEY', env('AWS_SES_SECRET_ACCESS_KEY', ''));
define('AWS_SES_CONFIGURATION_SET', env('AWS_SES_CONFIGURATION_SET', ''));
define('MAIL_FROM_EMAIL', env('MAIL_FROM_EMAIL', 'no-reply@joblynk.co.za'));
define('MAIL_FROM_NAME', env('MAIL_FROM_NAME', APP_NAME));

/**
 * Whether SES is configured well enough to attempt a send.
 */
function mailerIsConfigured(): bool
{
    return AWS_SES_REGION !== ''
        && AWS_SES_ACCESS_KEY_ID !== ''
        && AWS_SES_SECRET_ACCESS_KEY !== ''
        && MAIL_FROM_EMAIL !== '';
}

/**
 * Send a single HTML email via AWS SES v2.
 *
 * @param string $to      Recipient email address.
 * @param string $subject Subject line.
 * @param string $html    HTML body.
 * @param array  $opts    Optional: ['replyTo' => string, 'fromName' => string,
 *                         'headers' => ['List-Unsubscribe' => '<...>']]
 * @return bool True on a 2xx SES response.
 */
function sendEmail(string $to, string $subject, string $html, array $opts = []): bool
{
    if (!mailerIsConfigured()) {
        error_log('Mailer: AWS SES is not configured (missing region/keys/from).');
        return false;
    }
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        error_log('Mailer: refusing to send to invalid address: ' . $to);
        return false;
    }

    $region  = AWS_SES_REGION;
    $service = 'ses';
    $host    = "email.{$region}.amazonaws.com";
    $uri     = '/v2/email/outbound-emails';
    $endpoint = "https://{$host}{$uri}";

    $fromName = (string) ($opts['fromName'] ?? MAIL_FROM_NAME);
    $from = $fromName !== '' ? mailerEncodeFrom($fromName, MAIL_FROM_EMAIL) : MAIL_FROM_EMAIL;

    // Custom headers (e.g. List-Unsubscribe) require the "Raw" content type.
    $customHeaders = isset($opts['headers']) && is_array($opts['headers']) ? $opts['headers'] : [];

    $payload = [
        'FromEmailAddress' => $from,
        'Destination'      => ['ToAddresses' => [$to]],
    ];
    if (!empty($opts['replyTo'])) {
        $payload['ReplyToAddresses'] = [(string) $opts['replyTo']];
    }
    if (AWS_SES_CONFIGURATION_SET !== '') {
        $payload['ConfigurationSetName'] = AWS_SES_CONFIGURATION_SET;
    }

    if ($customHeaders) {
        $payload['Content'] = ['Raw' => ['Data' => base64_encode(
            mailerBuildRawMime($from, $to, $subject, $html, $customHeaders, $opts)
        )]];
    } else {
        $payload['Content'] = ['Simple' => [
            'Subject' => ['Data' => $subject, 'Charset' => 'UTF-8'],
            'Body'    => ['Html' => ['Data' => $html, 'Charset' => 'UTF-8']],
        ]];
    }

    $body = json_encode($payload);

    // ── Signature V4 ──
    $amzDate   = gmdate('Ymd\THis\Z');
    $dateStamp = gmdate('Ymd');
    $payloadHash = hash('sha256', $body);

    $canonicalHeaders = "content-type:application/json\nhost:{$host}\nx-amz-date:{$amzDate}\n";
    $signedHeaders    = 'content-type;host;x-amz-date';
    $canonicalRequest = "POST\n{$uri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";

    $algorithm       = 'AWS4-HMAC-SHA256';
    $credentialScope = "{$dateStamp}/{$region}/{$service}/aws4_request";
    $stringToSign    = "{$algorithm}\n{$amzDate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

    $kDate    = hash_hmac('sha256', $dateStamp, 'AWS4' . AWS_SES_SECRET_ACCESS_KEY, true);
    $kRegion  = hash_hmac('sha256', $region, $kDate, true);
    $kService = hash_hmac('sha256', $service, $kRegion, true);
    $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
    $signature = hash_hmac('sha256', $stringToSign, $kSigning);

    $authorization = "{$algorithm} Credential=" . AWS_SES_ACCESS_KEY_ID . "/{$credentialScope}, "
        . "SignedHeaders={$signedHeaders}, Signature={$signature}";

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Amz-Date: ' . $amzDate,
            'Authorization: ' . $authorization,
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) {
        error_log('Mailer SES cURL error: ' . $err);
        return false;
    }
    if ($code < 200 || $code >= 300) {
        error_log("Mailer SES send failed (HTTP {$code}): " . substr((string) $resp, 0, 500));
        return false;
    }
    return true;
}

/**
 * RFC 2047-encode a display name if it contains non-ASCII, then wrap the address.
 */
function mailerEncodeFrom(string $name, string $email): string
{
    $name = trim($name);
    if ($name === '') return $email;
    if (preg_match('/[^\x20-\x7E]/', $name)) {
        $name = '=?UTF-8?B?' . base64_encode($name) . '?=';
    } else {
        // Quote if it contains specials.
        if (preg_match('/[",<>@]/', $name)) {
            $name = '"' . str_replace('"', '\"', $name) . '"';
        }
    }
    return "{$name} <{$email}>";
}

/**
 * Build a minimal raw MIME message so we can attach custom headers
 * (e.g. List-Unsubscribe for one-click unsubscribe).
 */
function mailerBuildRawMime(string $from, string $to, string $subject, string $html, array $headers, array $opts): string
{
    $eol = "\r\n";
    $lines = [];
    $lines[] = 'From: ' . $from;
    $lines[] = 'To: ' . $to;
    if (!empty($opts['replyTo'])) $lines[] = 'Reply-To: ' . $opts['replyTo'];
    // Encode subject for UTF-8 safety.
    $encodedSubject = preg_match('/[^\x20-\x7E]/', $subject)
        ? '=?UTF-8?B?' . base64_encode($subject) . '?='
        : $subject;
    $lines[] = 'Subject: ' . $encodedSubject;
    $lines[] = 'MIME-Version: 1.0';
    foreach ($headers as $k => $v) {
        $lines[] = $k . ': ' . $v;
    }
    $lines[] = 'Content-Type: text/html; charset=UTF-8';
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = '';
    $lines[] = chunk_split(base64_encode($html), 76, $eol);

    return implode($eol, $lines);
}
