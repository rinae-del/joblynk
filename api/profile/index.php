<?php
/**
 * Profile API
 * GET  /api/profile/index.php   — Get current user's profile
 * POST /api/profile/index.php   — Update current user's profile
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

function isLocalAvatarPath(string $path): bool
{
    $normalized = str_replace('\\', '/', ltrim($path, '/\\'));
    return strpos($normalized, 'uploads/avatars/') === 0;
}

function deleteLocalAvatarFile(?string $path): void
{
    if (!$path || !isLocalAvatarPath($path)) {
        return;
    }

    $filePath = __DIR__ . '/../../' . str_replace('\\', '/', ltrim($path, '/\\'));
    if (is_file($filePath)) {
        @unlink($filePath);
    }
}

function fetchProfile(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('
        SELECT id, first_name, last_name, email, phone, location,
               bio, job_title, linkedin, portfolio, skills,
               id_number, dob, gender, citizenship,
               street_address, city, province, postal_code, country,
               avatar_url
        FROM users WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    $user['skills'] = json_decode($user['skills'], true) ?: [];

    return $user;
}

function storeAvatarUpload(array $file, int $userId): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        jsonResponse(['success' => false, 'message' => 'Please choose an image to upload.'], 422);
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'Avatar upload failed.'], 422);
    }

    $maxSize = 5 * 1024 * 1024;
    if (($file['size'] ?? 0) > $maxSize) {
        jsonResponse(['success' => false, 'message' => 'Profile photo must be smaller than 5MB.'], 422);
    }

    $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        jsonResponse(['success' => false, 'message' => 'Allowed image types: JPG, PNG, WEBP.'], 422);
    }

    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowedMimes, true)) {
        jsonResponse(['success' => false, 'message' => 'Invalid image file.'], 422);
    }

    $avatarDir = __DIR__ . '/../../uploads/avatars';
    if (!is_dir($avatarDir)) {
        mkdir($avatarDir, 0755, true);
    }

    $storedName = 'avatar_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destination = $avatarDir . '/' . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        jsonResponse(['success' => false, 'message' => 'Failed to save profile photo.'], 500);
    }

    return [
        'avatar_url' => 'uploads/avatars/' . $storedName,
        'mime_type' => $mime,
    ];
}

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$userId = $_SESSION['user_id'];
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── Ensure profile columns exist (adds them if missing) ──
// These columns extend the users table for profile data.
// On first run they'll be created; subsequent calls find them already there.
try {
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'phone'")->fetch();
    if (!$cols) {
        $pdo->exec("ALTER TABLE users
            ADD COLUMN phone VARCHAR(30) DEFAULT '' AFTER email,
            ADD COLUMN location VARCHAR(255) DEFAULT '' AFTER phone,
            ADD COLUMN bio TEXT AFTER location,
            ADD COLUMN job_title VARCHAR(255) DEFAULT '' AFTER bio,
            ADD COLUMN linkedin VARCHAR(255) DEFAULT '' AFTER job_title,
            ADD COLUMN portfolio VARCHAR(255) DEFAULT '' AFTER linkedin,
            ADD COLUMN skills JSON AFTER portfolio
        ");
    }
    // Add identity & address columns if missing
    $idCol = $pdo->query("SHOW COLUMNS FROM users LIKE 'id_number'")->fetch();
    if (!$idCol) {
        $pdo->exec("ALTER TABLE users
            ADD COLUMN id_number VARCHAR(13) DEFAULT '' AFTER skills,
            ADD COLUMN dob DATE NULL AFTER id_number,
            ADD COLUMN gender VARCHAR(20) DEFAULT '' AFTER dob,
            ADD COLUMN citizenship VARCHAR(30) DEFAULT '' AFTER gender,
            ADD COLUMN street_address VARCHAR(255) DEFAULT '' AFTER citizenship,
            ADD COLUMN city VARCHAR(100) DEFAULT '' AFTER street_address,
            ADD COLUMN province VARCHAR(50) DEFAULT '' AFTER city,
            ADD COLUMN postal_code VARCHAR(10) DEFAULT '' AFTER province,
            ADD COLUMN country VARCHAR(50) DEFAULT 'South Africa' AFTER postal_code
        ");
    }
    $avatarCol = $pdo->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->fetch();
    if (!$avatarCol) {
        $countryCol = $pdo->query("SHOW COLUMNS FROM users LIKE 'country'")->fetch();
        $position = $countryCol ? 'AFTER country' : 'AFTER updated_at';
        $pdo->exec("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT '' {$position}");
    }
} catch (Throwable $e) {
    // Columns likely already exist — ignore
}

// ── GET: return profile ──
if ($method === 'GET') {
    $user = fetchProfile($pdo, $userId);

    jsonResponse(['success' => true, 'profile' => $user]);
}

// ── POST: update profile ──
if ($method === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $isMultipart = stripos($contentType, 'multipart/form-data') !== false;

    if ($isMultipart && isset($_FILES['avatar'])) {
        $currentProfile = fetchProfile($pdo, $userId);
        $avatarUpload = storeAvatarUpload($_FILES['avatar'], $userId);

        $stmt = $pdo->prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
        $stmt->execute([$avatarUpload['avatar_url'], $userId]);

        deleteLocalAvatarFile($currentProfile['avatar_url'] ?? '');

        $updatedProfile = fetchProfile($pdo, $userId);
        jsonResponse([
            'success' => true,
            'message' => 'Profile picture updated.',
            'avatar_url' => $updatedProfile['avatar_url'] ?? '',
            'profile' => $updatedProfile,
        ]);
    }

    $body = getJsonBody();

    $firstName  = trim($body['firstName'] ?? $body['first_name'] ?? '');
    $lastName   = trim($body['lastName'] ?? $body['last_name'] ?? '');
    $phone      = trim($body['phone'] ?? '');
    $location   = trim($body['location'] ?? '');
    $bio        = trim($body['bio'] ?? '');
    $jobTitle   = trim($body['jobTitle'] ?? $body['job_title'] ?? '');
    $linkedin   = trim($body['linkedin'] ?? '');
    $portfolio  = trim($body['portfolio'] ?? '');
    $skills     = $body['skills'] ?? [];

    // Identity & address fields
    $idNumber       = preg_replace('/\D/', '', trim($body['idNumber'] ?? $body['id_number'] ?? ''));
    $dob            = trim($body['dob'] ?? '');
    $gender         = trim($body['gender'] ?? '');
    $citizenship    = trim($body['citizenship'] ?? '');
    $streetAddress  = trim($body['streetAddress'] ?? $body['street_address'] ?? '');
    $city           = trim($body['city'] ?? '');
    $province       = trim($body['province'] ?? '');
    $postalCode     = preg_replace('/\D/', '', trim($body['postalCode'] ?? $body['postal_code'] ?? ''));
    $country        = trim($body['country'] ?? 'South Africa');

    if (!$firstName) {
        jsonResponse(['success' => false, 'message' => 'First name is required.'], 422);
    }

    // Server-side SA ID validation
    if ($idNumber !== '' && strlen($idNumber) !== 13) {
        jsonResponse(['success' => false, 'message' => 'SA ID number must be exactly 13 digits.'], 422);
    }
    if ($idNumber !== '' && strlen($idNumber) === 13) {
        // Validate date
        $yy = (int)substr($idNumber, 0, 2);
        $mm = (int)substr($idNumber, 2, 2);
        $dd = (int)substr($idNumber, 4, 2);
        $currentYY = (int)date('y');
        $fullYear = ($yy <= $currentYY) ? 2000 + $yy : 1900 + $yy;

        if ($mm < 1 || $mm > 12 || $dd < 1 || $dd > cal_days_in_month(CAL_GREGORIAN, $mm, $fullYear)) {
            jsonResponse(['success' => false, 'message' => 'Invalid date in SA ID number.'], 422);
        }

        // Luhn check
        $sum = 0;
        for ($i = 0; $i < 13; $i++) {
            $d = (int)$idNumber[$i];
            if ($i % 2 === 1) {
                $d *= 2;
                if ($d > 9) $d -= 9;
            }
            $sum += $d;
        }
        if ($sum % 10 !== 0) {
            jsonResponse(['success' => false, 'message' => 'Invalid SA ID number (checksum failed).'], 422);
        }

        // Auto-derive gender, citizenship, dob from ID
        $genderSeq = (int)substr($idNumber, 6, 4);
        $gender = $genderSeq >= 5000 ? 'Male' : 'Female';
        $citizenDigit = (int)$idNumber[10];
        $citizenship = $citizenDigit === 0 ? 'SA Citizen' : 'Permanent Resident';
        $dob = $fullYear . '-' . str_pad($mm, 2, '0', STR_PAD_LEFT) . '-' . str_pad($dd, 2, '0', STR_PAD_LEFT);
    }

    // Sanitize province against allowed values
    $allowedProvinces = ['', 'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
                         'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
    if (!in_array($province, $allowedProvinces, true)) {
        $province = '';
    }

    $skillsJson = json_encode(is_array($skills) ? $skills : []);

    $stmt = $pdo->prepare('
        UPDATE users SET
            first_name = ?, last_name = ?, phone = ?, location = ?,
            bio = ?, job_title = ?, linkedin = ?, portfolio = ?, skills = ?,
            id_number = ?, dob = ?, gender = ?, citizenship = ?,
            street_address = ?, city = ?, province = ?, postal_code = ?, country = ?
        WHERE id = ?
    ');
    $stmt->execute([
        $firstName, $lastName, $phone, $location,
        $bio, $jobTitle, $linkedin, $portfolio, $skillsJson,
        $idNumber, $dob ?: null, $gender, $citizenship,
        $streetAddress, $city, $province, $postalCode, $country,
        $userId
    ]);

    // Update session name so auth-guard reflects the change immediately
    $_SESSION['user_name'] = trim($firstName . ' ' . $lastName);

    jsonResponse(['success' => true, 'message' => 'Profile updated.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
