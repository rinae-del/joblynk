<?php
/**
 * PayFast Configuration
 */

require_once __DIR__ . '/env.php';

define('PAYFAST_MERCHANT_ID', env('PAYFAST_MERCHANT_ID', ''));
define('PAYFAST_MERCHANT_KEY', env('PAYFAST_MERCHANT_KEY', ''));
define('PAYFAST_PASSPHRASE', env('PAYFAST_PASSPHRASE', ''));
define('PAYFAST_SANDBOX', (bool) env('PAYFAST_SANDBOX', '0'));

// PayFast URL
define('PAYFAST_URL', PAYFAST_SANDBOX 
    ? 'https://sandbox.payfast.co.za/eng/process' 
    : 'https://www.payfast.co.za/eng/process');

// PayFast validation URL
define('PAYFAST_VALIDATE_URL', PAYFAST_SANDBOX 
    ? 'https://sandbox.payfast.co.za/eng/query/validate' 
    : 'https://www.payfast.co.za/eng/query/validate');

/**
 * PayFast requires urlencode with uppercase percent escapes.
 */
function payfastUrlEncode(string $value): string
{
    return strtoupper(urlencode($value));
}

/**
 * Build an ordered PayFast parameter string.
 */
function buildPayFastParameterString(
    array $data,
    bool $skipBlankValues = true,
    bool $stopAtSignature = false,
    bool $trimValues = true
): string {
    $parameterString = '';

    foreach ($data as $key => $value) {
        if ($stopAtSignature && $key === 'signature') {
            break;
        }

        if (!$stopAtSignature && $key === 'signature') {
            continue;
        }

        $stringValue = (string) $value;

        if ($skipBlankValues && $stringValue === '') {
            continue;
        }

        $encodedValue = payfastUrlEncode($trimValues ? trim($stringValue) : $stringValue);
        $parameterString .= $key . '=' . $encodedValue . '&';
    }

    return rtrim($parameterString, '&');
}

/**
 * Build the PayFast signature from an ordered field list.
 */
function buildPayFastItnParameterString(array $data): string
{
    $payload = $data;
    unset($payload['signature']);

    $parts = [];
    foreach ($payload as $key => $value) {
        $stringValue = trim((string) $value);
        if ($stringValue === '') {
            continue;
        }
        $parts[$key] = $key . '=' . payfastUrlEncode($stringValue);
    }

    ksort($parts, SORT_STRING);
    return implode('&', $parts);
}

function generatePayFastSignature(array $data, ?string $passphrase = null): string {
    $signatureString = buildPayFastParameterString($data);

    if ($passphrase !== null && trim($passphrase) !== '') {
        $signatureString .= '&passphrase=' . payfastUrlEncode(trim($passphrase));
    }

    return md5($signatureString);
}
