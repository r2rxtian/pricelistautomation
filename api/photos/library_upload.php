<?php
declare(strict_types=1);
/** Adds up to 40 photos to the photo library (multipart field images[]). */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product photos.');

$files = normalize_uploaded_files($_FILES['images'] ?? null);
if (!$files) json_response(['ok' => false, 'message' => 'Choose one or more JPG, PNG, or WebP images.'], 422);
if (count($files) > 40) json_response(['ok' => false, 'message' => 'Upload at most 40 photos at a time.'], 422);
$added = [];
$errors = [];
foreach ($files as $file) {
    try {
        $added[] = store_library_photo($file, $user);
    } catch (InvalidArgumentException $error) {
        $errors[] = ($file['name'] ?? 'Image') . ': ' . $error->getMessage();
    }
}
if ($added) {
    record_audit('image_update', 'Added ' . count($added) . ' photo' . (count($added) === 1 ? '' : 's') . ' to the library',
        "{$user['name']} uploaded " . implode(', ', array_map(fn($p) => $p['name'], array_slice($added, 0, 10))) . (count($added) > 10 ? '…' : '') . '.',
        ['count' => count($added)]);
}
$message = $added ? count($added) . ' photo' . (count($added) === 1 ? '' : 's') . ' added to the library.' : 'No photos were added.';
if ($errors) $message .= ' ' . count($errors) . ' skipped.';
json_response(['ok' => (bool) $added, 'photos' => $added, 'errors' => $errors, 'message' => $message], $added ? 200 : 422);
