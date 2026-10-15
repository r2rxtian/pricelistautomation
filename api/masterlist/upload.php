<?php
declare(strict_types=1);
/**
 * Uploads the price list workbook (every product, its details and standard prices), in two steps with
 * the same file:
 *   1. without `confirm`: checks the workbook and returns a preview of what it would change;
 *   2. with `confirm` = that preview's fingerprint: applies it (only while the preview is still the
 *      same, so nothing changed in between).
 * Every country and price level follows the new prices, except prices set by hand for one of them.
 * Like file uploads, it is live at once (no approval).
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'upload', 'Your role cannot upload price lists.');
if (!masterlist_enabled()) json_response(['ok' => false, 'message' => 'The price list needs the SQL Server storage (conn/config.php).'], 409);
if (count($_FILES) !== 1 || !isset($_FILES['workbook']) || !is_array($_FILES['workbook'])) {
    json_response(['ok' => false, 'message' => 'Upload one official .xlsx workbook.'], 422);
}

try {
    $import = import_official_uploaded_workbook($_FILES['workbook'], '', '');
} catch (WorkbookTemplateException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage(), 'problems' => $error->problems], 422);
}

$preview = masterlist_preview_masterlist($import) + ['fileName' => $import['sourceFile']];
$fingerprint = hash('sha256', json_encode($preview));
$counts = $preview['counts'];
$changes = $counts['added'] + $counts['removed'] + $counts['priceChanges'] + $counts['detailChanges'];
$confirm = (string) ($_POST['confirm'] ?? '');
if ($confirm !== $fingerprint) {
    // A confirm with an older fingerprint: something changed since the preview, so show the new one.
    json_response(['ok' => true, 'preview' => $preview, 'fingerprint' => $fingerprint, 'changeCount' => $changes, 'stale' => $confirm !== '']);
}
if (!$changes) json_response(['ok' => false, 'message' => 'This file has no changes: every product and price is already the same.'], 422);

$versionId = bin2hex(random_bytes(8));
$records = masterlist_apply_masterlist($import, $versionId);
$live = masterlist_base_version();

// The upload's record (history, audit and notifications), with the prices as they are now.
$identity = ['name' => MASTERLIST_NAME, 'country' => '', 'priceLevel' => ''];
$revision = 1;
foreach (repo_list_version_summaries() as $summary) if (same_price_list($summary, $identity)) $revision = max($revision, (int) $summary['revision'] + 1);
$categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $live['rows'])));
$version = [
    'id' => $versionId, 'source' => 'upload', 'kind' => 'masterlist', 'name' => MASTERLIST_NAME, 'priceLevel' => '', 'country' => '',
    'revision' => $revision, 'status' => 'uploaded',
    'headers' => $live['headers'], 'rows' => $live['rows'], 'priceColumns' => MASTERLIST_PRICE_COLUMNS,
    'adjustment' => 0.0, 'categoryAdjustments' => [],
    'summary' => ['totalProducts' => count($live['rows']), 'totalAdjustedProducts' => 0, 'adjustedCategories' => []],
    'changes' => [], 'changeCount' => count($records), 'productCount' => count($live['rows']), 'categories' => $categories,
    'savedAt' => gmdate('c'), 'savedBy' => $user['name'], 'savedByUser' => $user['username'],
    'requiredApprovers' => [], 'approvals' => [], 'approvedAt' => null, 'approvedBy' => null,
    'rejectedAt' => null, 'rejectedBy' => null, 'rejectionRemarks' => null,
    'basedOn' => MASTERLIST_ID, 'templateVersion' => $import['templateVersion'],
    'uploadSummary' => $counts, 'sourceFile' => $import['sourceFile'],
];
repo_save_version($version);
supersede_older_approved($version);

$what = implode(', ', array_filter([
    $counts['added'] ? "{$counts['added']} added" : '', $counts['removed'] ? "{$counts['removed']} removed" : '',
    $counts['priceChanges'] ? "{$counts['priceChanges']} new prices" : '', $counts['detailChanges'] ? "{$counts['detailChanges']} with new details" : '',
]));
$title = $preview['first'] ? 'Uploaded the price list' : 'Uploaded an updated price list';
$details = "{$user['name']} uploaded the price list ({$import['sourceFile']}): {$preview['products']} products; {$what}.";
record_audit('import_workbook', $title, $details, [
    'versionId' => $versionId, 'versionName' => MASTERLIST_NAME, 'fileName' => MASTERLIST_NAME, 'revision' => $revision, 'kind' => 'masterlist',
    'rowCount' => $preview['products'], 'counts' => $counts, 'sourceFile' => $import['sourceFile'], 'templateVersion' => $import['templateVersion'],
]);
notify(usernames_with_permission('export'), 'available', $title, "{$details} The prices are live and can be exported.", $versionId);
json_response(['ok' => true, 'active' => version_for_client($user, $live), 'message' => "Price list updated: {$what}.", 'changeCount' => count($records)]);
