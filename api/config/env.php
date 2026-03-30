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

        // Remove surrounding quotes
        if (strlen($value) >= 2 && 
            (($value[0] === '"' && $value[-1] === '"') || 
             ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }

        // Convert string booleans
        if ($value === 'true') $value = '1';
        if ($value === 'false') $value = '0';

        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// Auto-load .env from project root
loadEnv(__DIR__ . '/../../.env');

/**
 * Get an environment variable with an optional default.
 */
function env(string $key, ?string $default = null): ?string {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}
