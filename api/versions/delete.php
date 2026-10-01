<?php
declare(strict_types=1);
/** Deletes a saved version. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'update', 'Only price list administrators can delete saved versions.');

$version = repo_get_version(clean_text(request_json()['id'] ?? '', 32));
if (!$version || !repo_delete_version($version['id'])) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
record_audit('delete_version', "Deleted '{$version['name']}'", "{$user['name']} deleted " . version_label($version) . " ({$version['status']}).", [
    'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'],
]);
json_response(['ok' => true, 'message' => 'Saved version deleted.']);
