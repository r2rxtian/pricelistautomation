<?php
declare(strict_types=1);
/** Deletes a library photo; product types that used it fall back to "no photo". */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product photos.');

$id = clean_text(request_json()['id'] ?? '', 32);
$photo = repo_delete_library_photo($id);
if (!$photo) json_response(['ok' => false, 'message' => 'Photo not found.'], 404);
$unassigned = 0;
foreach (repo_list_images() as $image) {
    if (($image['libraryId'] ?? '') === $id) {
        repo_delete_image((string) $image['key']);
        $unassigned++;
    }
}
delete_library_file((string) $photo['imagePath']);
record_audit('image_delete', "Deleted library photo '{$photo['name']}'", "{$user['name']} deleted a library photo" . ($unassigned ? " used by {$unassigned} product type(s)." : '.'), ['unassigned' => $unassigned]);
json_response(['ok' => true, 'unassigned' => $unassigned, 'message' => 'Photo deleted' . ($unassigned ? " and removed from {$unassigned} product type(s)." : '.')]);
