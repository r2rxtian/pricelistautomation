<?php
declare(strict_types=1);
/** Renames a photo in the library. Only its display name changes: the file, folder and the product types using it stay. */
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
$name = clean_text($input['name'] ?? '', 200);
if ($name === '') json_response(['ok' => false, 'message' => 'Give the photo a name.'], 422);
if ($name === ($photo['name'] ?? '')) json_response(['ok' => true, 'photo' => $photo, 'message' => 'No change.']);
$renamed = repo_rename_library_photo($id, $name);
if (!$renamed) json_response(['ok' => false, 'message' => 'That photo is no longer in the library.'], 404);
record_audit('image_update', "Renamed photo '{$photo['name']}'", "{$user['name']} renamed a library photo from '{$photo['name']}' to '{$name}'.", ['photo' => $name, 'previousName' => $photo['name']]);
json_response(['ok' => true, 'photo' => $renamed, 'message' => "Renamed to {$name}."]);
