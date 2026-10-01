<?php
declare(strict_types=1);
/** Rejects a pending price list; a reason is required and is sent to the submitter. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'approve', 'Your role cannot approve price lists.');

$data = request_json();
$version = find_reviewable_version($user, clean_text($data['id'] ?? '', 32));
$remarks = clean_text($data['remarks'] ?? '', 500);
if ($remarks === '') json_response(['ok' => false, 'message' => 'Enter the reason for rejecting this price list.'], 422);
$label = version_label($version);
$submitter = (string) ($version['savedByUser'] ?? '');

$version['status'] = 'rejected';
$version['rejectedAt'] = gmdate('c');
$version['rejectedBy'] = $user['name'];
$version['rejectionRemarks'] = $remarks;
repo_save_version($version);
record_audit('reject_version', "Rejected '{$version['name']}'", "{$user['name']} rejected {$label}: {$remarks}", [
    'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'remarks' => $remarks,
]);
notify([$submitter], 'rejected', "Rejected: {$version['name']}", "{$user['name']} rejected {$label}. Reason: {$remarks}", $version['id']);
json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => 'Price list rejected. The submitter has been notified.']);
