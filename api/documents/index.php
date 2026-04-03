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

session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

setCorsHeaders();

// Auth check
if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
}

$userId = $_SESSION['user_id'];
$userRole = $_SESSION['user_role'] ?? 'job_seeker';
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

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
            SELECT a.cv_id, a.cl_id FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.id = ? AND j.user_id = ?
        ');
        $stmt->execute([$appId, $userId]);
        $application = $stmt->fetch();

        if (!$application) {
            jsonResponse(['success' => false, 'message' => 'Application not found or not authorized.'], 404);
        }

        // Ensure the requested doc is either the CV or CL from this application
        if ((int)$docId !== (int)$application['cv_id'] && (int)$docId !== (int)$application['cl_id']) {
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
    if ($type && in_array($type, ['cv', 'cl'])) {
        $stmt = $pdo->prepare('SELECT id, doc_type, name, accent_color, created_at, updated_at FROM documents WHERE user_id = ? AND doc_type = ? ORDER BY updated_at DESC');
        $stmt->execute([$userId, $type]);
    } else {
        $stmt = $pdo->prepare('SELECT id, doc_type, name, accent_color, created_at, updated_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC');
        $stmt->execute([$userId]);
    }

    $docs = $stmt->fetchAll();
    jsonResponse(['success' => true, 'documents' => $docs]);
}

// ═══════════════════════════
// POST — Create or update
// ═══════════════════════════
if ($method === 'POST') {
    $body = getJsonBody();

    $docId      = $body['id'] ?? null;
    $docType    = $body['doc_type'] ?? 'cv';
    $name       = trim($body['name'] ?? 'Untitled');
    $accentColor = $body['accent_color'] ?? '#3B4BA6';
    $data       = $body['data'] ?? null;

    if (!in_array($docType, ['cv', 'cl'])) {
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

    $stmt = $pdo->prepare('DELETE FROM documents WHERE id = ? AND user_id = ?');
    $stmt->execute([$docId, $userId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'Document not found.'], 404);
    }

    jsonResponse(['success' => true, 'message' => 'Document deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
