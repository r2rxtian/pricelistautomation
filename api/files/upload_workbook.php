<?php
declare(strict_types=1);
/**
 * Uploads a price list workbook, in two steps with the same file:
 *   1. without `confirm`: checks the workbook and returns a preview of what it would change;
 *   2. with `confirm` = that preview's fingerprint: applies it (only while the preview is still the
 *      same, so nothing changed in between).
 * `target` says what the file is for (Requirements 17Oct2026: choose the price level, then the customer):
 * list-<customerId>-<levelId>, one customer. Every file is one customer's price list; the price level
 * only groups customers. The customer's list becomes exactly the file (products, details and prices).
 * Like file uploads, it is live at once (no approval).
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'upload', 'Your role cannot upload price lists.');
if (!pricing_enabled()) json_response(['ok' => false, 'message' => 'The price list needs the SQL Server storage (conn/config.php).'], 409);
if (count($_FILES) !== 1 || !isset($_FILES['workbook']) || !is_array($_FILES['workbook'])) {
    json_response(['ok' => false, 'message' => 'Upload one official .xlsx workbook.'], 422);
}
$target = clean_text($_POST['target'] ?? '', 40);
$pair = pricing_parse_list_id($target);
// One customer only: a file for a whole price level (customer 0) or the standard prices is not taken.
if (!$pair || $pair[0] === 0) json_response(['ok' => false, 'message' => 'Choose the price level, then the customer this file is for.'], 422);
$list = $pair ? pricing_list_version($pair[0], $pair[1]) : null;
if ($pair && !$list) json_response(['ok' => false, 'message' => 'That price level or customer is no longer in Config. Refresh and choose again.'], 409);

try {
    $import = import_official_uploaded_workbook($_FILES['workbook'], '', '');
} catch (WorkbookTemplateException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage(), 'problems' => $error->problems], 422);
}

$preview = ($pair ? pricing_preview_list($import, $pair[0], $pair[1]) : pricing_preview_masterlist($import)) + ['fileName' => $import['sourceFile']];
$fingerprint = hash('sha256', json_encode($preview));
$counts = $preview['counts'];
$changes = $counts['added'] + ($counts['removed'] ?? 0) + $counts['priceChanges'] + ($counts['detailChanges'] ?? 0) + ($counts['reordered'] ?? 0);
$confirm = (string) ($_POST['confirm'] ?? '');
if ($confirm !== $fingerprint) {
    // A confirm with an older fingerprint: something changed since the preview, so show the new one.
    json_response(['ok' => true, 'preview' => $preview, 'fingerprint' => $fingerprint, 'changeCount' => $changes, 'stale' => $confirm !== '']);
}
if (!$changes) json_response(['ok' => false, 'message' => 'This file has no changes: every product and price is already the same.'], 422);

$versionId = bin2hex(random_bytes(8));
$records = $pair ? pricing_apply_list($import, $pair[0], $pair[1], $versionId, $user['name']) : pricing_apply_masterlist($import, $versionId);
$live = $pair ? pricing_list_version($pair[0], $pair[1]) : pricing_base_version();

// The upload's record (history, audit and notifications), with the prices as they are now.
$customer = $pair ? (string) $list['country'] : '';
$level = $pair ? (string) $list['priceLevel'] : '';
$identity = ['name' => PRICE_LIST_NAME, 'country' => $customer, 'priceLevel' => $level];
$revision = 1;
foreach (repo_list_version_summaries() as $summary) if (same_price_list($summary, $identity)) $revision = max($revision, (int) $summary['revision'] + 1);
$categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $live['rows'])));
$version = [
    'id' => $versionId, 'source' => 'upload', 'kind' => $pair ? 'list' : 'masterlist', 'name' => PRICE_LIST_NAME, 'priceLevel' => $level, 'country' => $customer,
    'revision' => $revision, 'status' => 'uploaded',
    'headers' => $live['headers'], 'rows' => $live['rows'], 'priceColumns' => PRICE_COLUMNS,
    'adjustment' => 0.0, 'categoryAdjustments' => [],
    'summary' => ['totalProducts' => count($live['rows']), 'totalAdjustedProducts' => 0, 'adjustedCategories' => []],
    'changes' => [], 'changeCount' => count($records), 'productCount' => count($live['rows']), 'categories' => $categories,
    'savedAt' => gmdate('c'), 'savedBy' => $user['name'], 'savedByUser' => $user['username'],
    'requiredApprovers' => [], 'approvals' => [], 'approvedAt' => null, 'approvedBy' => null,
    'rejectedAt' => null, 'rejectedBy' => null, 'rejectionRemarks' => null,
    'basedOn' => $pair ? $list['id'] : STANDARD_PRICES_ID, 'templateVersion' => $import['templateVersion'],
    'uploadSummary' => $counts, 'sourceFile' => $import['sourceFile'],
];
repo_save_version($version);
supersede_older_approved($version);

$what = implode(', ', array_filter([
    $counts['added'] ? "{$counts['added']} added" : '', ($counts['removed'] ?? 0) ? "{$counts['removed']} removed" : '',
    $counts['priceChanges'] ? "{$counts['priceChanges']} new prices" : '', ($counts['reordered'] ?? 0) ? 'new order' : '', ($counts['detailChanges'] ?? 0) ? "{$counts['detailChanges']} with new details" : '',
]));
if ($pair) {
    $for = pricing_list_name($list);
    $title = "Uploaded prices for {$for}";
    $details = "{$user['name']} uploaded the prices for {$for} ({$import['sourceFile']}): {$preview['products']} products; {$what}.";
    $message = "Prices for {$for} updated: {$what}.";
} else {
    $title = $preview['first'] ? 'Uploaded the price list' : 'Uploaded an updated price list';
    $details = "{$user['name']} uploaded the price list ({$import['sourceFile']}): {$preview['products']} products; {$what}.";
    $message = "Price list updated: {$what}.";
}
record_audit('import_workbook', $title, $details, [
    'versionId' => $versionId, 'versionName' => PRICE_LIST_NAME, 'fileName' => PRICE_LIST_NAME, 'revision' => $revision, 'kind' => $pair ? 'list' : 'masterlist',
    'country' => $customer, 'priceLevel' => $level,
    'rowCount' => $preview['products'], 'counts' => $counts, 'sourceFile' => $import['sourceFile'], 'templateVersion' => $import['templateVersion'],
]);
notify(usernames_with_permission('export'), 'available', $title, "{$details} The prices are live and can be exported.", $versionId);
json_response(['ok' => true, 'active' => version_for_client($user, $live), 'message' => $message, 'changeCount' => count($records)]);
