<?php
/**
 * Paystack Configuration
 */

require_once __DIR__ . '/env.php';

define('PAYSTACK_SECRET_KEY', env('PAYSTACK_SECRET_KEY', ''));
define('PAYSTACK_PUBLIC_KEY', env('PAYSTACK_PUBLIC_KEY', ''));

