<?php
/**
 * Notification / email-preference engine.
 *
 * Consent model: OPT-OUT. Every category is on by default; a row in
 * `email_preferences` with enabled=0 means the user unsubscribed.
 * The `account` category is transactional and cannot be turned off.
 *
 * Sends flow through sendUserEmail(), which:
 *   - honours the user's preference (skips + logs if opted out),
 *   - de-duplicates via an optional dedup key (for reminders/digests),
 *   - injects an unsubscribe footer + List-Unsubscribe header,
 *   - records every attempt in `email_log`.
 */

require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/helpers.php';

/**
 * Category metadata. `optional=false` categories are transactional and
 * are always delivered (and are hidden from the unsubscribe UI).
 */
function emailCategories(): array
{
    return [
        'account'             => ['label' => 'Account & security',        'optional' => false],
        'application_updates' => ['label' => 'Application updates',        'optional' => true],
        'reminders'           => ['label' => 'Application reminders',      'optional' => true],
        'recommendations'     => ['label' => 'Recommended jobs for you',   'optional' => true],
        'marketing'           => ['label' => 'News & product updates',     'optional' => true],
    ];
}

function isValidEmailCategory(string $category): bool
{
    return array_key_exists($category, emailCategories());
}

function ensureEmailSchema(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    try {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS `email_preferences` (
                `user_id` INT NOT NULL,
                `category` VARCHAR(40) NOT NULL,
                `enabled` TINYINT(1) NOT NULL DEFAULT 1,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`user_id`, `category`),
                FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS `email_log` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NULL,
                `email` VARCHAR(191) NOT NULL,
                `category` VARCHAR(40) NOT NULL,
                `subject` VARCHAR(255) NOT NULL DEFAULT '',
                `dedup_key` VARCHAR(191) NULL,
                `status` ENUM('sent','failed','skipped') NOT NULL DEFAULT 'sent',
                `error` VARCHAR(255) NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_email_log_dedup` (`dedup_key`),
                INDEX `idx_email_log_user_cat` (`user_id`, `category`, `created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    } catch (Throwable $e) {
        error_log('ensureEmailSchema failed: ' . $e->getMessage());
    }
    $done = true;
}

/** Whether the user wants a given category (opt-out; transactional always true). */
function userWantsEmail(PDO $pdo, int $userId, string $category): bool
{
    $meta = emailCategories()[$category] ?? null;
    if ($meta && $meta['optional'] === false) return true; // transactional
    try {
        $stmt = $pdo->prepare('SELECT enabled FROM email_preferences WHERE user_id = ? AND category = ?');
        $stmt->execute([$userId, $category]);
        $row = $stmt->fetch();
        if ($row === false) return true; // no row = default on
        return (int) $row['enabled'] === 1;
    } catch (Throwable $e) {
        return true; // fail open for non-critical read
    }
}

/** All preferences for a user, defaulted to on where no row exists. */
function getEmailPreferences(PDO $pdo, int $userId): array
{
    $set = [];
    try {
        $stmt = $pdo->prepare('SELECT category, enabled FROM email_preferences WHERE user_id = ?');
        $stmt->execute([$userId]);
        foreach ($stmt->fetchAll() as $r) $set[$r['category']] = (int) $r['enabled'] === 1;
    } catch (Throwable $e) {
        // ignore; treat as all-default
    }
    $out = [];
    foreach (emailCategories() as $key => $meta) {
        $out[$key] = [
            'label'    => $meta['label'],
            'optional' => $meta['optional'],
            'enabled'  => $meta['optional'] === false ? true : ($set[$key] ?? true),
        ];
    }
    return $out;
}

function setEmailPreference(PDO $pdo, int $userId, string $category, bool $enabled): bool
{
    $meta = emailCategories()[$category] ?? null;
    if (!$meta || $meta['optional'] === false) return false; // can't change transactional
    ensureEmailSchema($pdo);
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO email_preferences (user_id, category, enabled) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)'
        );
        $stmt->execute([$userId, $category, $enabled ? 1 : 0]);
        return true;
    } catch (Throwable $e) {
        error_log('setEmailPreference failed: ' . $e->getMessage());
        return false;
    }
}

/** Secret for signing unsubscribe links. Set MAIL_SECRET in .env for production. */
function mailSecret(): string
{
    $s = (string) env('MAIL_SECRET', '');
    return $s !== '' ? $s : ('joblynk-mail:' . APP_URL);
}

function unsubscribeToken(int $userId, string $category): string
{
    return hash_hmac('sha256', $userId . ':' . $category, mailSecret());
}

function verifyUnsubscribeToken(int $userId, string $category, string $token): bool
{
    return hash_equals(unsubscribeToken($userId, $category), $token);
}

