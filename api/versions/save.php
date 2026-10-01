<?php
declare(strict_types=1);
/**
 * Saves a price list.
 *   kind = 'upload' – a new file as uploaded: stored with its original prices, live at once, no approval.
 *   otherwise       – price changes: pending until approved (instantly approved for auto-approvers).
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'save', 'Your role cannot save price lists.');

$data = request_json();
$name = clean_text($data['name'] ?? '', 160);
$priceLevelInput = clean_text($data['priceLevel'] ?? '', 120);
$countryInput = clean_text($data['country'] ?? '', 120);
if ($name === '' || $priceLevelInput === '' || $countryInput === '') {
    json_response(['ok' => false, 'message' => 'Enter the price list name, price level, and country.'], 422);
}
// Countries come from the configured list, so "philippines" and "Philippines" are the same record.
$country = canonical_country($countryInput);
if ($country === null) {
    json_response(['ok' => false, 'message' => "\"{$countryInput}\" is not in the country list. Choose a country from the dropdown."], 422);
}
// Price levels are numbered (Price Level 1, 2, …).
$priceLevel = canonical_price_level($priceLevelInput);
if ($priceLevel === null) {
    json_response(['ok' => false, 'message' => "\"{$priceLevelInput}\" is not a valid price level. Choose Price Level 1 to " . count(PRICE_LEVELS) . '.'], 422);
}

$headers = $data['headers'] ?? [];
$rows = $data['rows'] ?? [];
$priceColumns = $data['priceColumns'] ?? [];
if (!is_array($headers) || !is_array($rows) || !is_array($priceColumns) || !$rows || count($rows) > 15000) {
    json_response(['ok' => false, 'message' => 'The imported workbook data is invalid or too large.'], 422);
}
$headers = array_map(fn($value) => clean_text($value, 120), array_slice(array_values($headers), 0, 80));
$width = count($headers);
$adjustment = clean_number($data['adjustment'] ?? 0, -100, 10000);
if ($width === 0 || $adjustment === null) {
    json_response(['ok' => false, 'message' => 'Check the headers and percentage.'], 422);
}
$priceColumns = array_values(array_unique(array_filter(array_map('intval', $priceColumns), fn($i) => $i >= 0 && $i < $width)));
if (!$priceColumns) json_response(['ok' => false, 'message' => 'No price columns were detected.'], 422);

$categoryAdjustments = [];
foreach (is_array($data['categoryAdjustments'] ?? null) ? $data['categoryAdjustments'] : [] as $category => $value) {
    $key = clean_text((string) $category, 120);
    $number = clean_number($value, -100, 10000);
    if ($key !== '' && $number !== null) $categoryAdjustments[$key] = $number;
}

$cleanRows = [];
$categories = [];
foreach ($rows as $row) {
    if (!is_array($row)) continue;
    $clean = [];
    for ($i = 0; $i < $width; $i++) {
        $value = $row[$i] ?? '';
        $clean[] = (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value) && in_array($i, $priceColumns, true)))
            ? (float) $value
            : clean_text($value, 500);
    }
    $cleanRows[] = $clean;
    if ($clean[0] !== '') $categories[(string) $clean[0]] = ($categories[(string) $clean[0]] ?? 0) + 1;
}

$adjustedCategories = [];
$adjustedProducts = 0;
foreach ($categories as $category => $count) {
    $rate = $categoryAdjustments[$category] ?? $adjustment;
    if ((float) $rate !== 0.0) {
        $adjustedCategories[] = ['category' => $category, 'adjustment' => $rate, 'productCount' => $count];
        $adjustedProducts += $count;
    }
}

$changes = [];
foreach (array_slice(is_array($data['changes'] ?? null) ? $data['changes'] : [], 0, 1000) as $change) {
    if (!is_array($change)) continue;
    $changes[] = [
        'code' => clean_text($change['code'] ?? '', 80),
        'product' => clean_text($change['product'] ?? '', 200),
        'category' => clean_text($change['category'] ?? '', 120),
        'column' => clean_text($change['column'] ?? '', 120),
        'oldValue' => clean_text($change['oldValue'] ?? '', 200),
        'newValue' => clean_text($change['newValue'] ?? '', 200),
    ];
}

$summaries = repo_list_version_summaries();
// Same price list = same name, country and price level (one country can have several price levels).
$identity = ['name' => $name, 'country' => $country, 'priceLevel' => $priceLevel];
$sameName = array_values(array_filter($summaries, fn($v) => same_price_list($v, $identity)));

// Uploads are stored as-is (original prices) and need no approval; only later price changes do.
if (($data['kind'] ?? '') === 'upload') {
    $revision = 1;
    foreach ($sameName as $summary) $revision = max($revision, (int) $summary['revision'] + 1);
    $version = [
        'id' => bin2hex(random_bytes(8)),
        'source' => 'upload',
        'name' => $name,
        'priceLevel' => $priceLevel,
        'country' => $country,
        'revision' => $revision,
        'status' => 'uploaded',
        'headers' => $headers,
        'rows' => $cleanRows,
        'priceColumns' => $priceColumns,
        'adjustment' => 0.0,
        'categoryAdjustments' => [],
        'summary' => ['totalProducts' => count($cleanRows), 'totalAdjustedProducts' => 0, 'adjustedCategories' => []],
        'changes' => [],
        'changeCount' => 0,
        'productCount' => count($cleanRows),
        'categories' => array_keys($categories),
        'savedAt' => gmdate('c'),
        'savedBy' => $user['name'],
        'savedByUser' => $user['username'],
        'requiredApprovers' => [],
        'approvals' => [],
        'approvedAt' => null,
        'approvedBy' => null,
        'rejectedAt' => null,
        'rejectedBy' => null,
        'rejectionRemarks' => null,
        'basedOn' => null,
    ];
    repo_save_version($version);
    supersede_older_approved($version);
    $label = version_label($version);
    record_audit('import_workbook', "Uploaded '{$name}'", "{$user['name']} uploaded {$label}: " . count($cleanRows) . ' products across ' . count($categories) . ' categories.', [
        'versionId' => $version['id'], 'versionName' => $name, 'fileName' => $name, 'revision' => $revision,
        'priceLevel' => $priceLevel, 'country' => $country, 'rowCount' => count($cleanRows), 'categoryCount' => count($categories),
        'sourceFile' => clean_text($data['sourceFile'] ?? '', 200),
    ]);
    notify(usernames_with_permission('export'), 'available', "New price list: {$name}", "{$user['name']} uploaded {$label}. It is available to open and export.", $version['id']);
    json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => "Uploaded {$name}."]);
}

// Price changes: update an unapproved change in place, or open a new revision for approval.
$targetId = clean_text($data['id'] ?? '', 32);
$base = null;
foreach ($summaries as $summary) {
    if ($targetId !== '' && $summary['id'] === $targetId) $base = $summary;
}
if (!$base && $sameName) $base = $sameName[0];

$inPlace = $base && in_array($base['status'], ['pending', 'rejected'], true);
$revision = 1;
foreach ($sameName as $summary) $revision = max($revision, (int) $summary['revision'] + ($inPlace ? 0 : 1));
if ($inPlace) $revision = (int) $base['revision'];

$version = [
    'id' => $inPlace ? $base['id'] : bin2hex(random_bytes(8)),
    'source' => 'change',
    'name' => $name,
    'priceLevel' => $priceLevel,
    'country' => $country,
    'revision' => $revision,
    'status' => 'pending',
    'headers' => $headers,
    'rows' => $cleanRows,
    'priceColumns' => $priceColumns,
    'adjustment' => $adjustment,
    'categoryAdjustments' => $categoryAdjustments,
    'summary' => [
        'totalProducts' => count($cleanRows),
        'totalAdjustedProducts' => $adjustedProducts,
        'adjustedCategories' => $adjustedCategories,
    ],
    'changes' => $changes,
    'changeCount' => count($changes),
    'productCount' => count($cleanRows),
    'categories' => array_keys($categories),
    'savedAt' => gmdate('c'),
    'savedBy' => $user['name'],
    'savedByUser' => $user['username'],
    'requiredApprovers' => approvers_for($user['username']),
    'approvals' => [],
    'approvedAt' => null,
    'approvedBy' => null,
    'rejectedAt' => null,
    'rejectedBy' => null,
    'rejectionRemarks' => null,
    'basedOn' => $base['id'] ?? null,
];
// Top approvers (e.g. Ms. Gen) publish directly: their saves are approved on the spot.
$autoApproved = is_auto_approver($user['username']);
if ($autoApproved) {
    $version['status'] = 'approved';
    $version['approvals'] = [['username' => $user['username'], 'name' => $user['name'], 'at' => gmdate('c'), 'remarks' => 'Approved on save', 'auto' => true]];
    $version['approvedAt'] = gmdate('c');
    $version['approvedBy'] = $user['name'];
}
repo_save_version($version);
if ($autoApproved) supersede_older_approved($version);

$label = version_label($version);
$adjustText = $adjustedCategories
    ? implode(', ', array_map(fn($c) => "{$c['category']} " . ($c['adjustment'] > 0 ? '+' : '') . "{$c['adjustment']}%", $adjustedCategories))
    : 'original prices';
$auditMeta = [
    'versionId' => $version['id'], 'versionName' => $name, 'fileName' => $name, 'revision' => $revision,
    'priceLevel' => $priceLevel, 'country' => $country, 'adjustedCategories' => $adjustedCategories,
    'changeCount' => count($changes), 'approvers' => array_map('user_display_name', $version['requiredApprovers']),
];

if ($autoApproved) {
    record_audit('save_version', "Saved '{$name}' (approved)", "{$label} saved and approved by {$user['name']} with {$adjustText}; " . count($changes) . ' cell edit(s). Available for export.', $auditMeta + ['autoApproved' => true]);
    notify(usernames_with_permission('export'), 'available', "Ready for export: {$name}", "{$user['name']} saved and approved {$label}. It is available for export.", $version['id']);
    json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => 'Saved and approved. It is ready for export.']);
}

record_audit('save_version', "Saved '{$name}' for approval", "{$label} saved by {$user['name']} with {$adjustText}; " . count($changes) . ' cell edit(s). Awaiting approval.', $auditMeta);
notify($version['requiredApprovers'], 'approval_request', "Approval needed: {$name}",
    "{$user['name']} saved {$label} and needs your approval before it can be exported.", $version['id']);

$approverNames = implode(' & ', array_map('user_display_name', $version['requiredApprovers']));
json_response([
    'ok' => true,
    'active' => version_for_client($user, $version),
    'message' => $approverNames !== '' ? "Saved and sent to {$approverNames} for approval." : 'Saved. Awaiting approval.',
]);
