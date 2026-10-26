<?php
declare(strict_types=1);
/** Checks an export is allowed (uploaded files and approved changes only), logs it, and returns the rows. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'export', 'Your role cannot export price lists.');

$data = request_json();
$format = in_array($data['format'] ?? '', ['excel', 'pdf'], true) ? $data['format'] : null;
if (!$format) json_response(['ok' => false, 'message' => 'Choose Excel or PDF.'], 422);
$version = find_open_version($user, clean_text($data['id'] ?? '', 32));
if (!is_exportable($version)) {
    json_response(['ok' => false, 'message' => 'Only uploaded files and approved price changes can be exported.'], 403);
}
$scope = clean_text($data['scope'] ?? '', 200);
record_audit('export_' . $format, "Exported '{$version['name']}' to " . ($format === 'pdf' ? 'PDF' : 'Excel'),
    "{$user['name']} exported " . version_label($version) . ($scope !== '' ? " ({$scope})" : '') . '.', [
        'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'format' => $format, 'scope' => $scope,
    ]);
json_response(['ok' => true, 'version' => $version]);
