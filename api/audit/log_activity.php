<?php
declare(strict_types=1);
/** Editor activity the browser reports itself (CLIENT_AUDIT_TYPES: uploads read, price adjustments, cell edits, resets). */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'update');

$data = request_json();
$type = clean_text($data['type'] ?? '', 40);
if (!in_array($type, CLIENT_AUDIT_TYPES, true)) json_response(['ok' => false, 'message' => 'Unknown activity type.'], 422);
$metadata = [];
foreach (is_array($data['metadata'] ?? null) ? $data['metadata'] : [] as $key => $value) {
    $key = clean_text((string) $key, 40);
    if ($key === '') continue;
    $metadata[$key] = is_array($value)
        ? array_slice(array_map(fn($v) => is_scalar($v) ? clean_text($v, 200) : '', $value), 0, 100)
        : (is_bool($value) || is_int($value) || is_float($value) ? $value : clean_text($value, 300));
}
$log = record_audit($type, clean_text($data['title'] ?? 'Price list activity', 300), clean_text($data['details'] ?? '', 1000), $metadata);
json_response(['ok' => true, 'log' => $log]);
