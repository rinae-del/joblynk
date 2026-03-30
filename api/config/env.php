<?php
/**
 * Simple .env file loader.
 * Parses KEY=VALUE lines and sets them as environment variables.
 */
function loadEnv(string $path): void {
    if (!file_exists($path)) return;

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;

        $eqPos = strpos($line, '=');
        if ($eqPos === false) continue;

        $key   = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));

        // Remove surrounding quotes (preserve special chars inside)
        if (strlen($value) >= 2) {
            if (($value[0] === '"' && $value[-1] === '"') || 
                ($value[0] === "'" && $value[-1] === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        // Only convert unquoted string booleans
        $lowerVal = strtolower($value);
        if ($lowerVal === 'true') $value = '1';
        if ($lowerVal === 'false') $value = '0';

        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// Auto-load .env from project root (try multiple possible locations)
$envPaths = [
    __DIR__ . '/../../.env',           // standard: api/config/ -> root
    $_SERVER['DOCUMENT_ROOT'] . '/.env', // webroot
    dirname($_SERVER['DOCUMENT_ROOT']) . '/.env', // one level above webroot
];
foreach ($envPaths as $envPath) {
    if (file_exists($envPath)) {
        loadEnv($envPath);
        break;
    }
}

/**
 * Get an environment variable with an optional default.
 */
function env(string $key, ?string $default = null): ?string {
    if (isset($_ENV[$key])) return $_ENV[$key];
    $val = getenv($key);
    return $val !== false ? $val : $default;
}
