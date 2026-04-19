<?php
/**
 * /api/documents/index.php
 * CRUD API for user documents (CVs & Cover Letters)
 * 
 * GET    — List all docs for the logged-in user (optional ?type=cv|cl)
 * GET    ?id=123 — Get a single document
 * POST   — Create or update a document
 * DELETE ?id=123 — Delete a document
 */

require_once __DIR__ . '/../config/session.php';
startSecureSession();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

function ensureDocumentsSchema(PDO $pdo): void
{
    try {
        $docTypeColumn = $pdo->query("SHOW COLUMNS FROM documents LIKE 'doc_type'")->fetch();
        if ($docTypeColumn && strpos((string)$docTypeColumn['Type'], "'supporting'") === false) {
            $pdo->exec("ALTER TABLE documents MODIFY COLUMN doc_type ENUM('cv', 'cl', 'supporting') NOT NULL");
        }
    } catch (Throwable $e) {
        // Ignore schema migration errors here; normal request handling will still run.
    }
}

function getDefaultAccentColor(string $docType): string
{
    if ($docType === 'cl') {
        return '#0F766E';
    }
    if ($docType === 'supporting') {
        return '#475569';
    }

    return '#3B4BA6';
}

function decodeDocumentData(?string $rawData): array
{
    $decoded = json_decode($rawData ?? 'null', true);
    return is_array($decoded) ? $decoded : [];
}

function buildDocumentSummary(array $doc): array
{
    $data = decodeDocumentData($doc['data'] ?? null);

    return [
        'id' => (int)$doc['id'],
        'doc_type' => $doc['doc_type'],
        'name' => $doc['name'],
        'accent_color' => $doc['accent_color'],
        'created_at' => $doc['created_at'],
        'updated_at' => $doc['updated_at'],
        'has_uploaded_file' => !empty($data['uploaded_file']),
        'original_name' => $data['original_name'] ?? null,
        'mime_type' => $data['mime_type'] ?? null,
        'file_size' => isset($data['file_size']) ? (int)$data['file_size'] : null,
    ];
}

function getUploadRulesForType(string $docType): array
{
    $allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    $allowedExts = ['pdf', 'doc', 'docx'];

    if ($docType === 'supporting') {
        $allowedMimes = array_merge($allowedMimes, ['image/jpeg', 'image/png']);
        $allowedExts = array_merge($allowedExts, ['jpg', 'jpeg', 'png']);
    }

    return [
        'allowed_mimes' => $allowedMimes,
        'allowed_exts' => $allowedExts,
        'max_size' => 5 * 1024 * 1024,
    ];
}

function storeUploadedDocument(PDO $pdo, int $userId, string $docType, array $file, string $name = ''): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        jsonResponse(['success' => false, 'message' => 'Please choose a file to upload.'], 422);
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'File upload error.'], 422);
    }

    $rules = getUploadRulesForType($docType);

    if (($file['size'] ?? 0) > $rules['max_size']) {
        jsonResponse(['success' => false, 'message' => 'File too large. Max 5MB.'], 422);
    }

    $originalName = $file['name'] ?? 'document';
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($ext, $rules['allowed_exts'], true)) {
        jsonResponse(['success' => false, 'message' => 'Invalid file type.'], 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $rules['allowed_mimes'], true)) {
        jsonResponse(['success' => false, 'message' => 'Invalid file content type.'], 422);
    }

    $uploadsDir = __DIR__ . '/../../uploads';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }

    $baseName = pathinfo($originalName, PATHINFO_FILENAME);
    $safeBaseName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $baseName ?: 'document');
    $storedName = $docType . '_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '_' . $safeBaseName . '.' . $ext;
    $destPath = $uploadsDir . '/' . $storedName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonResponse(['success' => false, 'message' => 'Failed to save uploaded file.'], 500);
    }

    $documentName = trim($name) !== '' ? trim($name) : ($baseName ?: 'Untitled');
    $fileData = json_encode([
        'uploaded_file' => $storedName,
        'original_name' => $originalName,
        'mime_type' => $mime,
        'file_size' => (int)($file['size'] ?? 0),
    ]);

    $stmt = $pdo->prepare('INSERT INTO documents (user_id, doc_type, name, accent_color, data) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $docType, $documentName, getDefaultAccentColor($docType), $fileData]);
    $newId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare('SELECT id, doc_type, name, accent_color, data, created_at, updated_at FROM documents WHERE id = ? AND user_id = ?');
    $stmt->execute([$newId, $userId]);
    $savedDoc = $stmt->fetch();

    return buildDocumentSummary($savedDoc ?: [
        'id' => $newId,
        'doc_type' => $docType,
        'name' => $documentName,
        'accent_color' => getDefaultAccentColor($docType),
        'data' => $fileData,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
    ]);
}

// Auth check
if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$userId = $_SESSION['user_id'];
$userRole = $_SESSION['user_role'] ?? 'job_seeker';
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();
$allowedDocTypes = ['cv', 'cl', 'supporting'];

ensureDocumentsSchema($pdo);

