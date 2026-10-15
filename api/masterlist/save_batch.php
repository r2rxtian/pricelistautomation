<?php
declare(strict_types=1);
/**
 * Saves the price masterlist as one file: base price edits, prices typed in any number of country +
 * price level lists, and % changes (for one list, every country of a level, or picked countries),
 * all as ONE change. It waits for approval (applied on the spot for auto-approvers).
 * Body: see masterlist_build_batch() in rules/masterlist.php.
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'save', 'Your role cannot save price lists.');
requirePermission($user, 'update', 'Your role cannot change prices.');
if (!masterlist_enabled()) json_response(['ok' => false, 'message' => 'The price list needs the SQL Server storage (conn/config.php).'], 409);

$result = masterlist_build_batch(request_json());
if ($result['error'] !== null) json_response(['ok' => false, 'message' => $result['error']], 422);
$batch = $result['batch'];
[$baseCount, $ruleCount, $listCount] = masterlist_batch_counts($batch);
// In plain words: which countries / price levels, which %, which products.
$described = masterlist_batch_description($batch);
$what = $described['text'];

// Saving again while your change waits replaces it, rather than adding another.
$identity = ['name' => MASTERLIST_NAME, 'country' => '', 'priceLevel' => ''];
$base = null;
$revision = 1;
foreach (repo_list_version_summaries() as $summary) {
    if (!same_price_list($summary, $identity)) continue;
    $revision = max($revision, (int) $summary['revision'] + 1);
    if (!$base && ($summary['kind'] ?? '') === 'batch' && in_array($summary['status'], ['pending', 'rejected'], true) && ($summary['savedByUser'] ?? '') === $user['username']) $base = $summary;
}
if ($base) $revision = (int) $base['revision'];
$autoApproved = is_auto_approver($user['username']);
$now = gmdate('c');
$version = [
    'id' => $base['id'] ?? bin2hex(random_bytes(8)), 'source' => 'change', 'kind' => 'batch', 'name' => MASTERLIST_NAME, 'priceLevel' => '', 'country' => '',
    'revision' => $revision, 'status' => $autoApproved ? 'approved' : 'pending',
    'headers' => [], 'rows' => [], 'priceColumns' => [], 'adjustment' => 0.0, 'categoryAdjustments' => [],
    'summary' => ['totalProducts' => 0, 'totalAdjustedProducts' => 0, 'adjustedCategories' => [], 'what' => $what],
    'changes' => [], 'changeCount' => $baseCount + $ruleCount + $listCount, 'productCount' => 0, 'categories' => [],
    'savedAt' => $now, 'savedBy' => $user['name'], 'savedByUser' => $user['username'],
    'requiredApprovers' => approvers_for($user['username']),
    'approvals' => $autoApproved ? [['username' => $user['username'], 'name' => $user['name'], 'at' => $now, 'remarks' => 'Approved on save', 'auto' => true]] : [],
    'approvedAt' => $autoApproved ? $now : null, 'approvedBy' => $autoApproved ? $user['name'] : null,
    'rejectedAt' => null, 'rejectedBy' => null, 'rejectionRemarks' => null, 'basedOn' => MASTERLIST_ID,
    'masterlistBatch' => $batch,
];
if ($autoApproved) masterlist_apply_batch($batch, $version['id'], $user['name']);
repo_save_version($version);

$meta = ['versionId' => $version['id'], 'versionName' => MASTERLIST_NAME, 'fileName' => MASTERLIST_NAME, 'kind' => 'batch', 'revision' => $revision,
    'parts' => $described['parts'], 'lines' => $described['lines'],
    'lists' => array_map(fn($list) => "{$list['country']} · {$list['priceLevel']}", $batch['lists'])];
// One country + price level only: the log shows its flag and name like a file.
if (count($batch['lists']) === 1 && !$batch['ruleOps'] && !$batch['baseEdits']) $meta += ['country' => $batch['lists'][0]['country'], 'priceLevel' => $batch['lists'][0]['priceLevel']];
if ($autoApproved) {
    supersede_older_approved($version);
    record_audit('save_version', 'Saved price changes (approved)', "{$user['name']} saved and approved price changes: {$what}.", $meta + ['autoApproved' => true]);
    notify(usernames_with_permission('export'), 'available', 'New prices', "{$user['name']} saved and approved: {$what}. The lists are ready for export.", $version['id']);
    json_response(['ok' => true, 'message' => "Saved and approved: {$what}.", 'version' => version_for_client($user, version_summary($version))]);
}
if ($base) repo_resolve_notifications($version['id'], ['approval_request']);
record_audit('save_version', 'Price changes sent for approval', "{$user['name']} saved price changes: {$what}. Awaiting approval.", $meta);
notify($version['requiredApprovers'], 'approval_request', 'Approval needed: price changes', "{$user['name']} saved price changes ({$what}) and needs your approval.", $version['id']);
$approverNames = implode(' & ', array_map('user_display_name', $version['requiredApprovers']));
json_response(['ok' => true, 'message' => $approverNames !== '' ? "Saved and sent to {$approverNames} for approval: {$what}." : "Saved: {$what}. Awaiting approval.", 'version' => version_for_client($user, version_summary($version))]);
