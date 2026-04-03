<?php
/**
 * Secure session bootstrap.
 * Call this instead of bare session_start() in every API endpoint.
 */

require_once __DIR__ . '/env.php';

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
            || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

    session_set_cookie_params([
        'lifetime' => 0,            // session cookie (until browser close)
        'path'     => '/',           // available across the whole site
        'domain'   => '',            // current domain only
        'secure'   => $isHttps,      // only over HTTPS when available
        'httponly'  => true,          // prevent JS access
        'samesite'  => 'Lax',        // allow normal navigations, block cross-site POSTs
    ]);

    session_name('JOBLYNK_SESS');    // unique name avoids collisions with other apps on shared hosting

    session_start();
}