function unsubscribeUrl(int $userId, string $category): string
{
    return rtrim(APP_URL, '/') . '/api/notifications/unsubscribe.php?u=' . $userId
        . '&c=' . urlencode($category) . '&t=' . unsubscribeToken($userId, $category);
}

function preferencesUrl(): string
{
    return rtrim(APP_URL, '/') . '/notification-settings.html';
}

/** Has an email with this dedup key already been sent successfully? */
function emailAlreadySent(PDO $pdo, string $dedupKey): bool
{
    if ($dedupKey === '') return false;
    try {
        $stmt = $pdo->prepare("SELECT 1 FROM email_log WHERE dedup_key = ? AND status = 'sent' LIMIT 1");
        $stmt->execute([$dedupKey]);
        return (bool) $stmt->fetch();
    } catch (Throwable $e) {
        return false;
    }
}

function logEmail(PDO $pdo, ?int $userId, string $email, string $category, string $subject, string $status, ?string $dedupKey = null, ?string $error = null): void
{
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO email_log (user_id, email, category, subject, dedup_key, status, error)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $email, $category, substr($subject, 0, 255), $dedupKey, $status, $error ? substr($error, 0, 255) : null]);
    } catch (Throwable $e) {
        error_log('logEmail failed: ' . $e->getMessage());
    }
}

/**
 * Send a category email to a user, honouring preferences + dedup + logging.
 *
 * @param array $user   Must include 'id' and 'email' (optionally 'first_name').
 * @param string $fullHtml  A full HTML email (already wrapped via buildEmailTemplate()).
 * @param array $opts   ['dedupKey' => string, 'replyTo' => string]
 * @return string 'sent' | 'skipped' | 'failed'
 */
function sendUserEmail(PDO $pdo, array $user, string $category, string $subject, string $fullHtml, array $opts = []): string
{
    ensureEmailSchema($pdo);
    $userId = (int) ($user['id'] ?? 0);
    $email  = (string) ($user['email'] ?? '');
    $dedupKey = (string) ($opts['dedupKey'] ?? '');

    if ($email === '') return 'failed';
    if (!isValidEmailCategory($category)) $category = 'marketing';

    if (!userWantsEmail($pdo, $userId, $category)) {
        logEmail($pdo, $userId, $email, $category, $subject, 'skipped', $dedupKey ?: null, 'opted_out');
        return 'skipped';
    }
    if ($dedupKey !== '' && emailAlreadySent($pdo, $dedupKey)) {
        return 'skipped';
    }

    $meta = emailCategories()[$category];
    $sendOpts = [];
    if (!empty($opts['replyTo'])) $sendOpts['replyTo'] = $opts['replyTo'];

    if ($meta['optional']) {
        $unsubUrl = unsubscribeUrl($userId, $category);
        $fullHtml = injectUnsubscribeFooter($fullHtml, $unsubUrl, $meta['label']);
        $sendOpts['headers'] = [
            'List-Unsubscribe' => '<' . $unsubUrl . '>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ];
    }

    $ok = sendEmail($email, $subject, $fullHtml, $sendOpts);
    logEmail($pdo, $userId, $email, $category, $subject, $ok ? 'sent' : 'failed', $dedupKey ?: null, $ok ? null : 'ses_error');
    return $ok ? 'sent' : 'failed';
}

/** Inject a small unsubscribe line just before </body>. */
function injectUnsubscribeFooter(string $html, string $unsubUrl, string $categoryLabel): string
{
    $safeUrl = htmlspecialchars($unsubUrl, ENT_QUOTES, 'UTF-8');
    $prefs = htmlspecialchars(preferencesUrl(), ENT_QUOTES, 'UTF-8');
    $label = htmlspecialchars($categoryLabel, ENT_QUOTES, 'UTF-8');
    $footer = '<div style="max-width:580px;margin:14px auto 28px;padding:0 18px;text-align:center;font-family:Arial,sans-serif;">'
        . '<p style="margin:0;font-size:12px;line-height:1.6;color:#94A3B8;">'
        . 'You are receiving “' . $label . '” emails from ' . htmlspecialchars(APP_NAME, ENT_QUOTES) . '. '
        . '<a href="' . $safeUrl . '" style="color:#64748B;text-decoration:underline;">Unsubscribe</a> · '
        . '<a href="' . $prefs . '" style="color:#64748B;text-decoration:underline;">Email preferences</a>'
        . '</p></div>';

    if (stripos($html, '</body>') !== false) {
        return preg_replace('#</body>#i', $footer . '</body>', $html, 1);
    }
    return $html . $footer;
}
