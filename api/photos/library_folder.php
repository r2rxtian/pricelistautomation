<?php
declare(strict_types=1);
/** Creates a reusable category folder, including an empty folder. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product photos.');

try {
    $category = normalize_library_category(request_json()['category'] ?? '');
    if ($category === '') throw new InvalidArgumentException('Enter a category name for the folder.');
} catch (InvalidArgumentException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
}
$folder = repo_add_library_folder($category);
record_audit('image_update', "Created photo folder '{$folder}'", "{$user['name']} added a category folder to the photo library.", ['folder' => $folder]);
json_response(['ok' => true, 'folder' => $folder, 'message' => 'Photo folder ready.']);
