<?php
declare(strict_types=1);
/** Removes the custom photo of a product type. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/photos.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage product images.');

$key = clean_text(request_json()['key'] ?? '', 64);
if (!preg_match('/^[a-f0-9]{64}$/', $key)) {
    json_response(['ok' => false, 'message' => 'Invalid product image key.'], 422);
}
$record = repo_delete_image($key);
if (!$record) json_response(['ok' => false, 'message' => 'Custom image not found.'], 404);
delete_managed_group_image((string) ($record['imagePath'] ?? ''));
record_audit('image_delete', "Removed photo for '" . ($record['groupName'] ?? 'product type') . "'", "{$user['name']} removed a custom product type photo.", [
    'category' => $record['category'] ?? '', 'groupName' => $record['groupName'] ?? '',
]);
json_response(['ok' => true, 'message' => 'Custom photo removed successfully.']);
