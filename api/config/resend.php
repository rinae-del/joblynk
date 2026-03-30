<?php
/**
 * Resend Email Configuration
 */

require_once __DIR__ . '/env.php';

define('RESEND_API_KEY', env('RESEND_API_KEY', ''));
define('RESEND_FROM_EMAIL', env('RESEND_FROM_EMAIL', 'Joblynk <onboarding@resend.dev>'));
define('APP_URL', env('APP_URL', 'http://localhost'));
define('APP_NAME', env('APP_NAME', 'Joblynk'));
