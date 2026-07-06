<?php
/**
 * Deprecated: email now sends via AWS SES.
 * Kept as a shim so existing `require_once .../config/resend.php` calls
 * (job.php, sitemap.php) still resolve APP_URL / APP_NAME and the mailer.
 */

require_once __DIR__ . '/mailer.php';