// ═══════════════════════════
// GET — List or single doc
// ═══════════════════════════
if ($method === 'GET') {

    $docId = $_GET['id'] ?? null;
    $appId = $_GET['application_id'] ?? null;

    // Recruiter: view applicant's document via application
    if ($docId && $appId && ($userRole === 'recruiter' || $userRole === 'admin')) {
        // Verify the recruiter owns the job this application belongs to
        $stmt = $pdo->prepare('
            SELECT a.cv_id, a.cl_id, a.document_ids FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.id = ? AND j.user_id = ?
        ');
        $stmt->execute([$appId, $userId]);
        $application = $stmt->fetch();

        if (!$application) {
            jsonResponse(['success' => false, 'message' => 'Application not found or not authorized.'], 404);
        }

        $applicationDocIds = json_decode($application['document_ids'] ?? '[]', true);
        if (!is_array($applicationDocIds)) {
            $applicationDocIds = [];
        }

        $allowedDocIds = array_values(array_unique(array_map('intval', array_merge(
            [$application['cv_id'] ?? null, $application['cl_id'] ?? null],
            $applicationDocIds
        ))));

        if (!in_array((int)$docId, $allowedDocIds, true)) {
            jsonResponse(['success' => false, 'message' => 'Document does not belong to this application.'], 403);
        }

        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
        $stmt->execute([$docId]);
        $doc = $stmt->fetch();

        if (!$doc) {
            jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
        }

        $doc['data'] = json_decode($doc['data'], true);
        jsonResponse(['success' => true, 'document' => $doc]);
    }

    // Single document (own)
    if ($docId) {
        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?');
        $stmt->execute([$docId, $userId]);
        $doc = $stmt->fetch();

        if (!$doc) {
            jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
        }

        $doc['data'] = json_decode($doc['data'], true);
        jsonResponse(['success' => true, 'document' => $doc]);
    }

    // List all (optionally filter by type)
    $type = $_GET['type'] ?? null;
    $uploadedOnly = isset($_GET['uploaded']) && in_array(strtolower((string)$_GET['uploaded']), ['1', 'true', 'yes'], true);

    if ($type && in_array($type, $allowedDocTypes, true)) {
        $stmt = $pdo->prepare('SELECT id, doc_type, name, accent_color, data, created_at, updated_at FROM documents WHERE user_id = ? AND doc_type = ? ORDER BY updated_at DESC');
        $stmt->execute([$userId, $type]);
    } else {
        $stmt = $pdo->prepare('SELECT id, doc_type, name, accent_color, data, created_at, updated_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC');
        $stmt->execute([$userId]);
    }

    $docs = array_map('buildDocumentSummary', $stmt->fetchAll());
    if ($uploadedOnly) {
        $docs = array_values(array_filter($docs, static function ($doc) {
            return !empty($doc['has_uploaded_file']);
        }));
    }

    jsonResponse(['success' => true, 'documents' => $docs]);
}

// ═══════════════════════════
// POST — Create or update
// ═══════════════════════════
if ($method === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $isMultipart = stripos($contentType, 'multipart/form-data') !== false;

    if ($isMultipart) {
        $docType = $_POST['doc_type'] ?? 'supporting';
        if (!in_array($docType, $allowedDocTypes, true)) {
            jsonResponse(['success' => false, 'message' => 'Invalid document type.'], 422);
        }

        $file = $_FILES['file'] ?? null;
        if (!$file) {
            jsonResponse(['success' => false, 'message' => 'No upload was provided.'], 422);
        }

        $document = storeUploadedDocument($pdo, $userId, $docType, $file, (string)($_POST['name'] ?? ''));
        jsonResponse(['success' => true, 'document' => $document, 'message' => 'Document uploaded.'], 201);
    }

    $body = getJsonBody();

    $docId      = $body['id'] ?? null;
    $docType    = $body['doc_type'] ?? 'cv';
    $name       = trim($body['name'] ?? 'Untitled');
    $accentColor = $body['accent_color'] ?? getDefaultAccentColor($docType);
    $data       = $body['data'] ?? null;

    if (!in_array($docType, $allowedDocTypes, true)) {
        jsonResponse(['success' => false, 'message' => 'Invalid document type.'], 422);
    }

    $dataJson = $data ? json_encode($data) : null;

    if ($docId) {
        // Update existing — verify ownership
        $stmt = $pdo->prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?');
        $stmt->execute([$docId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
        }

        $stmt = $pdo->prepare('UPDATE documents SET name = ?, accent_color = ?, data = ?, updated_at = NOW() WHERE id = ? AND user_id = ?');
        $stmt->execute([$name, $accentColor, $dataJson, $docId, $userId]);

        jsonResponse(['success' => true, 'id' => (int)$docId, 'message' => 'Document updated.']);
    } else {
        // Create new
        $stmt = $pdo->prepare('INSERT INTO documents (user_id, doc_type, name, accent_color, data) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $docType, $name, $accentColor, $dataJson]);
        $newId = (int)$pdo->lastInsertId();

        jsonResponse(['success' => true, 'id' => $newId, 'message' => 'Document created.'], 201);
    }
}

// ═══════════════════════════
// DELETE — Remove a document
// ═══════════════════════════
if ($method === 'DELETE') {
    $docId = $_GET['id'] ?? null;
    if (!$docId) {
        jsonResponse(['success' => false, 'message' => 'Document ID is required.'], 422);
    }

    $stmt = $pdo->prepare('SELECT data FROM documents WHERE id = ? AND user_id = ?');
    $stmt->execute([$docId, $userId]);
    $existingDoc = $stmt->fetch();
    if (!$existingDoc) {
        jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
    }

    $stmt = $pdo->prepare('DELETE FROM documents WHERE id = ? AND user_id = ?');
    $stmt->execute([$docId, $userId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
    }

    $data = decodeDocumentData($existingDoc['data'] ?? null);
    if (!empty($data['uploaded_file'])) {
        $filePath = __DIR__ . '/../../uploads/' . basename($data['uploaded_file']);
        if (is_file($filePath)) {
            @unlink($filePath);
        }
    }

    jsonResponse(['success' => true, 'message' => 'Document deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
