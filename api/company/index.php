<?php
/**
 * Company API
 * GET  /api/company/index.php   - Get current recruiter's company profile
 * POST /api/company/index.php   - Update company profile or upload logo
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

function ensureCompanyProfileColumns(PDO $pdo): void
{
    try {
        $websiteCol = $pdo->query("SHOW COLUMNS FROM companies LIKE 'website'")->fetch();
        if (!$websiteCol) {
            $pdo->exec("ALTER TABLE companies ADD COLUMN website VARCHAR(255) DEFAULT '' AFTER country");
        }

        $descriptionCol = $pdo->query("SHOW COLUMNS FROM companies LIKE 'description'")->fetch();
        if (!$descriptionCol) {
            $pdo->exec("ALTER TABLE companies ADD COLUMN description TEXT NULL AFTER website");
        }

        $logoCol = $pdo->query("SHOW COLUMNS FROM companies LIKE 'logo_url'")->fetch();
        if (!$logoCol) {
            $pdo->exec("ALTER TABLE companies ADD COLUMN logo_url VARCHAR(255) DEFAULT '' AFTER description");
        }
    } catch (Throwable $e) {
        // Ignore migration errors when columns already exist or DB permissions are limited.
    }
}

function isLocalCompanyLogoPath(string $path): bool
{
    $normalized = str_replace('\\', '/', ltrim($path, '/\\'));
    return strpos($normalized, 'uploads/company-logos/') === 0;
}

function deleteLocalCompanyLogoFile(?string $path): void
{
    if (!$path || !isLocalCompanyLogoPath($path)) {
        return;
    }

    $filePath = __DIR__ . '/../../' . str_replace('\\', '/', ltrim($path, '/\\'));
    if (is_file($filePath)) {
        @unlink($filePath);
    }
}

function fetchCompanyProfile(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('
        SELECT
            u.company_id,
            c.id,
            c.name,
            c.industry,
            c.size,
            c.vat_number,
            c.address_line1,
            c.address_line2,
            c.city,
            c.province,
            c.postal_code,
            c.country,
            c.website,
            c.description,
            c.logo_url
        FROM users u
        LEFT JOIN companies c ON c.id = u.company_id
        WHERE u.id = ?
        LIMIT 1
    ');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    return [
        'id' => isset($row['id']) ? (int) $row['id'] : null,
        'company_id' => isset($row['company_id']) ? (int) $row['company_id'] : null,
        'name' => $row['name'] ?? '',
        'industry' => $row['industry'] ?? '',
        'size' => $row['size'] ?? '',
        'vat_number' => $row['vat_number'] ?? '',
        'address_line1' => $row['address_line1'] ?? '',
        'address_line2' => $row['address_line2'] ?? '',
        'city' => $row['city'] ?? '',
        'province' => $row['province'] ?? '',
        'postal_code' => $row['postal_code'] ?? '',
        'country' => $row['country'] ?? 'South Africa',
        'website' => $row['website'] ?? '',
        'description' => $row['description'] ?? '',
        'logo_url' => $row['logo_url'] ?? '',
    ];
}

function createCompanyProfile(PDO $pdo, int $userId, array $data): int
{
    $stmt = $pdo->prepare('
        INSERT INTO companies (
            name, industry, size, vat_number, address_line1, address_line2,
            city, province, postal_code, country, website, description, logo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $data['name'],
        $data['industry'],
        $data['size'],
        $data['vat_number'],
        $data['address_line1'],
        $data['address_line2'],
        $data['city'],
        $data['province'],
        $data['postal_code'],
        $data['country'],
        $data['website'],
        $data['description'],
        $data['logo_url'],
    ]);

    $companyId = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('UPDATE users SET company_id = ? WHERE id = ?');
    $stmt->execute([$companyId, $userId]);

    return $companyId;
}

function storeCompanyLogoUpload(array $file, int $companyId): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        jsonResponse(['success' => false, 'message' => 'Please choose a company logo to upload.'], 422);
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'Company logo upload failed.'], 422);
    }

    $maxSize = 5 * 1024 * 1024;
    if (($file['size'] ?? 0) > $maxSize) {
        jsonResponse(['success' => false, 'message' => 'Company logo must be smaller than 5MB.'], 422);
    }

    $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        jsonResponse(['success' => false, 'message' => 'Allowed logo types: JPG, PNG, WEBP.'], 422);
    }

    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowedMimes, true)) {
        jsonResponse(['success' => false, 'message' => 'Invalid image file.'], 422);
    }

    $logoDir = __DIR__ . '/../../uploads/company-logos';
    if (!is_dir($logoDir)) {
        mkdir($logoDir, 0755, true);
    }

    $storedName = 'company_' . $companyId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destination = $logoDir . '/' . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        jsonResponse(['success' => false, 'message' => 'Failed to save company logo.'], 500);
    }

    return [
        'logo_url' => 'uploads/company-logos/' . $storedName,
        'mime_type' => $mime,
    ];
}

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$userId = (int) $_SESSION['user_id'];
$userRole = $_SESSION['user_role'] ?? '';
if ($userRole !== 'recruiter' && $userRole !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Only recruiters can update company information.'], 403);
}

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];
ensureCompanyProfileColumns($pdo);

if ($method === 'GET') {
    jsonResponse(['success' => true, 'company' => fetchCompanyProfile($pdo, $userId)]);
}

if ($method === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $isMultipart = stripos($contentType, 'multipart/form-data') !== false;

    if ($isMultipart && isset($_FILES['logo'])) {
        $company = fetchCompanyProfile($pdo, $userId);
        if (empty($company['company_id'])) {
            jsonResponse(['success' => false, 'message' => 'Save company details before uploading a logo.'], 422);
        }

        $upload = storeCompanyLogoUpload($_FILES['logo'], (int) $company['company_id']);
        $stmt = $pdo->prepare('UPDATE companies SET logo_url = ? WHERE id = ?');
        $stmt->execute([$upload['logo_url'], $company['company_id']]);
        deleteLocalCompanyLogoFile($company['logo_url'] ?? '');

        jsonResponse([
            'success' => true,
            'message' => 'Company logo updated.',
            'logo_url' => $upload['logo_url'],
            'company' => fetchCompanyProfile($pdo, $userId),
        ]);
    }

    $body = getJsonBody();

    $name = trim($body['name'] ?? $body['companyName'] ?? '');
    $industry = trim($body['industry'] ?? '');
    $size = trim($body['size'] ?? $body['companySize'] ?? '');
    $vatNumber = trim($body['vatNumber'] ?? $body['vat_number'] ?? '');
    $addressLine1 = trim($body['addressLine1'] ?? $body['address_line1'] ?? '');
    $addressLine2 = trim($body['addressLine2'] ?? $body['address_line2'] ?? '');
    $city = trim($body['city'] ?? '');
    $province = trim($body['province'] ?? '');
    $postalCode = trim($body['postalCode'] ?? $body['postal_code'] ?? '');
    $country = trim($body['country'] ?? 'South Africa');
    $website = trim($body['website'] ?? '');
    $description = trim($body['description'] ?? '');

    if ($name === '') {
        jsonResponse(['success' => false, 'message' => 'Company name is required.'], 422);
    }

    if ($website !== '' && !filter_var($website, FILTER_VALIDATE_URL)) {
        jsonResponse(['success' => false, 'message' => 'Please enter a valid website URL.'], 422);
    }

    $allowedProvinces = ['', 'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
    if (!in_array($province, $allowedProvinces, true)) {
        $province = '';
    }

    $company = fetchCompanyProfile($pdo, $userId);
    $companyData = [
        'name' => $name,
        'industry' => $industry,
        'size' => $size,
        'vat_number' => $vatNumber,
        'address_line1' => $addressLine1,
        'address_line2' => $addressLine2,
        'city' => $city,
        'province' => $province,
        'postal_code' => $postalCode,
        'country' => $country ?: 'South Africa',
        'website' => $website,
        'description' => $description,
        'logo_url' => $company['logo_url'] ?? '',
    ];

    if (!empty($company['company_id'])) {
        $stmt = $pdo->prepare('
            UPDATE companies SET
                name = ?, industry = ?, size = ?, vat_number = ?,
                address_line1 = ?, address_line2 = ?, city = ?, province = ?,
                postal_code = ?, country = ?, website = ?, description = ?
            WHERE id = ?
        ');
        $stmt->execute([
            $companyData['name'],
            $companyData['industry'],
            $companyData['size'],
            $companyData['vat_number'],
            $companyData['address_line1'],
            $companyData['address_line2'],
            $companyData['city'],
            $companyData['province'],
            $companyData['postal_code'],
            $companyData['country'],
            $companyData['website'],
            $companyData['description'],
            $company['company_id'],
        ]);
    } else {
        createCompanyProfile($pdo, $userId, $companyData);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Company details saved.',
        'company' => fetchCompanyProfile($pdo, $userId),
    ]);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);