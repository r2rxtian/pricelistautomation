<?php
declare(strict_types=1);
/** Moves a photo between logical folders without changing its file or assignments. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product photos.');
$input = request_json();
$id = clean_text($input['id'] ?? '', 32);
$photo = repo_get_library_photo($id);
if (!$photo) json_response(['ok' => false, 'message' => 'Photo not found.'], 404);
try {
    $category = normalize_library_category($input['category'] ?? '');
} catch (InvalidArgumentException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
}
if ($category !== '') $category = repo_add_library_folder($category);
$moved = repo_move_library_photo($id, $category);
if (!$moved) json_response(['ok' => false, 'message' => 'That photo is no longer in the library.'], 404);
$folder = $category !== '' ? $category : 'Unfiled';
record_audit('image_update', "Moved photo '{$photo['name']}'", "{$user['name']} moved a library photo to {$folder}.", ['photo' => $photo['name'], 'fromFolder' => $photo['category'] ?? '', 'folder' => $category]);
json_response(['ok' => true, 'photo' => $moved, 'message' => "Photo moved to {$folder}."]);
