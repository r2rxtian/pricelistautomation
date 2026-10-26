<?php
declare(strict_types=1);
/** Uses a photo from the library for a product type (category + product group). */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product images.');

$input = request_json();
$category = clean_text($input['category'] ?? '', 120);
$groupName = clean_text($input['groupName'] ?? '', 300);
if ($category === '' || $groupName === '') json_response(['ok' => false, 'message' => 'Choose a category and product type.'], 422);

$photo = repo_get_library_photo(clean_text($input['libraryId'] ?? '', 32));
if (!$photo) json_response(['ok' => false, 'message' => 'That photo is no longer in the library.'], 404);

$record = assign_group_photo($user, $category, $groupName, $photo);
json_response(['ok' => true, 'image' => $record, 'photo' => $photo, 'message' => 'Product photo updated.']);
