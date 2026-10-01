<?php
declare(strict_types=1);
/** Uploads a photo for a product type; the file also goes into the library so it can be reused. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product images.');

$category = clean_text($_POST['category'] ?? '', 120);
$groupName = clean_text($_POST['groupName'] ?? '', 300);
if ($category === '' || $groupName === '') json_response(['ok' => false, 'message' => 'Choose a category and product type.'], 422);

$files = normalize_uploaded_files($_FILES['image'] ?? null);
if (!$files) json_response(['ok' => false, 'message' => 'Choose a valid image file.'], 422);
try {
    $photo = store_library_photo($files[0], $user);
} catch (InvalidArgumentException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
}

$record = assign_group_photo($user, $category, $groupName, $photo);
json_response(['ok' => true, 'image' => $record, 'photo' => $photo, 'message' => 'Product photo updated.']);
