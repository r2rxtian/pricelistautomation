<?php
declare(strict_types=1);
/**
 * Deletes one customer's file (Files › a price level card › the bin): its products, prices, details
 * and % changes are removed, so the customer shows "No file yet" and can get a new upload. The
 * products stay in the system for other customers. Recorded in Audit Logs as a deletion.
 * Body: { target: "list-<customerId>-<levelId>" }.
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'upload', 'Your role cannot delete price list files.');
if (!pricing_enabled()) json_response(['ok' => false, 'message' => 'The price list needs the SQL Server storage (conn/config.php).'], 409);

$target = clean_text(request_json()['target'] ?? '', 40);
$pair = pricing_parse_list_id($target);
if (!$pair || $pair[0] === 0) json_response(['ok' => false, 'message' => 'Choose the customer whose file to delete.'], 422);
[$customerId, $levelId] = $pair;
$list = pricing_list_version($customerId, $levelId);
if (!$list) json_response(['ok' => false, 'message' => 'That customer is no longer in Config. Refresh and try again.'], 409);
$for = pricing_list_name($list);
if (!pricing_list_prices($customerId, $levelId)) json_response(['ok' => false, 'message' => "{$for} has no file to delete."], 409);

// A saved change for this customer still waits: deciding on it first keeps it from landing on nothing.
foreach (repo_list_version_summaries() as $summary) {
    if (($summary['kind'] ?? '') !== 'batch' || $summary['status'] !== 'pending') continue;
    foreach (pricing_batch_scopes(repo_get_version($summary['id'])['masterlistBatch'] ?? []) as $scope) {
        if ($scope['countryId'] === $customerId && ($scope['levelId'] === null || $scope['levelId'] === $levelId)) {
            json_response(['ok' => false, 'message' => "A price change for {$for} is waiting for approval. Approve or reject it first, then delete the file."], 409);
        }
    }
}

$versionId = bin2hex(random_bytes(8));
$removed = pricing_delete_list($customerId, $levelId, $versionId);

// Its upload records are no longer the live file (Files stops showing them as the last upload).
$fileNames = [];
foreach (repo_list_version_summaries() as $summary) {
    if (($summary['source'] ?? '') !== 'upload' || ($summary['kind'] ?? '') !== 'list' || $summary['status'] !== 'uploaded') continue;
    if (!same_price_list($summary, ['name' => PRICE_LIST_NAME, 'country' => $list['country'], 'priceLevel' => $list['priceLevel']])) continue;
    $upload = repo_get_version($summary['id']);
    if (!$upload) continue;
    if (!empty($upload['sourceFile'])) $fileNames[] = $upload['sourceFile'];
    $upload['status'] = 'superseded';
    repo_save_version($upload);
}

$file = $fileNames ? ' (' . $fileNames[0] . ')' : '';
record_audit('delete_version', "Deleted the file for {$for}",
    "{$user['name']} deleted the file for {$for}{$file}: {$removed} product" . ($removed === 1 ? '' : 's') . ' and their prices were removed from this customer.', [
    'versionId' => $versionId, 'versionName' => PRICE_LIST_NAME, 'fileName' => $fileNames[0] ?? PRICE_LIST_NAME, 'kind' => 'list',
    'country' => $list['country'], 'priceLevel' => $list['priceLevel'], 'rowCount' => $removed,
]);
json_response(['ok' => true, 'message' => "Deleted the file for {$for}.", 'removed' => $removed]);
