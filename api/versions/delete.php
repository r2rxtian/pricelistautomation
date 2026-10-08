<?php
declare(strict_types=1);
/**
 * Deletes a saved version: withdraws a pending request, discards a rejected one, or removes an
 * uploaded file nothing was built on. Approved price lists are kept (rules/workflow.php).
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'update', 'Only price list administrators can delete saved versions.');

$version = repo_get_version(clean_text(request_json()['id'] ?? '', 32));
if (!$version) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
$version = normalize_version($version);
$blocked = version_delete_block($version);
if ($blocked !== null) json_response(['ok' => false, 'message' => $blocked], 409);
if (!repo_delete_version($version['id'])) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);

$withdrawn = $version['status'] === 'pending';
record_audit('delete_version', ($withdrawn ? 'Withdrew' : 'Deleted') . " '{$version['name']}'",
    "{$user['name']} " . ($withdrawn ? 'withdrew the approval request for ' : 'deleted ') . version_label($version) . " ({$version['status']}).", [
    'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'status' => $version['status'],
]);
json_response(['ok' => true, 'message' => $withdrawn ? 'Approval request withdrawn.' : 'Saved version deleted.']);
