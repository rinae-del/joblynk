<?php
/**
 * Profile API
 * GET  /api/profile/index.php   — Get current user's profile
 * POST /api/profile/index.php   — Update current user's profile
 */

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

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
} catch (Exception $e) {
    // Columns likely already exist — ignore
}

// ── GET: return profile ──
if ($method === 'GET') {
    $stmt = $pdo->prepare('
        SELECT id, first_name, last_name, email, phone, location,
               bio, job_title, linkedin, portfolio, skills,
               id_number, dob, gender, citizenship,
               street_address, city, province, postal_code, country
        FROM users WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    $user['skills'] = json_decode($user['skills'], true) ?: [];

    jsonResponse(['success' => true, 'profile' => $user]);
}

// ── POST: update profile ──
if ($method === 'POST') {
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
