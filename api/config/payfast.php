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
