<?php
/**
 * Adzuna Jobs API client (South Africa: country code za).
 */

require_once __DIR__ . '/../config/env.php';

class AdzunaClient
{
    private string $appId;
    private string $appKey;
    private string $baseUrl = 'https://api.adzuna.com/v1/api';
    private int $requestCount = 0;
    private float $lastRequestAt = 0;

    public function __construct(?string $appId = null, ?string $appKey = null)
    {
        $this->appId = $appId ?? (string) env('ADZUNA_APP_ID', '');
        $this->appKey = $appKey ?? (string) env('ADZUNA_APP_KEY', '');
    }

    public function isConfigured(): bool
    {
        return $this->appId !== '' && $this->appKey !== '';
    }

    public function getRequestCount(): int
    {
        return $this->requestCount;
    }

    /**
     * @return array{results: array, count: int}
     */
    public function search(array $params = []): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Adzuna API credentials are not configured.');
        }

        $country = $params['country'] ?? 'za';
        $page = max(1, (int) ($params['page'] ?? 1));
        $query = [
            'app_id' => $this->appId,
            'app_key' => $this->appKey,
            'results_per_page' => min(50, max(1, (int) ($params['results_per_page'] ?? 50))),
            'content-type' => 'application/json',
        ];

        $optional = [
            'what' => $params['what'] ?? null,
            'where' => $params['where'] ?? null,
            'category' => $params['category'] ?? null,
            'max_days_old' => $params['max_days_old'] ?? null,
            'sort_by' => $params['sort_by'] ?? 'date',
            'salary_min' => $params['salary_min'] ?? null,
            'full_time' => $params['full_time'] ?? null,
            'part_time' => $params['part_time'] ?? null,
            'contract' => $params['contract'] ?? null,
            'permanent' => $params['permanent'] ?? null,
        ];

        foreach ($optional as $key => $value) {
            if ($value !== null && $value !== '') {
                $query[$key] = $value;
            }
        }

        $url = $this->baseUrl . '/jobs/' . rawurlencode($country) . '/search/' . $page . '?' . http_build_query($query);
        $this->throttle();

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);

        $body = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $this->requestCount++;

        if ($body === false) {
            throw new RuntimeException('Adzuna request failed: ' . $error);
        }

        if ($httpCode === 429) {
            throw new RuntimeException('Adzuna rate limit exceeded.');
        }

        if ($httpCode >= 400) {
            throw new RuntimeException('Adzuna HTTP ' . $httpCode . ': ' . substr((string) $body, 0, 200));
        }

        $data = json_decode((string) $body, true);
        if (!is_array($data)) {
            throw new RuntimeException('Invalid Adzuna response.');
        }

        return [
            'results' => $data['results'] ?? [],
            'count' => (int) ($data['count'] ?? 0),
        ];
    }

    private function throttle(): void
    {
        $minInterval = 2.5;
        $elapsed = microtime(true) - $this->lastRequestAt;
        if ($elapsed < $minInterval) {
            usleep((int) (($minInterval - $elapsed) * 1000000));
        }
        $this->lastRequestAt = microtime(true);
    }
}

/**
 * Default sync query rotation for South Africa.
 *
 * @return array<int, array<string, mixed>>
 */
function adzunaDefaultSyncQueries(): array
{
    $locations = ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Remote'];
    $categories = ['it-jobs', 'accounting-finance-jobs', 'engineering-jobs', 'sales-jobs', 'healthcare-nursing-jobs'];

    $queries = [];
    foreach ($locations as $location) {
        $queries[] = ['where' => $location, 'max_days_old' => 14, 'sort_by' => 'date'];
    }
    foreach ($categories as $category) {
        $queries[] = ['category' => $category, 'max_days_old' => 14, 'sort_by' => 'date'];
    }

    return $queries;
}
